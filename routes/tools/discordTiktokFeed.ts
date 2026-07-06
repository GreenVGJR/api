import { Hono } from "hono";
const app = new Hono();

import { DiscordTiktokFeed } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/discord/tiktokFeed", async (c) => {
	const token = c.req.query("token");
	const channelId = c.req.query("channelId");
	const messageId = c.req.query("messageId");
	const region_code = c.req.query("region_code") || "";

	c.header("X-Route", "discord.com, www.tiktok.com");

	return await dispatch(c, () => DiscordTiktokFeed(token!, channelId!, messageId!, region_code));
});

export default app;
