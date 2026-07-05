import { Hono } from "hono";
import { dispatch } from "../../functions/httpRequest.js";
import { EmojiKitchen } from "../../functions/request.js";

const app = new Hono();

app.get("/emoji/kitchen", async (c) => {
	const q1 = c.req.query("q1");
	const q2 = c.req.query("q2");
	const imageOnly = c.req.query("imageOnly") === "true";

	if (!q1 || !q2) {
		return c.json({ error: "Missing parameters required: q1 and q2" }, 202);
	}

	const emojiRegex = /\p{Emoji}/u;
	if (!emojiRegex.test(q1) || !emojiRegex.test(q2)) {
		return c.json({ error: "Must be emoji" }, 202);
	}

	c.header("X-Route", "tenor.googleapis.com");

	if (imageOnly) {
		const result = await EmojiKitchen(q1, q2);
		if (
			result &&
			!("error" in result) &&
			result.data?.media_formats?.png_transparent?.url
		) {
			const imageUrl = result.data.media_formats.png_transparent.url;

			try {
				const response = await fetch(imageUrl);
				if (response.ok) {
					const contentType =
						response.headers.get("content-type") || "image/png";
					const buffer = await response.arrayBuffer();
					return c.body(buffer, 200, {
						"Content-Type": contentType,
						"Cache-Control": "public, max-age=60",
					});
				}
			} catch (e) {
				console.error("Emoji proxy failed:", e);
			}

			return c.redirect(imageUrl);
		}
		if (result && "error" in result) return c.json(result, 404);
		return c.json({ error: "No combination found" }, 404);
	}

	return await dispatch(c, () => EmojiKitchen(q1, q2));
});

export default app;
