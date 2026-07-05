import { Hono } from "hono";
const app = new Hono();

import {
	DiscordInfoAutomod,
	DiscordSetAutomod,
	DiscordDeleteAutomod,
	getToken,
} from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

const parseSnowflake = (value: string | undefined) =>
	value && /^\d+$/.test(value) ? value : null;

app.get("/discord/infoAutomod", async (c) => {
	const token = getToken(c);
	const guildId = parseSnowflake(c.req.query("guildId"));
	const ruleId = parseSnowflake(c.req.query("ruleId"));

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId)
		return c.json({ error: "Missing valid parameter: guildId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () => DiscordInfoAutomod(token!, guildId!, ruleId));
});

app.get("/discord/setAutomod", async (c) => {
	const token = getToken(c);
	const guildId = parseSnowflake(c.req.query("guildId"));
	const rawRuleId = c.req.query("ruleId");
	const ruleId = parseSnowflake(rawRuleId) || undefined;
	const mode = ruleId || rawRuleId === "null" ? "modify" : "set";

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId)
		return c.json({ error: "Missing valid parameter: guildId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () =>
		DiscordSetAutomod(token, guildId, ruleId, c.req.query(), mode),
	);
});

app.get("/discord/deleteAutomod", async (c) => {
	const token = getToken(c);
	const guildId = parseSnowflake(c.req.query("guildId"));
	const ruleId = parseSnowflake(c.req.query("ruleId"));

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId)
		return c.json({ error: "Missing valid parameter: guildId" }, 202);
	if (!ruleId) return c.json({ error: "Missing valid parameter: ruleId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () => DiscordDeleteAutomod(token, guildId, ruleId));
});

export default app;
