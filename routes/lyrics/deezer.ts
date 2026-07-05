import { Hono } from "hono";
import { dispatch } from "../../functions/httpRequest.js";
const app = new Hono();
import { deezerLyrics } from "../../functions/request.js";

app.get("/deezer", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "pipe.deezer.com");
	return await dispatch(c, () => deezerLyrics(query!));
});

export default app;
