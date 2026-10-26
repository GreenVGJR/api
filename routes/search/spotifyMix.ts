import { Hono } from "hono";
const app = new Hono();

import { SPMixSearch } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/spotify/mix", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "api-partner.spotify.com, spclient.wg.spotify.com, open.spotify.com, clienttoken.spotify.com");
	return await dispatch(c, () => SPMixSearch(query, false, 1));
});

export default app;
