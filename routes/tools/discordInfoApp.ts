import { Hono } from "hono";
const app = new Hono();

import { DiscordInfoApp, getToken } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

const parseSnowflake = (value: string | undefined) =>
	value && /^\d+$/.test(value) ? value : null;

app.get("/discord/infoApp", async (c) => {
	const rawToken = c.req.query("token");
	const token = rawToken ? getToken(c) : null;
	const botId = parseSnowflake(c.req.query("botId"));

	if (rawToken && !token)
		return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!botId) return c.json({ error: "Missing valid parameter: botId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () => DiscordInfoApp(token, botId));
});

export default app;
