import { Hono } from "hono";
const app = new Hono();

import { getOrCreatePlayer, getQueue, destroyPlayer, hasActivePlayer, get247, set247, createMusicStream, formatDuration, formatTrack, fillAutoplay, isRadioActive } from "../../functions/musicPlayer.js";

type RMValue = "off" | "track" | "queue";
const RM = {
	OFF: "off" as RMValue,
	TRACK: "track" as RMValue,
	QUEUE: "queue" as RMValue,
};

function parseTimeMS(timeStr: string): number {
	if (!timeStr) return 0;
	timeStr = timeStr.toLowerCase().replace(/\s+/g, "");

	const hmsRegex = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?/;
	if (/[hm]/.test(timeStr)) {
		const match = timeStr.match(hmsRegex);
		if (match) {
			const hours = parseInt(match[1] || "0", 10);
			const minutes = parseInt(match[2] || "0", 10);
			const seconds = parseInt(match[3] || "0", 10);
			return (hours * 3600 + minutes * 60 + seconds) * 1000;
		}
	}

	if (timeStr.includes(":")) {
		const parts = timeStr.split(":").map((p) => parseInt(p, 10));
		if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
		if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
	}

	const secs = parseInt(timeStr, 10);
	return isNaN(secs) ? 0 : secs * 1000;
}

function isActive(p: any): boolean {
	return !!(p.playing || p.paused || p.queue.current);
}

app.get("/pause", async (c) => {
	return await createMusicStream(c, async (log, s) => {
		const token = c.req.query("token");
		const guildId = c.req.query("guildId");

		if (!token || !guildId) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Missing required params: token, guildId", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}
		if (await isRadioActive(token, guildId, log)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Stop the player first before using this", type: { final: "error", alt: "blocked" } })}}`);
			return;
		}
		if (!hasActivePlayer(token)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		const { player } = await getOrCreatePlayer(token, log);
		const queue = getQueue(player, guildId);

		if (!queue || !isActive(queue)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active queue found for this guild", type: { primary: "error", alt: "inactive_queue" } })}}`);
			return;
		}

		if (queue.paused) {
			await s.write(
				`],"data":${JSON.stringify({
					status: true,
					data: {
						action: "none",
						isPaused: queue.paused,
						isPlaying: queue.playing,
					},
					type: { primary: "final", alt: "success" },
				})}}`,
			);
			return;
		}

		await queue.pause();

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				data: {
					action: "paused",
					isPaused: queue.paused,
					isPlaying: queue.playing,
				},
				type: { primary: "final", alt: "success" },
			})}}`,
		);
	});
});

app.get("/resume", async (c) => {
	return await createMusicStream(c, async (log, s) => {
		const token = c.req.query("token");
		const guildId = c.req.query("guildId");

		if (!token || !guildId) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Missing required params: token, guildId", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}
		if (await isRadioActive(token, guildId, log)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Stop the player first before using this", type: { final: "error", alt: "blocked" } })}}`);
			return;
		}
		if (!hasActivePlayer(token)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		const { player } = await getOrCreatePlayer(token, log);
		const queue = getQueue(player, guildId);

		if (!queue || !isActive(queue)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active queue found for this guild", type: { primary: "error", alt: "inactive_queue" } })}}`);
			return;
		}

		if (!queue.paused) {
			await s.write(
				`],"data":${JSON.stringify({
					status: true,
					data: {
						action: "none",
						isPaused: queue.paused,
						isPlaying: queue.playing,
					},
					type: { primary: "final", alt: "success" },
				})}}`,
			);
			return;
		}

		await queue.resume();

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				data: {
					action: "resumed",
					isPaused: queue.paused,
					isPlaying: queue.playing,
				},
				type: { primary: "final", alt: "success" },
			})}}`,
		);
	});
});

app.get("/skip", async (c) => {
	return await createMusicStream(c, async (log, s) => {
		const token = c.req.query("token");
		const guildId = c.req.query("guildId");
		const indexStr = c.req.query("index") || "";
		const index = parseInt(indexStr, 10);

		if (!token || !guildId) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Missing required params: token, guildId", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}
		if (await isRadioActive(token, guildId, log)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Stop the player first before using this", type: { final: "error", alt: "blocked" } })}}`);
			return;
		}
		if (!hasActivePlayer(token)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		const { client, player } = await getOrCreatePlayer(token, log);
		const queue = getQueue(player, guildId);

		if (!queue || !isActive(queue)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active queue found for this guild", type: { primary: "error", alt: "inactive_queue" } })}}`);
			return;
		}

		if (queue.queue.tracks.length === 0) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No more tracks in queue to skip to", type: { primary: "error", alt: "empty_queue" } })}}`);
			return;
		}

		const skippedTrack = queue.queue.current;
		let nextTrack: any = queue.queue.tracks[0] ?? null;

		// If index provided, validate and reposition
		if (indexStr !== "" && !isNaN(index)) {
			const tracks = queue.queue.tracks;
			if (index < 0 || index >= tracks.length) {
				// If autoplay is on, we allow "skipping past the end" by just jumping to something new
				if (queue.get("autoplay")) {
					await log(`Index ${index} is past the buffer, clearing and finding new recommendations...`);
					await queue.queue.splice(0, tracks.length);
					// Explicitly fill before continuing so the output matches
					await fillAutoplay(queue);
				} else {
					await s.write(`],"data":${JSON.stringify({ status: false, message: `Index ${index} is out of bounds (0-${tracks.length - 1})`, type: { primary: "error", alt: "invalid_query" } })}}`);
					return;
				}
			} else {
				nextTrack = tracks[index];
				if (index > 0) await queue.queue.splice(0, index);
			}
		}

		await log(skippedTrack ? `Skipping: "${skippedTrack.info.title}"...` : "Skipping: Unknown...");

		// Use skip(0, false) originally intended, but if it's a live track,
		// we use stopPlaying(false) to ensure it stops correctly then plays next.
		if (skippedTrack?.info.isStream) {
			await (queue as any).stopPlaying(false);
		} else {
			await queue.skip(0, false);
		}
		await log(nextTrack ? `Now playing: "${nextTrack.info.title}"` : "Queue ended");

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				data: {
					action: "skipped",
					skippedTrack: skippedTrack ? formatTrack(skippedTrack, client, queue).data : null,
					currentTrack: nextTrack ? formatTrack(nextTrack, client, queue).data : null,
				},
				type: { primary: "final", alt: "success" },
			})}}`,
		);
	});
});

app.get("/stop", async (c) => {
	return await createMusicStream(c, async (log, s) => {
		const token = c.req.query("token");
		const guildId = c.req.query("guildId");

		if (!token || !guildId) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Missing required params: token, guildId", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}
		if (!hasActivePlayer(token)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		const { player: manager } = await getOrCreatePlayer(token, log);
		const queue = getQueue(manager, guildId);

		if (!queue || (!isActive(queue) && queue.queue.tracks.length === 0)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		const is247 = get247(token!, guildId!);

		if (is247) {
			await log(`24/7 mode — stopping playback and clearing queue`);

			if (queue.queue.previous.length > 0) {
				await log("Clearing queue history...");
				queue.queue.previous.splice(0, queue.queue.previous.length);
			}

			if (queue.queue.tracks.length > 0) {
				queue.queue.splice(0, queue.queue.tracks.length);
			}

			if (queue.queue.current) {
				await log("Stopping current track...");
				await (queue as any).stopPlaying(false);
			}

			await s.write(
				`],"data":${JSON.stringify({
					status: true,
					data: { action: "stopped", context_destroyed: false, is247: true },
					type: { primary: "final", alt: "success" },
				})}}`,
			);
			return;
		}

		await log("Clearing queue history...");
		if (queue.queue.previous.length > 0) {
			queue.queue.previous.splice(0, queue.queue.previous.length);
		}
		await log("Destroying Lavalink player...");
		await queue.destroy();
		await log("Player destroyed");

		let hasActiveNodes = false;
		for (const [id, p] of manager.players) {
			if (id === guildId) continue;
			if (p.playing || p.paused || p.queue.tracks.length > 0) {
				hasActiveNodes = true;
				break;
			}
		}

		let killed = false;
		if (!hasActiveNodes) {
			await log("No other active servers, destroying discord.js client...");
			const token2 = c.req.query("token")!;
			await destroyPlayer(token2);
			killed = true;
			await log("Discord.js client destroyed");
		} else {
			await log("Other active servers exist, keeping client alive");
		}

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				data: { action: "stopped", context_destroyed: killed, is247: false },
				type: { primary: "final", alt: "success" },
			})}}`,
		);
	});
});

app.get("/seek", async (c) => {
	return await createMusicStream(c, async (log, s) => {
		const token = c.req.query("token");
		const guildId = c.req.query("guildId");
		const time = c.req.query("time");

		if (!token || !guildId || !time) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Missing required params: token, guildId, time", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}
		if (await isRadioActive(token, guildId, log)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Stop the player first before using this", type: { final: "error", alt: "blocked" } })}}`);
			return;
		}
		if (!hasActivePlayer(token)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		const { player } = await getOrCreatePlayer(token, log);
		const queue = getQueue(player, guildId);

		if (!queue || !isActive(queue) || !queue.queue.current) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active queue found for this guild", type: { primary: "error", alt: "inactive_queue" } })}}`);
			return;
		}

		const currentTrack = queue.queue.current;
		const duration = currentTrack.info.duration || 0;

		if (currentTrack.info.isStream) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Cannot seek on a live track", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}

		if (duration <= 0) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Cannot seek: track metadata is missing duration", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}

		const ms = parseTimeMS(time);

		if (ms > duration) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: `Cannot seek beyond song duration (${Math.floor(duration / 1000)}s)`, type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}

		if (ms < 0) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: `Cannot seek below 0`, type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}

		const seekTarget = Math.max(0, ms);
		await log(`Seeking to ${seekTarget}ms (input: "${time}")...`);

		try {
			await queue.seek(seekTarget);
			await log(`Seek completed to ${seekTarget}ms`);
		} catch (err: any) {
			await log(`Seek failed: ${err?.message || err}`);
			await s.write(`],"data":${JSON.stringify({ status: false, message: `Seek failed: ${err?.message || "Unknown error"}`, type: { primary: "error", alt: "critical" } })}}`);
			return;
		}

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				data: {
					action: "seek",
					time: String(seekTarget),
					formatTime: formatDuration(seekTarget),
					progress: {
						current: {
							label: formatDuration(seekTarget),
							value: String(seekTarget),
						},
						total: {
							label: formatDuration(currentTrack.info.duration),
							value: String(currentTrack.info.duration),
						},
					},
				},
				type: { primary: "final", alt: "success" },
			})}}`,
		);
	});
});

app.get("/volume", async (c) => {
	return await createMusicStream(c, async (log, s) => {
		const token = c.req.query("token");
		const guildId = c.req.query("guildId");

		if (!token || !guildId) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Missing required params: token, guildId", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}
		if (!hasActivePlayer(token)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		const value = parseInt(c.req.query("value") || "");
		if (isNaN(value) || value < 0 || value > 100) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Volume must be a number between 0 and 100", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}

		const { player } = await getOrCreatePlayer(token, log);
		const queue = getQueue(player, guildId);

		if (!queue || !isActive(queue)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active queue found for this guild", type: { primary: "error", alt: "inactive_queue" } })}}`);
			return;
		}

		const previousVolume = queue.volume;

		await log(`Setting volume to ${value}...`);
		await queue.setVolume(value);
		await log(`Volume set to ${queue.volume} (previous: ${previousVolume})`);

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				data: { action: "volume_set", volume: queue.volume, previousVolume },
				type: { primary: "final", alt: "success" },
			})}}`,
		);
	});
});

const LOOP_MODES: Record<string, RMValue | "autoplay"> = {
	off: RM.OFF,
	track: RM.TRACK,
	queue: RM.QUEUE,
	autoplay: "autoplay",
};

app.get("/loop", async (c) => {
	return await createMusicStream(c, async (log, s) => {
		const token = c.req.query("token");
		const guildId = c.req.query("guildId");
		const mode = (c.req.query("mode") || "").toLowerCase().replace(/\s+/g, "");

		if (!token || !guildId) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Missing required params: token, guildId", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}
		if (await isRadioActive(token, guildId, log)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Stop the player first before using this", type: { final: "error", alt: "blocked" } })}}`);
			return;
		}
		if (!hasActivePlayer(token)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		const { player } = await getOrCreatePlayer(token, log);
		const queue = getQueue(player, guildId);

		if (!queue || !isActive(queue)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active queue found for this guild", type: { primary: "error", alt: "inactive_queue" } })}}`);
			return;
		}

		let repeatMode: RMValue | "autoplay";

		if (mode === "" || mode === "toggle") {
			const current = queue.repeatMode as unknown as RMValue;
			const isAutoplay = queue.get("autoplay");

			if (isAutoplay) repeatMode = RM.TRACK;
			else if (current === RM.OFF) repeatMode = "autoplay";
			else if (current === RM.TRACK) repeatMode = RM.QUEUE;
			else repeatMode = RM.OFF;
		} else if (mode in LOOP_MODES) {
			repeatMode = LOOP_MODES[mode];
		} else {
			// support numeric shortcuts: 0=off, 1=track, 2=queue, 3=autoplay
			const num = parseInt(mode, 10);
			const numMap: Record<number, RMValue | "autoplay"> = {
				0: "off",
				1: "track",
				2: "queue",
				3: "autoplay",
			};
			if (!isNaN(num) && num in numMap) {
				repeatMode = numMap[num];
			} else {
				await s.write(`],"data":${JSON.stringify({ status: false, message: `Invalid loop mode: "${mode}". Use: off, track, queue, autoplay (or 0-3)`, type: { primary: "error", alt: "invalid_query" } })}}`);
				return;
			}
		}

		await log(`Setting loop mode to ${repeatMode}...`);

		if (repeatMode === "autoplay") {
			queue.set("autoplay", true);
			await queue.setRepeatMode(RM.OFF as any);
			// Trigger initial fill so tracks appear immediately
			fillAutoplay(queue);
		} else {
			queue.set("autoplay", false);
			// Remove tracks added by autoplay
			const tracks = queue.queue.tracks;
			for (let i = tracks.length - 1; i >= 0; i--) {
				const t = tracks[i];
				if ((t.requester as any)?.isAutoplay) {
					await queue.queue.splice(i, 1);
				}
			}
			await queue.setRepeatMode(repeatMode as any);
		}

		await log(`Loop mode set to ${repeatMode}`);

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				data: { action: "loop", mode: repeatMode },
				type: { primary: "final", alt: "success" },
			})}}`,
		);
	});
});

app.get("/shuffle", async (c) => {
	return await createMusicStream(c, async (log, s) => {
		const token = c.req.query("token");
		const guildId = c.req.query("guildId");

		if (!token || !guildId) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Missing required params: token, guildId", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}
		if (await isRadioActive(token, guildId, log)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Stop the player first before using this", type: { final: "error", alt: "blocked" } })}}`);
			return;
		}
		if (!hasActivePlayer(token)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		const { player } = await getOrCreatePlayer(token, log);
		const queue = getQueue(player, guildId);

		if (!queue || !isActive(queue)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active queue found for this guild", type: { primary: "error", alt: "inactive_queue" } })}}`);
			return;
		}

		if (queue.queue.tracks.length < 2) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Need at least 2 tracks in queue to shuffle", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}

		await log(`Shuffling ${queue.queue.tracks.length} tracks...`);
		await queue.queue.shuffle();
		await log("Queue shuffled");

		const shuffledTracks = queue.queue.tracks.slice(0, 20).map((t) => ({
			title: t.info.title,
			author: t.info.author,
			url: t.info.uri,
		}));

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				data: {
					action: "shuffled",
					queueSize: queue.queue.tracks.length,
					tracks: shuffledTracks,
				},
				type: { primary: "final", alt: "success" },
			})}}`,
		);
	});
});

app.get("/remove", async (c) => {
	return await createMusicStream(c, async (log, s) => {
		const token = c.req.query("token");
		const guildId = c.req.query("guildId");
		const indexStr = c.req.query("index") || "";
		const index = parseInt(indexStr, 10);

		if (!token || !guildId || indexStr === "" || isNaN(index)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Missing or invalid required params: token, guildId, index", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}
		if (await isRadioActive(token, guildId, log)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Stop the player first before using this", type: { final: "error", alt: "blocked" } })}}`);
			return;
		}
		if (!hasActivePlayer(token)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		const { client, player } = await getOrCreatePlayer(token, log);
		const queue = getQueue(player, guildId);

		if (!queue) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		const tracks = queue.queue.tracks;
		if (index < 0 || index >= tracks.length) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: `Index ${index} is out of bounds (0-${tracks.length - 1})`, type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}

		const trackToRemove = tracks[index];
		const current = queue.queue.current;

		await log(`Removing: "${trackToRemove.info.title}"...`);
		await queue.queue.splice(index, 1);
		await log(current ? `Now playing: "${current.info.title}"` : "Queue ended");

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				data: {
					action: "removed",
					removedTrack: formatTrack(trackToRemove, client, queue).data,
					currentTrack: current ? formatTrack(current, client, queue).data : null,
				},
				type: { primary: "final", alt: "success" },
			})}}`,
		);
	});
});

app.get("/clear", async (c) => {
	return await createMusicStream(c, async (log, s) => {
		const token = c.req.query("token");
		const guildId = c.req.query("guildId");

		if (!token || !guildId) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Missing required params: token, guildId", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}
		if (await isRadioActive(token, guildId, log)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Stop the player first before using this", type: { final: "error", alt: "blocked" } })}}`);
			return;
		}
		if (!hasActivePlayer(token)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		const { player } = await getOrCreatePlayer(token, log);
		const queue = getQueue(player, guildId);

		if (!queue) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		const sizeBefore = queue.queue.tracks.length;
		await log(`Clearing queue (${sizeBefore} tracks)...`);
		await queue.queue.splice(0, sizeBefore);
		await log("Queue cleared");

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				data: { action: "cleared", tracksRemoved: sizeBefore },
				type: { primary: "final", alt: "success" },
			})}}`,
		);
	});
});

app.get("/jump", async (c) => {
	return await createMusicStream(c, async (log, s) => {
		const token = c.req.query("token");
		const guildId = c.req.query("guildId");
		const indexStr = c.req.query("index") || "";
		const index = parseInt(indexStr, 10);

		if (!token || !guildId || indexStr === "" || isNaN(index)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Missing or invalid required params: token, guildId, index", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}
		if (await isRadioActive(token, guildId, log)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Stop the player first before using this", type: { final: "error", alt: "blocked" } })}}`);
			return;
		}
		if (!hasActivePlayer(token)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		const { client, player } = await getOrCreatePlayer(token, log);
		const queue = getQueue(player, guildId);

		if (!queue || !isActive(queue)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active queue found for this guild", type: { primary: "error", alt: "inactive_queue" } })}}`);
			return;
		}

		const tracks = queue.queue.tracks;
		if (index < 0 || index >= tracks.length) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: `Index ${index} is out of bounds (0-${tracks.length - 1})`, type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}

		const targetTrack = tracks[index];
		await log(`Jumping to index ${index}: "${targetTrack.info.title}"`);

		// Remove all tracks before the target, then skip current
		if (index > 0) await queue.queue.splice(0, index);
		await queue.skip();
		await log("Jumped successfully");

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				data: {
					action: "jumped",
					track: formatTrack(targetTrack, client, queue).data,
					index,
				},
				type: { primary: "final", alt: "success" },
			})}}`,
		);
	});
});

app.get("/move", async (c) => {
	return await createMusicStream(c, async (log, s) => {
		const token = c.req.query("token");
		const guildId = c.req.query("guildId");
		const fromStr = c.req.query("from") || "";
		const toStr = c.req.query("to") || "";
		const from = parseInt(fromStr, 10);
		const to = parseInt(toStr, 10);

		if (!token || !guildId || fromStr === "" || toStr === "" || isNaN(from) || isNaN(to)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Missing or invalid required params: token, guildId, from, to", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}
		if (await isRadioActive(token, guildId, log)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Stop the player first before using this", type: { final: "error", alt: "blocked" } })}}`);
			return;
		}
		if (!hasActivePlayer(token)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		const { client, player } = await getOrCreatePlayer(token, log);
		const queue = getQueue(player, guildId);

		if (!queue) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		const tracks = queue.queue.tracks;
		if (from < 0 || from >= tracks.length || to < 0 || to >= tracks.length) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: `Index out of bounds (0-${tracks.length - 1})`, type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}

		const fromTrack = tracks[from];
		const toTrack = tracks[to];

		if (from === to) {
			await s.write(
				`],"data":${JSON.stringify({
					status: true,
					data: {
						action: "moved",
						fromTrack: formatTrack(fromTrack, client, queue).data,
						toTrack: formatTrack(toTrack, client, queue).data,
						from,
						to,
					},
					type: { primary: "final", alt: "success" },
				})}}`,
			);
			return;
		}

		await log(`Moving track "${fromTrack.info.title}" from ${from} to ${to}`);

		// Save reference before removing — queue.queue.splice() does NOT
		// return removed items like Array.splice (it returns {})
		await queue.queue.splice(from, 1);
		// After removal, indices shift: if to > from, adjust down by 1
		await queue.queue.splice(to > from ? to - 1 : to, 0, fromTrack);
		await log("Track moved");

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				data: {
					action: "moved",
					fromTrack: formatTrack(fromTrack, client, queue).data,
					toTrack: formatTrack(toTrack, client, queue).data,
					from,
					to,
				},
				type: { primary: "final", alt: "success" },
			})}}`,
		);
	});
});

app.get("/back", async (c) => {
	return await createMusicStream(c, async (log, s) => {
		const token = c.req.query("token");
		const guildId = c.req.query("guildId");

		if (!token || !guildId) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Missing required params: token, guildId", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}
		if (await isRadioActive(token, guildId, log)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Stop the player first before using this", type: { final: "error", alt: "blocked" } })}}`);
			return;
		}
		if (!hasActivePlayer(token)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		const { client, player } = await getOrCreatePlayer(token, log);
		const queue = getQueue(player, guildId);

		if (!queue) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		if (!queue.queue.previous.length) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No history found", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}

		const skipped = queue.queue.current;
		const prevTrack = queue.queue.previous[0];
		await log(`Backing to previous track: "${prevTrack?.info.title || "Unknown"}"`);

		try {
			// lavalink-client has no built-in previous() — prepend the previous
			// track back into the queue then skip the current one
			await queue.queue.add(prevTrack as any, 0);
			await queue.skip();
			await log("Back successful");
		} catch (err: any) {
			await log(`Back failed: ${err.message}`);
			await s.write(`],"data":${JSON.stringify({ status: false, message: `Failed to go back: ${err.message}`, type: { primary: "error", alt: "critical" } })}}`);
			return;
		}

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				data: {
					action: "back",
					skippedTrack: skipped ? formatTrack(skipped, client, queue).data : null,
					currentTrack: prevTrack ? formatTrack(prevTrack, client, queue).data : null,
				},
				type: { primary: "final", alt: "success" },
			})}}`,
		);
	});
});

app.get("/247", async (c) => {
	return await createMusicStream(c, async (log, s) => {
		const token = c.req.query("token");
		const guildId = c.req.query("guildId");

		if (!token || !guildId) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Missing required params: token, guildId", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}
		if (!hasActivePlayer(token)) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		const valueStr = c.req.query("value") || "";
		if (valueStr !== "true" && valueStr !== "false") {
			await s.write(`],"data":${JSON.stringify({ status: false, message: 'Value must be "true" or "false"', type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}

		const is247 = valueStr === "true";

		// Check if the bot is actually in the guild
		const { player } = await getOrCreatePlayer(token, log);
		const queue = getQueue(player, guildId);

		if (!queue) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active player or queue found for this guild", type: { primary: "error", alt: "inactive_queue" } })}}`);
			return;
		}

		set247(token, guildId, is247);
		await log(`24/7 mode set to ${is247} for guild ${guildId}`);

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				data: { action: "247_set", is247 },
				type: { primary: "final", alt: "success" },
			})}}`,
		);
	});
});

app.get("/where", async (c) => {
	return await createMusicStream(c, async (log, s) => {
		const token = c.req.query("token");
		const guildId = c.req.query("guildId");
		const authorId = c.req.query("authorId");

		if (!token) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Missing required param: token", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}
		const isNew = !hasActivePlayer(token);
		await log(isNew ? "Creating new discord.js client..." : "Reusing existing discord.js client");

		const { client, player: manager } = await getOrCreatePlayer(token, log);
		await log(isNew ? "Discord.js client ready" : "Client retrieved");
		await log("Lavalink manager active");

		// ── Bot's connected VCs (array) ───────────────────────────────────
		const botChannels: {
			id: string;
			voiceId: string;
			name: string;
			guildId: string;
			usersInChannel:
				| {
						id: string;
						username: string;
						displayName: string;
						isBot: boolean;
				  }[]
				| null;
		}[] = [];

		const playersToCheck = guildId ? ([[guildId, manager.players.get(guildId)]].filter(([, p]) => p) as [string, any][]) : [...manager.players.entries()];

		for (const [gid, guildPlayer] of playersToCheck) {
			if (guildPlayer?.voiceChannelId) {
				let ch = client.channels.cache.get(guildPlayer.voiceChannelId) as any;
				if (!ch) {
					ch = (await client.channels.fetch(guildPlayer.voiceChannelId).catch(() => null)) as any;
				}
				const usersInChannel = ch?.members
					? [...ch.members.values()].map((m: any) => ({
							id: m.user.id,
							username: m.user.username,
							displayName: m.displayName,
							isBot: m.user.bot,
						}))
					: null;
				botChannels.push({
					id: guildPlayer.voiceChannelId,
					voiceId: guildPlayer.voiceChannelId,
					name: ch?.name ?? "Unknown",
					guildId: gid,
					usersInChannel,
				});
				await log(`Bot is in VC: ${ch?.name ?? "Unknown"} (${guildPlayer.voiceChannelId}) in guild ${gid}`);
			}
		}

		if (botChannels.length === 0) await log("Bot is not in any voice channel");

		// ── Author's current VC ───────────────────────────────────────────
		let authorChannel: {
			id: string;
			voiceId: string;
			name: string;
			guildId: string;
		} | null = null;

		if (authorId) {
			await log(`Looking up voice channel for user: ${authorId}`);
			let guildsToCheck: any[] = [];
			if (guildId) {
				let g = client.guilds.cache.get(guildId);
				if (!g) g = (await client.guilds.fetch(guildId).catch(() => undefined)) as any;
				if (g) guildsToCheck = [g];
			} else {
				guildsToCheck = [...client.guilds.cache.values()];
			}

			for (const guild of guildsToCheck as any[]) {
				try {
					const member = await guild.members.fetch(authorId).catch(() => null);
					if (member?.voice?.channelId) {
						const channelId = member.voice.channelId;
						const channelName = member.voice.channel?.name ?? "Unknown";
						authorChannel = {
							id: channelId,
							voiceId: channelId,
							name: channelName,
							guildId: guild.id,
						};
						await log(`User ${authorId} is in VC: ${channelName} (${channelId})`);
						break;
					}
				} catch {}
			}
			if (!authorChannel) await log(`User ${authorId} is not in any voice channel`);
		}

		const result = botChannels.map((b) => ({
			client: {
				id: b.id,
				voiceId: b.id,
				name: b.name,
				guildId: b.guildId,
			},
			author: authorChannel?.guildId === b.guildId ? authorChannel : null,
			sameChannel: !!(authorChannel && authorChannel.id === b.id),
			usersInChannel: b.usersInChannel,
		}));

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				data: result,
				author: authorChannel,
				type: { primary: "final", alt: "success" },
			})}}`,
		);
	});
});

export default app;
