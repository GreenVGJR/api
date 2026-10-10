import { Hono } from "hono";
const app = new Hono();

import { Rule34 } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/rule34", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "rule34.xxx");
	return await dispatch(c, () => Rule34(query));
});

export default app;
