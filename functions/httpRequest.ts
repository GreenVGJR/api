import { Context } from "hono";
import { Buffer } from "buffer";
import { stream } from "hono/streaming";
import zlib from "zlib";
import crypto from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { commonHeaders } from "./request.js";
import { recordRequestLog } from "./telemetry.js";
import { autoGenBuild, autoGenBuildPara } from "../app.js";
import { maxLimitRequestsPerSec } from "../config.json";

const logResponse = <T extends Response>(c: Context, response: T, statusCode = response.status) => {
	recordRequestLog(c, statusCode);
	return response;
};

type AiImageEntry = { prompt: Buffer; image?: Buffer; contentType?: string; ts?: string; expire: number };

const aiImageRegistry = new Map<string, AiImageEntry>();
const AI_IMAGE_TTL = 7 * 24 * 3600 * 1000;

const pruneAiImageRegistry = () => {
	const now = Date.now();
	for (const [k, v] of aiImageRegistry) if (v.expire < now) aiImageRegistry.delete(k);
};

// Scopes the handshake/cache entry to BOTH the prompt and the current URL path,
// so the same prompt on a different AI-image route gets its own validation.
const aiImageKey = (c: Context): string => {
	const prompt = c.req.query("prompt") || "";
	const pathname = new URL(c.req.url).pathname;
	return crypto.createHash("md5").update(`${prompt}|${pathname}`, "utf8").digest("hex");
};

export const aiImageHandshake = async (c: Context): Promise<Response | null> => {
	const prompt = c.req.query("prompt");
	if (prompt === undefined || prompt === "") return null;
	const hash = aiImageKey(c);
	const hs = c.req.query("hs");
	const ts = c.req.query("ts");
	const url = new URL(c.req.url);
	const fwdProto = (c.req.header("x-forwarded-proto") || "").split(",")[0].trim();
	if (fwdProto === "https") url.protocol = "https:";

	if (hs || ts) {
		if (hs !== hash) return c.text("Forbidden", 403);
		pruneAiImageRegistry();
		const entry = aiImageRegistry.get(hash);
		if (entry && entry.expire > Date.now()) {
			if (ts && entry.ts && ts !== entry.ts) return c.text("Forbidden", 403);
			if (entry.image) {
				return new Response(entry.image, {
					headers: {
						"Content-Type": entry.contentType || "image/png",
						"Cache-Control": "public, max-age=3600, s-maxage=3600",
					},
				});
			}
			return null;
		}
	}

	const newTs = String(Date.now());
	aiImageRegistry.set(hash, { prompt: Buffer.from(prompt, "utf8"), ts: newTs, expire: Date.now() + AI_IMAGE_TTL });
	url.searchParams.set("hs", hash);
	url.searchParams.set("ts", newTs);
	return c.redirect(url.toString(), 302);
};

export const cacheAiImage = (c: Context, buffer: Buffer | ArrayBuffer, contentType: string) => {
	const hash = aiImageKey(c);
	const prompt = c.req.query("prompt") || "";
	const existing = aiImageRegistry.get(hash);
	aiImageRegistry.set(hash, {
		prompt: existing?.prompt || Buffer.from(prompt, "utf8"),
		ts: existing?.ts || String(Date.now()),
		image: buffer instanceof ArrayBuffer ? Buffer.from(new Uint8Array(buffer)) : Buffer.from(buffer),
		contentType,
		expire: Date.now() + AI_IMAGE_TTL,
	});
};

export const aiImageDispatch = async (c: Context, buffer: Buffer | ArrayBuffer, contentType: string) => {
	if (c.req.query("prompt")) cacheAiImage(c, buffer, contentType);
	return await blobDispatch(c, buffer, { "content-type": contentType });
};

let _failingImage: Buffer | null = null;
export const getFailingImage = async (): Promise<Buffer> => {
	if (!_failingImage) {
		_failingImage = await readFile(path.join(__dirname, "..", "public", "failingimage.png"));
	}
	return _failingImage;
};

// Returns the "generation failed" image with the error reason in X-Message.
export const aiImageFailure = async (c: Context, message: string): Promise<Response> => {
	const buf = await getFailingImage();
	return new Response(buf, {
		status: 200,
		headers: { "Content-Type": "image/png", "x-message": message },
	});
};

export const blobDispatch = async (c: Context, body: any, headers?: any) => {
	try {
		if (c.req.method !== "GET") return logResponse(c, c.text("", 200));
	} catch {
		return logResponse(c, c.text("", 200));
	}

	c.header("X-Enc-Route", "v4");

	const type = headers?.get ? headers.get("content-type") : headers?.["content-type"];
	const filtype1 = type?.split("/")?.[0];
	const defaultExtensions: Record<string, string> = {
		video: "mp4",
		image: "png",
		audio: "mp3",
		text: "plain",
		application: "octet-stream",
	};
	const subtype = type?.split("/")?.[1]?.split(";")?.[0];
	const filtype2 = subtype === "*" ? defaultExtensions[filtype1] || null : subtype;
	const contentType = filtype2 ? `${filtype1}/${filtype2}` : type || "application/octet-stream";

	c.header("Content-Type", contentType);
	c.header("Cache-Control", "public, max-age=3600, s-maxage=3600, must-revalidate, no-transform");

	return logResponse(
		c,
		stream(c, async (s) => {
			s.onAbort(() => {
				return;
			});

			await s.write(new Uint8Array());

			if (c.req.raw.signal.aborted) return;

			try {
				let resolvedBody = typeof body === "function" ? body() : body;
				if (resolvedBody instanceof Promise) resolvedBody = await resolvedBody;

				if (c.req.raw.signal.aborted) return;

				if (resolvedBody?.ok === false) {
					console.error(`blobDispatch: Upstream returned status ${resolvedBody.status}`);
					return;
				}

				const dataToPipe = resolvedBody?.body || resolvedBody;
				if (dataToPipe) {
					if (dataToPipe.getReader || dataToPipe.pipeTo) {
						await s.pipe(dataToPipe);
					} else if (dataToPipe.pipe) {
						const { Readable } = await import("stream");

						await s.pipe(Readable.toWeb(dataToPipe));
					} else {
						await s.write(dataToPipe);
					}
				}
			} catch (err) {}
		}),
	);
};

// Rate limiting config and state
const MAX_REQUESTS_PER_SECOND = maxLimitRequestsPerSec;
let requestCount = 0;
const queue: (() => void)[] = [];

setInterval(() => {
	requestCount = 0;
	while (queue.length > 0 && requestCount < MAX_REQUESTS_PER_SECOND) {
		const resolve = queue.shift();
		if (resolve) {
			resolve();
			requestCount++;
		}
	}
}, 1000);

export async function rateLimit(): Promise<void> {
	if (requestCount >= MAX_REQUESTS_PER_SECOND) {
		await new Promise<void>((resolve) => {
			queue.push(resolve);
		});
	}
	requestCount++;
}

export const dispatch = async (c: Context, promiseFactory: any) => {
	const ua = c.req.header("user-agent") || "";
	const fetchmode = c.req.header("sec-fetch-mode") || "";
	if (ua.toLowerCase().includes("bot")) {
		return logResponse(c, c.text("", 403));
	}

	try {
		if (c.req.method !== "GET") return logResponse(c, c.text("", 200));
	} catch {
		return logResponse(c, c.text("", 200));
	}

	const requrl = new URL(c.req.url);

	const acceptEncoding = c.req.header("accept-encoding") || "";
	let useGzip = acceptEncoding.includes("gzip");
	c.header("Content-Type", "application/json");
	if (c.req.query(autoGenBuildPara) !== undefined || c.req.header("x-sz-token") !== undefined) {
		if ((c.req.query(autoGenBuildPara) === autoGenBuild || c.req.header("x-sz-token") === autoGenBuild) && fetchmode === "same-origin") {
			c.header("Content-Encoding", "n");
			c.header("Content-Type", "image/x-icon");
			useGzip = true;
		} else if (fetchmode !== "same-origin") {
			return logResponse(c, c.text("", 412));
		}
	} else if (useGzip) c.header("Content-Encoding", "gzip");
	const cacheDirectives = ["public"];
	if (requrl.pathname?.startsWith("/tools/discord/") || requrl.pathname?.startsWith("/tools/db/")) {
		cacheDirectives.push("max-age=0");
	} else {
		cacheDirectives.push("max-age=8");
	}
	cacheDirectives.push("must-revalidate");
	cacheDirectives.push("no-transform");
	c.header("Cache-Control", cacheDirectives.join(", "));
	c.header("X-Enc-Route", "v5");

	await rateLimit();

	return logResponse(
		c,
		stream(c, async (stream) => {
			stream.onAbort(() => {
				return;
			});

			if (c.req.raw.signal.aborted) return;

			let gzip: zlib.Gzip | null = null;

			if (useGzip) {
				gzip = zlib.createGzip({ level: 1 });
				const headerChunk: Buffer = await new Promise((resolve) => {
					gzip!.once("data", resolve);
					gzip!.flush(zlib.constants.Z_SYNC_FLUSH);
				});
				await stream.write(headerChunk);
			} else {
				await stream.write("");
			}

			if (c.req.raw.signal.aborted) return;

			const data = await Promise.resolve()
				.then(() => (typeof promiseFactory === "function" ? promiseFactory() : promiseFactory))
				.catch((err) => {
					console.error("Promise error:", err);
					return null;
				});

			if (c.req.raw.signal.aborted) return;

			let payload: string;
			if (!data) {
				payload = "null";
			} else if (typeof data === "object") {
				payload = JSON.stringify(data);
			} else {
				payload = String(data);
			}

			if (useGzip && gzip) {
				await new Promise<void>((resolve, reject) => {
					gzip!.on("data", (chunk: Buffer) => {
						stream.write(chunk);
					});
					gzip!.on("end", resolve);
					gzip!.on("error", reject);
					gzip!.end(Buffer.from(payload));
				});
			} else {
				await stream.write(payload);
			}
		}),
	);
};

export const processImage = async (c: Context, url?: string) => {
	if (!url) return undefined;
	if (!url.startsWith("http")) return undefined;

	let checkurl: URL;
	try {
		checkurl = new URL(url);
	} catch {
		return undefined;
	}
	if (checkurl.host === c.req.header("host")) return "";

	try {
		const res = await fetch(url, { headers: commonHeaders });
		if (!res.ok) return "";
		const contentType = res.headers.get("content-type");
		if (!contentType?.startsWith("image/") && !contentType?.startsWith("video/")) return "";
		const arrayBuffer = await res.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		return `data:${contentType};base64,${buffer.toString("base64")}`;
	} catch (e) {
		return "";
	}
};
