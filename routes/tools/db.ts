import { Hono } from "hono";
import { dispatch } from "../../functions/httpRequest.js";
import db from "../../functions/database.js";

const app = new Hono();

app.get("/db/get", async (c) => {
	const q = c.req.query("q");
	const hash = c.req.query("hash");
	if (!q || !hash) {
		return c.json({ error: "Missing parameter required (q and hash)" }, 202);
	}
	return await dispatch(c, () => {
		const result = db.get(q, hash);
		if (!result) return { error: "Record not found or invalid hash" };
		return result;
	});
});

app.get("/db/getAll", async (c) => {
	const q = c.req.query("q") || "";
	const hash = c.req.query("hash");
	return await dispatch(c, () => db.getAll(q, hash));
});

app.get("/db/delete", async (c) => {
	const q = c.req.query("q");
	const hash = c.req.query("hash");
	if (!q || !hash) {
		return c.json({ error: "Missing parameter required (q and hash)" }, 202);
	}
	return await dispatch(c, () => {
		if (c.req.raw.signal.aborted) return;
		const result = db.delete(q, hash);
		if (result.error) return result;
		return { status: result.success, name: q, hash: hash };
	});
});

const setRateLimit = new Map<string, { count: number; resetAt: number }>();

app.get("/db/set", async (c) => {
	const name = c.req.query("name");
	const value = c.req.query("value");
	const hash = c.req.query("hash");
	if (!name || !value) {
		return c.json({ error: "Missing parameter required (name and value)" }, 202);
	}

	return await dispatch(c, async () => {
		if (!hash) {
			const ip = c.req.header("cf-connecting-ip")?.split(",")[0] || "127.0.0.1";
			const limitKey = `${ip}`;
			const now = Date.now();
			let limitInfo = setRateLimit.get(limitKey);

			if (limitInfo && now < limitInfo.resetAt) {
				if (limitInfo.count >= 3) {
					const delay = limitInfo.resetAt - now;
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
				limitInfo.count++;
			} else {
				setRateLimit.set(limitKey, { count: 1, resetAt: now + 8000 });
				setTimeout(() => setRateLimit.delete(limitKey), 8000);
			}
		}

		if (c.req.raw.signal.aborted) return;

		const result = db.set(name, value, hash);
		if (result.error) return result;
		return {
			status: true,
			name: name,
			value: value,
			type: result.type,
			hash: result.hash,
		};
	});
});

export default app;
