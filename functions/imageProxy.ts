// In-memory store for translated overlay images served by the proxy route.
// Images expire automatically (1 hour); nothing is written to disk.

import crypto from "crypto";
import type { Context } from "hono";

type StoredImage = {
	image: Buffer;
	mime: string;
	expire: number;
	/** Endpoint that produced the image, so /logs shows the target, not /a/g/. */
	sourcePath?: string;
};

const IMAGE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Persist across bun --hot reloads; module-scoped maps would be wiped.
const g = globalThis as any;
const images: Map<string, StoredImage> = g.__vgjr_image_proxy || (g.__vgjr_image_proxy = new Map<string, StoredImage>());
// Maps a translation request (url|from|to) to the stored image id so the
// overlay URL can redirect to /a/g/... without regenerating.
const queryImages: Map<string, { id: string; expire: number }> = g.__vgjr_image_proxy_query || (g.__vgjr_image_proxy_query = new Map());

function prune() {
	const now = Date.now();
	for (const [key, entry] of images) {
		if (entry.expire < now) images.delete(key);
	}
	for (const [key, entry] of queryImages) {
		if (entry.expire < now) queryImages.delete(key);
	}
}

if (!g.__vgjr_image_proxy_timer) {
	g.__vgjr_image_proxy_timer = setInterval(prune, 5 * 60 * 1000);
	g.__vgjr_image_proxy_timer.unref?.();
}

/** Same 8-char MD5-of-IP scheme used by /logs. */
export function getIpHash(ip: string): string {
	return crypto
		.createHash("md5")
		.update(ip || "")
		.digest("hex")
		.slice(0, 8);
}

/** Store the image and return its short content hash (the proxy id). */
export function storeProxyImage(image: Buffer, mime: string, sourcePath?: string): string {
	prune();
	const id = crypto.createHash("sha256").update(image).digest("hex").slice(0, 16);
	images.set(id, { image, mime, sourcePath, expire: Date.now() + IMAGE_TTL_MS });
	return id;
}

export function getProxyImage(id: string): StoredImage | null {
	prune();
	return images.get(id) ?? null;
}

export function mimeExtension(mime: string): string {
	const subtype = (mime || "").split(";")[0].trim().toLowerCase().split("/")[1] || "png";
	return subtype === "jpeg" ? "jpg" : subtype;
}

export function queryKey(url: string, from: string, to: string): string {
	return crypto.createHash("sha256").update(`${url}|${from}|${to}`).digest("hex").slice(0, 16);
}

export function setQueryImage(key: string, id: string): void {
	prune();
	queryImages.set(key, { id, expire: Date.now() + IMAGE_TTL_MS });
}

export function getQueryImageId(key: string): string | null {
	prune();
	const entry = queryImages.get(key);
	if (!entry) return null;
	const image = images.get(entry.id);
	return image && image.expire > Date.now() ? entry.id : null;
}

/** Store a generated image and redirect the client to its /a/g/ proxy URL. */
export function proxyRedirect(c: Context, image: Buffer | ArrayBuffer, mime: string): Response {
	const buffer = image instanceof ArrayBuffer ? Buffer.from(new Uint8Array(image)) : Buffer.from(image);
	const id = storeProxyImage(buffer, mime, c.req.path);
	const ip = c.req.header("cf-connecting-ip") || c.req.header("x-real-ip") || c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "";
	const ipHash = getIpHash(ip);
	const fwdProto = (c.req.header("x-forwarded-proto") || "").split(",")[0].trim();
	const proto = fwdProto || new URL(c.req.url).protocol.replace(":", "");
	const host = c.req.header("host") || new URL(c.req.url).host;
	return c.redirect(`${proto}://${host}/a/g/${ipHash}/img/${id}.${mimeExtension(mime)}`, 302);
}
