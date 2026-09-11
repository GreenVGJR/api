import { Hono } from "hono";
const app = new Hono();

import { CanvaGraphics } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/canva/graphics", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "www.canva.com");
	return await dispatch(c, () => CanvaGraphics(query));
});

export default app;
