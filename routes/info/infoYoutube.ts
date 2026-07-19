import { Hono } from "hono";
const app = new Hono();

import { infoYoutube, infoYoutubeChannel } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/youtube/video", async (c) => {
	const query = c.req.query("url");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "m.youtube.com, www.youtube.com");
	return await dispatch(c, () => infoYoutube(query));
});

app.get("/youtube/channel", async (c) => {
	const query = c.req.query("url");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	const feeds = c.req.query("feed") === "true";
	c.header("X-Route", "m.youtube.com, www.youtube.com");
	return await dispatch(c, () => infoYoutubeChannel(query, feeds));
});

export default app;
