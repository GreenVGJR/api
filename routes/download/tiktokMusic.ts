import { Hono } from "hono";
const app = new Hono();
import { TiktokMusicDetail } from "../../functions/request.js";
import { rateLimit } from "../../functions/httpRequest.js";
import { recordRequestLog } from "../../functions/telemetry.js";

app.get("/tiktok/music", async (c) => {
	const query = c.req.query("url");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	await rateLimit();
	const result: any = await TiktokMusicDetail(query);
	const target = result?.data?.music?.playUrl;
	if (!target) {
		recordRequestLog(c, 404);
		return c.json({ error: result?.error || "Music not found" }, 404);
	}
	c.header("X-Route", "www.tiktok.com");
	if (c.req.query("json") === "true" || !c.req.header("user-agent")?.startsWith("Mozilla/5.0")) {
		recordRequestLog(c, 200);
		return c.json({
			url: target,
			type: "audio",
			title: result?.data?.music?.title ?? null,
			author: result?.data?.music?.authorName ?? null,
			duration: result?.data?.music?.duration ?? null,
		});
	}
	recordRequestLog(c, 302);
	return c.text(target, 302, { Location: target });
});

export default app;
