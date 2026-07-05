import { Hono } from "hono";
const app = new Hono();

import { RadioSearch } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/radio", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "all.api.radio-browser.info");

	return await dispatch(c, () => RadioSearch(query));
});

export default app;
