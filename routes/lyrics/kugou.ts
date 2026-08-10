import { Hono } from "hono";
import { dispatch } from "../../functions/httpRequest.js";
import { KugouLyrics } from "../../functions/request.js";

const app = new Hono();

app.get("/kugou", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "lyrics.kugou.com");
	return await dispatch(c, () => KugouLyrics(query!));
});

export default app;
