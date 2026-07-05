import { Hono } from "hono";
import {
	DiscordCreateSticker,
	DiscordDeleteSticker,
	DiscordInfoSticker,
	getQuery,
	getToken,
} from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest";

const app = new Hono();

app.get("/discord/infoSticker", async (c) => {
	let token: string | null = null;
	try {
		const queryToken = c.req.query("token");
		if (queryToken) {
			const checktoken = Number.isInteger(
				parseInt(atob(queryToken.split(".")[0])),
			);
			if (!checktoken) throw new Error();
			token = queryToken;
		}
	} catch {}

	const q = c.req.query("q") || "";

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!q) return c.json({ error: "Missing valid parameter: q" }, 202);

	return await dispatch(c, () => DiscordInfoSticker(token!, q));
});

app.get("/discord/sticker/create", async (c) => {
	const token = getToken(c);

	const queryGuildId = c.req.query("guildId");
	const guildId =
		queryGuildId && Number.isInteger(parseInt(queryGuildId))
			? queryGuildId
			: null;

	const url = getQuery(c, "url");
	const name = getQuery(c, "name");
	const descriptionQuery = getQuery(c, "description");
	const tagsQuery = getQuery(c, "tags");
	const reasonQuery = getQuery(c, "reason");

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId)
		return c.json({ error: "Missing valid parameter: guildId" }, 202);
	if (!url || typeof url !== "string")
		return c.json({ error: "Missing valid parameter: url" }, 202);
	if (!name || typeof name !== "string")
		return c.json({ error: "Missing valid parameter: name" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () =>
		DiscordCreateSticker(token, guildId, {
			url,
			name,
			description: typeof descriptionQuery === "string" ? descriptionQuery : "",
			tags:
				typeof tagsQuery === "string" && tagsQuery.trim() ? tagsQuery : name,
			reason:
				typeof reasonQuery === "string" && reasonQuery.trim()
					? reasonQuery
					: undefined,
		}),
	);
});

app.get("/discord/deleteSticker", async (c) => {
	const token = getToken(c);
	const guildId = c.req.query("guildId");
	const stickerId = c.req.query("stickerId");

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId || !/^\d+$/.test(guildId))
		return c.json({ error: "Missing valid parameter: guildId" }, 202);
	if (!stickerId || !/^\d+$/.test(stickerId))
		return c.json({ error: "Missing valid parameter: stickerId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () =>
		DiscordDeleteSticker(token, guildId, stickerId),
	);
});

export default app;
