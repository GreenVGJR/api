import { Hono } from "hono";
const app = new Hono();

import { DiscordInfoChannel } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/discord/infoChannel", async (c) => {
	let token: string | null = null;
	try {
		const queryToken = c.req.query("token");
		if (queryToken) {
			const checktoken = Number.isInteger(parseInt(atob(queryToken.split(".")[0])));
			if (!checktoken) throw new Error();
			token = queryToken;
		}
	} catch {}

	const channelId = c.req.query("channelId");
	const queryGuildId = c.req.query("guildId");
	const guildId = queryGuildId && Number.isInteger(parseInt(queryGuildId)) ? queryGuildId : undefined;

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!channelId) return c.json({ error: "Missing valid parameter: channelId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () => DiscordInfoChannel(token!, channelId, guildId));
});

export default app;
