import { Hono } from "hono";
const app = new Hono();

import { yahooImageSearch } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/yahooImage", async (c) => {
	const query = c.req.query("q");

	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "images.search.yahoo.com, tse1.mm.bing.net");
	return await dispatch(c, () => yahooImageSearch(query));
});

export default app;
