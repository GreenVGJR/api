import crypto from "crypto";
import { Hono } from "hono";
import { commonHeaders } from "../../functions/request.js";
import { blobDispatch } from "../../functions/httpRequest.js";

const app = new Hono();

app.get("/ai-image/magicstudio", async (c) => {
	const query = c.req.query("prompt");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	const genuuid = crypto.randomUUID();
	c.header("X-Route", "ai-api.magicstudio.com");
	c.header("X-Enc-Data", "model:unknown,id:" + genuuid);

	const formq = new FormData();
	formq.append("prompt", query);
	formq.append("output_format", "bytes");
	formq.append("request_timestamp", String(new Date().getTime() / 1000));
	formq.append("user_is_subscribed", "false");
	formq.append("user_profile_id", "null");
	formq.append("anonymous_user_id", genuuid);

	return await blobDispatch(
		c,
		async () =>
			await fetch("https://ai-api.magicstudio.com/api/ai-art-generator", {
				method: "POST",
				headers: {
					...commonHeaders,
					Origin: "https://magicstudio.com",
					Referer: "https://magicstudio.com/ai-art-generator",
				},
				body: formq,
			}),
		{ "content-type": "image/png" },
	);
});

export default app;
