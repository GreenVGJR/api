import { Hono } from "hono";
const app = new Hono();

import { googleImgSearchV2 } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/googleImage/cse", async (c) => {
	const query = c.req.query("q");

	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "cse.google.com, www.google.com");
	return await dispatch(c, () => googleImgSearchV2(query));
});

export default app;
