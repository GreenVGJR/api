import { Hono } from "hono";
const app = new Hono();

import { RageProfile } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/rage", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}

	c.header("X-Route", "rage.wtf");
	c.header("X-Ech-Target", "cloudflare-ech");

	return await dispatch(c, () => RageProfile(query));
});

export default app;
