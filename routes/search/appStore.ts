import { Hono } from "hono";
const app = new Hono();

import { AppstoreSearch } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

const ALLOWED_TYPES = ["iphone", "ipad", "mac", "vision", "watch", "tv"];

app.get("/appstore", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}

	const rawType = c.req.query("type");
	if (rawType !== undefined && (typeof rawType !== "string" || !ALLOWED_TYPES.includes(rawType))) {
		return c.json({ error: `Invalid type. Available: ${ALLOWED_TYPES.join(", ")}` }, 202);
	}
	const type = rawType || "iphone";
	c.header("X-Route", "apps.apple.com");

	return await dispatch(c, () => AppstoreSearch(query, type));
});

export default app;
