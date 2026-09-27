import { Hono } from "hono";
const app = new Hono();
import { InstagramPhoto } from "../../functions/request.js";
import { rateLimit } from "../../functions/httpRequest.js";
import { recordRequestLog } from "../../functions/telemetry.js";

app.get("/instagram/photo", async (c) => {
	const query = c.req.query("url");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	await rateLimit();
	const result: any = await InstagramPhoto(query);
	if (!result || !result.urls?.length) {
		recordRequestLog(c, 404);
		return c.json({ error: result?.error || "Photos not found" }, 404);
	}
	c.header("X-Route", "www.instagram.com");
	recordRequestLog(c, 200);
	return c.json({ urls: result.urls, type: "image" });
});

export default app;
