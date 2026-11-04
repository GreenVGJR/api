import { Hono } from "hono";
const app = new Hono();
import { RedditDownload } from "../../functions/request.js";
import { rateLimit } from "../../functions/httpRequest.js";
import { recordRequestLog } from "../../functions/telemetry.js";

app.get("/reddit/video", async (c) => {
	const query = c.req.query("url");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	await rateLimit();
	const result: any = await RedditDownload(query);
	const target = result?.media;
	if (!target) {
		recordRequestLog(c, 404);
		return c.json({ error: result?.error || "Video not found" }, 404);
	}
	c.header("X-Route", result?.source === "redgifs" ? "api.redgifs.com" : "www.reddit.com");
	if (c.req.query("json") === "true" || !c.req.header("user-agent")?.startsWith("Mozilla/5.0")) {
		recordRequestLog(c, 200);
		return c.json({ url: target, type: "video" });
	}
	recordRequestLog(c, 302);
	return c.text(target, 302, { Location: target });
});

export default app;
