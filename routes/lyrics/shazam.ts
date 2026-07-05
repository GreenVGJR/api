import { Hono } from "hono";
import { dispatch } from "../../functions/httpRequest.js";
import { ShazamLyrics } from "../../functions/request.js";

const app = new Hono();

app.get("/shazam", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "itunes.apple.com, www.shazam.com");
	return await dispatch(c, () => ShazamLyrics(query!));
});

export default app;
