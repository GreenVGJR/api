import { Context } from "hono";
import { Buffer } from "buffer";
import { stream } from "hono/streaming";
import zlib from "zlib";
import crypto from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { commonHeaders } from "./request.js";
import { recordRequestLog } from "./telemetry.js";
import { autoGenBuild, autoGenBuildPara, isLocalRequest } from "../app.js";
import { maxLimitRequestsPerSec, wafChallenge, buildId } from "../config.json";
import { VS_COOKIE, signVsChallenge, verifyVsCookie } from "./vsChallenge.js";

const logResponse = <T extends Response>(c: Context, response: T, statusCode = response.status) => {
	recordRequestLog(c, statusCode);
	return response;
};

type AiImageEntry = {
	prompt: Buffer;
	image?: Buffer;
	contentType?: string;
	ts?: string;
	expire: number;
};

const aiImageRegistry = new Map<string, AiImageEntry>();
const AI_IMAGE_TTL = 7 * 24 * 3600 * 1000;

const pruneAiImageRegistry = () => {
	const now = Date.now();
	for (const [k, v] of aiImageRegistry) if (v.expire < now) aiImageRegistry.delete(k);
};

// Opportunistic playground attestation via `x-sf-l` header.
export const verifySfL = async (c: Context): Promise<boolean | null> => {
	let raw: string | undefined;
	try {
		raw = c.req.header("x-sf-l");
	} catch {
		return null;
	}
	if (!raw) return null;
	try {
		const parts = raw.split(".");
		if (parts.length !== 3) return false;
		const [tStr, n, sig] = parts;
		if (!/^\d{10,15}$/.test(tStr)) return false;
		if (!/^[0-9a-fA-F]{8,64}$/.test(n)) return false;
		if (!/^[0-9a-fA-F]{64}$/.test(sig)) return false;
		const t = Number(tStr);
		if (!Number.isFinite(t)) return false;
		if (Math.abs(Date.now() - t) > 5 * 60 * 1000) return false;
		const url = new URL(c.req.url);
		const hmac = (msg: string) => crypto.createHmac("sha256", String(autoGenBuild)).update(msg, "utf8").digest("hex");
		const matches = (msg: string) => {
			const a = Buffer.from(hmac(msg), "utf8");
			const b = Buffer.from(sig.toLowerCase(), "utf8");
			return a.length === b.length && crypto.timingSafeEqual(a, b);
		};
		if (matches(`GET\n${url.pathname}${url.search}\n${tStr}.${n}`)) return true;
		// aiImageHandshake() 302-redirects (appending the hs/ts registry cache key)
		// after the client signed the URL, and fetch follows it transparently with
		// the old header ΓÇö so also accept the signature over the pre-redirect URL.
		const stripped = new URL(c.req.url);
		stripped.searchParams.delete("hs");
		stripped.searchParams.delete("ts");
		if (stripped.search !== url.search && matches(`GET\n${stripped.pathname}${stripped.search}\n${tStr}.${n}`)) return true;
		return false;
	} catch {
		return false;
	}
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
	aiImageRegistry.set(hash, {
		prompt: Buffer.from(prompt, "utf8"),
		ts: newTs,
		expire: Date.now() + AI_IMAGE_TTL,
	});
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

// --- Shared Resource Infrastructure -----------------------------------------

const SHARE_DENY_PREFIXES = ["/music", "/tools/db", "/tools/chat", "/tools/discord"];
const SHARE_KEY_IGNORE = new Set(["_", "nocache", "cb"]);

type ShareEntry = { key: string; promise: Promise<any>; resolve?: (v: any) => void; reject?: (e: any) => void };
const shareInflight = new Map<string, ShareEntry>();

const sharePathAllowed = (pathname: string): boolean => {
	const routeBase = buildId ? `/${buildId}` : "";
	const p = routeBase && pathname.startsWith(routeBase + "/") ? pathname.slice(routeBase.length) : pathname;
	return !SHARE_DENY_PREFIXES.some((pre) => p === pre || p.startsWith(pre + "/") || p.startsWith(pre + "?"));
};

const dispatchShareKey = (c: Context, useGzip: boolean): string => {
	const url = new URL(c.req.url);
	const params: string[] = [];
	url.searchParams.forEach((v, k) => {
		if (v !== "" && !SHARE_KEY_IGNORE.has(k)) params.push(`${k}=${v}`);
	});
	params.sort();
	const routeBase = buildId ? `/${buildId}` : "";
	const pathname = routeBase && url.pathname.startsWith(routeBase + "/") ? url.pathname.slice(routeBase.length) : url.pathname;
	return `${pathname}?${params.join("&")}|${useGzip ? "gz" : "raw"}`;
};

type BlobShareEntry = {
	key: string;
	chunks: Uint8Array[];
	bytes: number;
	done: boolean;
	failed: boolean;
	refs: number;
	waiters: Array<() => void>;
};

const BLOB_SHARE_MAX_BYTES = 32 * 1024 * 1024;
const blobShares = new Map<string, BlobShareEntry>();

const blobShareNotify = (e: BlobShareEntry) => {
	const waiters = e.waiters;
	e.waiters = [];
	for (const w of waiters) w();
};

const blobShareAppend = (e: BlobShareEntry, chunk: Uint8Array) => {
	if (e.failed || e.done) return;
	if (e.bytes + chunk.byteLength > BLOB_SHARE_MAX_BYTES) {
		e.failed = true;
		e.chunks.length = 0;
		e.bytes = 0;
		blobShareNotify(e);
		return;
	}
	e.chunks.push(chunk);
	e.bytes += chunk.byteLength;
	blobShareNotify(e);
};

const blobShareFinish = (e: BlobShareEntry, failed: boolean) => {
	e.done = true;
	if (failed) e.failed = true;
	blobShareNotify(e);
	if (e.refs <= 0) blobShares.delete(e.key);
};

const blobShareRelease = (e: BlobShareEntry) => {
	e.refs--;
	if (e.done && e.refs <= 0) blobShares.delete(e.key);
};

let _failingImage: Buffer | null = null;
export const getFailingImage = async (): Promise<Buffer> => {
	if (!_failingImage) {
		_failingImage = await readFile(path.join(__dirname, "..", "public", "failingimage.png"));
	}
	return _failingImage;
};

// The navigate-phase VS wait page. The wallpaper is inlined as a data URI because the
// response is `no-store` and lives for ~1s, so a second request would never be cached.
let _vsWaitPage: string | null = null;
const getVsWaitPage = async (): Promise<string> => {
	if (_vsWaitPage) return _vsWaitPage;
	const [template, wallpaper] = await Promise.all([readFile(path.join(__dirname, "..", "html", "vsWait.html"), "utf-8"), readFile(path.join(__dirname, "..", "public", "wf.webp"))]);
	_vsWaitPage = template.replace("{{BG}}", wallpaper.toString("base64"));
	return _vsWaitPage;
};

// Returns the "generation failed" image with the error reason in X-Message.
export const aiImageFailure = async (c: Context, message: string): Promise<Response> => {
	const buf = await getFailingImage();
	return new Response(buf, {
		status: 200,
		headers: { "Content-Type": "image/png", "x-message": message },
	});
};

export const blobDispatch = async (c: Context, body: any, headers?: any, options?: { share?: boolean | string }) => {
	try {
		if (c.req.method !== "GET") return logResponse(c, c.text("", 200));
	} catch {
		return logResponse(c, c.text("", 200));
	}

	if ((await verifySfL(c)) === false) return logResponse(c, c.text("Forbidden", 403));

	c.header("X-Enc-Route", "v5");

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

	let shareKey: string | null = null;
	if (options?.share !== false) {
		if (typeof options?.share === "string") shareKey = options.share;
		else if (sharePathAllowed(new URL(c.req.url).pathname)) {
			const url = new URL(c.req.url);
			const params: string[] = [];
			url.searchParams.forEach((v, k) => {
				if (v !== "" && !SHARE_KEY_IGNORE.has(k)) params.push(`${k}=${v}`);
			});
			params.sort();
			const routeBase = buildId ? `/${buildId}` : "";
			const pathname = routeBase && url.pathname.startsWith(routeBase + "/") ? url.pathname.slice(routeBase.length) : url.pathname;
			shareKey = `${pathname}?${params.join("&")}|blob`;
		}
	}

	let blobEntry: BlobShareEntry | null = null;
	let blobIsFollower = false;
	if (shareKey) {
		const existing = blobShares.get(shareKey);
		if (existing) {
			blobEntry = existing;
			existing.refs++;
			blobIsFollower = true;
			c.header("X-Share", "follower");
		} else {
			blobEntry = { key: shareKey, chunks: [], bytes: 0, done: false, failed: false, refs: 0, waiters: [] };
			blobShares.set(shareKey, blobEntry);
			blobIsFollower = false;
			c.header("X-Share", "leader");
		}
	}

	return logResponse(
		c,
		stream(c, async (s) => {
			s.onAbort(() => {
				return;
			});

			if (c.req.raw.signal.aborted) return;

			const entry = blobEntry;
			const isFollower = blobIsFollower;

			await s.write(new Uint8Array());

			if (c.req.raw.signal.aborted) {
				if (entry) {
					if (isFollower) blobShareRelease(entry);
					else blobShareFinish(entry, true);
				}
				return;
			}

			try {
				if (isFollower && entry) {
					let cursor = 0;
					let fallback = false;
					while (true) {
						while (cursor < entry.chunks.length) {
							if (c.req.raw.signal.aborted) break;
							await s.write(entry.chunks[cursor++]);
						}
						if (c.req.raw.signal.aborted) break;
						if (entry.failed) {
							fallback = cursor === 0;
							break;
						}
						if (entry.done) break;
						await new Promise<void>((resolve) => entry!.waiters.push(resolve));
					}

					if (c.req.raw.signal.aborted) return;

					if (fallback) {
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
					}
				} else if (entry) {
					let resolvedBody = typeof body === "function" ? body() : body;
					if (resolvedBody instanceof Promise) resolvedBody = await resolvedBody;

					if (c.req.raw.signal.aborted) {
						blobShareFinish(entry, false);
						return;
					}

					if (resolvedBody?.ok === false) {
						console.error(`blobDispatch: Upstream returned status ${resolvedBody.status}`);
						blobShareFinish(entry, true);
						return;
					}

					const dataToPipe = resolvedBody?.body || resolvedBody;
					if (dataToPipe) {
						if (dataToPipe.getReader || dataToPipe.pipeTo) {
							const reader = dataToPipe.getReader();
							while (true) {
								const { done, value } = await reader.read();
								if (done) break;
								if (!value) continue;
								const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
								blobShareAppend(entry, chunk);
								if (!c.req.raw.signal.aborted) {
									try {
										await s.write(chunk);
									} catch {}
								}
								if (c.req.raw.signal.aborted && entry.refs <= 0) {
									try {
										await reader.cancel();
									} catch {}
									break;
								}
							}
						} else if (dataToPipe.pipe) {
							const { Readable } = await import("stream");
							const webStream = Readable.toWeb(dataToPipe);
							const reader = webStream.getReader();
							while (true) {
								const { done, value } = await reader.read();
								if (done) break;
								if (!value) continue;
								const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
								blobShareAppend(entry, chunk);
								if (!c.req.raw.signal.aborted) {
									try {
										await s.write(chunk);
									} catch {}
								}
								if (c.req.raw.signal.aborted && entry.refs <= 0) {
									try {
										await reader.cancel();
									} catch {}
									break;
								}
							}
						} else {
							const chunk = dataToPipe instanceof Uint8Array ? dataToPipe : new Uint8Array(dataToPipe);
							blobShareAppend(entry, chunk);
							if (!c.req.raw.signal.aborted) {
								try {
									await s.write(chunk);
								} catch {}
							}
						}
					}
					blobShareFinish(entry, false);
				} else {
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
				}
			} catch (err) {
				if (entry && !isFollower) blobShareFinish(entry, true);
			} finally {
				if (entry) {
					if (isFollower) blobShareRelease(entry);
					else if (!entry.done) blobShareFinish(entry, true);
				}
			}
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

export const applyVsChallenge = async (c: Context): Promise<Response | null> => {
	const vsUa = c.req.header("user-agent") ?? "";
	const vsMozilla = vsUa.startsWith("Mozilla/5.0");
	if (!wafChallenge || !vsMozilla || (await verifyVsCookie(c))) return null;

	const vsSite = c.req.header("sec-fetch-site");
	const vsMode = c.req.header("sec-fetch-mode");
	const vsDest = c.req.header("sec-fetch-dest");
	const vsFullSet = vsSite !== undefined && vsMode !== undefined && vsDest !== undefined;
	const vsPartialSet = !vsFullSet && (vsSite !== undefined || vsMode !== undefined || vsDest !== undefined);

	if (vsMode === "navigate") {
		const challenge = await signVsChallenge(c.req.url, vsUa);
		c.header("Cache-Control", "no-store");
		c.header("Link", `</?vs=${challenge}>; rel=preload; as=fetch`);
		c.header("Refresh", "1");
		return c.html(await getVsWaitPage(), 403);
	}
	if (vsPartialSet) {
		c.header("Cache-Control", "no-store");
		return c.text("", 412);
	}
	return null;
};

export const dispatch = async (c: Context, promiseFactory: any, options?: { share?: boolean | string }) => {
	const ua = c.req.header("user-agent") || "";
	const fetchmode = c.req.header("sec-fetch-mode") || "";
	if (ua.toLowerCase().includes("bot")) {
		return logResponse(c, c.text("", 403));
	}

	if ((await verifySfL(c)) === false) return logResponse(c, c.text("Forbidden. Please refresh this page", 403));

	const vsRes = await applyVsChallenge(c);
	if (vsRes) return logResponse(c, vsRes);

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
		} else if (fetchmode !== "same-origin" && !isLocalRequest(c.req.header("host"))) {
			return logResponse(c, c.text("", 412));
		}
	} else if (useGzip) c.header("Content-Encoding", "gzip");
	const cacheDirectives = ["public"];
	if (requrl.pathname?.startsWith("/tools/discord/") || requrl.pathname?.startsWith("/tools/db/") || requrl.pathname?.startsWith("/tools/chat/")) {
		cacheDirectives.push("max-age=0");
	} else {
		cacheDirectives.push("max-age=30");
	}
	cacheDirectives.push("must-revalidate");
	cacheDirectives.push("no-transform");
	c.header("Cache-Control", cacheDirectives.join(", "));
	c.header("X-Enc-Route", "v6");
	if (wafChallenge) c.header("Set-Cookie", `${VS_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`);

	let shareKey: string | null = null;
	if (options?.share !== false) {
		if (typeof options?.share === "string") shareKey = options.share;
		else if (sharePathAllowed(requrl.pathname)) shareKey = dispatchShareKey(c, useGzip);
	}

	await rateLimit();

	// Synchronous shared-entry creation (atomic across concurrent requests)
	let shareEntry: ShareEntry | null = null;
	let shareRole: "leader" | "follower" | null = null;
	if (shareKey) {
		const existing = shareInflight.get(shareKey);
		if (existing) {
			shareEntry = existing;
			shareRole = "follower";
		} else {
			shareRole = "leader";
			const deferred: ShareEntry = { key: shareKey, promise: null as any, resolve: undefined, reject: undefined };
			deferred.promise = new Promise<any>((res, rej) => {
				deferred.resolve = res;
				deferred.reject = rej;
			});
			shareInflight.set(shareKey, deferred);
			shareEntry = deferred;
		}
	}
	if (shareRole) c.header("X-Share", shareRole);

	return logResponse(
		c,
		stream(c, async (stream) => {
			stream.onAbort(() => {
				return;
			});

			// Followers with an already-aborted client skip; leaders still run to serve followers.
			if (c.req.raw.signal.aborted && shareRole !== "leader") return;

			if (useGzip) {
				if (shareRole === "follower") {
					await stream.write("");
				}
			} else {
				await stream.write("");
			}

			if (c.req.raw.signal.aborted && shareRole !== "leader") return;

			const produce = async (): Promise<Buffer | string> => {
				if (useGzip) {
					const gzip = zlib.createGzip({ level: 9 });
					const chunks: Buffer[] = [];
					const headerChunk: Buffer = await new Promise((resolve) => {
						gzip.once("data", resolve);
						gzip.flush(zlib.constants.Z_SYNC_FLUSH);
					});
					chunks.push(headerChunk);
					if (!c.req.raw.signal.aborted) {
						try {
							await stream.write(headerChunk);
						} catch {}
					}
					const data = await Promise.resolve()
						.then(() => (typeof promiseFactory === "function" ? promiseFactory() : promiseFactory))
						.catch((err) => {
							console.error("Promise error:", err);
							return null;
						});
					let payload: string;
					if (!data) {
						payload = "null";
					} else if (typeof data === "object") {
						payload = JSON.stringify(data);
					} else {
						payload = String(data);
					}
					await new Promise<void>((resolve, reject) => {
						gzip.on("data", (chunk: Buffer) => {
							chunks.push(chunk);
							if (!c.req.raw.signal.aborted) {
								stream.write(chunk).catch(() => {});
							}
						});
						gzip.on("end", resolve);
						gzip.on("error", reject);
						gzip.end(Buffer.from(payload));
					});
					return Buffer.concat(chunks);
				}
				const data = await Promise.resolve()
					.then(() => (typeof promiseFactory === "function" ? promiseFactory() : promiseFactory))
					.catch((err) => {
						console.error("Promise error:", err);
						return null;
					});
				let payload: string;
				if (!data) {
					payload = "null";
				} else if (typeof data === "object") {
					payload = JSON.stringify(data);
				} else {
					payload = String(data);
				}
				if (!c.req.raw.signal.aborted) {
					try {
						await stream.write(payload);
					} catch {}
				}
				return payload;
			};

			let encoded: Buffer | string | undefined;
			if (shareKey && shareEntry) {
				if (shareRole === "leader") {
					try {
						const v = await produce();
						shareEntry.resolve!(v);
						if (shareInflight.get(shareKey) === shareEntry) shareInflight.delete(shareKey);
						encoded = v;
					} catch (e) {
						shareEntry.reject!(e);
						if (shareInflight.get(shareKey) === shareEntry) shareInflight.delete(shareKey);
						console.error("Promise error:", e);
						encoded = undefined;
					}
				} else {
					try {
						encoded = await shareEntry.promise;
					} catch (e) {
						console.error("Promise error:", e);
						encoded = undefined;
					}
				}
			} else {
				encoded = await produce();
			}

			if (c.req.raw.signal.aborted) return;

			if (encoded != null) {
				// Follower: write the full buffered stream (leader already streamed its own).
				if (shareRole === "follower") {
					await stream.write(encoded);
				}
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
