import { Hono } from "hono";
const app = new Hono();

import { DiscordInfoClient, getToken } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/discord/infoClient", async (c) => {
	const rawToken = c.req.query("token");
	const token = rawToken ? getToken(c) : null;

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () => DiscordInfoClient(token));
});

export default app;
