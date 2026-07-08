import { Hono } from "hono";
const app = new Hono();

import { holidaysTime } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/holidays", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}

	const queryYear = c.req.query("year");
	const year = queryYear && /^\d{4}$/.test(queryYear) ? queryYear : new Date().getFullYear().toString();
	if (!year) {
		return c.json({ error: "Missing or invalid year" }, 202);
	}

	c.header("X-Route", "countries.altoal.com, date.nager.at");
	return await dispatch(c, () => holidaysTime(query, year));
});

export default app;
