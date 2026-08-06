import { Hono } from "hono";
const app = new Hono();

import { getOrCreatePlayer, resolveVoiceChannel, formatTrack, hasActivePlayer, set247, get247, clear247, createMusicStream, checkVoicePermissions, setVoiceStatus, voiceStatusStore, getLavalinkNodeIds, ensureNodeConnected } from "../../functions/musicPlayer.js";
import { commonHeaders } from "../../functions/request.js";
import { radioStreamUrls } from "../../functions/radioProxy.js";
import { getActiveFilters } from "./filters.js";

async function resolveRedirectUrl(url: string, maxRedirects = 5): Promise<string> {
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
				const next = location.startsWith("http") ? location : new URL(location, current).href;
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
					message: "Missing required params: token, stationId, and either voiceId OR (guildId and authorId)",
					type: { primary: "error", alt: "invalid_query" },
				})}}`,
			);
			return;
		}

		// 1. Fetch station details from Radio Browser API
		await log(`Fetching radio station details for ID: ${stationId}...`);
		let stationInfo: any = null;
		try {
			const res = await fetch(`https://all.api.radio-browser.info/json/stations/byuuid?uuids=${encodeURIComponent(stationId)}`, { headers: commonHeaders });
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
		await log(isNew ? "Creating new discord.js client..." : "Reusing existing discord.js client");

		const { client, player: manager } = await getOrCreatePlayer(token, log, true);
		await log(isNew ? "Discord.js client ready" : "Client retrieved");

		// 3. Resolve Voice Channel
		let channel: any = null;
		if (voiceId) {
			await log(`Resolving voice channel: ${voiceId}`);
			channel = await resolveVoiceChannel(client, voiceId);
		} else if (authorId && reqGuildId) {
			await log(`Looking for author's voice connection (${authorId}) in guild ${reqGuildId}...`);
			let guild = client.guilds.cache.get(reqGuildId as string);
			if (!guild) {
				guild = await client.guilds.fetch(reqGuildId as string).catch(() => undefined);
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
				existingPlayer.queue.previous.splice(0, existingPlayer.queue.previous.length);
			}
			if (existingPlayer.queue.tracks.length > 0) {
				existingPlayer.queue.tracks.splice(0, existingPlayer.queue.tracks.length);
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
		const proxyUrl = `http://localhost:3000/radio-proxy/${guildId}`;
		const streamUrls = [resolvedStreamUrl, proxyUrl];
		await log(`Stream URLs: proxy="${proxyUrl}" / direct="${resolvedStreamUrl}"`);

		// Create new Player & Connect
		await log("Creating Lavalink player for radio streaming...");
		// Prefer the local (vgjr) node first, only falling back to remote. Explicitly
		// pick + connect it so the manager doesn't silently auto-assign a different,
		// possibly-unconnected node.
		const preferredNodeIds = getLavalinkNodeIds(true);
		let chosenNodeId: string | null = null;
		// 1. Try to find an already connected node
		for (const id of preferredNodeIds) {
			const existingNode = manager.nodeManager.nodes.get(id);
			if (existingNode?.connected) {
				chosenNodeId = id;
				break;
			}
		}
		// 2. If none connected, try to connect one and verify stability
		if (!chosenNodeId) {
			for (const id of preferredNodeIds) {
				const node = await ensureNodeConnected(manager, id, log);
				if (node) {
					await new Promise((r) => setTimeout(r, 50)); // Stability check
					if (node.connected) {
						chosenNodeId = id;
						break;
					} else {
						if (log) await log(`Lavalink node "${id}" dropped immediately — trying next`);
					}
				}
			}
		}
		if (!chosenNodeId) {
			await log("No Lavalink node is currently reachable");
			await s.write(
				`],"data":${JSON.stringify({
					status: false,
					message: "No Lavalink node is currently reachable",
					type: { primary: "error", alt: "critical" },
				})}}`,
			);
			return;
		}
		await log(`Using Lavalink node "${chosenNodeId}"`);
		const guildPlayer = await manager.createPlayer({
			guildId,
			voiceChannelId: channel.id,
			selfDeaf: isDeaf,
			selfMute: false,
			node: chosenNodeId as any,
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

		// 6. Search and load radio stream URL, trying each Lavalink node on failure
		await log("Searching and loading radio stream via Lavalink...");
		const requester = authorId ? await client.users.fetch(authorId as string).catch(() => ({ id: authorId, username: "Discord User" })) : client.user;
		// Radio: strictly prefer the local (vgjr) node first, falling back to remote
		// nodes only if the local node fails. Note we do NOT prepend guildPlayer.node
		// (the node it was created on) ahead of the local node — after a track was
		// just played, that could be a remote node and would otherwise be tried first.
		const nodeIds = getLavalinkNodeIds(true);
		let searchResult: any;
		let lastError: string | null = null;

		const nodesToTry = new Set([...nodeIds, guildPlayer.node?.id].filter(Boolean));

		for (const nodeId of nodesToTry) {
			const currentNodeId = guildPlayer.node?.id || "unknown";

			if (nodeId !== currentNodeId) {
				await log(`Search failed on "${currentNodeId}", trying next node "${nodeId}"...`);
				const target = await ensureNodeConnected(manager, nodeId as string, log);
				if (!target || !target.connected) {
					await log(`Node "${nodeId}" is unavailable, skipping...`);
					continue;
				}
				try {
					await guildPlayer.moveNode(nodeId as string);
				} catch {
					await log(`Failed to move player to node "${nodeId}"`);
					continue;
				}
			}

			// Try direct URL first, then fallback to proxy stream URL
			for (let u = 0; u < streamUrls.length; u++) {
				const url = streamUrls[u];
				const urlLabel = u === 0 ? "direct" : "proxy";
				await log(`Using ${urlLabel} stream URL on "${guildPlayer.node?.id || currentNodeId}"`);
				try {
					searchResult = await guildPlayer.search({ query: url, source: undefined as any }, requester);
				} catch (err: any) {
					lastError = err?.message || "unknown error";
					await log(`Lavalink search failed on "${guildPlayer.node?.id || currentNodeId}": ${lastError}`);
					const msg = String(lastError);
					if (msg.includes("not connected") || msg.includes("Failed to parse JSON") || msg.includes("422")) {
						break; // Try next node for both URLs
					}
					continue;
				}

				if (searchResult?.tracks?.length) break;

				lastError = "No tracks found";
				await log(`Lavalink search returned no tracks on "${guildPlayer.node?.id || currentNodeId}"`);
			}

			if (searchResult?.tracks?.length) break;
		}

		if (!searchResult?.tracks?.length) {
			const isBlocked = lastError && (lastError.includes("Failed to parse JSON") || lastError.includes("422"));
			await log("Lavalink failed to resolve radio stream");
			await s.write(
				`],"data":${JSON.stringify({
					status: false,
					message: isBlocked ? "This radio stream is blocked on public Lavalink nodes." : "Lavalink failed to load the radio stream URL",
					type: { primary: "error", alt: isBlocked ? "blocked" : "invalid_query" },
				})}}`,
			);
			return;
		}

		const track = searchResult.tracks[0];
		const domain = new URL(resolvedStreamUrl).hostname;

		// Inject station metadata
		track.info.title = stationInfo.name || track.info.title || "Live Radio";
		track.info.author = stationInfo.country || track.info.author || "Radio Station";
		if (stationInfo.favicon) {
			track.info.artworkUrl = stationInfo.favicon;
		}
		if (!track.info.artworkUrl) {
			track.info.artworkUrl = `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=256`;
		}

		// Add track to queue
		await guildPlayer.queue.add(track);

		// 8. Play the stream
		await log("Starting radio stream playback...");
		try {
			await Promise.race([guildPlayer.play(), new Promise((_, reject) => setTimeout(() => reject(new Error("Playback start request timed out")), 20_000))]);
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

		const activeFilters = getActiveFilters(guildPlayer);
		const formattedTrack = formatTrack(track, client, guildPlayer, activeFilters, is247);
		formattedTrack.data.id = domain;
		formattedTrack.data.url = resolvedStreamUrl;

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				data: {
					isNewPlayer: true,
					...formattedTrack.data,
					platform: "radio",
					queue: {
						size: guildPlayer.queue.tracks.length,
						limit_size: 3,
						tracks: [formattedTrack.data],
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
