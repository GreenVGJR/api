import { Hono } from "hono";
import { EmbedBuilder } from "discord.js";
import { getOrCreatePlayer, createMusicStream, getMessageStatusSettings, setMessageStatusSetting, applyTemplate } from "../../functions/musicPlayer.js";
import { ALLOWED_TAGS } from "../../functions/types/index.js";

const app = new Hono();

app.get("/messageStatus", async (c) => {
	return await createMusicStream(c, async (log, s) => {
		const token = c.req.query("token");
		const guildId = c.req.query("guildId");
		const channelId = c.req.query("channelId");
		const type = c.req.query("type");
		const statusStr = c.req.query("status");
		const content = c.req.query("content");
		const sendStr = c.req.query("send");

		if (!token || !guildId) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Missing required params: token, guildId", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}

		try {
			await log("Fetching player...");
			const { client, player: manager } = await getOrCreatePlayer(token, log);

			await log(`Validating guild: ${guildId}`);
			let guild = client.guilds.cache.get(guildId as string);
			if (!guild) {
				guild = await client.guilds.fetch(guildId as string).catch(() => undefined);
			}
			if (!guild) {
				await log("Guild not found or bot not in guild");
				await s.write(`],"data":${JSON.stringify({ status: false, message: "Guild not found or bot not in guild", type: { primary: "error", alt: "invalid_query" } })}}`);
				return;
			}

			const player = manager.players.get(guildId);
			const isActivePlayer = !!(player && player.queue.current);
			const currentTrack = player?.queue.current || null;
			let sendResult: any = null;
			const contentExample = JSON.stringify({
				embeds: [
					{
						title: "{title}",
						url: "{url}",
						color: 10526719,
						author: { name: "Now Playing" },
						fields: [
							{ name: "Requested By", value: "<@{requestedBy}>", inline: true },
							{ name: "Duration", value: "{duration}", inline: true },
							{ name: "Source", value: "{source}", inline: true },
							{ name: "Loop", value: "{loop}", inline: true },
							{ name: "Volume", value: "{volume}%", inline: true },
						],
						thumbnail: { url: "{thumbnail}" },
						footer: { text: "{requester.globalName}", icon_url: "{requester.avatar}" },
						timestamp: "{currentTimestamp}",
					},
				],
			});

			if (type && statusStr !== undefined) {
				const validTypes = ["trackStart", "queueEnd"];
				if (!validTypes.includes(type)) {
					await log(`Invalid type: ${type}`);
					await s.write(
						`],"data":${JSON.stringify({
							status: false,
							message: `Invalid type "${type}". Allowed: ${validTypes.join(", ")}`,
							data: getMessageStatusSettings(token, guildId),
							type: { primary: "error", alt: "invalid_query" },
						})}}`,
					);
					return;
				}

				const isActive = statusStr === "true";
				const resolvedChannelId = channelId || "";

				if (isActive && resolvedChannelId) {
					try {
						const channel = await client.channels.fetch(resolvedChannelId).catch(() => null);
						if (!channel) {
							await log(`Channel ${resolvedChannelId} not found`);
							await s.write(`],"data":${JSON.stringify({ status: false, message: `Channel ${resolvedChannelId} not found or inaccessible`, type: { primary: "error", alt: "invalid_query" } })}}`);
							return;
						}
					} catch (chErr: any) {
						await log(`Failed to verify channel: ${chErr.message}`);
						await s.write(`],"data":${JSON.stringify({ status: false, message: `Failed to verify channel: ${chErr.message}`, type: { primary: "error", alt: "invalid_query" } })}}`);
						return;
					}
				}

				if (isActive && content && content.trim()) {
					let parsed: any;
					try {
						parsed = JSON.parse(content);
					} catch {
						await s.write(`],"data":${JSON.stringify({ status: false, message: `Content must be valid JSON. Example: ${contentExample}`, type: { primary: "error", alt: "invalid_query" } })}}`);
						return;
					}

					if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
						await s.write(`],"data":${JSON.stringify({ status: false, message: 'Content must be a JSON object (e.g. {"content":"...","embeds":[...]})', type: { primary: "error", alt: "invalid_query" } })}}`);
						return;
					}

					if (parsed.embeds && Array.isArray(parsed.embeds)) {
						for (let i = 0; i < parsed.embeds.length; i++) {
							const stubEmbed = JSON.parse(JSON.stringify(parsed.embeds[i]));
							if (typeof stubEmbed.timestamp === "string" && /\{.*\}/.test(stubEmbed.timestamp)) {
								stubEmbed.timestamp = new Date().toISOString();
							}
							if (stubEmbed.color != null && typeof stubEmbed.color === "string" && /\{.*\}/.test(stubEmbed.color)) {
								stubEmbed.color = 0;
							}
							try {
								new EmbedBuilder(stubEmbed);
							} catch (valErr: any) {
								await log(`Invalid embed at index ${i}: ${valErr.message}`);
								await s.write(`],"data":${JSON.stringify({ status: false, message: `Embed #${i + 1} is invalid: ${valErr.message}`, type: { primary: "error", alt: "invalid_query" } })}}`);
								return;
							}
						}
					}
				}

				await log(`Configuring message status for type: ${type} (Active: ${isActive})`);

				setMessageStatusSetting(token, guildId, type, isActive, channelId || "", content || "");

				if (sendStr === "true" && isActive && channelId && content) {
					if (!currentTrack) {
						sendResult = { error: "No track currently playing" };
					} else {
						try {
							const resolved = currentTrack && content.includes("{") ? applyTemplate(content, currentTrack, client) : content;
							const payload = JSON.parse(resolved);
							if (payload.embeds) {
								payload.embeds = payload.embeds.map((e: any) => {
									if (e.footer && (!e.footer.icon_url || e.footer.icon_url === "null" || e.footer.icon_url === "undefined")) {
										delete e.footer.icon_url;
									}
									if (e.footer && !e.footer.text) delete e.footer;
									if (e.author && (!e.author.icon_url || e.author.icon_url === "null" || e.author.icon_url === "undefined")) {
										delete e.author.icon_url;
									}
									if (e.author && !e.author.name) delete e.author;
									if (e.thumbnail && (!e.thumbnail.url || e.thumbnail.url === "null" || e.thumbnail.url === "undefined")) {
										delete e.thumbnail;
									}
									if (e.image && (!e.image.url || e.image.url === "null" || e.image.url === "undefined")) {
										delete e.image;
									}
									return e;
								});
							}
							const targetChannel = await client.channels.fetch(channelId).catch(() => null);
							if (targetChannel && typeof (targetChannel as any).send === "function") {
								const sent = await (targetChannel as any).send(payload);
								sendResult = sent;
							} else {
								sendResult = { error: "Cannot send messages in this channel" };
							}
						} catch (sendErr: any) {
							sendResult = { error: sendErr.message };
						}
					}
				}

				await log("Configuration saved");
			} else {
				await log("Fetched current configurations");
			}

			await s.write(
				`],"data":${JSON.stringify({
					_warning: "For security reasons, you can't use alongside Expression Functions.",
					_message: "Embed builder: https://www.discordutils.com/embed",
					_example: contentExample,
					status: isActivePlayer,
					message: isActivePlayer ? undefined : "No active player for this channel",
					data: {
						...getMessageStatusSettings(token, guildId),
						tags: ALLOWED_TAGS,
					},
					altData: sendResult,
					type: { primary: "final", alt: "success" },
				})}}`,
			);
		} catch (err: any) {
			await log(`Error: ${err?.message}`);
			await s.write(`],"data":${JSON.stringify({ status: false, message: err?.message || "Failed to configure message status", type: { primary: "error", alt: "critical" } })}}`);
		}
	});
});

export default app;
