import { Hono } from "hono";
const app = new Hono();

import { RedditPost } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/reddit/post", async (c) => {
	const url = c.req.query("url");
	if (url === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	}
	if (url === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}

	c.header("X-Route", "www.reddit.com");
	return await dispatch(c, () => RedditPost(url));
});

export default app;
