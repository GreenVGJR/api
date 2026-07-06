import { Context } from "hono";
import { Buffer } from "buffer";
import { stream } from "hono/streaming";
import zlib from "zlib";
import { commonHeaders } from "./request.js";
import { recordRequestLog } from "./logs.js";

const logResponse = <T extends Response>(c: Context, response: T, statusCode = response.status) => {
	recordRequestLog(c, statusCode);
	return response;
};

export const blobDispatch = async (c: Context, body: any, headers?: any) => {
	await rateLimit();

	try {
		if (c.req.method !== "GET") return logResponse(c, c.text("", 200));
	} catch {
		return logResponse(c, c.text("", 200));
	}

	if (Object.entries(c.req.queries()).length >= 3) {
		return logResponse(c, c.text("Forbidden", 403));
	}

	c.header("X-Enc-Route", "v3");

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
	c.header("Cache-Control", "public, max-age=30, must-revalidate, no-transform");

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
const MAX_REQUESTS_PER_SECOND = 10;
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
	if (ua.toLowerCase().includes("bot")) {
		return logResponse(c, c.text("", 403));
	}

	await rateLimit();

	try {
		if (c.req.method !== "GET") return logResponse(c, c.text("", 200));
	} catch {
		return logResponse(c, c.text("", 200));
	}

	const requrl = new URL(c.req.url);

	c.header("X-Enc-Route", "v4");
	c.header("Content-Type", "application/json");
	const acceptEncoding = c.req.header("accept-encoding") || "";
	const useGzip = acceptEncoding.includes("gzip");
	if (useGzip) c.header("Content-Encoding", "gzip");
	c.header("Cache-Control", requrl.pathname?.startsWith("/tools/discord/") || requrl.pathname?.startsWith("/tools/db/") ? "public, max-age=0, must-revalidate" : "public, max-age=5, must-revalidate");

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
		const res = await fetch(url, { headers: { ...commonHeaders } });
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
