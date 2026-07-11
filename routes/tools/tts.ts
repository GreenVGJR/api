import { Hono } from "hono";
const app = new Hono();

import { googleTTS } from "../../functions/request.js";
import { blobDispatch } from "../../functions/httpRequest.js";

app.get("/tts", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	const lang = c.req.query("lang") || "en";

	const audio = await googleTTS(query, lang);
	if (!audio) return c.json({ error: "Failed to synthesize speech" }, 202);

	c.header("X-Route", "translate.google.com");
	return await blobDispatch(c, audio, { "content-type": "audio/mpeg" });
});

export default app;
