import { Hono } from "hono";
const app = new Hono();

import { DiscordTTS } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/discord/tts", async (c) => {
	const token = c.req.query("token");
	const channelId = c.req.query("channelId");
	const q = c.req.query("q");
	const file_name = c.req.query("file_name");
	const messageId = c.req.query("messageId");
	const clone = c.req.query("clone") === "true";
	const lang = c.req.query("lang");
	const quality = c.req.query("quality");

	c.header("X-Route", "translate.google.com");

	return await dispatch(c, () => DiscordTTS(token!, channelId!, q!, file_name ?? undefined, messageId ?? undefined, clone, lang ?? undefined, quality ?? undefined));
});

export default app;
