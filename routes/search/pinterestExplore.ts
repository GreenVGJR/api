import { Hono } from "hono";
const app = new Hono();

import { pinterestExplore } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

const ALLOWED_RATIOS = ["all", "portrait", "landscape", "square"];

app.get("/pinterest/explore", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}

	const rawRatio = c.req.query("ratio")?.toLowerCase();
	if (rawRatio !== undefined && (typeof rawRatio !== "string" || !ALLOWED_RATIOS.includes(rawRatio))) {
		return c.json({ error: `Invalid ratio. Available: ${ALLOWED_RATIOS.join(", ")}` }, 202);
	}

	c.header("X-Route", "id.pinterest.com");
	return await dispatch(c, () => pinterestExplore(query, rawRatio || "all"));
});

export default app;
