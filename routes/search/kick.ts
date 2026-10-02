import { Hono } from "hono";
const app = new Hono();

import { KickSearch } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/kick", async (c) => {
	const query = c.req.query("q");
	const withStream = c.req.query("withStream") === "true";
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "search.kick.com");
	return await dispatch(c, () => KickSearch(query, withStream));
});

export default app;
