import { Hono } from "hono";
const app = new Hono();

import { Audiomack } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/audiomack", async (c) => {
	const query = c.req.query("q");
	const type = c.req.query("type") || "songs";
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}

	const validTypes = [
		"songs",
		"albums",
		"playlists",
		"artists",
		"song",
		"album",
		"playlist",
		"artist",
	];
	if (type && !validTypes.includes(type.toLowerCase())) {
		return c.json(
			{
				error: "Invalid type parameter",
				supported_types: ["songs", "albums", "playlists", "artists"],
			},
			202,
		);
	}

	c.header("X-Route", "api.audiomack.com");
	return await dispatch(c, () => Audiomack(query, type));
});

export default app;
