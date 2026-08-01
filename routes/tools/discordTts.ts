import { Hono } from "hono";
const app = new Hono();

import { DiscordTTS, getToken } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/discord/tts", async (c) => {
	const token = getToken(c);
	const channelId = c.req.query("channelId");
	const q = c.req.query("q");
	const file_name = c.req.query("file_name");
	const messageId = c.req.query("messageId");
	const clone = c.req.query("clone") === "true";
	const lang = c.req.query("lang");
	const quality = c.req.query("quality");

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!channelId) return c.json({ error: "Missing valid parameter: channelId" }, 202);
	if (!q) return c.json({ error: "Missing valid parameter: q" }, 202);

	c.header("X-Route", "translate.google.com");

	return await dispatch(c, () => DiscordTTS(token, channelId, q, file_name ?? undefined, messageId ?? undefined, clone, lang ?? undefined, quality ?? undefined));
});

export default app;
