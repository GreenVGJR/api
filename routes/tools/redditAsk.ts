import { Hono } from "hono";
const app = new Hono();

import { dispatch } from "../../functions/httpRequest.js";
import { redditAsk } from "../../functions/request.js";

app.get("/chat/reddit/ask", async (c) => {
	const prompt = c.req.query("prompt");
	if (prompt === undefined) {
		return c.json({ error: "Missing parameter required", isFallback: true }, 202);
	} else if (prompt.trim() === "") {
		return c.json({ error: "Nothing to do", isFallback: true }, 202);
	}

	c.header("X-Route", "reddit.answers");
	return await dispatch(c, () => redditAsk(prompt));
});

export default app;
