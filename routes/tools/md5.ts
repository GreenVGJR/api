import { Hono } from "hono";
const app = new Hono();

app.get("/md5", async (c) => {
	const query = c.req.query("q");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	return c.json({
		value: new Bun.CryptoHasher("md5").update(query).digest("hex"),
	});
});

export default app;
