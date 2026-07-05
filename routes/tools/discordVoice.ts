import { Hono } from "hono";
const app = new Hono();

import { DiscordVoice, getQuery, getToken } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/discord/voice/deafen", async (c) => {
	const token = getToken(c);
	const guildId = getQuery(c, "guildId");
	const userId = getQuery(c, "userId");

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId)
		return c.json({ error: "Missing valid parameter: guildId" }, 202);
	if (!userId) return c.json({ error: "Missing valid parameter: userId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () =>
		DiscordVoice(token!, guildId, "deafen", { userId }),
	);
});

app.get("/discord/voice/undeafen", async (c) => {
	const token = getToken(c);
	const guildId = getQuery(c, "guildId");
	const userId = getQuery(c, "userId");

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId)
		return c.json({ error: "Missing valid parameter: guildId" }, 202);
	if (!userId) return c.json({ error: "Missing valid parameter: userId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () =>
		DiscordVoice(token!, guildId, "undeafen", { userId }),
	);
});

app.get("/discord/voice/mute", async (c) => {
	const token = getToken(c);
	const guildId = getQuery(c, "guildId");
	const userId = getQuery(c, "userId");

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId)
		return c.json({ error: "Missing valid parameter: guildId" }, 202);
	if (!userId) return c.json({ error: "Missing valid parameter: userId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () =>
		DiscordVoice(token!, guildId, "mute", { userId }),
	);
});

app.get("/discord/voice/unmute", async (c) => {
	const token = getToken(c);
	const guildId = getQuery(c, "guildId");
	const userId = getQuery(c, "userId");

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId)
		return c.json({ error: "Missing valid parameter: guildId" }, 202);
	if (!userId) return c.json({ error: "Missing valid parameter: userId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () =>
		DiscordVoice(token!, guildId, "unmute", { userId }),
	);
});

app.get("/discord/voice/kick", async (c) => {
	const token = getToken(c);
	const guildId = getQuery(c, "guildId");
	const userId = getQuery(c, "userId");

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId)
		return c.json({ error: "Missing valid parameter: guildId" }, 202);
	if (!userId) return c.json({ error: "Missing valid parameter: userId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () =>
		DiscordVoice(token!, guildId, "kick", { userId }),
	);
});

app.get("/discord/voice/move", async (c) => {
	const token = getToken(c);
	const guildId = getQuery(c, "guildId");
	const userId = getQuery(c, "userId");
	const toChannelId = getQuery(c, "toChannelId") || getQuery(c, "to");

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId)
		return c.json({ error: "Missing valid parameter: guildId" }, 202);
	if (!userId) return c.json({ error: "Missing valid parameter: userId" }, 202);
	if (!toChannelId)
		return c.json({ error: "Missing valid parameter: toChannelId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () =>
		DiscordVoice(token!, guildId, "move", { userId, toChannelId }),
	);
});

app.get("/discord/voice/muteall", async (c) => {
	const token = getToken(c);
	const guildId = getQuery(c, "guildId");
	const channelId = getQuery(c, "channelId");

	const authorId = getQuery(c, "authorId");

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId)
		return c.json({ error: "Missing valid parameter: guildId" }, 202);
	if (!channelId)
		return c.json({ error: "Missing valid parameter: channelId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () =>
		DiscordVoice(token!, guildId, "muteall", { channelId, authorId }),
	);
});

app.get("/discord/voice/unmuteall", async (c) => {
	const token = getToken(c);
	const guildId = getQuery(c, "guildId");
	const channelId = getQuery(c, "channelId");

	const authorId = getQuery(c, "authorId");

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId)
		return c.json({ error: "Missing valid parameter: guildId" }, 202);
	if (!channelId)
		return c.json({ error: "Missing valid parameter: channelId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () =>
		DiscordVoice(token!, guildId, "unmuteall", { channelId, authorId }),
	);
});

app.get("/discord/voice/deafall", async (c) => {
	const token = getToken(c);
	const guildId = getQuery(c, "guildId");
	const channelId = getQuery(c, "channelId");

	const authorId = getQuery(c, "authorId");

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId)
		return c.json({ error: "Missing valid parameter: guildId" }, 202);
	if (!channelId)
		return c.json({ error: "Missing valid parameter: channelId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () =>
		DiscordVoice(token!, guildId, "deafall", { channelId, authorId }),
	);
});

app.get("/discord/voice/undeafall", async (c) => {
	const token = getToken(c);
	const guildId = getQuery(c, "guildId");
	const channelId = getQuery(c, "channelId");

	const authorId = getQuery(c, "authorId");

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId)
		return c.json({ error: "Missing valid parameter: guildId" }, 202);
	if (!channelId)
		return c.json({ error: "Missing valid parameter: channelId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () =>
		DiscordVoice(token!, guildId, "undeafall", { channelId, authorId }),
	);
});

app.get("/discord/voice/kickall", async (c) => {
	const token = getToken(c);
	const guildId = getQuery(c, "guildId");
	const channelId = getQuery(c, "channelId");
	const authorId = getQuery(c, "authorId");

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId)
		return c.json({ error: "Missing valid parameter: guildId" }, 202);
	if (!channelId)
		return c.json({ error: "Missing valid parameter: channelId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () =>
		DiscordVoice(token!, guildId, "kickall", { channelId, authorId }),
	);
});

app.get("/discord/voice/moveall", async (c) => {
	const token = getToken(c);
	const guildId = getQuery(c, "guildId");
	const channelId = getQuery(c, "channelId");
	const toChannelId = getQuery(c, "toChannelId") || getQuery(c, "to");
	const authorId = getQuery(c, "authorId");

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId)
		return c.json({ error: "Missing valid parameter: guildId" }, 202);
	if (!channelId)
		return c.json({ error: "Missing valid parameter: channelId" }, 202);
	if (!toChannelId)
		return c.json({ error: "Missing valid parameter: toChannelId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () =>
		DiscordVoice(token!, guildId, "moveall", {
			channelId,
			toChannelId,
			authorId,
		}),
	);
});

app.get("/discord/voice/list", async (c) => {
	const token = getToken(c);
	const guildId = getQuery(c, "guildId");
	const channelId = getQuery(c, "channelId");

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId)
		return c.json({ error: "Missing valid parameter: guildId" }, 202);
	if (!channelId)
		return c.json({ error: "Missing valid parameter: channelId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () =>
		DiscordVoice(token!, guildId, "list", { channelId }),
	);
});

app.get("/discord/voice/setStatus", async (c) => {
	const token = getToken(c);
	const channelId = getQuery(c, "channelId");
	const content = getQuery(c, "content");

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!channelId)
		return c.json({ error: "Missing valid parameter: channelId" }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () =>
		DiscordVoice(token!, "", "setstatus", { channelId, content }),
	);
});

export default app;
