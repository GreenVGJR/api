import { Hono } from "hono";
const app = new Hono();

import { translateImage } from "../../functions/translateImage.js";
import { getIpHash, getProxyImage, getQueryImageId, mimeExtension, queryKey, setQueryImage, storeProxyImage } from "../../functions/imageProxy.js";
import { applyVsChallenge } from "../../functions/httpRequest.js";
import { commonHeaders } from "../../functions/types/headers.js";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type OverlayResult = { ok: true; id: string; mime: string; raw: Record<string, any> } | { ok: false; error: string };

async function generateOverlay(url: string, from: string, to: string, sourcePath?: string): Promise<OverlayResult> {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return { ok: false, error: "Invalid image URL" };
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return { ok: false, error: "Invalid image URL" };
	}

	let res: Response;
	try {
		res = await fetch(parsed.toString(), {
			headers: { ...commonHeaders, Accept: "image/*,*/*;q=0.8" },
			redirect: "follow",
			signal: AbortSignal.timeout(20000),
		});
	} catch {
		return { ok: false, error: "Failed to fetch image" };
	}
	if (!res.ok) {
		return { ok: false, error: `Image fetch returned ${res.status}` };
	}

	const declared = Number(res.headers.get("content-length") || 0);
	if (declared > MAX_IMAGE_BYTES) {
		return { ok: false, error: "Image too large (max 10MB)" };
	}

	let bytes: Uint8Array;
	try {
		bytes = new Uint8Array(await res.arrayBuffer());
	} catch {
		return { ok: false, error: "Failed to read image" };
	}
	if (bytes.length === 0) {
		return { ok: false, error: "Empty image" };
	}
	if (bytes.length > MAX_IMAGE_BYTES) {
		return { ok: false, error: "Image too large (max 10MB)" };
	}

	const mime = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "image/jpeg";
	const b64 = Buffer.from(bytes).toString("base64");

	let result;
	try {
		result = await translateImage(b64, mime, from, to);
	} catch (e) {
		return { ok: false, error: `Translation bridge failed: ${(e as any)?.message || String(e)}` };
	}

	if (!result?.ok) {
		return { ok: false, error: result?.error || "Translation failed" };
	}

	const { request_id: _requestId, ok: _ok, ...raw } = result;
	const overlayB64 = typeof raw.overlay_image === "string" ? raw.overlay_image : "";
	if (!overlayB64) {
		return { ok: false, error: "No overlay image returned" };
	}

	const overlayMime = typeof raw.overlay_mime_type === "string" ? raw.overlay_mime_type : "image/png";
	const id = storeProxyImage(Buffer.from(overlayB64, "base64"), overlayMime, sourcePath);
	setQueryImage(queryKey(url, from, to), id);
	delete raw.overlay_image;

	return { ok: true, id, mime: overlayMime, raw };
}

function requestOrigin(c: any): string {
	const fwdProto = (c.req.header("x-forwarded-proto") || "").split(",")[0].trim();
	const proto = fwdProto || new URL(c.req.url).protocol.replace(":", "");
	const host = c.req.header("host") || new URL(c.req.url).host;
	return `${proto}://${host}`;
}

function clientIpHash(c: any): string {
	const ip = c.req.header("cf-connecting-ip") || c.req.header("x-real-ip") || c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "";
	return getIpHash(ip);
}

app.get("/translateImage", async (c) => {
	const url = c.req.query("url");
	if (url === undefined) {
		return c.json({ error: "Missing parameter required" }, 202);
	} else if (url === "") {
		return c.json({ error: "Nothing to do" }, 202);
	}

	const from = (c.req.query("from") || "auto").toLowerCase();
	const to = (c.req.query("to") || "en").toLowerCase();

	const vsRes = await applyVsChallenge(c);
	if (vsRes) return vsRes;

	const result = await generateOverlay(url, from, to, c.req.path);
	if (!result.ok) {
		return c.json({ error: result.error }, 202);
	}

	const origin = requestOrigin(c);
	const overlayUrl = `${origin}/tools/translateImage/img?url=${encodeURIComponent(url)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

	return c.json({ data: { ...result.raw, overlay_image: overlayUrl } });
});

// Overlay image endpoint: serves (or generates, then redirects to) the proxy.
// Same pattern as the ai-image endpoints: request waits for the image, then
// 302s to /a/g/<ipHash>/img/<id>.<format>, which serves via blobDispatch.
app.get("/translateImage/img", async (c) => {
	const url = c.req.query("url");
	if (!url) return c.body(null, 404);

	const from = (c.req.query("from") || "auto").toLowerCase();
	const to = (c.req.query("to") || "en").toLowerCase();
	const key = queryKey(url, from, to);

	const vsRes = await applyVsChallenge(c);
	if (vsRes) return vsRes;

	let id = getQueryImageId(key);
	if (!id) {
		const result = await generateOverlay(url, from, to, c.req.path);
		if (!result.ok) return c.body(null, 404);
		id = result.id;
	}

	const entry = getProxyImage(id);
	if (!entry) return c.body(null, 404);

	const location = `${requestOrigin(c)}/a/g/${clientIpHash(c)}/img/${id}.${mimeExtension(entry.mime)}`;
	return c.redirect(location, 302);
});

export default app;
