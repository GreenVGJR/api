import { Hono } from "hono";
import { getOrCreatePlayer } from "../../functions/musicPlayer.js";
import { PermissionsBitField } from "discord.js";
import { dispatch } from "../../functions/httpRequest.js";
import { activeGuildJobs, jobsByProcessId, generateProcessId, scheduleJobCleanup, AsyncJobSession } from "../../functions/discordBatchStore.js";

const app = new Hono();

app.get("/discord/modifyAllRoles", async (c) => {
	c.header("X-Route", "discord.com");

	const processIdQuery = c.req.query("processId")?.trim();

	// 1) Poll existing session by processId
	if (processIdQuery) {
		const job = jobsByProcessId.get(processIdQuery);
		if (!job) {
			return c.json({ error: "Invalid or expired processId" }, 202);
		}
		if (job.status === "awaiting") {
			return c.json({
				total: job.total,
				success: job.success,
				failed: job.failed,
				data: {
					status: "awaiting",
					process_id: job.processId,
				},
			});
		} else {
			return c.json({
				total: job.total,
				success: job.success,
				failed: job.failed,
				data: {
					status: "done",
					success: job.data.success || [],
					fail: job.data.fail || [],
				},
			});
		}
	}

	// 2) New modify roles job request
	let token: string | null = null;
	try {
		const queryToken = c.req.query("token");
		if (queryToken) {
			const checktoken = Number.isInteger(parseInt(atob(queryToken.split(".")[0])));
			if (!checktoken) throw new Error();
			token = queryToken;
		}
	} catch {}
	const guildId = c.req.query("guildId")?.trim();
	const roleIdParam = c.req.query("roleId")?.trim();
	const modeParam = c.req.query("mode")?.trim().toLowerCase();
	const typeParam = c.req.query("type")?.trim().toLowerCase() || "all";

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);
	if (!roleIdParam) return c.json({ error: "Missing valid parameter: roleId" }, 202);
	if (!modeParam || (modeParam !== "add" && modeParam !== "remove")) {
		return c.json({ error: "Missing valid parameter: mode (must be 'add' or 'remove')" }, 202);
	}
	if (typeParam !== "all" && typeParam !== "user" && typeParam !== "bot") {
		return c.json({ error: "Missing valid parameter: type (must be 'all', 'user', or 'bot')" }, 202);
	}

	// Check if this guild is already processing a request
	const existingJob = activeGuildJobs.get(guildId);
	if (existingJob && existingJob.status === "awaiting") {
		return c.json(
			{
				error: "One of your request is still processing.",
				process_id: existingJob.processId,
			},
			202,
		);
	}

	const targetRoleIds = roleIdParam
		.split(",")
		.map((r) => r.trim())
		.filter(Boolean);
	if (targetRoleIds.length === 0) {
		return c.json({ error: "Missing valid parameter: roleId" }, 202);
	}

	return await dispatch(c, async () => {
		try {
			const { client } = await getOrCreatePlayer(token);
			const guild = await client.guilds.fetch(guildId).catch(() => null);

			if (!guild) {
				return { error: "Guild not found or bot is not in the guild" };
			}

			const botMember = await guild.members.fetchMe().catch(() => null);
			if (!botMember) {
				return { error: "Could not fetch bot member in guild" };
			}

			// Check if bot has ManageRoles or Administrator
			if (!botMember.permissions.has(PermissionsBitField.Flags.Administrator) && !botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
				return {
					error: "Missing bot permissions",
					targets: roleIdParam,
					missing: "ManageRoles",
				};
			}

			// Validate that the target roles exist in the guild and bot hierarchy is sufficient
			const guildRoles = await guild.roles.fetch().catch(() => null);
			if (!guildRoles) {
				return { error: "Failed to fetch guild roles" };
			}

			const rolesToApply: any[] = [];
			const invalidRoles: string[] = [];

			for (const rId of targetRoleIds) {
				const role = guildRoles.get(rId);
				if (role) {
					rolesToApply.push(role);
				} else {
					invalidRoles.push(rId);
				}
			}

			if (invalidRoles.length > 0) {
				return { error: `Roles not found in guild: ${invalidRoles.join(", ")}` };
			}

			// Also verify bot role hierarchy (bot highest role must be higher than target roles)
			const botHighestRole = botMember.roles.highest;
			for (const role of rolesToApply) {
				if (role.position >= botHighestRole.position && guild.ownerId !== botMember.id) {
					return {
						error: "Missing bot permissions",
						targets: role.id,
						missing: `Role hierarchy: Cannot manage role '${role.name}' (${role.id}) because it is higher than or equal to bot's highest role`,
					};
				}
			}

			const members = await guild.members.fetch().catch(() => null);
			if (!members) {
				return { error: "Failed to fetch guild members" };
			}

			const targetMembers: [string, any][] = [];
			for (const [memId, member] of members) {
				if (!member) continue;
				if (typeParam === "user" && member.user?.bot) continue;
				if (typeParam === "bot" && !member.user?.bot) continue;
				targetMembers.push([memId, member]);
			}

			const totalCount = targetMembers.length;
			const processId = generateProcessId();

			const session: AsyncJobSession = {
				processId,
				guildId,
				status: "awaiting",
				total: totalCount,
				success: 0,
				failed: 0,
				data: {
					status: "awaiting",
					process_id: processId,
				},
			};

			activeGuildJobs.set(guildId, session);
			jobsByProcessId.set(processId, session);

			// Background execution worker
			(async () => {
				const successIds: string[] = [];
				const failIds: string[] = [];

				for (const [memId, member] of targetMembers) {
					try {
						if (modeParam === "add") {
							await member.roles.add(rolesToApply);
						} else {
							await member.roles.remove(rolesToApply);
						}
						successIds.push(memId);
					} catch {
						failIds.push(memId);
					}
				}

				session.status = "done";
				session.success = successIds.length;
				session.failed = failIds.length;
				session.data = {
					status: "done",
					success: successIds,
					fail: failIds,
				};

				activeGuildJobs.delete(guildId);
				scheduleJobCleanup(processId);
			})().catch(() => {
				session.status = "done";
				activeGuildJobs.delete(guildId);
			});

			return {
				total: session.total,
				success: session.success,
				failed: session.failed,
				data: {
					status: "awaiting",
					process_id: processId,
				},
			};
		} catch (err: any) {
			return { error: err?.message || "Internal server error" };
		}
	});
});

export default app;
