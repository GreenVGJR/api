import { Hono } from "hono";
const app = new Hono();

import { Tidal } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/tidal", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "api.tidal.com");
	const limitStr: any = c.req.query("limit");
	const limit = isNaN(limitStr) ? 1 : Math.min(20, Math.max(1, parseInt(limitStr, 10)));
	return await dispatch(c, () => Tidal(query, false, limit));
});

export default app;
