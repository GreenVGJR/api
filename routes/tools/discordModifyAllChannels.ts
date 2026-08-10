import { Hono } from "hono";
import { getOrCreatePlayer } from "../../functions/musicPlayer.js";
import { PermissionsBitField, ChannelType } from "discord.js";
import { PERMISSION_KEYS } from "../../functions/types/index.js";
import { dispatch } from "../../functions/httpRequest.js";
import { activeGuildJobs, jobsByProcessId, generateProcessId, scheduleJobCleanup, AsyncJobSession } from "../../functions/discordBatchStore.js";

const app = new Hono();

// Map BDFD / standard keys from PERMISSION_KEYS to discord.js PermissionFlagsBits keys (Channel-applicable permissions only)
const PERMISSION_KEY_TO_FLAG: Record<string, keyof typeof PermissionsBitField.Flags> = {
	createinstantinvite: "CreateInstantInvite",
	managechannels: "ManageChannels",
	addreactions: "AddReactions",
	priorityspeaker: "PrioritySpeaker",
	stream: "Stream",
	readmessages: "ViewChannel",
	sendmessages: "SendMessages",
	tts: "SendTTSMessages",
	managemessages: "ManageMessages",
	embedlinks: "EmbedLinks",
	attachfiles: "AttachFiles",
	readmessagehistory: "ReadMessageHistory",
	mentioneveryone: "MentionEveryone",
	externalemojis: "UseExternalEmojis",
	connect: "Connect",
	speak: "Speak",
	voicemute: "MuteMembers",
	voicedeafen: "DeafenMembers",
	movemembers: "MoveMembers",
	usevad: "UseVAD",
	managewebhooks: "ManageWebhooks",
	slashcommands: "UseApplicationCommands",
	requesttospeak: "RequestToSpeak",
	manageevents: "ManageEvents",
	managethreads: "ManageThreads",
	createpublicthreads: "CreatePublicThreads",
	createprivatethreads: "CreatePrivateThreads",
	externalstickers: "UseExternalStickers",
	sendmessagesinthreads: "SendMessagesInThreads",
	useembeddedactivities: "UseEmbeddedActivities",
	usesoundboard: "UseSoundboard",
	createevents: "CreateEvents",
	userexternalsounds: "UseExternalSounds",
	sendvoicemessages: "SendVoiceMessages",
	setvoicechannelstatus: "SetVoiceChannelStatus",
	pinmessages: "PinMessages",
	bypassslowmode: "BypassSlowmode",
	useexternalapps: "UseExternalApps",
};

// Additional BDFD alias aliases (e.g. sendmessage, send_messages, etc.)
const ADDITIONAL_ALIASES: Record<string, keyof typeof PermissionsBitField.Flags> = {
	sendmessage: "SendMessages",
	send_messages: "SendMessages",
	sendtts: "SendTTSMessages",
	send_tts_messages: "SendTTSMessages",
	viewchannel: "ViewChannel",
	view_channel: "ViewChannel",
	managechannel: "ManageChannels",
	manage_channels: "ManageChannels",
	managerole: "ManageRoles",
	manage_roles: "ManageRoles",
};

function resolvePermissionFlag(perm: string): keyof typeof PermissionsBitField.Flags | null {
	const clean = perm
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");

	if (PERMISSION_KEY_TO_FLAG[clean]) return PERMISSION_KEY_TO_FLAG[clean];
	if (ADDITIONAL_ALIASES[clean]) return ADDITIONAL_ALIASES[clean];

	// Direct lookup in PERMISSION_KEYS
	if (PERMISSION_KEYS.hasOwnProperty(clean)) {
		const keyName = PERMISSION_KEY_TO_FLAG[clean];
		if (keyName) return keyName;
	}

	return null;
}

app.get("/discord/modifyAllChannels", async (c) => {
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
				none: job.none || 0,
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
				none: job.none || 0,
				data: {
					status: "done",
					success: job.data.success || [],
					fail: job.data.fail || [],
					none: job.data.none || [],
				},
			});
		}
	}

	// 2) New modify job request
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
	const permissionParam = c.req.query("permission")?.trim();
	const modeParam = c.req.query("mode")?.trim().toLowerCase();
	const typeParam = c.req.query("type")?.trim().toLowerCase() || "all";

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);
	if (!permissionParam) return c.json({ error: "Missing valid parameter: permission" }, 202);
	if (!modeParam || (modeParam !== "allow" && modeParam !== "deny" && modeParam !== "reset")) {
		return c.json({ error: "Missing valid parameter: mode (must be 'allow', 'deny', or 'reset')" }, 202);
	}
	if (typeParam !== "all" && typeParam !== "text" && typeParam !== "voice") {
		return c.json({ error: "Missing valid parameter: type (must be 'all', 'text', or 'voice')" }, 202);
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

	const rawPermList = permissionParam
		.split(",")
		.map((p) => p.trim())
		.filter(Boolean);
	const targetPermissions: (keyof typeof PermissionsBitField.Flags)[] = [];
	const invalidPerms: string[] = [];

	for (const p of rawPermList) {
		const flag = resolvePermissionFlag(p);
		if (flag) {
			targetPermissions.push(flag);
		} else {
			invalidPerms.push(p);
		}
	}

	if (invalidPerms.length > 0) {
		const availablePerms = Object.keys(PERMISSION_KEYS)
			.filter((k) => PERMISSION_KEY_TO_FLAG.hasOwnProperty(k))
			.join(", ");
		return c.json(
			{
				error: `Invalid permissions: ${invalidPerms.join(", ")}`,
				list: availablePerms,
			},
			202,
		);
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

			// Required permissions for bot to edit channel overwrites
			const missingPerms: string[] = [];

			if (!botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
				if (!botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
					missingPerms.push("ManageChannels");
				}
				if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
					missingPerms.push("ManageRoles");
				}
			}

			if (missingPerms.length > 0) {
				return {
					error: "Missing bot permissions",
					targets: permissionParam,
					missing: missingPerms.join(", "),
				};
			}

			const channels = await guild.channels.fetch().catch(() => null);
			if (!channels) {
				return { error: "Failed to fetch guild channels" };
			}

			// Target channels to process based on typeParam filter
			const targetChannels: [string, any][] = [];
			for (const [chId, channel] of channels) {
				if (!channel) continue;
				if (typeParam === "text") {
					const isTextType = channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement || channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildMedia;
					if (!isTextType) continue;
				} else if (typeParam === "voice") {
					const isVoiceType = channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice;
					if (!isVoiceType) continue;
				}
				targetChannels.push([chId, channel]);
			}

			const totalCount = targetChannels.length;
			const processId = generateProcessId();

			const session: AsyncJobSession = {
				processId,
				guildId,
				status: "awaiting",
				total: totalCount,
				success: 0,
				failed: 0,
				none: 0,
				data: {
					status: "awaiting",
					process_id: processId,
				},
			};

			activeGuildJobs.set(guildId, session);
			jobsByProcessId.set(processId, session);

			const permObject: Record<string, boolean | null> = {};
			for (const flag of targetPermissions) {
				permObject[flag] = modeParam === "reset" ? null : modeParam === "allow";
			}

			const everyoneRole = guild.roles.everyone;

			// Background execution worker
			(async () => {
				const successIds: string[] = [];
				const failIds: string[] = [];
				const noneIds: string[] = [];

				for (const [chId, channel] of targetChannels) {
					try {
						if ("permissionOverwrites" in channel && typeof channel.permissionOverwrites?.edit === "function") {
							const existingOverwrite = channel.permissionOverwrites?.cache?.get(guild.id);
							let alreadyMatches = true;
							for (const flag of targetPermissions) {
								const desired = modeParam === "reset" ? null : modeParam === "allow";
								const hasAllow = existingOverwrite?.allow?.has(PermissionsBitField.Flags[flag]) || false;
								const hasDeny = existingOverwrite?.deny?.has(PermissionsBitField.Flags[flag]) || false;

								if (desired === true) {
									if (!hasAllow || hasDeny) {
										alreadyMatches = false;
										break;
									}
								} else if (desired === false) {
									if (hasAllow || !hasDeny) {
										alreadyMatches = false;
										break;
									}
								} else {
									if (hasAllow || hasDeny) {
										alreadyMatches = false;
										break;
									}
								}
							}

							if (alreadyMatches) {
								noneIds.push(chId);
							} else {
								await channel.permissionOverwrites.edit(everyoneRole, permObject);
								successIds.push(chId);
							}
						} else {
							failIds.push(chId);
						}
					} catch {
						failIds.push(chId);
					}
				}

				session.status = "done";
				session.success = successIds.length;
				session.failed = failIds.length;
				session.none = noneIds.length;
				session.data = {
					status: "done",
					success: successIds,
					fail: failIds,
					none: noneIds,
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
				none: session.none,
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
