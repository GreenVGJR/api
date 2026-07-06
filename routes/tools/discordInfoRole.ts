import { Hono } from "hono";
const app = new Hono();

import { DiscordInfoRole } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/discord/infoRole", async (c) => {
	let token: string | null = null;
	try {
		const queryToken = c.req.query("token");
		if (queryToken) {
			const checktoken = Number.isInteger(parseInt(atob(queryToken.split(".")[0])));
			if (!checktoken) throw new Error();
			token = queryToken;
		}
	} catch {}

	const roleId = c.req.query("roleId");
	const queryGuildId = c.req.query("guildId");
	const guildId = queryGuildId && Number.isInteger(parseInt(queryGuildId)) ? queryGuildId : null;

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!roleId) return c.json({ error: "Missing valid parameter: roleId" }, 202);
	if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () => DiscordInfoRole(token!, roleId, guildId));
});

export default app;
