import { Hono } from "hono";
const app = new Hono();

import { DiscordTiktokFeed, getToken } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/discord/tiktokFeed", async (c) => {
	const token = getToken(c);
	const channelId = c.req.query("channelId");
	const messageId = c.req.query("messageId");
	const region_code = c.req.query("region_code") || "";

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!channelId) return c.json({ error: "Missing valid parameter: channelId" }, 202);

	c.header("X-Route", "discord.com, www.tiktok.com");

	return await dispatch(c, () => DiscordTiktokFeed(token, channelId, messageId ?? undefined, region_code));
});

export default app;
