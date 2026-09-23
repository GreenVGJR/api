import { Hono } from "hono";
const app = new Hono();

import { hasActivePlayer, destroyPlayer, clearAll247, createMusicStream } from "../../functions/musicPlayer.js";

app.get("/destroy", async (c) => {
	const token = c.req.query("token");

	return await createMusicStream(c, async (log, s) => {
		if (!token) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Missing required params: token", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}

		// discord.js client active (players map holds the client + Lavalink manager)?
		if (!hasActivePlayer(token)) {
			await log("No active discord.js client for this token");
			await s.write(`],"data":${JSON.stringify({ status: false, message: "No active client found", type: { primary: "error", alt: "inactive_player" } })}}`);
			return;
		}

		await log("Clearing 24/7 state for all guilds...");
		clearAll247(token);

		await log("Destroying Lavalink players");
		await destroyPlayer(token);
		await log("Discord.js client destroyed");

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				data: { action: "destroyed", context_destroyed: true },
				type: { primary: "final", alt: "success" },
			})}}`,
		);
	});
});

export default app;
