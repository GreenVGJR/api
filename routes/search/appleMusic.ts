import { Hono } from "hono";
const app = new Hono();

import { AppleMusicSearch } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/applemusic", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	const limitStr: any = c.req.query("limit");
	const limit = isNaN(limitStr) ? 1 : Math.min(30, Math.max(1, parseInt(limitStr, 10)));
	c.header("X-Route", "itunes.apple.com, music.apple.com");

	return await dispatch(c, () => AppleMusicSearch(query, limit));
});

export default app;
