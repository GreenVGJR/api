import { Hono } from "hono";
const app = new Hono();

import { RobloxUsers } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/roblox/users", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	c.header("X-Route", "apis.roblox.com, catalog.roblox.com, friends.roblox.com, users.roblox.com, thumbnails.roblox.com");
	return await dispatch(c, () => RobloxUsers(query));
});

export default app;
