import { Hono } from "hono";
import { Buffer } from "buffer";
const app = new Hono();

import { aiImageFailure, applyVsChallenge } from "../../functions/httpRequest.js";
import { proxyRedirect } from "../../functions/imageProxy.js";
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

	const vsRes = await applyVsChallenge(c);
	if (vsRes) return vsRes;
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
					}),
				});

				if (cfResponse.ok) {
					const json = (await cfResponse.json()) as any;
					const base64Image = json?.result?.image;
					if (base64Image) {
						const imageBuffer = Buffer.from(base64Image, "base64");
						return await proxyRedirect(c, await resizeImage(imageBuffer), "image/png");
					}
				} else if (cfResponse.status === 429) {
					console.warn("Cloudflare AI rate limited (429), falling back to Vercel");
				} else {
					let loggedAsWarning = false;
					const errorText = await cfResponse.text();
					try {
						const errorJson = JSON.parse(errorText);
						if (errorJson && typeof errorJson === "object" && Array.isArray(errorJson.errors)) {
							const messages = errorJson.errors.map((e: any) => e.message).join("; ");
							if (/Length of '\/prompt' must be <= 2048/.test(messages) || /Input prompt contains NSFW content/.test(messages)) {
								console.warn(`Cloudflare AI validation error (${cfResponse.status}): ${messages}`);
								loggedAsWarning = true;
							}
						}
					} catch (_) {}
					if (!loggedAsWarning) {
						console.error(`Cloudflare AI error (${cfResponse.status}):`, errorText);
					}
				}
			} catch (e) {
				console.error("Cloudflare AI fetch error:", e);
			}
		}
	}

	try {
		const fallbackResponse = await fetch(`https://fast-flux-demo.replicate.workers.dev/api/generate-image?text=${query}`, {
			method: "GET",
			headers: {
				...commonHeaders,
				Accept: "*/*",
				"Sec-Fetch-Dest": "empty",
				"Sec-Fetch-Mode": "cors",
				"Sec-Fetch-Site": "same-site",
			},
		});

		if (!fallbackResponse.ok) {
			return await aiImageFailure(`Fallback upstream returned ${fallbackResponse.status}`);
		}
		return await proxyRedirect(c, await resizeImage(await fallbackResponse.arrayBuffer()), "image/png");
	} catch (e) {
		return await aiImageFailure(`Generation failed: ${(e as any)?.message || String(e)}`);
	}
});

// Cloudflare seems a/b implement TLS Fingerprinting
app.get("/ai-image/flux_klein", async (c) => {
	const query = c.req.query("prompt");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}

	const vsRes = await applyVsChallenge(c);
	if (vsRes) return vsRes;

	c.header("X-Route", "multi-modal.ai.cloudflare.com");
	c.header("X-Enc-Data", "model:@cf/black-forest-labs/flux-2-klein-9b");

	const formData = new FormData();
	formData.append("prompt", query);
	formData.append("steps", "1");
	formData.append("guidance", "2");

	try {
		const response = await fetch(`${atob("aHR0cHM6Ly9tdWx0aS1tb2RhbC5haS5jbG91ZGZsYXJlLmNvbS9hcGkvaW5mZXJlbmNl")}?model=@cf/black-forest-labs/flux-2-klein-9b`, {
			body: formData,
			method: "POST",
			headers: {
				...commonHeaders,
				Accept: "*/*",
				Origin: "https://multi-modal.ai.cloudflare.com",
				Referer: "https://multi-modal.ai.cloudflare.com/",
				"Sec-Fetch-Dest": "empty",
				"Sec-Fetch-Mode": "cors",
				"Sec-Fetch-Site": "same-origin",
			},
		});

		if (!response.ok) {
			return await aiImageFailure(`Upstream returned ${response.status}`);
		}

		const json = (await response.json()) as any;
		if (json?.response?.httpCode) {
			return await aiImageFailure(`Upstream error: ${JSON.stringify(json.response)}`);
		}
		const base64Image = json?.response?.image;
		if (!base64Image) {
			return await aiImageFailure("No image data in response");
		}

		const imageBuffer = Buffer.from(base64Image, "base64");
		return await proxyRedirect(c, imageBuffer, "image/png");
	} catch (e) {
		return await aiImageFailure(`Generation failed: ${(e as any)?.message || String(e)}`);
	}
});

// flux-2-dev via multipart form-data.
app.get("/ai-image/flux_dev", async (c) => {
	const query = c.req.query("prompt");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}

	const vsRes = await applyVsChallenge(c);
	if (vsRes) return vsRes;

	c.header("X-Route", "multi-modal.ai.cloudflare.com");
	c.header("X-Enc-Data", "model:@cf/black-forest-labs/flux-2-dev");

	const formData = new FormData();
	formData.append("prompt", query);
	formData.append("steps", "25");
	formData.append("guidance", "2");

	try {
		const response = await fetch(`${atob("aHR0cHM6Ly9tdWx0aS1tb2RhbC5haS5jbG91ZGZsYXJlLmNvbS9hcGkvaW5mZXJlbmNl")}?model=@cf/black-forest-labs/flux-2-dev`, {
			body: formData,
			method: "POST",
			headers: {
				...commonHeaders,
				Accept: "*/*",
				Origin: "https://multi-modal.ai.cloudflare.com",
				Referer: "https://multi-modal.ai.cloudflare.com/",
				"Sec-Fetch-Dest": "empty",
				"Sec-Fetch-Mode": "cors",
				"Sec-Fetch-Site": "same-origin",
			},
		});

		if (!response.ok) {
			return await aiImageFailure(`Upstream returned ${response.status}`);
		}

		const json = (await response.json()) as any;
		if (json?.response?.httpCode) {
			return await aiImageFailure(`Upstream error: ${JSON.stringify(json.response)}`);
		}
		const base64Image = json?.response?.image;
		if (!base64Image) {
			return await aiImageFailure("No image data in response");
		}

		const imageBuffer = Buffer.from(base64Image, "base64");
		return await proxyRedirect(c, imageBuffer, "image/jpeg");
	} catch (e) {
		return await aiImageFailure(`Generation failed: ${(e as any)?.message || String(e)}`);
	}
});

// Leonardo models via JSON body (model inside the payload).
const leonardoJsonEndpoint = async (c: any, model: string) => {
	const query = c.req.query("prompt");
	if (query === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (query === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}

	const vsRes = await applyVsChallenge(c);
	if (vsRes) return vsRes;

	c.header("X-Route", "multi-modal.ai.cloudflare.com");
	c.header("X-Enc-Data", `model:${model}`);

	try {
		const response = await fetch(atob("aHR0cHM6Ly9tdWx0aS1tb2RhbC5haS5jbG91ZGZsYXJlLmNvbS9hcGkvaW5mZXJlbmNl"), {
			method: "POST",
			headers: {
				...commonHeaders,
				"Content-Type": "application/json",
				Accept: "*/*",
				Origin: "https://multi-modal.ai.cloudflare.com",
				Referer: "https://multi-modal.ai.cloudflare.com/",
				"Sec-Fetch-Dest": "empty",
				"Sec-Fetch-Mode": "cors",
				"Sec-Fetch-Site": "same-origin",
			},
			body: JSON.stringify({
				model,
				prompt: query,
				num_steps: 15,
				guidance: 2,
			}),
		});

		if (!response.ok) {
			return await aiImageFailure(`Upstream returned ${response.status}`);
		}

		const json = (await response.json()) as any;
		if (json?.response?.httpCode) {
			return await aiImageFailure(`Upstream error: ${JSON.stringify(json.response)}`);
		}
		const base64Image = json?.response?.image;
		if (!base64Image) {
			return await aiImageFailure("No image data in response");
		}

		const imageBuffer = Buffer.from(base64Image, "base64");
		return await proxyRedirect(c, imageBuffer, "image/jpeg");
	} catch (e) {
		return await aiImageFailure(`Generation failed: ${(e as any)?.message || String(e)}`);
	}
};

app.get("/ai-image/lucid_origin", async (c) => await leonardoJsonEndpoint(c, "@cf/leonardo/lucid-origin"));

app.get("/ai-image/phoenix", async (c) => await leonardoJsonEndpoint(c, "@cf/leonardo/phoenix-1.0"));

export default app;
