import { Hono } from "hono";
const app = new Hono();

import { infoGiphy } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/giphy", async (c) => {
	const query = c.req.query("url");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "giphy.com");
	return await dispatch(c, () => infoGiphy(query));
});

export default app;
