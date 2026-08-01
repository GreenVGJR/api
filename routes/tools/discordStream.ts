import { Hono } from "hono";
const app = new Hono();

import { DiscordStream, getToken } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/discord/stream", async (c) => {
	const token = getToken(c);
	const channelId = c.req.query("channelId");
	const messageId = c.req.query("messageId");
	const url = c.req.query("url");
	const clone = c.req.query("clone") === "true";
	const onEmbed = c.req.query("onEmbed") === "true";
	const name = c.req.query("name");
	const fallbackEmbed = c.req.query("fallbackEmbed") === "true";

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!channelId) return c.json({ error: "Missing valid parameter: channelId" }, 202);
	if (!url) return c.json({ error: "Missing valid parameter: url" }, 202);

	c.header("X-Route", "discord.com");

	return await dispatch(c, () => DiscordStream(token, channelId, messageId ?? undefined, url, clone, onEmbed, name ?? undefined, fallbackEmbed));
});

export default app;
