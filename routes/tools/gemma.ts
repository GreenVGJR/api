import { Hono } from "hono";
const app = new Hono();

import { GoogleGemma } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/chat/gemma", async (c) => {
	const query = c.req.query("prompt");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "multi-modal.ai.cloudflare.com");
	return await dispatch(c, () => GoogleGemma(query));
});

export default app;
