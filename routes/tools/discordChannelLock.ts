import { Hono } from "hono";
const app = new Hono();

import { DiscordLockAllChannels, getQuery } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

const ALLOWED_TYPES = ["all", "text", "voice"];

const runLock = (c: any, lock: boolean) => {
	const token = getQuery(c, "token");
	const guildId = getQuery(c, "guildId");
	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);

	const type = getQuery(c, "type") || "all";
	if (!ALLOWED_TYPES.includes(type)) return c.json({ error: "Invalid type (all, text, voice)" }, 202);

	c.header("X-Route", "discord.com");
	return dispatch(c, () => DiscordLockAllChannels(token!, guildId!, lock, type));
};

app.get("/discord/channel/lockAll", async (c) => {
	return await runLock(c, true);
});

app.get("/discord/channel/unlockAll", async (c) => {
	return await runLock(c, false);
});

export default app;
