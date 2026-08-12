import { Hono } from "hono";
const app = new Hono();

import { pinterest } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

const ALLOWED_TYPES = ["image", "video", "gif", "all"];
const ALLOWED_RATIOS = ["all", "portrait", "landscape", "square"];

app.get("/pinterest", async (c) => {
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
	const type = rawType || "all";

	const rawRatio = c.req.query("ratio")?.toLowerCase();
	if (rawRatio !== undefined && (typeof rawRatio !== "string" || !ALLOWED_RATIOS.includes(rawRatio))) {
		return c.json({ error: `Invalid ratio. Available: ${ALLOWED_RATIOS.join(", ")}` }, 202);
	}
	const ratio = rawRatio || "all";

	const limitStr: any = c.req.query("limit");
	const limit = isNaN(limitStr) ? 20 : Math.min(40, Math.max(1, parseInt(limitStr, 10)));
	c.header("X-Route", "www.pinterest.com");
	return await dispatch(c, () => pinterest(query, type, limit, ratio));
});

export default app;
