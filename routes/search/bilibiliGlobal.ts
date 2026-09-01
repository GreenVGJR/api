import { Hono } from "hono";
const app = new Hono();

import { BilibiliGlobal } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/bilibili/global", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "api.bilibili.com");
	return await dispatch(c, () => BilibiliGlobal(query));
});

export default app;
