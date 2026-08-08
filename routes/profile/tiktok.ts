import { Hono } from "hono";
const app = new Hono();

import { TiktokInfoUser } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/tiktok", async (c) => {
	let query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}

	query = query.split(" ")[0];
	c.header("X-Route", "www.tiktok.com");
	return await dispatch(c, () => TiktokInfoUser(query));
});

export default app;
