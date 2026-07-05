import { Hono } from "hono";
const app = new Hono();

import { Pexels } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/pexels", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "api.pexels.com");
	return await dispatch(c, () => Pexels(query));
});

export default app;
