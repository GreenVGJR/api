import { Hono } from "hono";
const app = new Hono();

import { SCMusic } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/soundcloud", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	const limitStr: any = c.req.query("limit");
	const limit = isNaN(limitStr) ? 1 : Math.min(30, Math.max(1, parseInt(limitStr, 10)));
	c.header("X-Route", "api-v2.soundcloud.com, mobi.soundcloud.com");
	return await dispatch(c, () => SCMusic(query, false, limit));
});

export default app;
