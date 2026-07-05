import { Hono } from "hono";
const app = new Hono();

import { SPMusic } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/spotify", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "api.spotify.com, api-partner.spotify.com");
	return await dispatch(c, () => SPMusic(query));
});

export default app;
