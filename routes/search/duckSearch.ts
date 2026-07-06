import { Hono } from "hono";
const app = new Hono();

import { duckImageSearch, duckSearch, duckVideoSearch } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/duckduckgo", async (c) => {
	const query = c.req.query("q");

	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "duckduckgo.com, links.duckduckgo.com");
	return await dispatch(c, () => duckSearch(query));
});

app.get("/duckduckgo/image", async (c) => {
	const query = c.req.query("q");

	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "duckduckgo.com");
	return await dispatch(c, () => duckImageSearch(query));
});

app.get("/duckduckgo/video", async (c) => {
	const query = c.req.query("q");

	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "duckduckgo.com");
	return await dispatch(c, () => duckVideoSearch(query));
});

export default app;
