import { Hono } from "hono";
const app = new Hono();

import {
	getOrCreatePlayer,
	resolveVoiceChannel,
	formatTrack,
	hasActivePlayer,
	set247,
	get247,
	clear247,
	createMusicStream,
	checkVoicePermissions,
	formatDuration,
	setVoiceStatus,
	voiceStatusStore,
	ensureLocalNode,
} from "../../functions/musicPlayer.js";
import { commonHeaders } from "../../functions/request.js";
import { radioStreamUrls } from "../../functions/radioProxy.js";
import { getActiveFilters } from "./filters.js";

async function resolveRedirectUrl(
	url: string,
	maxRedirects = 5,
): Promise<string> {
	let current = url;
	for (let i = 0; i < maxRedirects; i++) {
		try {
			const res = await fetch(current, {
				method: "GET",
				redirect: "manual",
				headers: commonHeaders,
			});
			const status = res.status;
			if (status >= 300 && status < 400) {
				const location = res.headers.get("location");
				if (!location) break;
				// Handle relative redirects
				const next = location.startsWith("http")
					? location
					: new URL(location, current).href;
				if (next === current) break;
				current = next;
			} else {
				break;
			}
		} catch {
			break;
		}
	}
	return current;
}

app.get("/radio", async (c) => {
	return await createMusicStream(c, async (log, s) => {
		const token = c.req.query("token");
		const stationId = c.req.query("stationId");
		let voiceId = c.req.query("voiceId");
		const reqGuildId = c.req.query("guildId");
		const authorId = c.req.query("authorId");
		const isDeaf = c.req.query("isDeaf") !== "false";
		const req247 = c.req.query("247");

		if (!token || !stationId || (!voiceId && (!reqGuildId || !authorId))) {
			await s.write(
				`],"data":${JSON.stringify({
					status: false,
					message:
						"Missing required params: token, stationId, and either voiceId OR (guildId and authorId)",
					type: { primary: "error", alt: "invalid_query" },
				})}}`,
			);
			return;
		}

		// 1. Fetch station details from Radio Browser API
		await log(`Fetching radio station details for ID: ${stationId}...`);
		let stationInfo: any = null;
		try {
			const res = await fetch(
				`https://all.api.radio-browser.info/json/stations/byuuid?uuids=${encodeURIComponent(stationId)}`,
				{ headers: commonHeaders },
			);
			const data = await res.json();
			if (Array.isArray(data) && data.length > 0) {
				stationInfo = data[0];
			}
		} catch (err: any) {
			await log(`Error fetching radio station: ${err?.message || err}`);
		}

		if (!stationInfo || (!stationInfo.url_resolved && !stationInfo.url)) {
			await log("Radio station details could not be retrieved");
			await s.write(
				`],"data":${JSON.stringify({
					status: false,
					message: "Radio station not found or lacks a playable stream URL",
					type: { primary: "error", alt: "invalid_query" },
				})}}`,
			);
			return;
		}

		const rawStreamUrl = stationInfo.url_resolved || stationInfo.url;
		await log(`Raw stream URL: ${rawStreamUrl}`);

		const resolvedStreamUrl = await resolveRedirectUrl(rawStreamUrl);
		if (resolvedStreamUrl !== rawStreamUrl) {
			await log(`Stream redirected to: ${resolvedStreamUrl}`);
		} else {
			await log(`Resolved stream URL: ${resolvedStreamUrl}`);
		}

		// 2. Initialize / Retrieve client and player
		const isNew = !hasActivePlayer(token);
		await log(
			isNew
				? "Creating new discord.js client..."
				: "Reusing existing discord.js client",
		);

		const { client, player: manager } = await getOrCreatePlayer(token, log);
		await log(isNew ? "Discord.js client ready" : "Client retrieved");

		// 3. Resolve Voice Channel
		let channel: any = null;
		if (voiceId) {
			await log(`Resolving voice channel: ${voiceId}`);
			channel = await resolveVoiceChannel(client, voiceId);
		} else if (authorId && reqGuildId) {
			await log(
				`Looking for author's voice connection (${authorId}) in guild ${reqGuildId}...`,
			);
			let guild = client.guilds.cache.get(reqGuildId as string);
			if (!guild) {
				guild = await client.guilds
					.fetch(reqGuildId as string)
					.catch(() => undefined);
			}
			if (guild) {
				const voiceState = guild.voiceStates.cache.get(authorId as string);
				if (voiceState?.channel) channel = voiceState.channel;
			}
		}

		if (!channel) {
			await log("Voice channel not found or user is not in one");
			await s.write(
				`],"data":${JSON.stringify({
					status: false,
					message: "Could not find target voice channel",
					type: { primary: "error", alt: "unknown_voice" },
				})}}`,
			);
			return;
		}

		const guildId = channel.guild.id;
		checkVoicePermissions(channel, client.user!);

		// 4. Handle Force Disconnect of existing music player in target guild
		const existingPlayer = manager.players.get(guildId);
		if (existingPlayer) {
			await log("Active music player found, performing force disconnect...");
			if (existingPlayer.queue.previous.length > 0) {
				existingPlayer.queue.previous.splice(
					0,
					existingPlayer.queue.previous.length,
				);
			}
			if (existingPlayer.queue.tracks.length > 0) {
				existingPlayer.queue.tracks.splice(
					0,
					existingPlayer.queue.tracks.length,
				);
			}
			clear247(token, guildId);
			const voiceChannelId = existingPlayer.voiceChannelId;
			if (voiceChannelId) {
				await setVoiceStatus(voiceChannelId, token, "").catch(() => {});
			}
			voiceStatusStore.delete(`${token}:${guildId}`);
			await existingPlayer.destroy();
			await log("Previous player disconnected and destroyed successfully");
		}

		// Store original URL for the proxy endpoint (AFTER force disconnect to avoid playerDestroy cleanup)
		radioStreamUrls.set(guildId, resolvedStreamUrl);
		const streamUrl = `http://localhost:3000/radio-proxy/${guildId}`;
		await log(`Using proxy URL: ${streamUrl}`);

		// 5. Ensure local Lavalink node is connected (radio strictly uses local)
		const radioNode = await ensureLocalNode(manager, log);
		if (!radioNode) {
			await s.write(
				`],"data":${JSON.stringify({
					status: false,
					message: "Local Lavalink node is not available for radio streaming",
					type: { primary: "error", alt: "critical" },
				})}}`,
			);
			return;
		}

		// Create new Player & Connect (force use of local node)
		await log("Creating Lavalink player for radio streaming...");
		const guildPlayer = await manager.createPlayer({
			guildId,
			voiceChannelId: channel.id,
			selfDeaf: isDeaf,
			selfMute: false,
			node: radioNode.id,
		});

		if (!guildPlayer.connected) {
			await log("Connecting player to voice channel...");
			await guildPlayer.connect();
			await log("Connected");
		}

		let is247 = get247(token!, guildId);
		if (req247 !== undefined) {
			is247 = req247 === "true";
			set247(token!, guildId, is247);
		}

		// 6. Search and load stream URL
		await log("Searching and loading radio stream via Lavalink...");
		const requester = authorId
			? await client.users
					.fetch(authorId as string)
					.catch(() => ({ id: authorId, username: "Discord User" }))
			: client.user;

		let searchResult: any;
		try {
			searchResult = await guildPlayer.search(
				{ query: streamUrl, source: undefined as any },
				requester,
				radioNode,
			);
		} catch (err: any) {
			const msg = err?.message || "unknown error";
			await log(`Lavalink search failed: ${msg}`);
			const isBlocked =
				msg.includes("Failed to parse JSON") || msg.includes("422");
			await s.write(
				`],"data":${JSON.stringify({
					status: false,
					message: isBlocked
						? "This radio stream is blocked on public Lavalink nodes."
						: `Lavalink failed to resolve the radio stream: ${msg}`,
					type: { primary: "error", alt: isBlocked ? "blocked" : "critical" },
				})}}`,
			);
			return;
		}
		if (!searchResult?.tracks?.length) {
			await log("Lavalink failed to resolve radio stream");
			await s.write(
				`],"data":${JSON.stringify({
					status: false,
					message: "Lavalink failed to load the radio stream URL",
					type: { primary: "error", alt: "invalid_query" },
				})}}`,
			);
			return;
		}

		const track = searchResult.tracks[0];

		// Inject station metadata
		track.info.title = stationInfo.name || track.info.title || "Live Radio";
		track.info.author =
			stationInfo.country || track.info.author || "Radio Station";
		if (stationInfo.favicon) {
			track.info.artworkUrl = stationInfo.favicon;
		}

		// Add track to queue
		await guildPlayer.queue.add(track);

		// 8. Play the stream
		await log("Starting radio stream playback...");
		try {
			await Promise.race([
				guildPlayer.play(),
				new Promise((_, reject) =>
					setTimeout(
						() => reject(new Error("Playback start request timed out")),
						20_000,
					),
				),
			]);
			guildPlayer.setData("__isRadio", true);
		} catch (err: any) {
			await log(`Play failed: ${err?.message || err}`);
			await s.write(
				`],"data":${JSON.stringify({
					status: false,
					message: err?.message || "Failed to start radio stream playback",
					type: { primary: "error", alt: "critical" },
				})}}`,
			);
			return;
		}

		const formattedTrack = formatTrack(track, client, guildPlayer);
		// Override proxy URL with actual stream URL in response
		formattedTrack.id = resolvedStreamUrl;
		formattedTrack.url = resolvedStreamUrl;
		const activeFilters = getActiveFilters(guildPlayer);

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				nodeId: guildPlayer.node?.id ?? null,
				data: {
					isNewPlayer: true,
					client: guildPlayer.options || null,
					track: formattedTrack,
					platform: "radio",
					is247,
					isPlaying: guildPlayer.playing,
					isPaused: guildPlayer.paused,
					filters: {
						array: activeFilters.length > 0 ? activeFilters : [],
						string: activeFilters.length > 0 ? activeFilters.join(", ") : "",
					},
					queue: {
						size: guildPlayer.queue.tracks.length,
						limit_size: 3,
						tracks: [formattedTrack],
						elapsedTime: {
							label: "Live Stream",
							value: "0",
						},
					},
				},
				type: { primary: "final", alt: "success" },
			})}}`,
		);
	});
});

export default app;
