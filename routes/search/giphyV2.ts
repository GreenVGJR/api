import { Hono } from "hono";
const app = new Hono();

import { GiphyAPI } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/giphy/v2", async (c) => {
	const query = c.req.query("q");
	const type = c.req.query("type");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}

	const validTypes = ["gif", "sticker", "clip"];
	if (type && !validTypes.includes(type)) {
		return c.json(
			{
				error: "Invalid type parameter",
				supported_types: validTypes,
			},
			202,
		);
	}
	c.header("X-Route", "api.giphy.com");
	return await dispatch(c, () => GiphyAPI(query, type));
});

export default app;
