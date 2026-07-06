import { Hono } from "hono";
import { Buffer } from "buffer";
const app = new Hono();

import { blobDispatch } from "../../functions/httpRequest.js";
import { commonHeaders } from "../../functions/request.js";

async function resizeImage(input: Buffer | ArrayBuffer) {
	return await new Bun.Image(input).resize(1024, 1024, { filter: "mks2021" }).buffer();
}

app.get("/ai-image/flux_schnell", async (c) => {
	const query = c.req.query("prompt");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}
	const CF_AID = process.env.CF_AID;
	const CF_TOKEN = process.env.CF_TOKEN;

	c.header("X-Route", "api.cloudflare.com, fast-flux-demo.replicate.workers.dev");
	c.header("X-Enc-Data", "model:flux-1-schnell");

	if (CF_AID && CF_TOKEN) {
		if (query.length > 2048) {
			console.warn(`Cloudflare AI prompt length (${query.length}) exceeds limit of 2048; skipping Cloudflare AI and using fallback`);
		} else {
			try {
				const cfResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_AID}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${CF_TOKEN}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						prompt: query,
						steps: 1,
						width: 768,
						height: 768,
					}),
				});

				if (cfResponse.ok) {
					const json = (await cfResponse.json()) as any;
					const base64Image = json?.result?.image;
					if (base64Image) {
						const imageBuffer = Buffer.from(base64Image, "base64");
						return await blobDispatch(c, await resizeImage(imageBuffer), {
							"content-type": "image/png",
						});
					}
				} else if (cfResponse.status === 429) {
					console.warn("Cloudflare AI rate limited (429), falling back to Vercel");
				} else {
					let loggedAsWarning = false;
					try {
						const errorJson = await cfResponse.json();
						if (errorJson && typeof errorJson === "object" && Array.isArray(errorJson.errors)) {
							const messages = errorJson.errors.map((e: any) => e.message).join("; ");
							if (/Length of '\/prompt' must be <= 2048/.test(messages) || /Input prompt contains NSFW content/.test(messages)) {
								console.warn(`Cloudflare AI validation error (${cfResponse.status}): ${messages}`);
								loggedAsWarning = true;
							}
						}
					} catch (_) {}
					if (!loggedAsWarning) {
						const errorText = await cfResponse.text();
						console.error(`Cloudflare AI error (${cfResponse.status}):`, errorText);
					}
				}
			} catch (e) {
				console.error("Cloudflare AI fetch error:", e);
			}
		}
	}

	const fallbackResponse = await fetch(`https://fast-flux-demo.replicate.workers.dev/api/generate-image?text=${query}`, {
		method: "GET",
		headers: {
			...commonHeaders,
			Accept: "application/json, text/plain, */*",
			"Sec-Fetch-Dest": "empty",
			"Sec-Fetch-Mode": "cors",
			"Sec-Fetch-Site": "same-site",
		},
	});

	if (!fallbackResponse.ok)
		return await blobDispatch(c, fallbackResponse, {
			"content-type": "image/png",
		});
	return await blobDispatch(c, await resizeImage(await fallbackResponse.arrayBuffer()), { "content-type": "image/png" });
});

app.get("/ai-image/flux_klein", async (c) => {
	const query = c.req.query("prompt");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}

	c.header("X-Route", "multi-modal.ai.cloudflare.com");
	c.header("X-Enc-Data", "model:@cf/black-forest-labs/flux-2-klein-9b");

	const formData = new FormData();
	formData.append("prompt", query);
	formData.append("steps", "1");
	formData.append("guidance", "2");

	const response = await fetch(`${atob("aHR0cHM6Ly9tdWx0aS1tb2RhbC5haS5jbG91ZGZsYXJlLmNvbS9hcGkvaW5mZXJlbmNl")}?model=@cf/black-forest-labs/flux-2-klein-9b`, {
		body: formData,
		method: "POST",
		headers: {
			Origin: "https://multi-modal.ai.cloudflare.com",
			Referer: "https://multi-modal.ai.cloudflare.com",
			"Sec-Fetch-Dest": "empty",
			"Sec-Fetch-Mode": "cors",
			"Sec-Fetch-Site": "same-origin",
		},
	});

	if (!response.ok) {
		return c.json({ error: `Upstream returned ${response.status}` }, 502);
	}

	const json = (await response.json()) as any;
	if (json?.response?.httpCode) {
		return c.json({ error: json.response }, 502);
	}
	const base64Image = json?.response?.image;
	if (!base64Image) {
		return c.json({ error: "No image data in response" }, 502);
	}

	const imageBuffer = Buffer.from(base64Image, "base64");
	return await blobDispatch(c, imageBuffer, {
		"content-type": "image/png",
	});
});

export default app;
