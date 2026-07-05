import { Hono } from "hono";
const app = new Hono();

import { Tenor } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/tenor", async (c) => {
	const query = c.req.query("q");
	const type = c.req.query("type");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}

	const validTypes = ["all", "sticker", "meme"];
	if (type && !validTypes.includes(type)) {
		return c.json(
			{
				error: "Invalid type parameter",
				supported_types: validTypes,
			},
			202,
		);
	}
	c.header("X-Route", "tenor.com");
	return await dispatch(c, () => Tenor(query, type));
});

export default app;
