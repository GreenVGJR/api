import { Hono } from "hono";
const app = new Hono();

import { DiscordInfoMember } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/discord/infoMember", async (c) => {
	let token: string | null = null;
	try {
		const queryToken = c.req.query("token");
		if (queryToken) {
			const checktoken = Number.isInteger(parseInt(atob(queryToken.split(".")[0])));
			if (!checktoken) throw new Error();
			token = queryToken;
		}
	} catch {}

	const queryUserId = c.req.query("userId");
	const userId = queryUserId && Number.isInteger(parseInt(queryUserId)) ? queryUserId : null;

	const queryGuildId = c.req.query("guildId");
	const guildId = queryGuildId && Number.isInteger(parseInt(queryGuildId)) ? queryGuildId : undefined;

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!userId) return c.json({ error: "Missing valid parameter: userId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () => DiscordInfoMember(token!, userId!, guildId));
});

export default app;
