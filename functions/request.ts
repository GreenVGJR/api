import { type Context } from "hono";
import { normalizeCookies, youtubeVisitorKey, googleAuthKey, giphyKey, flickrKey, soundcloudKey, spotifyKey, spotifyKeyToken, mackOauth, tidalKeys, tidalKeysToken, deezerKeys, imgurKey, crunchyKey, saweriaBuildKey, keytidal, keytidalopen, setKeyTidal, instagramSession, twitterKey, twitterObj, refreshRedditAuth, tiktokSessions, devianKey } from "./authRequest.js";
import { DISCORD_APPLICATION_INTEGRATION_TYPES, DISCORD_PERMISSIONS, PERMISSION_KEYS, DISCORD_CHANNEL_TYPES, DISCORD_STICKER_MAX_BYTES, DISCORD_STICKER_MAX_CONVERT_INPUT_BYTES, DISCORD_STICKER_MIME_TO_EXT, DISCORD_STICKER_CONVERT_MIME_TO_PNG, DISCORD_STICKER_CONVERT_EXT_TO_PNG, DISCORD_STICKER_EXT_TO_MIME, DISCORD_AUTOMOD_TRIGGER_TYPES, DISCORD_AUTOMOD_EVENT_TYPES, DISCORD_AUTOMOD_ACTION_TYPES, DISCORD_AUTOMOD_PRESET_TYPES, GOOGLE_TTS_REGION, resolveFlags, resolveApplicationFlags, listcodes } from "./types/index.js";

import { browserRequest } from "./browserRequest.js";
import { get as httpcloakGet } from "httpcloak";
// @ts-expect-error no types
import signTikTok from "./tiktok_signature/index.mjs";

import { Innertube, Log, ProtoUtils } from "youtubei.js";
import { getChallenge, BotGuardClient } from "bgutils-js/botguard";
import { createColdStartToken, WebPoMinter } from "bgutils-js/webpo";
import { parseHTML } from "linkedom";
import { decodeHTML } from "entities";
import crypto from "crypto";
import { Buffer } from "buffer";
import emojibaseData from "emojibase-data/en/data.json" with { type: "json" };
import emojibaseGroups from "emojibase-data/meta/groups.json" with { type: "json" };

declare global {
	interface Response {
		json(): Promise<any>;
	}
}

const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

Log.setLevel(Log.Level.ERROR);

export let keyYoutubeVisitor: {
	visitor_data: string;
	cookie: string;
	client_version: string;
	platform_type: string;
} | null = null;

export const getYoutubeVisitorKey = async () => {
	if (!keyYoutubeVisitor) {
		keyYoutubeVisitor = await youtubeVisitorKey();
	}
	return keyYoutubeVisitor;
};
let youtubeiPromise: Promise<any> | null = null;
let poTokenCache: { po_token: string; visitor_data: string } | null = null;

const YOUTUBE_PO_TOKEN_REQUEST_KEY = process.env.YTREQUEST_KEY || "";
const YOUTUBE_API_KEY = process.env.YTAPI_KEY || "";

let bgProgram: string | null = null;
let bgGlobalName: string | null = null;
let bgInitPromise: Promise<void> | null = null;
let bgRefreshPromise: Promise<void> | null = null;
let bgVisitorData: string | null = null;
let bgIntegrityExp = 0;
const CAPTION_POT_TTL_FALLBACK = 30 * 60 * 1000;

const captionPoTokenCache = new Map<string, { token: string; exp: number }>();
function getCachedCaptionPot(videoId: string) {
	const entry = captionPoTokenCache.get(videoId);
	if (entry && entry.exp > Date.now()) return entry.token;
	captionPoTokenCache.delete(videoId);
	return null;
}
function setCachedCaptionPot(videoId: string, token: string) {
	captionPoTokenCache.set(videoId, {
		token,
		exp: bgIntegrityExp || Date.now() + CAPTION_POT_TTL_FALLBACK,
	});
}

async function ensureBotGuardDom() {
	if (typeof (globalThis as any).window !== "undefined" && typeof (globalThis as any).document !== "undefined") return;
	const { JSDOM } = await import("jsdom");
	const dom = new JSDOM("", { url: "https://www.youtube.com/" });
	Object.assign(globalThis, {
		window: dom.window,
		document: dom.window.document,
	});
}

function getFallbackPoToken() {
	const id = Math.random().toString(36).substring(2, 13);
	const ts = Math.floor(Date.now() / 1000);
	const visitorData = ProtoUtils.encodeVisitorData(id, ts);
	return {
		po_token: createColdStartToken(id),
		visitor_data: visitorData,
	};
}

// Cold-start (session-bound) token for initial playback, built from a fresh visitor id.
async function installBotGuardInterpreter() {
	await ensureBotGuardDom();
	const challenge = await getChallenge({
		requestKey: YOUTUBE_PO_TOKEN_REQUEST_KEY,
		fetchFunction: fetch as any,
		useYouTubeAPI: true,
	});
	const interpreterJavascript = challenge?.interpreterJavascript?.privateDoNotAccessOrElseSafeScriptWrappedValue;
	if (!challenge || !interpreterJavascript) throw new Error("Could not load BotGuard challenge");
	new Function(interpreterJavascript)();
	bgProgram = challenge.program as string;
	bgGlobalName = challenge.globalName as string;
}

async function refreshBotGuardIntegrity() {
	if (bgRefreshPromise) return bgRefreshPromise;
	bgRefreshPromise = (async () => {
		if (!bgProgram || !bgGlobalName) await installBotGuardInterpreter();
		const botguard = await BotGuardClient.create({
			program: bgProgram as string,
			globalName: bgGlobalName as string,
			globalObject: globalThis,
		});
		const webPoSignalOutput: any[] = [];
		// Bind the snapshot to the same visitorData the Innertube session uses,
		// otherwise the integrity token (and thus the caption pot) is visitor-less
		// and YouTube intermittently rejects it (empty 200).
		const botguardResponse = await botguard.snapshot({
			webPoSignalOutput,
			contentBinding: bgVisitorData || poTokenCache?.visitor_data ? { c: bgVisitorData || poTokenCache?.visitor_data! } : undefined,
		});
		const integrityTokenResponse = await fetch("https://jnn-pa.googleapis.com/$rpc/google.internal.waa.v1.Waa/GenerateIT", {
			method: "POST",
			headers: {
				"Content-Type": "application/json+protobuf",
				"x-goog-api-key": YOUTUBE_API_KEY,
				"x-user-agent": "grpc-web-javascript/0.1",
			},
			body: JSON.stringify([YOUTUBE_PO_TOKEN_REQUEST_KEY, botguardResponse]),
		});
		const integrityTokenJson = (await integrityTokenResponse.json()) as [string, number, number, string];
		const [integrityToken] = integrityTokenJson;
		if (!integrityToken) throw new Error("BotGuard integrity token unavailable");
	})().finally(() => {
		bgRefreshPromise = null;
	});
	return bgRefreshPromise;
}

export async function initBotGuard() {
	if (bgProgram && bgGlobalName) return;
	if (bgInitPromise) return bgInitPromise;
	bgInitPromise = (async () => {
		await installBotGuardInterpreter();
		await refreshBotGuardIntegrity();
	})().finally(() => {
		bgInitPromise = null;
	});
	return bgInitPromise;
}

// Content-bound token: fresh challenge + full generate (no cached integrity).
async function generateCbPotFall(videoId: string) {
	await ensureBotGuardDom();
	const challenge = await getChallenge({
		requestKey: YOUTUBE_PO_TOKEN_REQUEST_KEY,
		fetchFunction: fetch as any,
		useYouTubeAPI: true,
	});
	const interpreterJavascript = challenge?.interpreterJavascript?.privateDoNotAccessOrElseSafeScriptWrappedValue;
	if (!challenge || !interpreterJavascript) throw new Error("Could not load BotGuard challenge");
	new Function(interpreterJavascript)();
	const botguard = await BotGuardClient.create({
		program: challenge.program as string,
		globalName: challenge.globalName as string,
		globalObject: globalThis,
	});
	const webPoSignalOutput: any[] = [];
	const botguardResponse = await botguard.snapshot({
		webPoSignalOutput,
		contentBinding: bgVisitorData || poTokenCache?.visitor_data ? { c: bgVisitorData || poTokenCache?.visitor_data! } : undefined,
	});
	const integrityTokenResponse = await fetch("https://jnn-pa.googleapis.com/$rpc/google.internal.waa.v1.Waa/GenerateIT", {
		method: "POST",
		headers: {
			"Content-Type": "application/json+protobuf",
			"x-goog-api-key": YOUTUBE_API_KEY,
			"x-user-agent": "grpc-web-javascript/0.1",
		},
		body: JSON.stringify([YOUTUBE_PO_TOKEN_REQUEST_KEY, botguardResponse]),
	});
	const integrityTokenJson = (await integrityTokenResponse.json()) as [string, number, number, string];
	const integrityToken = integrityTokenJson[0];
	const estimatedTtlSecs = integrityTokenJson[1];
	if (estimatedTtlSecs) bgIntegrityExp = estimatedTtlSecs * 1000;
	else bgIntegrityExp = CAPTION_POT_TTL_FALLBACK;
	if (!integrityToken) throw new Error("BotGuard integrity token unavailable");
	const minter = await WebPoMinter.create({ integrityToken }, webPoSignalOutput as any);
	const token = await minter.mintAsWebsafeString(videoId);
	if (!token) throw new Error("poToken generation produced no token");
	return token;
}

export async function getBotGuardChallenge() {
	await initBotGuard();
	await getYoutubeVisitorKey();
	const visitorData = keyYoutubeVisitor?.visitor_data;
	if (!visitorData) throw new Error("Could not get YouTube visitor data");
	return { visitorData };
}

export async function generateYoutubePoToken() {
	const { visitorData } = await getBotGuardChallenge();
	bgVisitorData = visitorData;
	return {
		po_token: await generateCbPotFall(visitorData),
		visitor_data: visitorData,
	};
}

async function getYoutubeCaptionPoToken(videoId: string) {
	const cached = getCachedCaptionPot(videoId);
	if (cached) return cached;
	const token = await generateCbPotFall(videoId);
	setCachedCaptionPot(videoId, token);
	return token;
}

export async function getPoToken() {
	if (poTokenCache) return poTokenCache;
	try {
		poTokenCache = await generateYoutubePoToken();
	} catch (e) {
		console.error("Failed to generate YouTube PO token:", e);
		poTokenCache = getFallbackPoToken();
	}
	return poTokenCache;
}

function withYoutubePoToken(baseUrl: any, poToken: string) {
	if (!baseUrl) return null;
	const clientVersion = keyYoutubeVisitor?.client_version || "2.20261230";
	const platformType = keyYoutubeVisitor?.platform_type || "X11";
	try {
		const url = new URL(String(baseUrl));
		url.searchParams.set("fmt", "json3");
		url.searchParams.set("potc", "1");
		url.searchParams.set("pot", encodeURIComponent(poToken));
		url.searchParams.set("xorb", "2");
		url.searchParams.set("xobt", "3");
		url.searchParams.set("xovt", "3");
		url.searchParams.set("cbr", "Firefox");
		url.searchParams.set("cbrver", "153.0");
		url.searchParams.set("c", "WEB");
		url.searchParams.set("cver", clientVersion);
		url.searchParams.set("cplayer", "UNIPLAYER");
		url.searchParams.set("cos", platformType);
		url.searchParams.set("cplatform", "DESKTOP");
		return url.toString();
	} catch {
		const separator = String(baseUrl).includes("?") ? "&" : "?";
		return `${baseUrl}${separator}fmt=json3&potc=1&pot=${encodeURIComponent(poToken)}&xorb=2&xobt=3&xovt=3&cbr=Firefox&cbrver=153.0&c=WEB&cver=${clientVersion}&cplayer=UNIPLAYER&cos=${platformType}&cplatform=DESKTOP`;
	}
}

function getYoutubeChallengeObject(videoId: string, captionPoToken: string) {
	let decodedVisitorData: any = null;
	if (poTokenCache?.visitor_data) {
		try {
			decodedVisitorData = ProtoUtils.decodeVisitorData(poTokenCache.visitor_data);
		} catch {}
	}

	return {
		visitorData: poTokenCache?.visitor_data ? [poTokenCache.visitor_data, decodedVisitorData?.id || null, decodedVisitorData?.timestamp ? String(decodedVisitorData.timestamp) : null] : null,
		sessionPoToken: poTokenCache?.po_token || null,
		contentPoToken: {
			poToken: captionPoToken,
			targetId: videoId,
		},
	};
}

export async function getYoutubei() {
	if (!youtubeiPromise) {
		const { po_token, visitor_data } = await getPoToken();
		await getYoutubeVisitorKey();
		youtubeiPromise = Innertube.create({
			po_token,
			visitor_data,
		}).catch((e) => {
			youtubeiPromise = null;
			throw e;
		});
	}
	return youtubeiPromise;
}

export const userAgent = "Mozilla/5.0 (X11; Linux x86_64; rv:153.0) Gecko/20100101 Firefox/153.0";
export const userAgent_mobile = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/151.0.0.0 Mobile/15E148 Safari/604.1";
export const discordUserAgent = "DiscordBot (https://discord.com, 1.0)";

export const commonHeaders = {
	Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
	"Accept-Encoding": "gzip, deflate, br, zstd",
	"Accept-Language": "en-US,en;q=0.9",
	Priority: "u=0, i",
	"Sec-Fetch-Dest": "document",
	"Sec-Fetch-Mode": "navigate",
	"Sec-Fetch-Site": "none",
	TE: "trailers",
	"User-Agent": userAgent,
};

// Discord fetch wrapper with per-bucket and global rate limiting
const discordRateLimitBuckets = new Map<string, { limit: number; remaining: number; resetAfter: number; resetAt: number }>();
let discordGlobalReqCount = 0;
let discordGlobalReqReset = Date.now() + 1000;
const discordGlobalQueue: (() => void)[] = [];

export const discordFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
	const waitForGlobalSlot = async () => {
		if (Date.now() >= discordGlobalReqReset) {
			discordGlobalReqCount = 0;
			discordGlobalReqReset = Date.now() + 1000;
		}
		if (discordGlobalReqCount >= 50) {
			await new Promise<void>((resolve) => discordGlobalQueue.push(resolve));
		}
		discordGlobalReqCount++;
	};

	const getBucketKey = (res: Response): string => {
		const bucket = res.headers.get("X-RateLimit-Bucket");
		const scope = res.headers.get("X-RateLimit-Scope");
		if (bucket) return scope === "global" ? `global:${bucket}` : bucket;
		const isGlobal = res.headers.get("X-RateLimit-Global") === "true";
		return isGlobal ? "global" : url;
	};

	const handleBucketHeaders = (res: Response) => {
		const bucketKey = getBucketKey(res);
		const remaining = res.headers.get("X-RateLimit-Remaining");
		const resetAfter = res.headers.get("X-RateLimit-Reset-After");
		const limit = res.headers.get("X-RateLimit-Limit");
		if (remaining !== null && resetAfter !== null) {
			discordRateLimitBuckets.set(bucketKey, {
				limit: limit ? Number(limit) : Infinity,
				remaining: Number(remaining),
				resetAfter: Number(resetAfter),
				resetAt: Date.now() + Number(resetAfter) * 1000,
			});
		}
	};

	const waitForBucket = async (): Promise<void> => {
		const now = Date.now();
		for (const [key, bucket] of discordRateLimitBuckets) {
			if (bucket.remaining <= 0 && now < bucket.resetAt) {
				const waitMs = bucket.resetAt - now;
				await new Promise((resolve) => setTimeout(resolve, waitMs));
			}
			if (now >= bucket.resetAt) discordRateLimitBuckets.delete(key);
		}
	};

	const execute = async (): Promise<Response> => {
		await waitForGlobalSlot();
		await waitForBucket();
		const res = await fetch(url, options);
		handleBucketHeaders(res);

		if (res.status === 429) {
			const retryAfter = res.headers.get("Retry-After");
			const wait = retryAfter ? Number(retryAfter) * 1000 : 1000;
			const bucketKey = getBucketKey(res);
			discordRateLimitBuckets.set(bucketKey, {
				limit: Number(res.headers.get("X-RateLimit-Limit")) || Infinity,
				remaining: 0,
				resetAfter: wait / 1000,
				resetAt: Date.now() + wait,
			});
			await new Promise((resolve) => setTimeout(resolve, wait));
			return await execute();
		}

		return res;
	};

	return await execute();
};

const responseStatus = (response: any): number => response?.status ?? response?.statusCode ?? 0;

const responseText = async (response: any): Promise<string> => {
	if (!response) return "";
	if (typeof response.text === "function") return await response.text();
	if (typeof response.text === "string") return response.text;
	return "";
};

export const getQuery = (c: Context, key: string) => {
	const val = c.req.query(key);
	if (val === undefined) return undefined;
	if (val === "null") return null;
	return val;
};

export const getToken = (c: Context) => {
	try {
		const token = c.req.query("token");
		if (!token) return null;
		const checktoken = Number.isInteger(parseInt(atob(token.split(".")[0])));
		return checktoken ? token : null;
	} catch {
		return null;
	}
};

const parseAbbreviatedNumber = (str: string | null | undefined): number | null => {
	if (!str) return null;
	const cleanStr = str
		.replace(/,/g, "")
		.replace(/subscribers|videos|video|views|view|watching/gi, "")
		.trim();
	const match = cleanStr.match(/^(\d+\.?\d*)([KMB]?)$/i);
	if (!match) {
		const n = parseFloat(cleanStr);
		return isNaN(n) ? null : Math.floor(n);
	}

	let num = parseFloat(match[1]!);
	const unit = match[2]!.toUpperCase();

	switch (unit) {
		case "K":
			num *= 1000;
			break;
		case "M":
			num *= 1000000;
			break;
		case "B":
			num *= 1000000000;
			break;
	}
	return Math.floor(num);
};

const formatAbbreviatedNumber = (num: number | string | null | undefined): string => {
	if (num === null || num === undefined) return "0";
	const n = typeof num === "string" ? parseFloat(num) : num;
	if (isNaN(n)) return "0";

	if (n >= 1000000000) return (n / 1000000000).toFixed(1).replace(/\.0$/, "") + "B";
	if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
	if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
	return n.toString();
};

export const parseYtInitial = (html: any) => {
	try {
		const dataParts = html.split(/ytInitialData\s*=\s*/);
		if (dataParts.length < 2) return null;

		let jsonStr = dataParts[1];

		const endIdx = jsonStr.indexOf(";</script>") !== -1 ? jsonStr.indexOf(";</script>") : jsonStr.indexOf("</script>") !== -1 ? jsonStr.indexOf("</script>") : jsonStr.length;

		jsonStr = jsonStr.substring(0, endIdx).trim();
		if (jsonStr.endsWith(";")) jsonStr = jsonStr.substring(0, jsonStr.length - 1).trim();

		return JSON.parse(jsonStr);
	} catch (e) {
		console.error(e);
		return null;
	}
};

let keysc: string | undefined;
let keysp: string | undefined;
let keysptoken: string | undefined;
let keyflickr: string | undefined;
let keybearer: string | undefined;
let keydeezer: string | undefined;
let keyimgur: string | undefined;
let keygiphy: string | undefined;
let keycrunchy: string | undefined;
let keytumblr: string | undefined = process.env.TUMBLR;
let keydevian: { cookie: string; csrfToken: string } | null;
let keyInstagram: {
	cookie: string;
	lsd: string | null;
	csrf: string | null;
	app_id: string | null;
} | null = null;
let saweriaBuildId: string | undefined;
let twitterAuth: string | undefined = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
let redditCookies: string = "";
let tiktokSessionKeys: any = {};

type DiscordListCacheValue = { status: number; statusText: string; data: any };
type DiscordListCacheEntry = {
	expiresAt: number;
	value: DiscordListCacheValue;
};
const DISCORD_LIST_CACHE_TTL = 5 * 60 * 1000;
let discordObj: Record<string, DiscordListCacheEntry> = {};
let discordListCacheFetches: Record<string, Promise<DiscordListCacheValue> | undefined> = {};
let discordListMemberPartialObj: Record<string, DiscordListCacheEntry | undefined> = {};
let discordListMemberFetches: Record<string, Promise<void> | undefined> = {};
let konaSummary: any;

let googleImgSpAuth: any = {};

function deepFind(obj: unknown, key: string): unknown | null {
	if (!obj || typeof obj !== "object") return null;
	if (Array.isArray(obj)) {
		for (const item of obj) {
			const result = deepFind(item, key);
			if (result != null) return result;
		}
		return null;
	}
	const record = obj as Record<string, unknown>;
	if (key in record) return record[key];
	for (const val of Object.values(record)) {
		const result = deepFind(val, key);
		if (result != null) return result;
	}
	return null;
}

export const Flickr = async function Flickr(que: string, refresh_auth?: boolean, limit_number: number = 10): Promise<any> {
	if (!que) return null;

	if (refresh_auth || !keyflickr) {
		keyflickr = await flickrKey();
	}

	try {
		const per = await fetch(`https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=${keyflickr}&format=json&nojsoncallback=1&tags=${encodeURIComponent(que)}&per_page=${limit_number}`, {
			headers: commonHeaders,
		});

		if (per.status === 403) {
			return {
				error: "Cloudflare Turnstile asking to verify you're not a bot",
			};
		}

		if (per.status === 401) {
			return await Flickr(que, true);
		}

		const pes = await per.json();

		if (!pes?.photos?.photo?.[0]) {
			return { data: null };
		}

		const listids: string[] = pes.photos.photo.map((a: any) => a.id);

		const [per2, sizesResults] = await Promise.all([
			fetch(`https://api.flickr.com/services/rest/?method=flickr.photos.getInfo&photo_ids=${listids}&api_key=${keyflickr}&format=json&nojsoncallback=1`, {
				headers: commonHeaders,
			}),
			Promise.all(
				listids.map((id) =>
					fetch(`https://api.flickr.com/services/rest/?method=flickr.photos.getSizes&photo_id=${id}&api_key=${keyflickr}&format=json&nojsoncallback=1`, {
						headers: commonHeaders,
					})
						.then((r) => r.json())
						.then((j) => ({ id, sizes: j?.sizes?.size ?? [] })),
				),
			),
		]);

		if (per2.status === 403) {
			return {
				error: "Cloudflare Turnstile asking to verify you're not a bot",
			};
		}

		const pes2 = await per2.json();

		const sizesMap: Record<string, any[]> = {};
		for (const { id, sizes } of sizesResults) {
			sizesMap[id] = sizes;
		}

		const pulpes: any = pes2.photos.photo.map((a: any) => {
			const sizes: any[] = sizesMap[a.id] ?? [];
			const original = sizes.find((s: any) => s.label === "Original");

			const sizeMap = Object.fromEntries(
				sizes.map((s: any) => [
					s.label,
					{
						url: s.source,
						width: Number(s.width),
						height: Number(s.height),
					},
				]),
			);

			const highest = sizes.length > 0 ? (original && sizes.length > 1 ? sizes[sizes.length - 2] : sizes[sizes.length - 1]) : null;

			const originalUrl = original?.source ?? (a.originalsecret && a.originalformat ? `https://live.staticflickr.com/${a.server}/${a.id}_${a.originalsecret}_o.${a.originalformat}` : null);

			return {
				...a,
				media: {
					type: a.media,
					canDownload: originalUrl != null,
					sizes: sizeMap,
					preview: sizeMap["Large"]?.url ?? sizeMap["Medium 800"]?.url ?? null,
					highest: highest?.source ?? null,
					original: originalUrl,
					width: original ? Number(original.width) : a.originalwidth ? Number(a.originalwidth) : highest ? Number(highest.width) : 0,
					height: original ? Number(original.height) : a.originalheight ? Number(a.originalheight) : highest ? Number(highest.height) : 0,
				},
			};
		});

		return { data: pulpes };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const YTVideo = async function YTVideo(que: string, deepSearch: boolean = false) {
	if (!que) return null;
	try {
		await getYoutubeVisitorKey();
		const bodyload = JSON.stringify({
			query: que,
			context: {
				client: {
					clientName: "WEB",
					clientVersion: "2.20261230",
					hl: "en",
					gl: "US",
					...(poTokenCache?.visitor_data ? { visitorData: poTokenCache.visitor_data } : {}),
				},
			},
			...(poTokenCache?.po_token ? { serviceIntegrityDimensions: { poToken: poTokenCache.po_token } } : {}),
		});

		const response = await fetch("https://m.youtube.com/youtubei/v1/search?prettyPrint=false&fields=contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents.itemSectionRenderer.contents", {
			headers: {
				...commonHeaders,
				"content-type": "application/json",
				...(keyYoutubeVisitor?.cookie ? { Cookie: keyYoutubeVisitor.cookie } : {}),
			},
			body: bodyload,
			method: "POST",
		});

		const res: any = await response.json();

		const sectionContents = res?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
		const inrtubeContents = sectionContents.flatMap((sec: any) => sec?.itemSectionRenderer?.contents || []);
		const queryId: any = inrtubeContents?.find((m: any) => !!m.videoRenderer?.searchVideoResultEntityKey)?.videoRenderer?.searchVideoResultEntityKey;

		const videoItems = inrtubeContents.flatMap((item: any) => {
			if (item.shelfRenderer?.content?.verticalListRenderer?.items) {
				return item.shelfRenderer.content.verticalListRenderer.items;
			}
			if (item.shelfRenderer?.content?.horizontalListRenderer?.items) {
				return item.shelfRenderer.content.horizontalListRenderer.items;
			}
			return item;
		});

		const mappedTasks = videoItems.map(async (item: any) => {
			const a = item.videoRenderer;
			if (!a) return null;
			const checkmix = a?.navigationEndpoint?.watchEndpoint?.playlistId;
			let mixData: any = null;

			if (checkmix && deepSearch) {
				try {
					const rlkreq = await fetch(`https://www.youtube.com/watch?v=&list=${checkmix}`, {
						headers: commonHeaders,
					});

					let rlkresText = await rlkreq.text();
					let rlkres: any = parseYtInitial(rlkresText);

					if (rlkres) {
						const kkmvytmx = rlkres?.contents?.twoColumnWatchNextResults?.playlist?.playlist;
						if (kkmvytmx) {
							const kkmvytfd = rlkres?.contents?.twoColumnWatchNextResults?.secondaryResults?.secondaryResults?.results?.[0]?.itemSectionRenderer?.contents;
							let getmgcf: any = null;
							try {
								getmgcf = new URL(kkmvytmx.playlistShareUrl);
								getmgcf = getmgcf.searchParams.get("list");
							} catch {}
							mixData = {
								playlistId: getmgcf,
								title: kkmvytmx.title,
								shareUrl: kkmvytmx.playlistShareUrl,
								data:
									kkmvytmx.contents?.map((c: any) => ({
										videoId: c.playlistPanelVideoRenderer?.videoId,
										url: "https://www.youtube.com/watch?v=" + c.playlistPanelVideoRenderer?.videoId,
										altUrl: "https://www.youtube.com" + c.playlistPanelVideoRenderer?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url,
										title: c.playlistPanelVideoRenderer?.title?.simpleText,
										duration: c.playlistPanelVideoRenderer?.lengthText?.simpleText,
										thumbnail: "https://i.ytimg.com/vi/" + c.playlistPanelVideoRenderer?.videoId + "/hq720.jpg",
										owner: {
											name: c.playlistPanelVideoRenderer?.longBylineText?.runs?.[0]?.text,
											url: "https://www.youtube.com" + c.playlistPanelVideoRenderer?.longBylineText?.runs?.[0]?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url,
										},
									})) || [],
								altData:
									kkmvytfd
										?.filter((c: any) => c.lockupViewModel)
										?.map((c: any) => {
											const lvm = c.lockupViewModel;
											const nUrl = lvm?.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url || "";
											const rId = nUrl.includes("v=") ? nUrl.split("v=")[1].split("&")[0] : lvm?.contentId;
											return {
												videoId: rId,
												url: "https://www.youtube.com/watch?v=" + rId,
												altUrl: "https://www.youtube.com" + nUrl,
												title: lvm?.metadata?.lockupMetadataViewModel?.title?.content,
												thumbnail: "https://i.ytimg.com/vi/" + rId + "/hq720.jpg",
												owner: {
													name: lvm?.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content,
													url: lvm?.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url ? "https://www.youtube.com" + lvm?.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url : null,
													avatar: lvm?.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources?.[0]?.url?.replace(/=s\d+.*/, "=s0"),
												},
											};
										}) || [],
							};
						}
					}
				} catch (e) {
					console.error("Mix fetch error:", e);
				}
			}

			try {
				const chnl = a.longBylineText?.runs?.[0];
				const chnl2 = chnl?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url;
				const fom = {
					type: "videoRenderer",
					videoId: a.videoId,
					url: "https://www.youtube.com/watch?v=" + a.videoId,
					altUrl: "https://www.youtube.com" + a.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url,
					thumbnail: "https://i.ytimg.com/vi/" + a.videoId + "/maxresdefault.jpg",
					movingThumbnail: a.richThumbnail?.movingThumbnailRenderer?.movingThumbnailDetails?.thumbnails?.[0]?.url || null,
					previewThumbnail: a?.expandableMetadata?.expandableMetadataRenderer?.expandedContent?.horizontalCardListRenderer?.cards?.[0]?.macroMarkersListItemRenderer?.thumbnail?.thumbnails?.[0]?.url || (a.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url?.startsWith("/shorts") ? "https://i.ytimg.com/vi/" + a.videoId + "/oardefault.jpg" : null),
					title: a.title?.runs?.[0]?.text,
					description: a.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((b: any) => b.text)?.join("") || "",
					owners: {
						name: a.ownerText?.runs?.[0]?.text,
						url:
							(chnl2
								? ["https://www.youtube.com" + chnl2]
								: chnl?.navigationEndpoint?.showDialogCommand?.panelLoadingStrategy?.inlineContent?.dialogViewModel?.customContent?.listViewModel?.listItems
										?.map((d: any) => {
											const u = d.listItemViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url || d.listItemViewModel?.leadingAccessory?.avatarViewModel?.endpoint?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url || d.listItemViewModel?.title?.commandRuns?.[0]?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url;
											return u ? "https://www.youtube.com" + u : null;
										})
										.filter(Boolean)) || [],
						avatar: (a.avatar?.avatarStackViewModel?.avatars?.map((e: any) => e?.avatarViewModel?.image?.sources?.[0]?.url) || [a.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails?.[0]?.url]?.map((k: any) => k))?.map((k: any) => k?.replace(/=s\d+.*/, "=s0")),
					},
					timeChapters:
						a?.expandableMetadata?.expandableMetadataRenderer?.expandedContent?.horizontalCardListRenderer?.cards?.map((k: any) => ({
							text: k?.macroMarkersListItemRenderer?.title?.runs?.[0]?.text,
							time: k?.macroMarkersListItemRenderer?.timeDescription?.runs?.[0]?.text,
							thumbnail: k?.macroMarkersListItemRenderer?.thumbnail?.thumbnails?.[0]?.url,
							isHighlighted: k?.macroMarkersListItemRenderer?.isHighlighted,
							url: "https://www.youtube.com/" + k?.macroMarkersListItemRenderer?.onTap?.commandMetadata?.webCommandMetadata?.url,
						})) || null,
					isLive: a?.badges?.some((bad: any) => bad?.metadataBadgeRenderer?.icon?.iconType === "LIVE") || false,
					isATV: ((a.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((b: any) => b.text).join("") || "")?.startsWith("Provided to YouTube by ") && a.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer?.icon?.iconType === "MUSIC") || false,
					isMix: !!a?.navigationEndpoint?.watchEndpoint?.playlistId,
					isShorts: a.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url?.startsWith("/shorts"),
					mixPlaylist: mixData,
					viewCount: parseAbbreviatedNumber(a?.viewCountText?.simpleText?.split(" ")?.[0] || a.viewCountText?.runs?.[0]?.text),
					duration: a.lengthText?.simpleText || a.lengthText?.runs?.[0]?.text || null,
				};
				return fom;
			} catch (err) {
				console.error("Error parsing YouTube Video item:", err);
				return null;
			}
		});

		const alk = (await Promise.all(mappedTasks)).filter(Boolean);

		const mappedTasks2 = inrtubeContents.map((item: any) => {
			const a = item.gridShelfViewModel;
			if (!a) return null;
			return a.contents.map((e: any) => ({
				type: "shortsGrid",
				videoId: e?.shortsLockupViewModel?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId,
				url: "https://www.youtube.com/watch?v=" + e?.shortsLockupViewModel?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId,
				altUrl: "https://www.youtube.com" + e?.shortsLockupViewModel?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url,
				thumbnail: "https://i.ytimg.com/vi/" + e?.shortsLockupViewModel?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId + "/maxresdefault.jpg",
				movingThumbnail: null,
				previewThumbnail: "https://i.ytimg.com/vi/" + e?.shortsLockupViewModel?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId + "/oardefault.jpg",
				title: e?.shortsLockupViewModel?.overlayMetadata?.primaryText?.content || null,
				description: "",
				owners: {},
				timeChapters: null,
				isLive: false,
				isATV: false,
				isMix: false,
				isShorts: true,
				mixPlaylist: null,
				viewCount: parseAbbreviatedNumber(e?.shortsLockupViewModel?.overlayMetadata?.secondaryText?.content?.split(" ")?.[0]),
				duration: null,
			}));
		});
		const finalTask2 = mappedTasks2.filter(Boolean).flat();

		return { searchParams: queryId, data: alk?.concat(finalTask2) };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const YTMusic = async function YTMusic(que: string, deepSearch: boolean = false) {
	if (!que) return null;
	try {
		await getYoutubeVisitorKey();
		const videoIdFromPlaylist = (playlistId: string | undefined | null) => {
			if (!playlistId) return null;
			return playlistId.match(/^RDAMVM([A-Za-z0-9_-]{11})/)?.[1] || playlistId.match(/^RD(?:AM)?([A-Za-z0-9_-]{11})/)?.[1] || null;
		};
		const bodyload = JSON.stringify({
			query: que,
			params: "EgWKAQIIAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D",
			context: {
				client: {
					clientName: "WEB_REMIX",
					clientVersion: "1.20261230",
					hl: "en",
					gl: "US",
					...(poTokenCache?.visitor_data ? { visitorData: poTokenCache.visitor_data } : {}),
				},
			},
			...(poTokenCache?.po_token ? { serviceIntegrityDimensions: { poToken: poTokenCache.po_token } } : {}),
		});
		const response = await fetch("https://m.youtube.com/youtubei/v1/search?prettyPrint=false&fields=contents", {
			headers: {
				...commonHeaders,
				"Content-Type": "application/json",
				...(keyYoutubeVisitor?.cookie ? { Cookie: keyYoutubeVisitor.cookie } : {}),
			},
			body: bodyload,
			method: "POST",
		});

		const res: any = await response.json();

		if (!res?.contents?.tabbedSearchResultsRenderer) {
			return {
				error: "YouTube Music is not available in your area",
			};
		}

		const sectionContents = res?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
		const musicShelf = sectionContents.find((c: any) => c.musicShelfRenderer)?.musicShelfRenderer;
		const innerTubeResults = musicShelf?.contents || [];

		const mappedTasks = innerTubeResults.map(async (item: any) => {
			const a = item.musicResponsiveListItemRenderer;
			if (!a) return null;

			try {
				const flexColumn1 = a.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
				const flexColumn0 = a.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
				const flexColumn2 = a.flexColumns?.[2]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];

				const artistRuns = flexColumn1.filter((r: any) => r?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType?.startsWith("MUSIC_PAGE_TYPE_ARTIST"));

				const artistRunsFallback = artistRuns.length > 0 ? artistRuns : flexColumn1.filter((r: any) => r?.navigationEndpoint?.browseEndpoint?.browseId && !r?.navigationEndpoint?.browseEndpoint?.browseId?.startsWith("MPRE"));

				const artistRunsFinal =
					artistRunsFallback.length > 0
						? artistRunsFallback
						: (() => {
								const plainRun = flexColumn1[0];
								if (!plainRun?.text || plainRun.navigationEndpoint) return [];
								return plainRun.text
									.replace(/,\s*&\s*/g, " & ")
									.split(/,\s*|\s+&\s+|\s+and\s+/)
									.map((name: string) => name.trim())
									.filter(Boolean)
									.map((name: string) => ({
										text: name,
										navigationEndpoint: null,
									}));
							})();

				const albumRun = flexColumn1.find((r: any) => r?.navigationEndpoint?.browseEndpoint?.browseId?.startsWith("MPRE"));
				const durationRun = flexColumn1.filter((r: any) => r?.text?.includes(":")).pop() || flexColumn1[flexColumn1.length - 1];

				const musch = a.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url?.replace(/=w\d+.*/, "=s0");
				const menuWatchEndpoint = a.menu?.menuRenderer?.items?.find((e: any) => e.menuNavigationItemRenderer?.navigationEndpoint?.watchEndpoint)?.menuNavigationItemRenderer?.navigationEndpoint?.watchEndpoint;
				const titleWatchEndpoint = flexColumn0[0]?.navigationEndpoint?.watchEndpoint;
				const itemWatchEndpoint = a.navigationEndpoint?.watchEndpoint;
				const muspl = menuWatchEndpoint?.playlistId || titleWatchEndpoint?.playlistId || itemWatchEndpoint?.playlistId;
				const videoId = a.playlistItemData?.videoId || titleWatchEndpoint?.videoId || itemWatchEndpoint?.videoId || menuWatchEndpoint?.videoId || videoIdFromPlaylist(muspl);
				const altUrl = videoId ? "https://music.youtube.com/watch?v=" + videoId + (muspl ? "&list=" + muspl : "") : null;

				let mixData: any = null;
				if (muspl && deepSearch) {
					try {
						const rlkreq = await fetch(`https://www.youtube.com/watch?v=&list=${muspl}`, {
							headers: commonHeaders,
						});

						let rlkresText = await rlkreq.text();
						let rlkres: any = parseYtInitial(rlkresText);

						if (rlkres) {
							const kkmvytmx = rlkres?.contents?.twoColumnWatchNextResults?.playlist?.playlist;
							if (kkmvytmx) {
								const kkmvytfd = rlkres?.contents?.twoColumnWatchNextResults?.secondaryResults?.secondaryResults?.results?.[0]?.itemSectionRenderer?.contents;
								let getmgcf: any = null;
								try {
									getmgcf = new URL(kkmvytmx.playlistShareUrl);
									getmgcf = getmgcf.searchParams.get("list");
								} catch {}
								mixData = {
									playlistId: getmgcf,
									title: kkmvytmx.title,
									shareUrl: kkmvytmx.playlistShareUrl,
									data:
										kkmvytmx.contents?.map((c: any) => ({
											videoId: c.playlistPanelVideoRenderer?.videoId,
											url: "https://www.youtube.com/watch?v=" + c.playlistPanelVideoRenderer?.videoId,
											altUrl: "https://www.youtube.com" + c.playlistPanelVideoRenderer?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url,
											title: c.playlistPanelVideoRenderer?.title?.simpleText,
											duration: c.playlistPanelVideoRenderer?.lengthText?.simpleText,
											thumbnail: "https://i.ytimg.com/vi/" + c.playlistPanelVideoRenderer?.videoId + "/hq720.jpg",
											owner: {
												name: c.playlistPanelVideoRenderer?.longBylineText?.runs?.[0]?.text,
												url: "https://www.youtube.com" + c.playlistPanelVideoRenderer?.longBylineText?.runs?.[0]?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url,
											},
										})) || [],
									altData:
										kkmvytfd
											?.filter((c: any) => c.lockupViewModel)
											?.map((c: any) => {
												const lvm = c.lockupViewModel;
												const nUrl = lvm?.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url || "";
												const rId = nUrl.includes("v=") ? nUrl.split("v=")[1].split("&")[0] : lvm?.contentId;
												return {
													videoId: rId,
													url: "https://www.youtube.com/watch?v=" + rId,
													altUrl: "https://www.youtube.com" + nUrl,
													title: lvm?.metadata?.lockupMetadataViewModel?.title?.content,
													thumbnail: "https://i.ytimg.com/vi/" + rId + "/hq720.jpg",
													owner: {
														name: lvm?.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content,
														url: lvm?.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url ? "https://www.youtube.com" + lvm?.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url : null,
														avatar: lvm?.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources?.[0]?.url?.replace(/=s\d+.*/, "=s0"),
													},
												};
											}) || [],
								};
							}
						}
					} catch (e) {
						console.error("YTMusic mix fetch error:", e);
					}
				}

				return {
					duration: durationRun?.text || null,
					backgroundColors: a?.overlay?.musicItemThumbnailOverlayRenderer?.background?.verticalGradient?.gradientLayerColors || null,
					browseId: artistRunsFinal[0]?.navigationEndpoint?.browseEndpoint?.browseId || null,
					albumBrowseId: albumRun?.navigationEndpoint?.browseEndpoint?.browseId || null,
					playlistId: muspl,
					videoId,
					url: videoId ? "https://music.youtube.com/watch?v=" + videoId : null,
					altUrl,
					baseUrl: videoId ? "https://www.youtube.com/watch?v=" + videoId : null,
					shortUrl: videoId ? "https://youtu.be/" + videoId : null,
					thumbnail: musch?.startsWith("//") ? "https:" + musch : musch,
					title: flexColumn0[0]?.text,
					listenCount: String(parseAbbreviatedNumber(flexColumn2[0]?.text?.split(" ")?.[0])),
					isATV: titleWatchEndpoint?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType === "MUSIC_VIDEO_TYPE_ATV",
					isExplicit: a?.badges?.[0]?.musicInlineBadgeRenderer?.icon?.iconType?.startsWith("MUSIC_EXPLICIT") || false,
					isCollab: artistRunsFinal.length > 1,
					mixPlaylist: mixData,
					artists:
						artistRunsFinal.length > 0
							? artistRunsFinal.map((r: any) => ({
									name: r.text,
									browseId: r.navigationEndpoint?.browseEndpoint?.browseId || null,
									url: r.navigationEndpoint?.browseEndpoint?.browseId ? "https://music.youtube.com/channel/" + r.navigationEndpoint.browseEndpoint.browseId : null,
								}))
							: [
									{
										name: flexColumn1[0]?.text || "Unknown",
										browseId: null,
										url: null,
									},
								],
				};
			} catch (err) {
				console.error("Error parsing YouTube Music item:", err);
				return null;
			}
		});

		const alk = (await Promise.all(mappedTasks)).filter(Boolean);

		return { data: alk };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const GoogleSuggest = async function GoogleSuggest(que: string) {
	if (!que) return null;
	try {
		const res = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(que)}`, {
			headers: {
				...commonHeaders,
				Accept: "application/json",
				Referer: "https://www.google.com/",
				Origin: "https://www.google.com",
			},
		});
		const data: any = await res.json();
		return { autocomplete: data?.[1] || [] };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const DuckDuckGoSuggest = async function DuckDuckGoSuggest(que: string) {
	if (!que) return null;
	try {
		const res = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(que)}`, {
			headers: {
				...commonHeaders,
				Accept: "application/json",
				Referer: "https://duckduckgo.com/",
			},
		});
		const data: any = await res.json();
		if (Array.isArray(data)) {
			const arr = Array.isArray(data?.[1]) ? data[1] : data;
			return {
				autocomplete: arr.map((o: any) => (typeof o === "string" ? o : o?.phrase)).filter(Boolean),
			};
		}
		return {
			autocomplete: (data || []).map((o: any) => o?.phrase).filter(Boolean),
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const YTPlaylist = async function YTPlaylist(que: string) {
	if (!que) return null;
	try {
		await getYoutubeVisitorKey();
		const bodyload = JSON.stringify({
			query: que,
			params: "EgIQAw==",
			context: {
				client: {
					clientName: "WEB",
					clientVersion: "2.20261230",
					hl: "en",
					gl: "US",
					...(poTokenCache?.visitor_data ? { visitorData: poTokenCache.visitor_data } : {}),
				},
			},
			...(poTokenCache?.po_token ? { serviceIntegrityDimensions: { poToken: poTokenCache.po_token } } : {}),
		});

		const response = await fetch("https://m.youtube.com/youtubei/v1/search?prettyPrint=false", {
			headers: {
				...commonHeaders,
				"content-type": "application/json",
				...(keyYoutubeVisitor?.cookie ? { Cookie: keyYoutubeVisitor.cookie } : {}),
			},
			body: bodyload,
			method: "POST",
		});

		const res: any = await response.json();
		const contents = res?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

		const alk: any[] = [];

		contents.forEach((item: any) => {
			const a = item.lockupViewModel;
			if (!a || a.contentType !== "LOCKUP_CONTENT_TYPE_PLAYLIST") return;

			try {
				const meta = a.metadata?.lockupMetadataViewModel;
				const metadataRows = meta?.metadata?.contentMetadataViewModel?.metadataRows || [];

				const ownerPart = metadataRows[0]?.metadataParts?.[0]?.text;
				const ownerRun = ownerPart?.commandRuns?.[0];
				const ownerUrl = ownerRun?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url;
				const browseId = ownerRun?.onTap?.innertubeCommand?.browseEndpoint?.browseId;

				const sources: any[] = a.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.image?.sources || [];
				const bestThumb = sources.reduce((best: any, s: any) => (!best || s.width > best.width ? s : best), null);
				const thumbnail = bestThumb ? (bestThumb.url?.startsWith("//") ? "https:" + bestThumb.url : bestThumb.url) : null;

				const badge = a.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.overlays?.[0]?.thumbnailOverlayBadgeViewModel?.thumbnailBadges?.[0]?.thumbnailBadgeViewModel?.text;

				const targetVideo = metadataRows
					.filter((row: any) => !row.isSpacerRow && row.metadataParts?.[0]?.text?.commandRuns?.length)
					.map((row: any) => {
						const part = row.metadataParts[0].text;
						const run = part.commandRuns?.[0];
						const webUrl = run?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url;
						if (!webUrl?.startsWith("/watch")) return null;

						const watchEndpoint = run?.onTap?.innertubeCommand?.watchEndpoint;
						const videoId = watchEndpoint?.videoId;

						const raw: string = part.content || "";
						const sepIdx = raw.lastIndexOf(" · ");
						const title = sepIdx !== -1 ? raw.slice(0, sepIdx) : raw;
						const duration = sepIdx !== -1 ? raw.slice(sepIdx + 3) : null;

						// url without list, altUrl with list
						const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
						const altUrl = webUrl ? `https://www.youtube.com${webUrl}` : null;

						const videoThumb = videoId ? `https://i.ytimg.com/vi/${videoId}/hq720.jpg` : null;

						return { title, url, altUrl, duration, thumbnail: videoThumb };
					})
					.filter(Boolean);

				const fom = {
					playlistId: a.contentId,
					url: "https://www.youtube.com/playlist?list=" + a.contentId,
					title: meta?.title?.content,
					videoCount: badge ? parseInt(badge.replace(/[^0-9]/g, "")) || null : null,
					thumbnail,
					targetVideo,
					owner: {
						name: ownerPart?.content,
						browseId: browseId || null,
						url: ownerUrl ? "https://www.youtube.com" + ownerUrl : null,
					},
				};
				alk.push(fom);
			} catch (err) {
				console.error("Error parsing YouTube Playlist item:", err);
			}
		});

		return { data: alk };
	} catch (e) {
		console.error("YTPlaylist Global Error:", e);
		return null;
	}
};

export const SCMusic = async function SCMusic(que: string, refresh_auth?: boolean, limit_number: number = 1): Promise<any> {
	if (!que) return null;

	if (refresh_auth || !keysc) {
		keysc = await soundcloudKey();
	}

	try {
		const [per, per2] = await Promise.all([
			fetch(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(que)}&client_id=${keysc}&limit=${limit_number}&linked_partitioning=0`, {
				headers: commonHeaders,
			}),
			fetch(`https://mobi.soundcloud.com/search/tracks?q=${encodeURIComponent(que)}`, {
				headers: commonHeaders,
			}),
		]);

		if (per.status === 401) {
			return await SCMusic(que, true, limit_number);
		}
		const pes = per.status === 200 ? await per.json() : null;
		let testpes: any = {};
		try {
			const per2Text = await per2.text();
			testpes = JSON.parse(per2Text.split('type="application/json">')[1].split("</script>")[0]);
		} catch {}
		const entities = testpes?.props?.pageProps?.initialStoreState?.entities || {};
		const trackData = Object.values(entities?.tracks || {})
			.map((t: any) => t?.data)
			.filter(Boolean);
		return {
			data: [pes?.collection || null, trackData.length ? trackData : null],
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const SPMusic = async function SPMusic(que: string, refresh_auth: boolean = false, limit_number: number = 1): Promise<any> {
	if (!que) return null;

	if (refresh_auth || !keysp || !keysptoken) {
		const [a, b] = await Promise.all([spotifyKeyToken(), spotifyKey()]);
		keysptoken = a;
		keysp = b;
	}

	try {
		const perbody = {
			variables: {
				searchTerm: que,
				offset: 0,
				limit: limit_number,
				numberOfTopResults: limit_number,
				includeAudiobooks: true,
				includeArtistHasConcertsField: true,
				includePreReleases: true,
				includeAuthors: true,
			},
			operationName: "searchDesktop",
			extensions: {
				persistedQuery: {
					version: 1,
					sha256Hash: "fcad5a3e0d5af727fb76966f06971c19cfa2275e6ff7671196753e008611873c",
				},
			},
		};
		const per2 = await fetch(`https://api-partner.spotify.com/pathfinder/v2/query`, {
			method: "POST",
			body: JSON.stringify(perbody),
			headers: {
				"Content-Type": "application/json",
				Origin: "https://open.spotify.com",
				Authorization: "Bearer " + (keysp || ""),
				"App-Platform": "WebPlayer",
				"Client-Token": keysptoken || "",
				...commonHeaders,
			},
		});

		if (per2.status === 403) {
			return {
				error: "IP Blocked",
			};
		}

		if (per2.status === 429) {
			return {
				error: "Rate-limited",
			};
		}

		if ((per2.status === 401 || per2.status === 400) && !refresh_auth) {
			return await SPMusic(que, true);
		} else {
			const pes2: any = await per2.json();
			const finalpes: any = pes2?.data?.searchV2 || {};
			return {
				data: {
					albums: finalpes.albumsV2.items?.map((a: any) => a.data) || null,
					artists: finalpes.artists.items?.map((a: any) => a.data) || null,
					audiobooks: finalpes.audiobooks.items?.map((a: any) => a.data) || null,
					featured: finalpes.topResultsV2.itemsV2?.map((a: any) => a.item.data) || null,
					episodes: finalpes.episodes.items?.map((a: any) => a.data) || null,
					genres: finalpes.genres.items?.map((a: any) => a.data) || null,
					playlists: finalpes.playlists.items?.map((a: any) => a.data) || null,
					podcasts: finalpes.podcasts.items?.map((a: any) => a.data) || null,
					tracks: finalpes.tracksV2.items?.map((a: any) => a.item.data) || null,
					users: finalpes.users.items?.map((a: any) => a.data) || null,
				},
			};
		}
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const YTLyrics = async function YTLyrics(url: string, container?: any) {
	let videoId = url.match(/(?:[?&]v(?:i)?=|(?:^|\/)(?:youtu\.be|v|vi|u\/\w|embed|shorts|watch|live|source)\/)([A-Za-z0-9_-]{11})(?=$|[?#&/])/)?.[1];
	videoId = videoId || undefined;
	if (!videoId) return null;

	try {
		const responseBody: any = {
			data: null,
			syncLyrics: null,
			lyrics: null,
			footer: null,
		};

		const bodyload = JSON.stringify({
			videoId: videoId,
			context: {
				client: {
					clientName: "WEB_REMIX",
					clientVersion: "1.20261230",
					hl: "en",
					gl: "US",
				},
			},
		});
		const response = await fetch("https://m.youtube.com/youtubei/v1/next?prettyPrint=false&fields=contents.singleColumnMusicWatchNextResultsRenderer.tabbedRenderer.watchNextTabbedResultsRenderer(tabs.tabRenderer(endpoint(browseEndpoint/browseId),content/musicQueueRenderer/content/playlistPanelRenderer/contents/playlistPanelVideoRenderer(title,longBylineText,thumbnail,lengthText,videoId,shortBylineText)))", {
			headers: {
				...commonHeaders,
				"Content-Type": "application/json",
			},
			body: bodyload,
			method: "POST",
		});
		const res: any = await response.json();
		const browseId: string = res?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[1]?.tabRenderer?.endpoint?.browseEndpoint?.browseId || "";

		if (browseId) {
			const bodyload2 = JSON.stringify({
				browseId: browseId,
				context: {
					client: {
						clientName: "WEB_REMIX",
						clientVersion: "1.20261230",
						hl: "en",
						gl: "US",
					},
				},
			});

			const bodyload3 = JSON.stringify({
				browseId: browseId,
				context: {
					client: {
						clientName: "ANDROID_MUSIC",
						clientVersion: "9.25.50",
						hl: "en",
						gl: "US",
					},
				},
			});

			const [pull, pull3] = await Promise.all([
				fetch("https://m.youtube.com/youtubei/v1/browse?prettyPrint=false&fields=contents", {
					headers: {
						...commonHeaders,
						"Content-Type": "application/json",
					},
					body: bodyload2,
					method: "POST",
				}),
				fetch("https://m.youtube.com/youtubei/v1/browse?prettyPrint=false&fields=contents.elementRenderer.newElement.type.componentType.model.timedLyricsModel.lyricsData(timedLyricsData(lyricLine,cueRange(startTimeMilliseconds)))", {
					headers: {
						...commonHeaders,
						"Content-Type": "application/json",
					},
					body: bodyload3,
					method: "POST",
				}),
			]);

			const [res2, res3] = await Promise.all([pull.json(), pull3.json()]);
			responseBody["lyrics"] = (res2 as any)?.contents?.sectionListRenderer?.contents?.[0]?.musicDescriptionShelfRenderer?.description?.runs?.[0]?.text || null;
			responseBody["syncLyrics"] =
				(res3 as any)?.contents?.elementRenderer?.newElement?.type?.componentType?.model?.timedLyricsModel?.lyricsData?.timedLyricsData?.map((j: any) => ({
					...j,
					...(j?.cueRange ? {} : { cueRange: {} }),
				})) || null;
			responseBody["footer"] = (res2 as any)?.contents?.sectionListRenderer?.contents?.[0]?.musicDescriptionShelfRenderer?.footer?.runs?.[0]?.text || null;
		}

		responseBody["data"] = { ...(container || {}) };

		return responseBody;
	} catch (e) {
		console.error("YTLyrics Error:", e);
		return null;
	}
};

export const ShazamLyrics = async function ShazamLyrics(que: string): Promise<any> {
	if (!que) return null;
	try {
		const itunesRes = await fetch(`https://itunes.apple.com/search?media=music&limit=1&country=US&term=${encodeURIComponent(que)}`, { headers: commonHeaders });
		const itunesData: any = await itunesRes.json();
		const tracks = itunesData?.results;

		if (!tracks || tracks.length === 0) {
			return { data: null };
		}

		const firstTrack = tracks[0];
		const trackViewUrl: string = firstTrack.trackViewUrl || "";

		let shazamUrl: string | null = null;
		try {
			const parsedUrl = new URL(trackViewUrl);
			const iParam = parsedUrl.searchParams.get("i");
			const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
			const slugSegment = pathSegments.length >= 3 ? pathSegments[2] : null;

			if (iParam && slugSegment) {
				shazamUrl = `https://www.shazam.com/song/${iParam}/${slugSegment}`;
			}
		} catch {}

		const trackInfo = { ...firstTrack };

		let shazamInfo: any = null;
		let lyrics: string | null = null;
		let syncLyrics: string | null = null;

		if (shazamUrl) {
			try {
				const shazamRes = await fetch(shazamUrl, {
					headers: commonHeaders,
				});

				const html = await shazamRes.text();

				try {
					const ldJsonMatch = html.split('script type="application/ld+json">');
					if (ldJsonMatch.length > 1) {
						const ldJsonStr = ldJsonMatch[1].split("</script>")[0];
						const ldJson = JSON.parse(ldJsonStr);

						let parsedDuration: number | null = null;
						if (ldJson.duration && ldJson.duration.startsWith("PT")) {
							const match = ldJson.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
							if (match) {
								const h = parseInt(match[1] || "0", 10);
								const m = parseInt(match[2] || "0", 10);
								const s = parseFloat(match[3] || "0");
								parsedDuration = Math.round((h * 3600 + m * 60 + s) * 1000);
							}
						}

						const byArtist = typeof ldJson.byArtist === "string" ? ldJson.byArtist : ldJson.byArtist?.name || ldJson.creator?.name || null;

						shazamInfo = {
							trackName: ldJson.name || null,
							trackUrl: ldJson.url || null,
							thumbnailUrl: ldJson.thumbnailUrl?.replace(/\d+x\d+\w+/, "1x1ss").replace(/\.\w+$/, ".png") || null,
							durationTrack: parsedDuration,
							genreTrack: ldJson.genre || null,
							byArtist: byArtist,
							albumName: ldJson.inAlbum?.name || null,
							albumPublished: ldJson.datePublished || null,
						};
					} else {
						shazamInfo = {
							trackName: null,
							trackUrl: null,
							thumbnailUrl: null,
							durationTrack: null,
							genreTrack: null,
							byArtist: null,
							albumName: null,
							albumPublished: null,
						};
					}

					const artistMatch = html.match(/TrackPageArtistLink_artistNameText[^>]*>([^<]+)<\/span>/);
					if (artistMatch) shazamInfo.byArtist = decodeHTML(artistMatch[1]);

					const albumMatch = html.match(/>Album<\/span>(?:<a[^>]*>)?<span[^>]*>([^<]+)<\/span>/);
					if (albumMatch) shazamInfo.albumName = decodeHTML(albumMatch[1]);

					const dateMatch = html.match(/>Release Date<\/span><span[^>]*>([^<]+)<\/span>/);
					if (dateMatch) shazamInfo.albumPublished = dateMatch[1];

					const labelMatch = html.match(/>Label<\/span><span[^>]*>([^<]+)<\/span>/);
					shazamInfo.label = labelMatch ? decodeHTML(labelMatch[1]) : null;

					const languageMatch = html.match(/>Language<\/span><span[^>]*>([^<]+)<\/span>/);
					shazamInfo.language = languageMatch ? decodeHTML(languageMatch[1]) : null;

					const bpmMatch = html.match(/>BPM<\/span><span[^>]*>(\d+)<\/span>/);
					shazamInfo.bpm = bpmMatch ? parseInt(bpmMatch[1], 10) : null;

					const getAttribute = (name: string) => {
						const regex = new RegExp(`>${name}<\\/span><\\/div><div[^>]*><div[^>]*><div[^>]*style="left:(\\d+)%"`);
						const match = html.match(regex);
						return match ? parseInt(match[1], 10) : null;
					};

					shazamInfo.melodicness = getAttribute("Melodicness");
					shazamInfo.acousticness = getAttribute("Acousticness");
					shazamInfo.valence = getAttribute("Valence");
					shazamInfo.danceability = getAttribute("Danceability");
					shazamInfo.energy = getAttribute("Energy");
				} catch {}

				try {
					const rx = /\\\\?"lyricLines\\\\?":(\[.*?\])\}/g;
					const matches = [...html.matchAll(rx)];

					if (matches.length > 0) {
						const parseTime = (str: string) => {
							if (str.includes(":")) {
								const parts = str.split(":");
								if (parts.length === 3) {
									return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
								} else if (parts.length === 2) {
									return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
								}
							}
							return parseFloat(str);
						};

						const syncedLines: string[] = [];
						matches.forEach((m) => {
							try {
								const raw = m[1].replace(/\\"/g, '"');
								const arr = JSON.parse(raw);

								arr.forEach((l: any) => {
									const time = parseTime(l.startTimeInSeconds || "0");
									const mins = Math.floor(time / 60)
										.toString()
										.padStart(2, "0");
									const secs = (time % 60).toFixed(2).padStart(5, "0");
									syncedLines.push(`[${mins}:${secs}] ${l.content}`);
								});
							} catch {}
						});

						if (syncedLines.length > 0) {
							syncLyrics = syncedLines.join("\n");
						}
					}
				} catch {}

				if (!lyrics) {
					try {
						const lyricParts = html.split("LyricsContent_");
						if (lyricParts.length > 1) {
							const lyricLines: string[] = [];
							for (let i = 1; i < lyricParts.length; i++) {
								const part = lyricParts[i];
								if (part.startsWith("sectionTitle") || part.startsWith("lyricLine")) {
									const text = part
										.split('">')[1]
										?.split("</div>")[0]
										?.replace(/<[^>]*>/g, "");
									if (text) {
										lyricLines.push(text);
									}
								}
							}

							if (lyricLines.length > 0) {
								lyrics = decodeHTML(lyricLines.join("\n"));
							}
						}
					} catch {}
				}

				if (!lyrics) {
					try {
						const ldJsonMatch = html.split('script type="application/ld+json">');
						if (ldJsonMatch.length > 1) {
							const ldJsonStr = ldJsonMatch[1].split("</script>")[0];
							const ldJson = JSON.parse(ldJsonStr);
							if (ldJson?.recordingOf?.lyrics?.text) {
								lyrics = ldJson.recordingOf.lyrics.text;
							}
						}
					} catch {}
				}
			} catch (e) {
				console.error("Shazam fetch error:", e);
			}
		}

		return {
			data: [trackInfo, shazamInfo],
			lyrics: lyrics,
			syncLyrics: syncLyrics || null,
		};
	} catch (e) {
		console.error("Shazam lyrics error:", e);
		return null;
	}
};

export const Deezer = async function Deezer(que: string, limits: number = 1) {
	if (!que) return null;
	try {
		const pull = await fetch(`https://api.deezer.com/search?limit=${limits}&q=${encodeURIComponent(que)}`, {
			headers: commonHeaders,
		});
		const res: any = await pull.json();
		return { data: res?.data || null };
	} catch {
		return null;
	}
};

async function resolveTikTokRedirect(url: string, maxRedirects = 6): Promise<string> {
	let currentUrl = url;

	for (let i = 0; i < maxRedirects; i++) {
		const res = await fetch(currentUrl, {
			redirect: "manual" as const,
			headers: {
				...commonHeaders,
				Range: "bytes=0-1",
			},
		});

		if (![301, 302, 303, 307, 308].includes(res.status)) break;

		const location = res.headers.get("location");
		if (typeof location !== "string" || !location) break;

		const nextUrl = new URL(location, currentUrl).toString();
		if (nextUrl === currentUrl) break;

		currentUrl = nextUrl;
	}

	return currentUrl;
}

export const TiktokVideo = async function TiktokVideo(url: string) {
	if (!url) return null;

	let videoId: string | null = null;
	let finalUrl = url;

	if (url.includes("vm.tiktok.com") || url.includes("vt.tiktok.com")) {
		try {
			finalUrl = await resolveTikTokRedirect(url);
		} catch (e) {
			console.error("TikTok redirect error:", e);
			return null;
		}
	}

	const patterns = [/video\/(\d+)/, /v\/(\d+)/, /^(\d+)$/];

	for (const pattern of patterns) {
		const match = finalUrl.match(pattern);
		if (match) {
			videoId = match[1];
			break;
		}
	}

	if (!videoId) return null;

	try {
		const targetUrl = `https://www.tiktok.com/@/video/${videoId}`;
		let scriptContent: string | undefined;
		for (let i = 0; i < 15; i++) {
			try {
				const response = await fetch(targetUrl, { headers: { ...commonHeaders, Cookie: tiktokSessionKeys?.cookie } });
				const html = await response.text();
				scriptContent = html.split('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">')[1]?.split("</script>")[0];
				if (scriptContent) break;
			} catch (e) {
				// ignore and retry
			}
		}
		if (!scriptContent) return { error: "WAF Challenge" };

		let savetikData: any = null;
		try {
			savetikData = await SavetikVideo(targetUrl);
		} catch (e) {
			// savetik is optional fallback, keep page data
		}

		const json = JSON.parse(scriptContent);
		const videoDetail = json?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;

		if (!videoDetail?.video) return { data: null };

		const responseData: any = {
			aweme_id: videoDetail.id?.toString(),
			original_play_url: savetikData?.video_url || null,
		};

		if (videoDetail.video?.videoID) responseData.videoId = videoDetail.video?.videoID;

		const authorUniqueId = videoDetail.author?.uniqueId;
		if (authorUniqueId && authorUniqueId !== "undefined") {
			responseData.url = "https://www.tiktok.com/@" + authorUniqueId + "/video/" + videoDetail.id;
			responseData.author = {
				url: "https://www.tiktok.com/@" + authorUniqueId,
				aweme_id: videoDetail.author?.id?.toString(),
				secUid: videoDetail.author?.secUid,
				uniqueId: videoDetail.author?.uniqueId,
				nickname: videoDetail.author?.nickname,
				desc: videoDetail.author?.signature,
				createTime: videoDetail.author?.createTime?.toString(),
				verified: videoDetail.author?.verified,
				tiktokSeller: videoDetail.author?.ttSeller,
				avatar: videoDetail.author?.avatarLarger,
				followerCount: videoDetail.authorStatsV2?.followerCount?.toString(),
				followingCount: videoDetail.authorStatsV2?.followingCount?.toString(),
				totalLikesCount: videoDetail.authorStatsV2?.heartCount?.toString(),
				likeCount: videoDetail.authorStatsV2?.diggCount?.toString(),
				videoCount: videoDetail.authorStatsV2?.videoCount?.toString(),
			};
		}

		if (videoDetail?.desc) responseData.desc = videoDetail.desc;
		if (videoDetail?.textLanguage) responseData.descLanguage = videoDetail.textLanguage;
		if (videoDetail.createTime && videoDetail.createTime !== "0") responseData.createTime = videoDetail.createTime;

		if (videoDetail.video?.cover) responseData.cover = videoDetail.video?.cover;
		if (videoDetail.video?.originCover) responseData.originCover = videoDetail.video?.originCover;
		if (videoDetail.video?.dynamicCover) responseData.dynamicCover = videoDetail.video?.dynamicCover;
		if (videoDetail.video?.duration) responseData.duration = videoDetail.video?.duration;

		const playUrl = videoDetail.video?.PlayAddrStruct?.UrlList?.[2]?.replace("?faid=1988", "?faid=1233");
		if (playUrl) responseData.play_url = playUrl;

		if (videoDetail.video?.bitrateInfo) {
			responseData.bit_rate = videoDetail.video?.bitrateInfo?.map((br: any) => ({
				gearName: br.GearName,
				bitrate: br.Bitrate,
				res: `${br.PlayAddr?.Width}x${br.PlayAddr?.Height}`,
				fps: br.BitrateFPS,
				format: br.Format,
				codec: br.CodecType,
				play_url: br.PlayAddr?.UrlList?.[2]?.replace("1988", "1233"),
			}));
		}

		if (videoDetail.statsV2?.diggCount) responseData.likeCount = videoDetail.statsV2?.diggCount?.toString();
		if (videoDetail.statsV2?.shareCount) responseData.shareCount = videoDetail.statsV2?.shareCount?.toString();
		if (videoDetail.statsV2?.commentCount) responseData.commentCount = videoDetail.statsV2?.commentCount?.toString();
		if (videoDetail.statsV2?.playCount) responseData.playCount = videoDetail.statsV2?.playCount?.toString();
		if (videoDetail.statsV2?.collectCount) responseData.favoriteCount = videoDetail.statsV2?.collectCount?.toString();

		if (videoDetail.suggestedWords) responseData.suggested_words = videoDetail.suggestedWords;
		const searchSuggest = videoDetail?.videoSuggestWordsList?.video_suggest_words_struct?.[0]?.words?.[0]?.word;
		if (searchSuggest) responseData.search_suggest = searchSuggest;

		if (videoDetail.locationCreated) responseData.location = videoDetail.locationCreated;

		const musicId = videoDetail.music?.id;
		if (musicId && musicId !== "undefined") {
			responseData.music = {
				url: "https://www.tiktok.com/music/-" + musicId,
				aweme_id: videoDetail.music?.id?.toString(),
				title: videoDetail.music?.title,
				author: videoDetail.music?.authorName,
				cover: videoDetail.music?.coverLarge,
				play_url: videoDetail.music?.playUrl,
				duration: videoDetail.music?.duration,
				original: videoDetail.music?.original,
				private: videoDetail.music?.private,
			};
		}

		return {
			_warning: "Tiktok updating security protection for accessing api. This endpoint may stop working in future",
			data: responseData,
			altData: videoDetail,
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export async function SavetikVideo(url: string) {
	if (!url) return null;
	try {
		const response = await fetch("https://savetik.io/api/ajaxSearch", {
			method: "POST",
			headers: {
				...commonHeaders,
				"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
			},
			body: new URLSearchParams({
				q: url,
				cursor: "0",
				page: "0",
				lang: "en",
			}).toString(),
		});

		const json: any = await response.json();
		if (!json || !json.data) return null;

		const { document } = parseHTML(json.data);
		const hdLink = Array.from(document.querySelectorAll("a")).find((el: any) => el.textContent?.includes("Download MP4 HD"));

		if (!hdLink) return null;

		let finalUrl = (hdLink as any).getAttribute("href");
		if (!finalUrl) return null;

		if (finalUrl.includes("snapcdn.app") && finalUrl.includes("token=")) {
			try {
				const token = new URL(finalUrl).searchParams.get("token");
				if (token) {
					const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
					if (payload.url) {
						finalUrl = payload.url;
					}
				}
			} catch {}
		}

		const musicLink = Array.from(document.querySelectorAll("a")).find((el: any) => el.textContent?.includes("Download MP3"));
		let musicUrl: any = (musicLink as any)?.getAttribute("href") || null;

		if (musicUrl && musicUrl.includes("snapcdn.app") && musicUrl.includes("token=")) {
			try {
				const token = new URL(musicUrl).searchParams.get("token");
				if (token) {
					const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
					if (payload.url) {
						musicUrl = payload.url;
					}
				}
			} catch {}
		}

		return {
			video_url: finalUrl?.split("?")?.[0],
			music_url: musicUrl,
		};
	} catch (e) {
		console.error("Savetik error:", e);
		return null;
	}
}

export const deezerLyrics = async function deezerLyrics(que: string, refresh_auth: boolean = false): Promise<any> {
	if (!que) return null;

	try {
		if (refresh_auth || !keydeezer) {
			keydeezer = await deezerKeys();
		}

		const body = {
			operationName: "SearchFull",
			variables: {
				query: que,
				firstList: 1,
			},
			query: "query SearchFull($query: String!, $firstList: Int!) { instantSearch(query: $query) { results { tracks(first: $firstList) { edges { node { id title duration popularity isExplicit lyrics { id } media { id rights { ads { available availableAfter } sub { available availableAfter } } } album { id displayTitle releaseDate isExplicit tracksCount cover { large: urls(pictureRequest: {width: 500, height: 500}) } contributors { edges { roles node { ... on Artist { id name } } } } } contributors { edges { node { ... on Artist { id name } } } } credits: contributors(roles: [AUTHOR, COMPOSER]) { edges { roles node { ... on Artist { id name } } } } } } } } } }",
		};

		const responseBody: any = {
			data: null,
			lyrics: null,
		};

		const pull = await fetch(`https://pipe.deezer.com/api`, {
			method: "POST",
			headers: {
				...commonHeaders,
				Authorization: "Bearer " + keydeezer,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		const res: any = await pull.json();

		if (res?.errors?.[0]?.message.includes("Given jwt")) {
			return await deezerLyrics(que, true);
		}

		const edges = res?.data?.instantSearch?.results?.tracks?.edges;

		if (!edges || edges.length === 0) {
			return { data: null };
		}

		const trackNode = edges[0].node;
		responseBody["data"] = trackNode;

		if (trackNode.lyrics?.id) {
			const body2 = {
				operationName: "GetLyrics",
				variables: {
					trackId: trackNode.id,
				},
				query: "query GetLyrics($trackId: String!) { track(trackId: $trackId) { lyrics { text synchronizedLines { lrcTimestamp line } } } }",
			};

			const pull2 = await fetch(`https://pipe.deezer.com/api`, {
				method: "POST",
				headers: {
					...commonHeaders,
					Authorization: "Bearer " + keydeezer,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body2),
			});

			const res2: any = await pull2.json();

			if (res2?.errors?.[0]?.message.includes("Given jwt")) {
				return await deezerLyrics(que, true);
			}

			responseBody["lyrics"] = res2?.data?.track?.lyrics || null;
		}

		return responseBody;
	} catch {
		return null;
	}
};

export const tidalLyrics = async function tidalLyrics(que: string, refresh_auth: boolean = false): Promise<any> {
	if (!que) return null;

	try {
		if (refresh_auth || !keybearer) {
			keybearer = await tidalKeysToken();
		}

		const findtrack: any = await Tidal(que, false, 1);
		const trackid = findtrack.data?.[0]?.id;
		if (!trackid) {
			return { data: null };
		}

		const pull = await fetch(`https://openapi.tidal.com/v2/tracks/${trackid}?countryCode=US&include=lyrics`, {
			headers: {
				...commonHeaders,
				Accept: "application/vnd.api+json",
				Origin: "https://tidal.com",
				Authorization: "Bearer " + keybearer,
			},
		});

		if (pull.status === 429) {
			return { error: "Rate-limited" };
		}

		if (pull.status === 400 || pull.status === 401) {
			return await tidalLyrics(que, true);
		}

		const res: any = await pull.json();
		return {
			data: [res?.data?.attributes || null, findtrack.data?.[0] || null],
			lyrics: res?.included?.[0]?.attributes?.text || null,
			syncLyrics: res?.included?.[0]?.attributes?.lrcText || null,
			...res?.included?.[0]?.attributes?.provider,
		};
	} catch {
		return null;
	}
};

export const SPLyrics = async function SPLyrics(que: string, refresh_auth: boolean = false): Promise<any> {
	if (!que) return null;

	if (refresh_auth || !keysp || !keysptoken) {
		const [a, b] = await Promise.all([spotifyKeyToken(), spotifyKey()]);
		keysptoken = a;
		keysp = b;
	}

	try {
		let trackId = que;
		let trackData: any = null;

		if (que.includes("spotify.com/track/")) {
			trackId = que.split("track/")[1].split("?")[0];
		} else if (que.match(/^[a-zA-Z0-9]{22}$/)) {
			trackId = que;
		} else {
			const searchResult = await SPMusic(que, false, 1);
			const firstTrack = searchResult?.data?.tracks?.[0];
			if (!firstTrack) return { data: null, lyrics: null };
			trackId = firstTrack.id;
		}

		const l = await infoSpotify("https://open.spotify.com/track/" + trackId);
		trackData = l?.data;

		const pull = await fetch(`https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}?format=json&vnext=true`, {
			headers: {
				...commonHeaders,
				Authorization: "Bearer " + keysp,
				"App-Platform": "WebPlayer",
			},
		});

		if (pull.status === 401 && !refresh_auth) {
			return await SPLyrics(que, true);
		}

		if (pull.status === 400 && !process.env.SPOTIFY_COOKIES) {
			return {
				error: "Sign in to use this feature",
			};
		} else if (pull.status === 403 || pull.status === 400) {
			return {
				error: "IP Blocked / Cookies no longer active",
			};
		}

		let res: any = {};

		try {
			res = await pull.json();
		} catch {}

		if (!trackData) {
			return { data: null };
		}

		const plainLyric = res?.lyrics?.lines
			?.map((a: any) => a.words)
			?.join("\n")
			?.replaceAll("♪", "");
		const { lyrics, ...extraInfo } = res || {};
		const { lines, ...extraInfo2 } = res?.lyrics || {};

		return {
			data: trackData,
			lyrics: plainLyric || null,
			syncLyrics: lines || null,
			...extraInfo2,
			...extraInfo,
		};
	} catch (e) {
		console.error("SPLyrics Error:", e);
		return null;
	}
};

export const Tidal = async function Tidal(que: string, refresh?: boolean, limits: number = 1): Promise<any> {
	if (!que) return null;
	if (refresh) {
		setKeyTidal(await tidalKeys());
	}

	try {
		const pull = await fetch(`https://api.tidal.com/v1/search/tracks?countryCode=US&locale=en_US&limit=${limits}&offset=0&query=${encodeURIComponent(que)}`, {
			headers: {
				...commonHeaders,
				"X-Tidal-Token": keytidal || "",
			},
		});

		if (pull.status === 400 || pull.status === 401) {
			return await Tidal(que, true);
		}

		const res: any = await pull.json();
		return { data: res?.items || null };
	} catch {
		return null;
	}
};

export const TidalOpen = async function TidalOpen(que: string, refresh?: boolean, limits: number = 1): Promise<any> {
	if (!que) return null;

	if (!keybearer || refresh) {
		keybearer = await tidalKeysToken();
	}

	try {
		const pull = await fetch(`https://tidal.com/v2/client-search/?includeContributors=true&includeDidYouMean=true&includeUserPlaylists=true&limit=${limits}&query=${encodeURIComponent(que)}&supportsUserData=true&countryCode=US&locale=en_US&deviceType=BROWSER`, {
			headers: {
				...commonHeaders,
				Accept: "application/json",
				Authorization: "Bearer " + keybearer,
				"x-tidal-token": keytidalopen,
			},
		});

		if (pull.status === 429) {
			return { error: "Rate-limited" };
		}

		if (pull.status === 400 || pull.status === 401) {
			return await TidalOpen(que, true);
		}

		const res: any = await pull.json();
		const data: any = {};
		for (const key in res) {
			if (["queryId", "contentTypeFilters"].includes(key)) continue;
			data[key] = res[key]?.items || res[key];
		}
		return { data };
	} catch {
		return null;
	}
};

export const Genius = async function Genius(que: string) {
	if (!que) return null;
	try {
		const [per, per2] = await Promise.all([
			fetch(`https://genius.com/api/search/song?&per_page=10&q=${encodeURIComponent(que)}`, {
				headers: commonHeaders,
			}),
			fetch(`https://genius.com/api/search/multi?q=${encodeURIComponent(que)}`, {
				headers: commonHeaders,
			}),
		]);

		const [data, data2] = await Promise.all([per.status === 200 ? per.json() : Promise.resolve(null), per2.status === 200 ? per2.json() : Promise.resolve(null)]);

		const hits = (data as any)?.response?.hits || (data as any)?.response?.sections?.[0]?.hits || [];
		const sections = (data2 as any)?.response?.sections || [];

		const results = hits.map((hit: any) => ({
			title: hit.result.title,
			fullTitle: hit.result.full_title,
			artist: hit.result.primary_artist.name,
			artistUrl: hit.result.primary_artist.url,
			thumbnail: hit.result.song_art_image_thumbnail_url,
			url: hit.result.url,
			id: hit.result.id,
		}));

		return { data: results, sections };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export function Number_random(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

const CONVO_KEY = crypto.createHash("sha256").update("conversation").digest();
const GEMINI_RETRY_COOLDOWN_MS = 1000;

function encryptConvo(data: string): string {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv("aes-256-gcm", CONVO_KEY, iv);
	const encrypted = Buffer.concat([cipher.update(data, "utf-8"), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return Buffer.concat([iv, authTag, encrypted]).toString("base64url");
}

function decryptConvo(encoded: string): string {
	const buf = Buffer.from(encoded, "base64url");
	const iv = buf.subarray(0, 12);
	const authTag = buf.subarray(12, 28);
	const encrypted = buf.subarray(28);
	const decipher = crypto.createDecipheriv("aes-256-gcm", CONVO_KEY, iv);
	decipher.setAuthTag(authTag);
	return decipher.update(encrypted) + decipher.final("utf-8");
}

let geminiWiz: { fSid: string; bl: string; expire: number } | null = null;
let geminiCookies: string | null = null;

const getGeminiWiz = async () => {
	if (geminiWiz && geminiWiz.expire > Date.now()) return geminiWiz;
	try {
		const res = await fetch("https://gemini.google.com/app", {
			headers: commonHeaders,
		});
		const text = await res.text();
		const fSid = text.match(/"FdrFJe":"(.*?)"/)?.[1];
		const bl = text.match(/"cfb2h":"(.*?)"/)?.[1];
		if (!fSid || !bl) return null;
		geminiWiz = { fSid, bl, expire: Date.now() + 21600 * 1000 };
		if (res.headers.getSetCookie) {
			geminiCookies = normalizeCookies(res.headers.getSetCookie());
		} else {
			geminiCookies = normalizeCookies(res.headers.get("set-cookie"));
		}
	} catch {
		return null;
	}
	return geminiWiz;
};

let geminiReqId = 0;

export const Gemini = async function Gemini(que: string, convo: any, retry: number = 0) {
	if (!que) return null;

	let objectbody: any = { cid: null, rid: null, rcid: null, cookies: null };
	let parsebody = null;
	let lastUUID: string | null = null;

	if (convo) {
		try {
			parsebody = JSON.parse(decryptConvo(convo));
		} catch {
			return { error: "JSON parsing error" };
		}
	}

	if (convo != null && typeof parsebody === "object") {
		objectbody["cid"] = parsebody?.cid;
		objectbody["rid"] = parsebody?.rid;
		objectbody["rcid"] = parsebody?.rcid;
		lastUUID = parsebody?.contentUUID;
	}

	const qCookies = geminiCookies;

	if (!lastUUID) lastUUID = crypto.randomUUID().toUpperCase();
	const inner = new Array(69).fill(null);
	inner[0] = [que, 0, null, null, null, null, 0];
	inner[1] = ["en"];
	inner[2] = [objectbody.cid || "", objectbody.rid || "", objectbody.rcid || "", null, null, null, null, null, null, ""];
	inner[3] = null;
	inner[4] = crypto.randomUUID().replace(/-/g, "");
	inner[6] = [1];
	inner[7] = 1;
	inner[10] = 1;
	inner[11] = 0;
	inner[17] = [[0]];
	inner[18] = 0;
	inner[27] = 1;
	inner[30] = [4];
	inner[41] = [1];
	inner[53] = 0;
	inner[59] = null;
	inner[61] = [];
	inner[68] = 2;
	const reqPayload = `f.req=${encodeURIComponent(JSON.stringify([null, JSON.stringify(inner)]))}&`;

	const wiz = await getGeminiWiz();
	geminiReqId = (geminiReqId + 1) % 100000;
	let geminiQuery = `hl=en-US&_reqid=${geminiReqId}&rt=c`;
	if (wiz) {
		geminiQuery = `bl=${encodeURIComponent(wiz!.bl)}&f.sid=${encodeURIComponent(wiz!.fSid)}&${geminiQuery}`;
	}
	const req = await fetch(`https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?${geminiQuery}`, {
		method: "POST",
		headers: {
			...commonHeaders,
			...(qCookies ? { Cookie: qCookies } : {}),
			Accept: "*/*",
			"Content-Type": "application/x-www-form-urlencoded",
			Referer: "https://gemini.google.com",
			Origin: "https://gemini.google.com",
			"x-goog-ext-525001261-jspb": `[1,null,null,null,"fbb127bbb056c959",null,null,0,[4,6],null,null,1,null,null,1,null,"${lastUUID}"]`,
			"x-goog-ext-73010989-jspb": "[0]",
			"x-goog-ext-73010990-jspb": "[0,0,0]",
			"Sec-Fetch-Dest": "empty",
			"Sec-Fetch-Mode": "cors",
			"Sec-Fetch-Site": "same-origin",
			"X-Same-Domain": "1",
		},
		body: reqPayload,
	});

	if (req.url.includes("google.com/sorry")) {
		return {
			error: "Google asking to verify you're not a bot",
		};
	}
	if (req.status === 400) {
		if (retry >= 2) {
			if (convo) {
				return await Gemini(que, null, retry);
			}
			return { error: "Timeout / Bad Request" };
		}
		await new Promise((r) => setTimeout(r, GEMINI_RETRY_COOLDOWN_MS));
		return await Gemini(que, convo, retry + 1);
	}
	if (req.status === 429) {
		if (retry >= 2) return { error: "Rate-limited" };
		await new Promise((r) => setTimeout(r, GEMINI_RETRY_COOLDOWN_MS));
		return await Gemini(que, convo, retry + 1);
	}
	if (req.status === 403) {
		return {
			error: "Blocked / Geo-restricted",
		};
	}

	const resText = await req.text();
	let response;
	let finalres;
	let errorCode: number | null = null;

	try {
		const lines = resText.split("\n");
		let innerData;

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed.startsWith("[")) continue;
			try {
				const parsed = JSON.parse(trimmed);
				const items = Array.isArray(parsed[0]) ? parsed : [parsed];
				for (const dt of items) {
					if (dt?.[0] !== "wrb.fr") continue;
					const check = JSON.parse(dt[2]);
					if (check?.[4]?.[0]?.[8]?.[0] === 2) {
						innerData = check;
					}
					if (!errorCode) {
						errorCode = check?.[5]?.[2]?.[0]?.[1]?.[0] ?? dt?.[5]?.[2]?.[0]?.[1]?.[0] ?? null;
					}
					if (innerData) break;
				}
			} catch {}
			if (innerData) break;
		}

		if (!innerData) {
			if (retry >= 2) {
				if (convo) {
					return await Gemini(que, null, retry);
				}
				// No data after retries: fall through and attach the error to responseBody.
			} else {
				await new Promise((r) => setTimeout(r, GEMINI_RETRY_COOLDOWN_MS));
				return await Gemini(que, convo, retry + 1);
			}
		} else {
			objectbody.cid = (innerData as any)[1][0];
			objectbody.rid = (innerData as any)[1][1];
			objectbody.rcid = (innerData as any)[4][0][0];
			objectbody.contentUUID = lastUUID;

			finalres = innerData as any;

			response = (finalres[4]?.[0]?.[12]?.[1]?.[0]?.[0]?.[0]?.[0] ?? finalres[4]?.[0]?.[1]?.[0]) || null;
		}
	} catch (e) {
		console.error(e);
		response = null;
	}

	const errorInfo = getGeminiError(errorCode);

	const responseBody = {
		isFallback: retry !== 0,
		response: response ?? null,
		error: errorInfo?.message || null,
		code: errorInfo?.code || null,
		data: {
			responseInfo: {
				sessionId: wiz?.fSid || null,
				id: finalres ? finalres[4]?.[0]?.[0]?.split("_")?.[1] || null : null,
				language: finalres ? finalres[4]?.[0]?.[9] || null : null,
			},
			conversation: finalres ? encryptConvo(JSON.stringify(objectbody)) : null,
			expire: finalres ? String(geminiWiz?.expire) : null,
			model: "gemini-3.6-flash",
		},
	};

	return responseBody;
};

function getGeminiError(code: number | null) {
	switch (code) {
		case 13:
			return {
				message: "Can't process this due high-demand model, rate-limited or bad request",
				code,
			};
		case 1097:
			return {
				message: "Can't continue this conversation. Gemini might block this request",
				code,
			};
		case 1076:
			return { message: "Timeout / Bad Request", code };
		case 1060:
			return { message: "Google - Sign in to confirm you're not a bot", code };
		case 1096:
		case 1100:
		case 1152:
			return {
				message: "Can't continue this conversation. Try again but without conversation id",
				code,
			};
		default:
			return code != null ? { message: "Can't continue stream response", code } : null;
	}
}

const findLangCode = (input?: string): string | null => {
	if (!input) return null;
	const lower = input.toLowerCase();
	const byCode = listcodes.find((l) => l.code.toLowerCase() === lower);
	if (byCode) return byCode.code;
	const byName = listcodes.find((l) => l.name.toLowerCase() === lower);
	if (byName) return byName.code;
	const byPartial = listcodes.find((l) => l.name.toLowerCase().includes(lower));
	if (byPartial) return byPartial.code;
	return null;
};

export const Translate = async function Translate(que: string, from?: string, to?: string) {
	if (!que) return null;

	const lFrom = from?.toLowerCase();
	const lTo = to?.toLowerCase();

	const sourceLang = findLangCode(lFrom) || "auto";
	const targetLang = findLangCode(lTo) || "en";

	const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&dt=bd&dj=1&q=${encodeURIComponent(que)}`;

	try {
		const response = await fetch(url, {
			headers: commonHeaders,
		});

		if (response.status !== 200) {
			return {
				error: `${response.status} - Can't process this`,
			};
		}

		const data: any = await response.json();

		let translatedText = "";
		if (data.sentences) {
			translatedText = data.sentences.map((s: any) => s.trans).join("");
		}

		return {
			response: translatedText,
			data: {
				query: que,
				fromLang: [data.src || sourceLang, listcodes.find((l) => l.code === (data.src || sourceLang))?.name || sourceLang],
				toLang: [targetLang, listcodes.find((l) => l.code === targetLang)?.name || targetLang],
				translateType: [lFrom && lTo ? "specific" : "auto", "flash"],
				accuracy: data?.ld_result?.srclangs_confidences?.[0] ? new String(data?.ld_result?.srclangs_confidences?.[0] * 100) : null,
			},
		};
	} catch {
		return null;
	}
};

function cleanTranscriptText(text: any) {
	return decodeHTML(
		String(text || "")
			.replace(/<[^>]+>/g, "")
			.replace(/\n/g, " "),
	)
		.replace(/\s+/g, " ")
		.trim();
}

function getYoutubeiText(value: any) {
	if (!value) return "";
	if (typeof value === "string") return value;
	if (typeof value.text === "string") return value.text;
	if (Array.isArray(value.runs)) return value.runs.map((run: any) => run.text || "").join("");
	if (typeof value.toString === "function" && value.toString !== Object.prototype.toString) return value.toString();
	return "";
}

function getYoutubeErrorMessage(e: any) {
	return e?.info?.reason || e?.info?.status || e?.message || "Video unavailable";
}

function parseHlsAttributes(line: string) {
	const attrs: Record<string, string> = {};
	const re = /([A-Z0-9-]+)=("([^"]*)"|[^,]*)/g;
	let match;
	while ((match = re.exec(line)) !== null) {
		attrs[match[1]] = match[3] ?? match[2];
	}
	return attrs;
}

async function getYoutubeLiveCaptions(info: any) {
	const hlsUrl = info?.streaming_data?.hls_manifest_url;
	if (!hlsUrl) return [];
	try {
		const response = await fetch(hlsUrl);
		if (!response.ok) return [];
		const manifest = await response.text();
		return manifest
			.split("\n")
			.filter((line) => line.includes("#EXT-X-MEDIA") && line.includes("TYPE=SUBTITLES"))
			.map((line) => {
				const attrs = parseHlsAttributes(line);
				const uri = attrs.URI ? new URL(attrs.URI, hlsUrl).toString() : null;
				return {
					name: attrs.NAME || attrs.LANGUAGE || null,
					languageCode: attrs.LANGUAGE || null,
					kind: "live",
					isTranslatable: false,
					url: uri,
					content: null,
				};
			})
			.filter((track) => track.url);
	} catch {
		return [];
	}
}

export const infoYoutube = async function infoYoutube(que: string) {
	let videoId = que.match(/(?:[?&]v(?:i)?=|(?:^|\/)(?:youtu\.be|v|vi|u\/\w|embed|shorts|watch|live|source)\/)([A-Za-z0-9_-]{11})(?=$|[?#&/])/)?.[1];
	videoId = videoId || undefined;
	if (!videoId) return null;

	try {
		const youtubei: any = await getYoutubei();
		const info: any = await youtubei.getInfo(videoId).catch((e: any) => ({ __youtubeError: e }));
		const poToken = await getYoutubeCaptionPoToken(videoId);
		const challenge = getYoutubeChallengeObject(videoId, poToken);

		if (info?.playability_status?.status && info.playability_status.status !== "OK") {
			return {
				error: info.playability_status.reason || info.playability_status.status,
			};
		}

		if (info?.__youtubeError) {
			return {
				error: getYoutubeErrorMessage(info.__youtubeError),
			};
		}

		const tracks = info?.captions?.caption_tracks || [];
		let captions: any[] = tracks.map((track: any) => {
			const url = withYoutubePoToken(track.base_url, poToken);
			return {
				rawName: track.name,
				name: cleanTranscriptText(getYoutubeiText(track.name)),
				languageCode: track.language_code || null,
				kind: track.kind || null,
				isTranslatable: !!track.is_translatable,
				url,
			};
		});

		if (!captions.length && info?.basic_info?.is_live) {
			captions = await getYoutubeLiveCaptions(info);
		}

		const basic = info.basic_info || {};
		const primary = info.primary_info || {};
		const secondary = info.secondary_info || {};
		const owner = secondary.owner?.author || basic.channel || {};
		const ownerUrls = owner.url ? [owner.url] : owner.id ? ["https://www.youtube.com/channel/" + owner.id] : [];
		const ownerAvatars = (owner.thumbnails || []).map((thumbnail: any) => thumbnail?.url?.replace(/=s\d+.*/, "=s0")).filter(Boolean);
		const feeds = (info.watch_next_feed || [])
			.map((item: any) => {
				const rId = item.content_id;
				if (!rId || !/^[A-Za-z0-9_-]{11}$/.test(rId)) return null;
				const feedOwner = item.metadata?.metadata?.metadata_rows?.[0]?.metadata_parts?.[0]?.text?.text || null;
				const feedOwnerPath = item.metadata?.image?.renderer_context?.command_context?.on_tap?.metadata?.url || item.metadata?.image?.renderer_context?.command_context?.on_tap?.payload?.canonicalBaseUrl;
				const feedOwnerUrl = feedOwnerPath ? [String(feedOwnerPath).startsWith("http") ? feedOwnerPath : "https://www.youtube.com" + feedOwnerPath] : null;
				const feedOwnerAvatar = item.metadata?.image?.avatar?.image?.map((thumbnail: any) => thumbnail?.url?.replace(/=s\d+.*/, "=s0")).filter(Boolean) || null;
				return {
					videoId: rId,
					url: "https://www.youtube.com/watch?v=" + rId,
					altUrl: "https://www.youtube.com/watch?v=" + rId,
					title: item.metadata?.title?.text || null,
					thumbnail: item.content_image?.image?.[0]?.url || "https://i.ytimg.com/vi/" + rId + "/hq720.jpg",
					owner: {
						name: feedOwner,
						url: feedOwnerUrl,
						avatar: feedOwnerAvatar?.length ? Array.from(new Set(feedOwnerAvatar)) : null,
					},
				};
			})
			.filter(Boolean);

		return {
			_challenge: challenge,
			data: {
				videoId: videoId,
				thumbnail: "https://i.ytimg.com/vi/" + videoId + "/maxresdefault.jpg",
				previewThumbnail: "https://i.ytimg.com/vi/" + videoId + "/maxres1.jpg",
				title: basic.title || getYoutubeiText(primary.title) || null,
				description: getYoutubeiText(secondary.description) || basic.short_description || null,
				releaseDate: getYoutubeiText(primary.published) || null,
				viewCount: String(basic.view_count || 0),
				owners: {
					name: owner.name || basic.author || null,
					url: ownerUrls,
					avatar: Array.from(new Set(ownerAvatars)),
				},
				tags: (basic.tags || []).map((tag: string) => ({
					text: tag,
					url: null,
				})),
				feeds,
				captions: captions,
			},
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const infoYoutubeChannel = async function infoYoutubeChannel(url: string, deepFetch: boolean = false): Promise<any> {
	if (!url) return null;

	const match = url.match(/^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(channel\/|c\/|user\/|@)([a-zA-Z0-9_\-.]+)/);
	if (!match) return null;

	const prefix = match[1];
	const identifier = match[2];
	const requestUrl = `https://www.youtube.com/${prefix}${identifier}`;

	try {
		await getYoutubeVisitorKey();

		const response = await fetch(requestUrl, {
			headers: {
				...commonHeaders,
				...(keyYoutubeVisitor?.cookie ? { Cookie: keyYoutubeVisitor.cookie } : {}),
			},
		});
		const html = await response.text();
		let data: any = parseYtInitial(html);

		if (!data) return { data: null };

		const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.map((t: any) => t.tabRenderer || t.expandableTabRenderer).filter(Boolean) || [];

		const header = data?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel;
		const channelMetadataRenderer = data?.metadata?.channelMetadataRenderer;
		const microformatRenderer = data?.microformat?.microformatDataRenderer;
		const channelDescription = channelMetadataRenderer?.description || microformatRenderer?.description;

		const channelLinks: any[] = [];
		const metadataRows = header?.metadata?.contentMetadataViewModel?.metadataRows || [];
		metadataRows.forEach((row: any) => {
			row?.metadataParts?.forEach((part: any) => {
				const linkModel = part?.text?.contentMetadataAndSelectedTextViewModel?.selectedText?.contentMetadataSelectedTextModel?.linkViewModel || part?.text?.contentMetadataAndSelectedTextViewModel?.text?.contentMetadataSelectedTextModel?.linkViewModel;
				if (linkModel) {
					channelLinks.push({
						title: linkModel.text || part?.text?.contentMetadataAndSelectedTextViewModel?.text?.content,
						url: linkModel.href || linkModel.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url,
					});
				}
			});
		});

		const channelMetadata: any = {};

		const extractData = (obj: any) => {
			if (!obj || typeof obj !== "object") return;

			const link = obj.aboutChannelExternalLinkViewModel || obj.channelExternalLinkViewModel;
			if (link) {
				const title = link.title?.content || link.text;
				const url = link.link?.content || link.href;
				if (url && !channelLinks.some((l) => l.url === url)) {
					channelLinks.push({ title: title || "Link", url });
				}
			}

			const meta = obj.aboutChannelViewModel || obj.aboutChannelRenderer?.metadata?.aboutChannelViewModel;
			if (meta) {
				if (meta.country) channelMetadata["location"] = meta.country;
				if (meta.joinedDateText?.content || meta.joinedDateText) {
					const dateStr = (meta.joinedDateText.content || meta.joinedDateText).replace(/^Joined\s+/i, "").trim();
					const timestamp = Date.parse(dateStr);
					if (!isNaN(timestamp)) {
						channelMetadata["joinTimestamp"] = String(Math.floor(timestamp / 1000));
					} else {
						channelMetadata["joinTimestamp"] = meta.joinedDateText.content || meta.joinedDateText;
					}
				}
				if (meta.subscriberCountText) channelMetadata["subscriberCount"] = String(parseAbbreviatedNumber(meta.subscriberCountText));
				if (meta.videoCountText) channelMetadata["videoCount"] = String(parseAbbreviatedNumber(meta.videoCountText));
				if (meta.viewCountText) channelMetadata["viewCount"] = String(parseAbbreviatedNumber(meta.viewCountText));
				if (meta.canonicalChannelUrl) channelMetadata["canonicalUrl"] = meta.canonicalChannelUrl.replace(/^http:\/\//i, "https://");
			}

			if (obj.primaryLinks || obj.secondaryLinks) {
				const links = [...(obj.primaryLinks || []), ...(obj.secondaryLinks || [])];
				links.forEach((l: any) => {
					const title = l.title?.simpleText;
					const url = l.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url;
					if (url && !channelLinks.some((lk) => lk.url === url)) {
						channelLinks.push({ title: title || "Link", url });
					}
				});
			}

			const banner = obj.banner?.thumbnails || obj.imageBannerViewModel?.image?.thumbnail?.thumbnails || obj.imageBannerViewModel?.image?.sources;
			if (banner && !channelMetadata["banner"]) {
				channelMetadata["banner"] = banner;
			}

			if (Array.isArray(obj)) {
				obj.forEach((item) => extractData(item));
			} else {
				for (const key in obj) extractData(obj[key]);
			}
		};

		const getBadgeType = (badgeId: string): string | null => {
			if (!badgeId) return null;
			const validBadges = ["CHECK_CIRCLE_THICK", "CHECK_CIRCLE_FILLED", "VERIFIED", "VERIFIED_BADGE", "OFFICIAL_ARTIST", "AUDIO_BADGE", "MUSIC_OFFICIAL_ARTIST", "OFFICIAL_ARTIST_BADGE"];
			return validBadges.includes(badgeId) ? badgeId : null;
		};

		const c4Header = data?.header?.c4TabbedHeaderRenderer;
		if (c4Header) {
			if (c4Header.avatar?.thumbnails) channelMetadata["avatar"] = c4Header.avatar.thumbnails;
			if (c4Header.banner?.thumbnails) channelMetadata["banner"] = c4Header.banner.thumbnails;
			if (c4Header.channelHandleText?.runs?.[0]?.text) channelMetadata["handle"] = c4Header.channelHandleText.runs[0].text;

			const badge = c4Header.badges?.map((b: any) => b.metadataBadgeRenderer?.icon?.iconType).find((id: string) => getBadgeType(id));
			if (badge) {
				channelMetadata["verified"] = true;
				channelMetadata["verified_type"] = getBadgeType(badge);
			}
		}

		const modernHeader = data?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel;
		if (modernHeader) {
			const avatar = modernHeader.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.thumbnail?.thumbnails;
			if (avatar) channelMetadata["avatar"] = avatar;

			const banner = data?.header?.pageHeaderRenderer?.banner?.imageBannerViewModel?.image?.thumbnail?.thumbnails || data?.header?.pageHeaderRenderer?.banner?.heroBannerViewModel?.banner?.imageBannerViewModel?.image?.thumbnail?.thumbnails;
			if (banner) channelMetadata["banner"] = banner;

			const title = modernHeader.title?.dynamicTextViewModel?.text?.content;
			if (title) channelMetadata["name"] = title;

			if (!channelMetadata["verified"]) {
				const headerRows = modernHeader.metadata?.contentMetadataViewModel?.metadataRows || [];
				let detectedType: string | null = null;

				headerRows.some((row: any) =>
					row.metadataParts?.some((part: any) => {
						const vm = part.text?.contentMetadataAndSelectedTextViewModel || part.text?.contentMetadataViewModel;
						const renderer = vm?.selectedText?.contentMetadataSelectedTextModel?.badgeViewModel?.badgeViewModel?.badge?.metadataBadgeRenderer || vm?.text?.contentMetadataSelectedTextModel?.badgeViewModel?.badgeViewModel?.badge?.metadataBadgeRenderer;
						const type = getBadgeType(renderer?.icon?.iconType);
						if (type) {
							detectedType = type;
							return true;
						}
						return false;
					}),
				);

				if (!detectedType) {
					const attachmentBadge = modernHeader.title?.dynamicTextViewModel?.text?.attachmentRuns?.map((run: any) => run.element?.type?.imageType?.image?.sources?.[0]?.clientResource?.imageName).find((name: string) => getBadgeType(name));

					if (attachmentBadge) detectedType = getBadgeType(attachmentBadge);
				}

				if (!detectedType) {
					const headerStr = JSON.stringify(modernHeader);
					const match = headerStr.match(/CHECK_CIRCLE_THICK|CHECK_CIRCLE_FILLED|VERIFIED_BADGE|VERIFIED|OFFICIAL_ARTIST|AUDIO_BADGE|MUSIC_OFFICIAL_ARTIST|OFFICIAL_ARTIST_BADGE/i);
					if (match) detectedType = match[0].toUpperCase();
				}

				if (detectedType) {
					channelMetadata["verified"] = true;
					channelMetadata["verified_type"] = detectedType;
				}
			}
		}

		if (channelMetadata["verified"] === undefined) {
			channelMetadata["verified"] = false;
			channelMetadata["verified_type"] = null;
		}

		if (!channelMetadata["banner"]) {
			const b1 = data?.header?.pageHeaderRenderer?.banner?.imageBannerViewModel?.image?.thumbnail?.thumbnails || data?.header?.pageHeaderRenderer?.banner?.imageBannerViewModel?.image?.sources;
			const b2 = modernHeader?.banner?.imageBannerViewModel?.image?.thumbnail?.thumbnails || modernHeader?.banner?.imageBannerViewModel?.image?.sources;
			const b3 = data?.header?.c4TabbedHeaderRenderer?.banner?.thumbnails;

			if (b1) channelMetadata["banner"] = b1;
			else if (b2) channelMetadata["banner"] = b2;
			else if (b3) channelMetadata["banner"] = b3;
		}

		if (!channelMetadata["avatar"]) {
			const a1 = channelMetadataRenderer?.avatar?.thumbnails;
			const a2 = microformatRenderer?.thumbnail?.thumbnails;
			if (a1) channelMetadata["avatar"] = a1;
			else if (a2) channelMetadata["avatar"] = a2;
		}

		if (!channelMetadata["name"]) {
			const t1 = channelMetadataRenderer?.title;
			const t2 = microformatRenderer?.title;
			if (t1) channelMetadata["name"] = t1;
			else if (t2) channelMetadata["name"] = t2;
		}

		if (channelMetadataRenderer) {
			if (channelMetadataRenderer.externalId) channelMetadata["channelId"] = channelMetadataRenderer.externalId;
			if (channelMetadataRenderer.vanityChannelUrl) channelMetadata["vanityChannelUrl"] = channelMetadataRenderer.vanityChannelUrl.replace(/^http:\/\//i, "https://");
			if (channelMetadataRenderer.channelUrl) channelMetadata["channelUrl"] = channelMetadataRenderer.channelUrl;
			if (typeof channelMetadataRenderer.isFamilySafe === "boolean") channelMetadata["familySafe"] = channelMetadataRenderer.isFamilySafe;
			if (channelMetadataRenderer.availableCountryCodes) channelMetadata["availableCountries"] = channelMetadataRenderer.availableCountryCodes;
			if (channelMetadataRenderer.keywords) {
				const keywordsStr = channelMetadataRenderer.keywords;
				const keywordsArray = keywordsStr.match(/"[^"]+"|[^\s]+/g)?.map((k: string) => k.replace(/^"|"$/g, "")) || [];
				if (keywordsArray.length > 0) channelMetadata["keywords"] = keywordsArray;
			}
			if (channelMetadataRenderer.avatar?.thumbnails && !channelMetadata["avatar"]) {
				channelMetadata["avatar"] = channelMetadataRenderer.avatar.thumbnails;
			}
		}

		// Fallback to microformat for tags/keywords
		if (microformatRenderer) {
			if (microformatRenderer.tags && !channelMetadata["keywords"]) {
				channelMetadata["keywords"] = microformatRenderer.tags;
			}
			if (typeof microformatRenderer.familySafe === "boolean" && channelMetadata["familySafe"] === undefined) {
				channelMetadata["familySafe"] = microformatRenderer.familySafe;
			}
			if (microformatRenderer.availableCountries && !channelMetadata["availableCountries"]) {
				channelMetadata["availableCountries"] = microformatRenderer.availableCountries;
			}
		}

		// Final fallback for channelId
		if (!channelMetadata["channelId"] && identifier && prefix === "channel/") {
			channelMetadata["channelId"] = identifier;
		} else if (!channelMetadata["channelId"] && microformatRenderer?.urlCanonical) {
			const idMatch = microformatRenderer.urlCanonical.match(/\/channel\/([^\/?#]+)/);
			if (idMatch) channelMetadata["channelId"] = idMatch[1];
		}

		extractData(data);

		let continuationToken = null;

		function findAboutToken(obj: any): string | null {
			if (!obj || typeof obj !== "object") return null;
			if (obj.showEngagementPanelEndpoint) {
				const token = searchToken(obj.showEngagementPanelEndpoint);
				if (token) return token;
			}
			if (Array.isArray(obj)) {
				for (const item of obj) {
					const res = findAboutToken(item);
					if (res) return res;
				}
			} else {
				for (const key in obj) {
					const res = findAboutToken(obj[key]);
					if (res) return res;
				}
			}
			return null;
		}

		function searchToken(obj: any): string | null {
			if (!obj || typeof obj !== "object") return null;
			if (obj.continuationItemRenderer) {
				return obj.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token;
			}
			if (Array.isArray(obj)) {
				for (const item of obj) {
					const res = searchToken(item);
					if (res) return res;
				}
			} else {
				for (const key in obj) {
					const res = searchToken(obj[key]);
					if (res) return res;
				}
			}
			return null;
		}

		continuationToken = findAboutToken(data?.header) || findAboutToken(data);
		const visitorData = data?.responseContext?.visitorData;

		if (continuationToken) {
			try {
				const continuationReq = await fetch("https://m.youtube.com/youtubei/v1/browse?prettyPrint=false", {
					method: "POST",
					headers: commonHeaders,
					body: JSON.stringify({
						continuation: continuationToken,
						context: {
							client: {
								clientName: "WEB",
								clientVersion: "2.20260204.01.00",
								hl: "en",
								gl: "US",
								visitorData: visitorData,
							},
						},
						...(poTokenCache?.po_token
							? {
									serviceIntegrityDimensions: {
										poToken: poTokenCache.po_token,
									},
								}
							: {}),
					}),
				});
				const continuationRes: any = await continuationReq.json();

				extractData(continuationRes);
			} catch {}
		}

		const extraEndpoints: any[] = [];

		const findAllButtons = (obj: any): any[] => {
			const buttons: any[] = [];
			if (!obj || typeof obj !== "object") return buttons;

			if (obj.buttonViewModel || obj.buttonRenderer) {
				buttons.push(obj.buttonViewModel || obj.buttonRenderer);
			}

			if (Array.isArray(obj)) {
				obj.forEach((item) => buttons.push(...findAllButtons(item)));
			} else {
				for (const key of Object.keys(obj)) {
					if (["trackingParams", "loggingDirectives", "rendererContext"].includes(key)) continue;
					buttons.push(...findAllButtons(obj[key]));
				}
			}
			return buttons;
		};

		const vm = data?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel;
		const allButtons = findAllButtons(vm?.actions || data?.header?.c4TabbedHeaderRenderer?.buttons);

		allButtons.forEach((btn: any) => {
			const endpoint = btn?.command?.browseEndpoint || btn?.onTap?.innertubeCommand?.browseEndpoint || btn?.navigationEndpoint?.browseEndpoint;

			if (endpoint && endpoint.browseId === "FEcommunity_page") {
				if (!tabs.some((t: any) => t.endpoint?.browseEndpoint?.browseId === endpoint.browseId)) {
					extraEndpoints.push({
						title: "Community",
						endpoint: { browseEndpoint: endpoint },
					});
				}
			}
		});

		const combinedTabs = [...tabs, ...extraEndpoints];

		const tabsObj: any = {
			home: null,
			videos: null,
			shorts: null,
			live: null,
			playlists: null,
			community: null,
			posts: null,
			podcasts: null,
			releases: null,
			store: null,
			courses: null,
			about: null,
			playables: null,
		};

		if (deepFetch) {
			const results = await Promise.all(
				combinedTabs.map(async (tab: any) => {
					if (tab.content) return { title: tab.title, content: tab.content };
					if (!tab.endpoint?.browseEndpoint) return null;

					const { browseId, params } = tab.endpoint.browseEndpoint;

					try {
						const bodyload = JSON.stringify({
							browseId: browseId,
							params: params,
							context: {
								client: {
									clientName: "WEB",
									clientVersion: "2.20260204.01.00",
									hl: "en",
									gl: "US",
									visitorData: visitorData,
								},
							},
							...(poTokenCache?.po_token
								? {
										serviceIntegrityDimensions: {
											poToken: poTokenCache.po_token,
										},
									}
								: {}),
						});

						const req = await fetch("https://m.youtube.com/youtubei/v1/browse?prettyPrint=false", {
							method: "POST",
							headers: {
								...commonHeaders,
								"Content-Type": "application/json",
							},
							body: bodyload,
						});

						const res: any = await req.json();
						const tabContent = res?.contents?.twoColumnBrowseResultsRenderer?.tabs?.find((t: any) => t?.tabRenderer?.selected)?.tabRenderer?.content || res?.contents?.sectionListRenderer || res?.contents || res;

						return {
							title: tab.title,
							content: tabContent,
						};
					} catch {
						return { title: tab.title, error: "Failed to fetch" };
					}
				}),
			);

			const finalResults = results.filter(Boolean);

			const flatten = (obj: any): any => {
				if (!obj || typeof obj !== "object") return obj;

				if (Array.isArray(obj)) {
					return obj.flatMap((item) => {
						const res = flatten(item);
						if (res === null || res === undefined) return [];
						return Array.isArray(res) ? res : [res];
					});
				}

				const keys = Object.keys(obj);
				const metadata = ["trackingParams", "accessibility", "accessibilityData", "clickTrackingParams", "commandMetadata", "loggingContext", "loggingDirectives", "type", "style", "targetId", "identifier", "entityId", "onTap", "command", "navigationEndpoint", "params", "menu", "title"];
				const dataKeys = keys.filter((k) => !metadata.includes(k));

				if (dataKeys.length === 0) return null;

				if (Array.isArray(obj.contents)) return flatten(obj.contents);
				if (Array.isArray(obj.items)) return flatten(obj.items);
				if (Array.isArray(obj.content)) return flatten(obj.content);

				if (obj.post && typeof obj.post === "object" && dataKeys.includes("post")) {
					return flatten(obj.post);
				}

				if (dataKeys.length === 1) {
					const key = dataKeys[0];
					if (key.endsWith("Renderer") || key.endsWith("ViewModel") || ["content", "item", "contents", "items", "post", "posts"].includes(key)) {
						return flatten(obj[key]);
					}
				}

				const res: any = {};
				for (const key of dataKeys) {
					res[key] = flatten(obj[key]);
				}
				return res;
			};

			finalResults.forEach((r: any) => {
				const title = typeof r.title === "string" ? r.title.toLowerCase() : r.title?.runs?.[0]?.text?.toLowerCase() || "";
				if (title && title !== "search") {
					const flattened = flatten(r.content);
					if (title === "posts") {
						tabsObj["posts"] = flattened;
					} else if (title === "community") {
						tabsObj["community"] = flattened;
					} else {
						tabsObj[title] = flattened;
					}
				}
			});
		}

		const normalizedLinks = channelLinks.map((link) => ({
			title: link.title,
			url: link.url && !link.url.match(/^https?:\/\//i) ? `https://${link.url}` : link.url,
		}));

		const processBanner = (images: any[]) => {
			if (!Array.isArray(images) || images.length === 0) return null;
			const sorted = [...images].sort((a, b) => (b.width || 0) - (a.width || 0));
			const highestUrl = sorted[0]?.url || null;

			if (!highestUrl) return null;

			const baseUrl = highestUrl.split("=")[0];

			return {
				highest: `${baseUrl}=w2560-fcrop64=1,0000000ffffffff`,
				highest_cropped: `${baseUrl}=w2560-fcrop64=1,00005a57ffffa5a8`,
				original: `${baseUrl}=s0`,
			};
		};

		const processAvatar = (images: any[]) => {
			if (!Array.isArray(images) || images.length === 0) return null;
			const sorted = [...images].sort((a, b) => (b.width || 0) - (a.width || 0));
			const highestUrl = sorted[0]?.url || null;

			if (!highestUrl) return null;

			const baseUrl = highestUrl.split("=")[0];

			const urlParts = highestUrl.split("=");
			let suffix = "c-k-c0x00ffffff-no-rj";

			if (urlParts.length > 1) {
				const params = urlParts.slice(1).join("=");
				const match = params.match(/[sc]\d+-(.+)/);
				if (match) suffix = match[1];
			}

			return {
				normal: `${baseUrl}=s900-${suffix}`,
				highest: `${baseUrl}=s2160-${suffix}`,
				original: `${baseUrl}=s0`,
			};
		};

		const processedMetadata = { ...channelMetadata };
		if (processedMetadata["banner"]) processedMetadata["banner"] = processBanner(processedMetadata["banner"]);
		if (processedMetadata["avatar"]) processedMetadata["avatar"] = processAvatar(processedMetadata["avatar"]);

		return {
			data: {
				links: normalizedLinks.length > 0 ? normalizedLinks : null,
				metadata: {
					description: channelDescription || null,
					...processedMetadata,
				},
				...(deepFetch ? { tabs: tabsObj } : {}),
			},
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const infoSoundcloud = async function infoSoundcloud(que: string, refresh_auth: boolean = false): Promise<any> {
	if (!que) return null;
	if (refresh_auth || !keysc) {
		keysc = await soundcloudKey();
	}
	try {
		const test = new URL(que);
		if (!test.host.endsWith("soundcloud.com")) return null;

		const [res, res2] = await Promise.all([
			fetch(`https://api-v2.soundcloud.com/resolve?client_id=${keysc}&url=https://soundcloud.com${test.pathname}`, {
				headers: commonHeaders,
			}),
			fetch("https://mobi.soundcloud.com" + test.pathname, {
				headers: commonHeaders,
			}),
		]);

		if (res.status === 401) {
			return await infoSoundcloud(que, true);
		}
		const pull = res.status === 200 ? await res.json() : null;

		let pull2: any = null;
		try {
			const res2Text = await res2.text();
			pull2 = JSON.parse(res2Text.split('type="application/json">')[1].split("</script>")[0]);
		} catch {}

		return {
			data: [pull || null, pull2?.props?.pageProps?.initialStoreState?.entities || null],
		};
	} catch (e) {
		console.error("infoSoundcloud error:", e);
		return null;
	}
};

export type SoundcloudStreamCandidate = {
	protocol: string;
	mimeType?: string;
	url: string;
};

export const infoSoundcloudStreams = async function infoSoundcloudStreams(url: string, refresh_auth: boolean = false): Promise<SoundcloudStreamCandidate[]> {
	if (!url) return [];
	if (refresh_auth || !keysc) {
		keysc = await soundcloudKey();
	}
	try {
		const res = await fetch(`https://api-v2.soundcloud.com/resolve?client_id=${keysc}&url=${encodeURIComponent(url)}`, {
			headers: commonHeaders,
		});
		if (res.status === 401) return await infoSoundcloudStreams(url, true);

		const data: any = res.status === 200 ? await res.json() : null;
		if (!data) return [];

		const transcodings: any[] = Array.isArray(data.media?.transcodings) ? data.media.transcodings : [];
		const orderedTranscodings = [
			...transcodings.filter((t: any) => {
				const p = String(t?.format?.protocol || "").toLowerCase();
				return p.includes("dash");
			}),
			...transcodings.filter((t: any) => String(t?.format?.protocol || "").toLowerCase() === "hls"),
			...transcodings.filter((t: any) => {
				const p = String(t?.format?.protocol || "").toLowerCase();
				return !p.includes("dash") && p !== "hls";
			}),
		];

		const candidates: SoundcloudStreamCandidate[] = [];
		const seen = new Set<string>();

		for (const transcoding of orderedTranscodings) {
			if (!transcoding?.url || seen.has(transcoding.url)) continue;
			seen.add(transcoding.url);

			try {
				const streamUrl = new URL(transcoding.url);
				streamUrl.searchParams.set("client_id", keysc || "");
				const streamRes = await fetch(streamUrl.toString(), {
					headers: commonHeaders,
				});
				const streamData: any = streamRes.status === 200 ? await streamRes.json() : null;
				if (streamData?.url) {
					candidates.push({
						protocol: transcoding.format?.protocol || "unknown",
						mimeType: transcoding.format?.mime_type,
						url: streamData.url,
					});
				}
			} catch {}
		}

		return candidates;
	} catch (e) {
		console.error("infoSoundcloudStreams error:", e);
		return [];
	}
};

export const infoSoundcloudStream = async function infoSoundcloudStream(url: string, refresh_auth: boolean = false): Promise<string | null> {
	const streams = await infoSoundcloudStreams(url, refresh_auth);
	return streams[0]?.url || null;
};

export const infoSpotify = async function infoSpotify(que: string) {
	if (!que) return null;
	try {
		const test = new URL(que);
		if (test.host !== "open.spotify.com") return null;

		const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(que)}`, {
			headers: commonHeaders,
		});

		const pull: any = await res.json();

		const res2 = await fetch(pull.iframe_url, {
			headers: {
				...commonHeaders,
				"User-Agent": "Bot",
			},
		});

		const pull2 = await res2.text();
		const test2 = JSON.parse(pull2.split('type="application/json">')[1].split("</script>")[0]);
		return { data: test2?.props?.pageProps?.state?.data?.entity || null };
	} catch {
		return null;
	}
};

export const infoITunes = async function infoITunes(que: string) {
	if (!que) return null;
	try {
		const test = new URL(que);
		if (test.host !== "music.apple.com") return null;

		const res = await fetch(que, {
			headers: {
				...commonHeaders,
				"User-Agent": "Bot",
			},
		});

		const pull = await res.text();
		const serverDataMatch = pull.match(/<script[^>]*id=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/);
		if (!serverDataMatch) {
			return { data: null };
		}
		const trypar = JSON.parse(serverDataMatch[1]);
		const sections = trypar[0]?.data?.sections;
		if (!sections?.[0]) {
			return { data: null };
		}

		const target = sections[0]?.items?.[0] || null;
		const other = sections
			.slice(1)
			.map((s: any) => s?.items)
			.filter(Boolean);

		return { data: { target, other } };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const pinterest = async function pinterest(que: string, type: string = "all") {
	if (!que) return null;
	try {
		const isVideo = type === "video";
		const feat = { options: { query: que, scope: isVideo ? "videos" : "pins", rs: "typed", page_size: 25 }, context: {} };
		const req = await fetch(`https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=/search/pins/?q=${encodeURIComponent(que)}&data=${encodeURIComponent(JSON.stringify(feat))}`, {
			headers: {
				...commonHeaders,
				"X-Pinterest-PWS-Handler": "www/search/[scope].js",
			},
		});

		const res: any = await req.json();
		const results = res.resource_response?.data?.results;
		if (!results?.[0]) {
			return {
				error: "Looks like your search violate our terms of service",
			};
		}

		if (type === "gif") {
			return { data: results.filter((r: any) => r?.is_gif || Object.values(r?.images ?? {}).some((i: any) => (i?.url ?? "").toLowerCase().endsWith(".gif"))) };
		}
		if (type === "image") {
			return { data: results.filter((r: any) => !r?.is_gif && !Object.values(r?.images ?? {}).some((i: any) => (i?.url ?? "").toLowerCase().endsWith(".gif")) && !(r?.videos?.video_list ?? null)) };
		}
		return { data: results };
	} catch {
		return null;
	}
};

export const infoPinterest = async function infoPinterest(que: string) {
	if (!que) return null;
	try {
		const test = new URL(que);
		if (!test.host.includes("pinterest.") && !test.host.includes("pin.it")) return null;

		const res = await fetch(que, {
			headers: commonHeaders,
		});

		const html = await res.text();

		const data: any[] = [];
		const scriptRegex = /<script\s+data-relay-completed-request="true"[^>]*>([\s\S]*?)<\/script>/g;
		let match;

		while ((match = scriptRegex.exec(html)) !== null) {
			const scriptContent = match[1];
			const funcMatch = scriptContent.match(/window\.__PWS_RELAY_REGISTER_COMPLETED_REQUEST__\("([^"]+)",\s*(\{[\s\S]*?\})\);?/);
			if (funcMatch) {
				try {
					const api_query = JSON.parse(decodeURIComponent(funcMatch[1]));
					const content = JSON.parse(funcMatch[2]);
					let relayData = content;
					if (relayData.data) relayData = relayData.data;

					const entries = Object.entries(relayData);
					if (entries.length > 0) {
						const firstValue: any = entries[0][1];
						const finalData = firstValue && typeof firstValue === "object" && "data" in firstValue ? firstValue.data : firstValue;

						data.push({
							api_query,
							data: finalData,
						});
					}
				} catch (e) {}
			}
		}

		return { data: data.length > 0 ? data.reverse() : null };
	} catch {
		return null;
	}
};

export const Discord = async (token: string, guildId: string, payload: any, payloadError: any, reasonAudit?: string) => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!guildId) return { error: "Missing guildId" };
	const url = `https://discord.com/api/v10/guilds/${guildId}`;

	try {
		const req = await discordFetch(url, {
			headers: {
				Authorization: `Bot ${token}`,
				"Content-Type": "application/json",
				"User-Agent": discordUserAgent,
			},
		});

		let currentInfo: any = null;
		try {
			currentInfo = await req.json();
		} catch {}

		if (req.status !== 200) {
			return {
				data: [null, null],
				error: currentInfo || {
					status: req.status,
					statusText: req.statusText,
				},
			};
		}

		if (Object.keys(payload).length === 0) {
			return { data: [currentInfo, null] };
		}

		const allSame = Object.keys(payload).every((key) => {
			const currentVal = currentInfo[key] ?? null;
			const payloadVal = payload[key] ?? null;
			return currentVal === payloadVal;
		});

		if (allSame) {
			return { data: [false, null, 204] };
		}

		const response = await discordFetch(url, {
			method: "PATCH",
			headers: {
				Authorization: `Bot ${token}`,
				"Content-Type": "application/json",
				"User-Agent": discordUserAgent,
				...(reasonAudit && { "X-Audit-Log-Reason": reasonAudit }),
			},
			body: JSON.stringify(payload),
		});

		let patchResponse: any = null;
		try {
			patchResponse = await response.json();
		} catch (e) {}

		if (response.status < 200 || response.status >= 300) {
			return {
				data: [currentInfo.code === 0 ? null : currentInfo, null],
				error: patchResponse || { status: response.status },
			};
		}

		return {
			data: [currentInfo, patchResponse, response.status, ...(reasonAudit ? [reasonAudit] : [])],
			...(payloadError?.[0] && {
				error: payloadError,
				errorMessage: "Continuing anyways",
			}),
		};
	} catch {
		return { error: "Something just happened" };
	}
};

export const DiscordMember = async (token: string, guildId: string, payload: any, payloadError: any, reasonAudit?: string, isReset: boolean = false) => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!guildId) return { error: "Missing guildId" };

	const url = `https://discord.com/api/v10/guilds/${guildId}/members/@me`;

	try {
		const req = await discordFetch(url, {
			method: "PATCH",
			headers: {
				Authorization: `Bot ${token}`,
				"Content-Type": "application/json",
				"User-Agent": discordUserAgent,
			},
			body: JSON.stringify({}),
		});

		let currentInfo: any = null;
		try {
			currentInfo = await req.json();
		} catch {}

		if (req.status !== 200) {
			return {
				data: [null, null],
				error: currentInfo || {
					status: req.status,
					statusText: req.statusText,
				},
			};
		}

		if (Object.keys(payload).length === 0) {
			return { data: [currentInfo, null] };
		}

		// Normalize values for comparison (treat null, undefined, and empty string as the same "empty" state)
		const normalize = (v: any) => (v === "" || v === undefined || v === null ? null : v);

		// Check if payload values already match current info — skip PATCH if nothing changed
		const allSame = Object.keys(payload).every((key) => {
			const currentVal = normalize(currentInfo[key] !== undefined ? currentInfo[key] : currentInfo.user?.[key]);
			const payloadVal = normalize(payload[key]);
			return currentVal === payloadVal;
		});

		// Helper to generate changes object: all requested keys are present, true if successful AND actually changed state
		const getChanges = (requested: any, successful: any, current: any) => {
			return Object.keys(requested).reduce((acc: any, key) => {
				const newVal = normalize(successful[key] !== undefined ? successful[key] : successful.user?.[key]);
				const currentVal = normalize(current[key] !== undefined ? current[key] : current.user?.[key]);
				// It's a "change" if the new state is actually different from the previous state
				acc[key] = newVal !== currentVal;
				return acc;
			}, {});
		};

		const changes = (p?: any) => (isReset ? getChanges(payload, p || payload, currentInfo) : null);

		if (allSame) {
			return { data: [false, null, 204, changes()] };
		}

		const response = await discordFetch(url, {
			method: "PATCH",
			headers: {
				Authorization: `Bot ${token}`,
				"Content-Type": "application/json",
				"User-Agent": discordUserAgent,
				...(reasonAudit && { "X-Audit-Log-Reason": reasonAudit }),
			},
			body: JSON.stringify(payload),
		});

		let patchResponse: any = null;
		try {
			patchResponse = await response.json();

			if (response.status === 403 && patchResponse?.code === 50013 && payload.nick !== undefined) {
				const { nick, ...retryPayload } = payload;
				if (Object.keys(retryPayload).length > 0) {
					const retryResponse = await discordFetch(url, {
						method: "PATCH",
						headers: {
							Authorization: `Bot ${token}`,
							"Content-Type": "application/json",
							"User-Agent": discordUserAgent,
							...(reasonAudit && { "X-Audit-Log-Reason": reasonAudit }),
						},
						body: JSON.stringify(retryPayload),
					});
					const retryJson = await retryResponse.json();

					if (retryResponse.status >= 200 && retryResponse.status < 300) {
						return {
							data: [currentInfo, retryJson, retryResponse.status, changes(retryJson), ...(reasonAudit ? [reasonAudit] : [])],
							...(payloadError?.[0] && {
								error: payloadError,
								errorMessage: "Continuing anyways (Retried without nickname)",
							}),
						};
					} else {
						patchResponse = retryJson;
					}
				}
			}
		} catch (e) {}

		if (response.status < 200 || response.status >= 300) {
			return {
				data: [currentInfo.code === 0 ? null : currentInfo, null, response.status, null],
				error: patchResponse || { status: response.status },
			};
		}

		return {
			data: [currentInfo, patchResponse, response.status, changes(patchResponse), ...(reasonAudit ? [reasonAudit] : [])],
			...(payloadError?.[0] && {
				error: payloadError,
				errorMessage: "Continuing anyways",
			}),
		};
	} catch {
		return { error: "Something just happened" };
	}
};

export const DiscordWebhook = async (token: string | null, guildId: string | null | undefined, payload: any) => {
	const action = payload.action;

	if (payload.webhookUrl) {
		const match = payload.webhookUrl.match(/webhooks\/(\d+)(?:\/([a-zA-Z0-9_-]+))?(?:[/?]|$)/);
		if (match) {
			payload.webhookId = match[1];
			if (match[2]) payload.webhookToken = match[2];
		}
	}

	const webhookId = payload.webhookId || (action !== "create" && action !== "list" ? guildId : null);
	const channelId = payload.channelId || (action === "create" || action === "list" ? guildId : null);

	let url = "";
	let method = "GET";

	const webhookToken = payload.webhookToken;

	if (action === "create") {
		if (!token || token === "null") return { error: "Missing token" };
		if (!channelId) return { error: "Missing channelId" };
		url = `https://discord.com/api/v10/channels/${channelId}/webhooks`;
		method = "POST";

		if (payload.avatar && payload.avatar.startsWith("http")) {
			try {
				const res = await fetch(payload.avatar, {
					headers: commonHeaders,
				});
				if (res.ok) {
					const contentType = res.headers.get("content-type");
					if (contentType?.startsWith("image/") || contentType?.startsWith("video/")) {
						const arrayBuffer = await res.arrayBuffer();
						const buffer = Buffer.from(arrayBuffer);
						payload.avatar = `data:${contentType};base64,${buffer.toString("base64")}`;
					}
				}
			} catch (e) {}
		}
	} else if (action === "info") {
		if (!webhookId) return { error: "Missing webhookId" };
		url = `https://discord.com/api/v10/webhooks/${webhookId}${!token && webhookToken ? `/${webhookToken}` : ""}`;
		method = "GET";
	} else if (action === "delete") {
		if (!webhookId) return { error: "Missing webhookId" };
		url = `https://discord.com/api/v10/webhooks/${webhookId}${!token && webhookToken ? `/${webhookToken}` : ""}`;
		method = "DELETE";
	} else if (action === "send") {
		if (!webhookId) return { error: "Missing webhookId" };
		if (!webhookToken) return { error: "Missing webhookToken" };
		url = `https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}`;
		method = "POST";
	} else if (action === "list") {
		if (!token || token === "null") return { error: "Missing token" };
		if (!channelId) return { error: "Missing channelId" };
		url = `https://discord.com/api/v10/channels/${channelId}/webhooks`;
		method = "GET";
	} else {
		return { error: "Nothing to do" };
	}

	try {
		const headers: any = {
			"Content-Type": "application/json",
			"User-Agent": discordUserAgent,
		};

		if (token && token !== "null") {
			headers["Authorization"] = `Bot ${token}`;
		}

		let bodyPayload: any = null;
		let checkUserFill: boolean = false;
		if (method === "POST") {
			if (action === "create") {
				bodyPayload = {
					name: payload.name || "New Webhook",
					avatar: payload.avatar || null,
				};
			} else if (action === "send") {
				bodyPayload = {
					content: payload.content || "",
					username: payload.username || null,
					avatar_url: payload.avatar_url || null,
				};
				Object.keys(bodyPayload).forEach((key) => bodyPayload[key] === null && delete bodyPayload[key]);
			}
		}

		let response = await discordFetch(url, {
			method: method,
			headers: headers,
			...(bodyPayload && { body: JSON.stringify(bodyPayload) }),
		});

		let result: any = null;
		if (response.status !== 204) {
			try {
				result = await response.json();
			} catch (e) {}
		}

		if (token && webhookToken && (action === "info" || action === "delete") && (response.status === 403 || result?.code === 50013)) {
			const fallbackUrl = `https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}`;
			const fallbackHeaders = { ...headers };
			delete fallbackHeaders["Authorization"];

			response = await discordFetch(fallbackUrl, {
				method: method,
				headers: fallbackHeaders,
				...(bodyPayload && { body: JSON.stringify(bodyPayload) }),
			});

			if (response.status !== 204) {
				try {
					result = await response.json();
					checkUserFill = true;
				} catch (e) {
					result = null;
				}
			} else {
				result = null;
			}
		}

		if (result) {
			if (Array.isArray(result)) {
				result = result.map((w: any) => ({
					...w,
					created_at: w.id ? String(getSnowflakeDate(w.id)) : null,
				}));
			} else if (typeof result === "object" && result.id) {
				result.created_at = String(getSnowflakeDate(result.id));
			}
		}

		if (action === "info" && result && typeof result === "object" && !Array.isArray(result)) {
			if (result.user === undefined) {
				if (checkUserFill && response.status === 200) {
					result.user = {
						error: "Cannot access to this channel, " + result.channel_id,
					};
				} else {
					result.user = null;
				}
			}
		}

		if (response.status < 200 || response.status >= 300) {
			return {
				data: null,
				error: result || { status: response.status },
			};
		}

		return { data: [result || true, null, response.status] };
	} catch (e: any) {
		return { error: e.message };
	}
};

export const GettyImage = async function GettyImage(que: string) {
	if (!que) return null;
	try {
		const req = await fetch(`https://www.istockphoto.com/en/search/2/image?phrase=${encodeURIComponent(que)}&page=1`, {
			headers: {
				...commonHeaders,
				Accept: "application/json",
			},
		});

		const res: any = await req.json();
		return {
			data: [res?.gallery?.assets ?? null, res?.relatedTerms ?? null],
		};
	} catch {
		return null;
	}
};

export const Unsplash = async function Unsplash(que: string) {
	if (!que) return null;

	try {
		const pull = await fetch(`https://unsplash.com/napi/search/photos?page=1&per_page=20&query=${encodeURIComponent(que)}`, {
			headers: commonHeaders,
		});

		if (pull.status === 403) {
			return {
				error: "IP Blocked",
			};
		}

		const res: any = await pull.json();
		return {
			data: res?.results?.[0]
				? {
						non_premium: res?.results.filter((a: any) => !a.premium),
						premium: res?.results.filter((a: any) => a.premium),
					}
				: null,
		};
	} catch {
		return null;
	}
};

export const Pixiv = async function Pixiv(que: string) {
	if (!que) return null;

	try {
		const per = await fetch(`https://www.pixiv.net/ajax/search/artworks/${encodeURIComponent(que)}?word=${encodeURIComponent(que)}&order=date_d&mode=safe&p=1&csw=0&s_mode=s_tag&type=all&ai_type=0&lang=en`, {
			headers: commonHeaders,
		});

		const res: any = await per.json();
		const items = res?.body?.illust?.data || res?.body?.illustManga?.data || [];
		return {
			data: {
				data:
					items?.map((item: any) => {
						const { url, profileImageUrl, ...rest } = item;
						return rest;
					}) || null,
				relatedTags: res?.body?.relatedTags || null,
				tagTranslation: res?.body?.tagTranslation || null,
			},
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const DiscordServers = async function DiscordServers(que: string) {
	if (!que) return null;

	try {
		const per = await discordFetch(`https://discord.com/api/v10/index/servers/search?limit=10&query=${encodeURIComponent(que)}`, {
			headers: { ...commonHeaders, "User-Agent": discordUserAgent },
		});

		if (per.status === 403) {
			return {
				error: "Cloudflare Turnstile asking to verify you're not a bot",
			};
		}

		const res: any = await per.json();
		return { data: res?.data?.hits || null };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const Bilibili = async function Bilibili(que: string) {
	if (!que) return null;

	try {
		const per = await fetch(`https://api.bilibili.tv/intl/gateway/web/v2/search_v2?s_locale=en_US&platform=web&keyword=${encodeURIComponent(que)}&highlight=1&pn=1&ps=10&qid=&sort=0`, {
			headers: commonHeaders,
		});

		if (per.status === 403) {
			return {
				error: "Akamai Captcha asking to verify you're not a bot",
			};
		}

		const res: any = await per.json();
		return {
			data: res?.data?.modules?.[0]?.items || res?.data?.modules?.[1]?.items || null,
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const DiscordApps = async function DiscordApps(que: string) {
	if (!que) return null;

	try {
		const per = await discordFetch(`https://discord.com/api/v10/application-directory/search?query=${encodeURIComponent(que)}&page=1&page_size=10&category_id=1&locale=en-US&source=0`, {
			headers: { ...commonHeaders, "User-Agent": discordUserAgent },
		});

		if (per.status === 403) {
			return {
				error: "Cloudflare Turnstile asking to verify you're not a bot",
			};
		}

		const res: any = await per.json();
		return { data: res?.results || null };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const Jiosaavn = async function Jiosaavn(que: string) {
	if (!que) return null;

	try {
		const per = await fetch(`https://www.jiosaavn.com/api.php?_format=json&n=10&__call=search.getResults&q=${encodeURIComponent(que)}`, {
			headers: commonHeaders,
		});

		const res: any = await per.json();
		const items = res?.results || [];

		return {
			data:
				items?.map((item: any) => {
					const { encrypted_media_url, encrypted_drm_media_url, encrypted_media_path, ...rest } = item;
					return rest;
				}) || null,
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const Twitch = async function Twitch(que: string) {
	if (!que) return null;

	try {
		const bodyhttp = [
			{
				operationName: "SearchResultsPage_SearchResults",
				variables: { query: que, includeIsDJ: true, platform: "web" },
				extensions: {
					persistedQuery: {
						version: 1,
						sha256Hash: "7f3580f6ac6cd8aa1424cff7c974a07143827d6fa36bba1b54318fe7f0b68dc5",
					},
				},
			},
			{
				operationName: "SearchTray_SearchSuggestions",
				variables: { queryFragment: que, withOfflineChannelContent: true },
				extensions: {
					persistedQuery: {
						version: 1,
						sha256Hash: "176dee782d1da7f1913242153c4abc4ef2a2b0b5ccb490d4a7b679e72bf1f45e",
					},
				},
			},
		];
		const per = await fetch(`https://gql.twitch.tv/gql`, {
			method: "POST",
			body: JSON.stringify(bodyhttp),
			headers: {
				...commonHeaders,
				"Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
				"Content-Type": "application/json",
			},
		});

		const res: any = await per.json();
		const { __typename, ...finalres } = {
			...res?.[1]?.data,
			...res?.[0]?.data?.searchFor,
		};

		return { data: finalres || null };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const ThreadUser = async function ThreadUser(que: string) {
	if (!que) return null;

	try {
		const bodyhttp = {
			query: que,
			first: 50,
			should_fetch_ig_inactive_on_text_app: true,
			should_fetch_friendship_status: false,
			should_fetch_fediverse_profiles: true,
			hide_unconnected_private: false,
			__relay_internal__pv__BarcelonaIsLoggedInrelayprovider: false,
			__relay_internal__pv__BarcelonaIsCrawlerrelayprovider: false,
			__relay_internal__pv__BarcelonaHasDisplayNamesrelayprovider: false,
		};
		const per = await fetch(`https://www.threads.com/graphql/query?doc_id=24871030029227550&variables=${JSON.stringify(bodyhttp)}`, {
			headers: {
				...commonHeaders,
				Origin: "https://www.threads.com",
				"X-IG-App-ID": "1412234116260832",
				"X-LOGGED-OUT-THREADS-MIGRATED-REQUEST": "true",
			},
		});

		const res: any = await per.json();

		return {
			data: res?.data?.xdt_api__v1__users__search_connection?.edges?.map((a: any) => a?.node) || null,
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const Pexels = async function Pexels(que: string) {
	if (!que) return null;

	try {
		const response = await fetch(`https://api.pexels.com/en-us/api/v2/search?per_page=20&query=${encodeURIComponent(que)}`, {
			headers: {
				...commonHeaders,
				"Secret-Key": process.env.PEXELS || "",
			},
		});

		if (response.status === 403) {
			return {
				error: "Cloudflare Turnstile asking to verify you're not a bot",
			};
		}

		if (response.status === 429) {
			return {
				error: "Rate-limited",
			};
		}

		const html = await response.text();
		let pull = null;
		try {
			pull = JSON.parse(html);
		} catch {}
		return { data: pull || null };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const TiktokSearchVideo = async function TiktokSearchVideo(que: string, limit: number = 1, refresh_auth: boolean = false) {
	if (!que) return null;

	try {
		if (refresh_auth || !tiktokSessionKeys?.device_id) tiktokSessionKeys = await tiktokSessions();

		const pul = await fetch(`https://api-boot.tiktokv.com/aweme/v1/search/item/?WebIdLastTime=${tiktokSessionKeys.deviceIdCreate}&count=${limit}&keyword=${encodeURIComponent(que)}&version_code=3.2.0&app_name=musical_ly&channel=App+Store&app_id=${tiktokSessionKeys.app_id}&device_id=${tiktokSessionKeys.device_id}&odinId=${tiktokSessionKeys.odin_id}&aid=1988&os_version=16.2&device_platform=iphone&iid=7386407102867523334&device_brand=iphone&device_type=iPhone10,6`, {
			headers: {
				...commonHeaders,
				"X-Khronos": Math.floor(Date.now() / 1000).toString(),
				Cookie: tiktokSessionKeys?.cookie,
			},
		});

		const res = await pul.text();
		if (res === "") {
			return {
				error: "Akamai Captcha asking to verify you're not a bot",
			};
		}
		let testres;
		try {
			testres = JSON.parse(res);
			if (!testres?.aweme_list && !refresh_auth) return await TiktokSearchVideo(que, limit, true);
		} catch {}
		return {
			_warning: "Tiktok updating security protection for accessing api. This endpoint may stop working in future",
			data: testres?.aweme_list || null,
		};
	} catch {
		return null;
	}
};

export const TiktokMusic = async function TiktokMusic(que: string, limit: number = 1, refresh_auth: boolean = false) {
	if (!que) return null;

	try {
		if (refresh_auth || !tiktokSessionKeys?.device_id) tiktokSessionKeys = await tiktokSessions();

		const pul = await fetch(`https://api-boot.tiktokv.com/aweme/v1/music/search/?WebIdLastTime=${tiktokSessionKeys.deviceIdCreate}&count=${limit}&cursor=0&aid=1988&app_id=${tiktokSessionKeys.app_id}&device_id=${tiktokSessionKeys.device_id}&odinId=${tiktokSessionKeys.odin_id}&region=&referer=&keyword=${encodeURIComponent(que)}`, {
			headers: {
				...commonHeaders,
				"X-Khronos": Math.floor(Date.now() / 1000).toString(),
				Cookie: tiktokSessionKeys?.cookie,
			},
		});

		const res = await pul.text();
		if (res === "") {
			return {
				error: "Akamai Captcha asking to verify you're not a bot",
			};
		}
		let testres;
		try {
			testres = JSON.parse(res);
			if (!testres?.music && !refresh_auth) return await TiktokMusic(que, limit, true);
		} catch {}
		return {
			_warning: "Tiktok updating security protection for accessing api. This endpoint may stop working in future",
			data: [testres?.music || null, testres?.music_info_list || null],
		};
	} catch {
		return null;
	}
};

export const TiktokUser = async function TiktokUser(que: string, limit: number = 1, refresh_auth: boolean = false) {
	if (!que) return null;

	try {
		if (refresh_auth || !tiktokSessionKeys?.device_id) tiktokSessionKeys = await tiktokSessions();

		const pul = await fetch(`https://api-boot.tiktokv.com/aweme/v1/discover/search/?WebIdLastTime=${tiktokSessionKeys.deviceIdCreate}&keyword=${encodeURIComponent(que)}&cursor=0&count=${limit}&hot_search=0&search_source=discover&aid=1988&app=musically&region=&referer=&app_id=${tiktokSessionKeys.app_id}&device_id=${tiktokSessionKeys.device_id}&odinId=${tiktokSessionKeys.odin_id}&type=1`, {
			headers: {
				...commonHeaders,
				"X-Khronos": String(Math.floor(Date.now() / 1000)),
				Cookie: tiktokSessionKeys?.cookie,
			},
		});

		const res = await pul.text();
		if (res === "") {
			return {
				error: "Akamai Captcha asking to verify you're not a bot",
			};
		}
		let testres;
		try {
			testres = JSON.parse(res);
			if (!testres?.user_list?.[0] && !refresh_auth) return await TiktokUser(que, limit, true);
		} catch {}
		return {
			_warning: "Tiktok updating security protection for accessing api. This endpoint may stop working in future",
			data: testres?.user_list?.map((a: any) => a.user_info) || null,
		};
	} catch {
		return null;
	}
};

// Have TLS Fingerprint, require http2 or above
export const TiktokFeed = async function TiktokFeed(region_code: string = "") {
	if (!tiktokSessionKeys?.device_id) tiktokSessionKeys = await tiktokSessions();

	const url = `https://www.tiktok.com/api/explore/item_list/?WebIdLastTime=${tiktokSessionKeys.deviceIdCreate}&aid=1284&app_id=${tiktokSessionKeys.app_id}&app_language=en&app_name=tiktok_web${tiktokSessionKeys.abVersion
		.split(",")
		.map((f: any) => `&clientABVersions=${f}`)
		.join("")}&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=Linux%20x86_64&browser_version=5.0%20(X11)&categoryType=120&channel=tiktok_web&clientABVersions=&cookie_enabled=false&count=1&data_collection_enabled=false&device_id=${tiktokSessionKeys.device_id}&odinId=${tiktokSessionKeys.odin_id}&device_platform=web_pc&enable_cache=false&is_fullscreen=true&is_page_visible=true&language=en&os=linux&priority_region=${region_code}&pullType=2&referer=&region=${region_code}&tz_name=&user_is_login=false&video_encoding=dash&webcast_language=en&screen_height=1440&screen_width=2560`;
	const headers = {
		...commonHeaders,
		Cookie: tiktokSessionKeys?.cookie,
		Referer: "https://www.tiktok.com/explore",
		"Sec-Fetch-Dest": "empty",
		"Sec-Fetch-Mode": "cors",
		"Sec-Fetch-Site": "same-origin",
	};

	const signedUrl = signTikTok({
		url,
		userAgent,
		msToken: "",
		body: "",
		perf: { txr: 105, tfr: 13, ixr: 15, ifr: 6 },
		envcode: 65,
		ubcode: 8,
	});

	for (let i = 0; i < 3; i++) {
		try {
			const pul = await fetch(signedUrl, { headers });
			const res = await pul.text();

			if (res === "" || pul.status !== 200) {
				if (i === 2) return { error: "Akamai Captcha asking to verify you're not a bot" };
				await new Promise((r) => setTimeout(r, 1000));
				continue;
			}

			let testres: any;
			try {
				testres = JSON.parse(res);
			} catch {
				if (i === 2) return { data: null };
				await new Promise((r) => setTimeout(r, 1000));
				continue;
			}

			const itemList = testres?.itemList || [];
			if (itemList.length === 0 || !itemList?.[0]?.video?.playAddr) {
				if (i === 2) return { data: null };
				await new Promise((r) => setTimeout(r, 1000));
				continue;
			}

			const data = await Promise.all(
				itemList.map(async (item: any) => {
					const videoInfo = item.video || {};
					const bitrateInfo = videoInfo.bitrateInfo || [];

					const sortedBitrateAsc = [...bitrateInfo].sort((a: any, b: any) => (a.Bitrate || 0) - (b.Bitrate || 0));
					const sortedBitrateDesc = [...bitrateInfo].sort((a: any, b: any) => (b.PlayAddr?.Width || 0) * (b.PlayAddr?.Height || 0) - (a.PlayAddr?.Width || 0) * (a.PlayAddr?.Height || 0));

					const videoUrl = (videoInfo.PlayAddrStruct?.UrlList || []).find((u: string) => u.includes("aweme/v1/play"))?.replace("faid=1988", "faid=1180") || null;
					const highestVideoUrl = sortedBitrateDesc[0]?.PlayAddr?.UrlList?.find((u: string) => u.includes("aweme/v1/play"))?.replace("faid=1988", "faid=1180") || null;
					const lowestVideoUrl = sortedBitrateAsc[0]?.PlayAddr?.UrlList?.find((u: string) => u.includes("aweme/v1/play"))?.replace("faid=1988", "faid=1180") || null;

					const extractRedirect = async (url: string) => {
						try {
							const res = await fetch(url, {
								headers: headers,
								redirect: "manual",
							});
							return res.headers.get("location") || url;
						} catch {
							return url;
						}
					};

					const [finalVideoUrl, finalLowestVideoUrl, finalHighestVideoUrl] = await Promise.all([videoUrl ? extractRedirect(videoUrl) : Promise.resolve(null), lowestVideoUrl ? extractRedirect(lowestVideoUrl) : Promise.resolve(null), highestVideoUrl ? extractRedirect(highestVideoUrl) : Promise.resolve(null)]);

					return {
						aweme_id: item.id,
						videoId: item.video?.videoID,
						url: "https://www.tiktok.com/@" + item.author?.uniqueId + "/video/" + item.id,
						desc: item.desc,
						descLanguage: item?.textLanguage || null,
						challenges: item?.challenges || [],
						create_time: item.createTime.toString(),
						duration: item.video?.duration,
						video_url: finalVideoUrl,
						lowest_video_url: finalLowestVideoUrl || finalVideoUrl,
						highest_video_url: finalHighestVideoUrl || finalVideoUrl,
						bit_rate: sortedBitrateDesc.map((br: any) => ({
							gear: br.GearName,
							bitrate: br.Bitrate,
							res: `${br.PlayAddr?.Width}x${br.PlayAddr?.Height}`,
							format: br.Format,
							codec: br.CodecType,
							play_url: br.PlayAddr?.UrlList?.[2]?.replace("faid=1988", "faid=1180"),
						})),
						author: {
							url: "https://www.tiktok.com/@" + item.author?.uniqueId,
							id: item.author?.id,
							secUid: item.author?.secUid,
							unique_id: item.author?.uniqueId,
							nickname: item.author?.nickname,
							desc: item.author?.signature,
							createTime: item.author?.createTime?.toString(),
							verified: item.author?.verified,
							tiktokSeller: item.author?.ttSeller,
							followerCount: item.authorStatsV2?.followerCount.toString(),
							followingCount: item.authorStatsV2?.followingCount.toString(),
							totalLikesCount: item.authorStatsV2?.heartCount.toString(),
							likeCount: item.authorStatsV2?.diggCount.toString(),
							videoCount: item.authorStatsV2?.videoCount.toString(),
							avatar: item.author?.avatarLarger,
						},
						music: {
							url: "https://www.tiktok.com/music/-" + item.music?.id,
							id: item.music?.id,
							title: item.music?.title,
							author: item.music?.authorName,
							cover: item.music?.coverLarge,
							duration: item.music?.duration,
							play_url: item.music?.playUrl,
						},
						statistics: {
							comment_count: item.stats?.commentCount.toString(),
							digg_count: item.stats?.diggCount.toString(),
							play_count: item.stats?.playCount.toString(),
							share_count: item.stats?.shareCount.toString(),
						},
						cover: item.video?.cover,
						origin_cover: item.video?.originCover,
						dynamic_cover: item.video?.dynamicCover,
					};
				}),
			);

			return {
				data: data?.[0] || null,
				altData: testres?.itemList?.[0] || null,
			};
		} catch (err) {
			if (i === 2) return null;
			await new Promise((r) => setTimeout(r, 1000));
		}
	}
	return null;
};

export const DiscordTiktokFeed = async function DiscordTiktokFeed(token: string, channelId: string, messageId?: string, region_code: string = "") {
	if (!token) return { error: "Missing token" };
	if (!channelId) return { error: "Missing channelId" };

	try {
		const channelCheck = await discordFetch(`https://discord.com/api/v10/channels/${channelId}`, {
			headers: {
				Authorization: `Bot ${token}`,
				"Content-Type": "application/json",
				"User-Agent": discordUserAgent,
			},
		});

		const channelData: any = await channelCheck.json();

		if (channelCheck.status !== 200) {
			return { error: channelData || "Channel verification failed" };
		}

		if (messageId) {
			const messageCheck = await discordFetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
				headers: {
					Authorization: `Bot ${token}`,
					"Content-Type": "application/json",
					"User-Agent": discordUserAgent,
				},
			});

			const messageData: any = await messageCheck.json();

			if (messageCheck.status !== 200) {
				return { error: messageData || "Message verification failed" };
			}
		}
	} catch (e: any) {
		return { error: e.message || "Failed to verify Discord resources" };
	}

	const feed = await TiktokFeed();
	if (!feed || !feed.data) return { error: "Akamai Captcha asking to verify you're not a bot" };

	const item = feed.data;
	const footerText = "TikTok • " + new Date(Number(item.create_time) * 1000).toLocaleString() + " • ❤️ " + formatAbbreviatedNumber(item.statistics.digg_count) + " 👁️ " + formatAbbreviatedNumber(item.statistics.play_count) + " 💬 " + formatAbbreviatedNumber(item.statistics.comment_count);

	const embed = {
		color: 0x000000,
		author: {
			name: item.author.unique_id,
			url: item.author.url,
			icon_url: item.author.avatar,
		},
		description: item.desc,
		url: item.url,
		footer: {
			text: footerText,
			icon_url: "https://sf16-sg.tiktokcdn.com/obj/eden-sg/uvkuhyieh7lpqpbj/pwa/512x512.png",
		},
	};

	const MAX_DISCORD_SIZE = 8388608;
	const urlsToTry = [item.highest_video_url, item.video_url].filter((u, i, a) => u && a.indexOf(u) === i);
	let videoBuffer: ArrayBuffer | null = null;

	for (const url of urlsToTry) {
		try {
			const vidReq = await fetch(url as string, {
				headers: {
					...commonHeaders,
					Referer: "https://www.tiktok.com/",
				},
			});

			const contentLength = parseInt(vidReq.headers.get("content-length") || "0");

			if (contentLength > MAX_DISCORD_SIZE) {
				continue;
			}

			const buffer = await vidReq.arrayBuffer();
			if (buffer.byteLength <= MAX_DISCORD_SIZE) {
				videoBuffer = buffer as ArrayBuffer;
				break;
			}
		} catch (e) {
			continue;
		}
	}

	let filename =
		item.desc
			?.replace(/[^a-z0-9 ]/gi, "_")
			.replace(/_{2,}/g, "_")
			.trim()
			.substring(0, 50) || "video-" + item.aweme_id;

	filename += ".mp4";

	const form = new FormData();
	const payload: any = {
		embeds: [embed],
		content: "",
	};

	if (videoBuffer) {
		payload.attachments = [
			{
				id: 0,
				filename: filename,
			},
		];
		// @ts-ignore
		form.append("files[0]", new Blob([videoBuffer]), filename);
	}

	form.append("payload_json", JSON.stringify(payload));

	try {
		const url = messageId ? `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}` : `https://discord.com/api/v10/channels/${channelId}/messages`;

		const response = await discordFetch(url, {
			method: messageId ? "PATCH" : "POST",
			headers: {
				Authorization: `Bot ${token}`,
				"User-Agent": discordUserAgent,
			},
			body: form,
		});

		const resJson: any = await response.json();
		return { data: resJson };
	} catch (e: any) {
		return { error: e.message };
	}
};

export const DiscordStream = async function DiscordStream(token: string, channelId: string, messageId?: string, url?: string, clone?: boolean, onEmbed?: boolean, name?: string, fallbackEmbed?: boolean) {
	if (!token) return { error: "Missing token" };
	if (!channelId) return { error: "Missing channelId" };
	if (!url) return { error: "Missing url" };

	let messageData: any = null;

	try {
		const channelCheck = await discordFetch(`https://discord.com/api/v10/channels/${channelId}`, {
			headers: {
				Authorization: `Bot ${token}`,
				"Content-Type": "application/json",
				"User-Agent": discordUserAgent,
			},
		});

		const channelData: any = await channelCheck.json();

		if (channelCheck.status !== 200) {
			return { error: channelData || "Channel verification failed" };
		}

		if (messageId) {
			const messageCheck = await discordFetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
				headers: {
					Authorization: `Bot ${token}`,
					"Content-Type": "application/json",
					"User-Agent": discordUserAgent,
				},
			});

			messageData = await messageCheck.json();

			if (messageCheck.status !== 200) {
				return { error: messageData || "Message verification failed" };
			}
		}
	} catch (e: any) {
		return { error: e.message || "Failed to verify Discord resources" };
	}

	const MAX_DISCORD_SIZE = 8388608;

	let videoBuffer: ArrayBuffer | null = null;
	let filename = "file";
	let contentType = "application/octet-stream";
	let fileTooLarge = false;

	try {
		const vidReq = await fetch(url, {
			headers: {
				...commonHeaders,
				referer: new URL(url).origin,
			},
		});

		const contentLength = parseInt(vidReq.headers.get("content-length") || "0");
		contentType = vidReq.headers.get("content-type") || contentType;

		const contentDisposition = vidReq.headers.get("content-disposition");
		if (contentDisposition) {
			const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
			if (fileNameMatch) {
				filename = fileNameMatch[1];
			}
		} else {
			try {
				const urlObj = new URL(url);
				const pathParts = urlObj.pathname.split("/");
				const lastPart = pathParts[pathParts.length - 1];
				if (lastPart && lastPart.includes(".")) {
					filename = lastPart;
				}
			} catch {}
		}

		if (contentLength > MAX_DISCORD_SIZE) {
			await vidReq.body?.cancel();
			fileTooLarge = true;
		}

		if (!fileTooLarge) {
			videoBuffer = await vidReq.arrayBuffer();
			if (videoBuffer.byteLength > MAX_DISCORD_SIZE) {
				fileTooLarge = true;
				videoBuffer = null;
			}
		}
	} catch (e: any) {
		return { error: "Failed to download content: " + e.message };
	}

	if (!filename.includes(".") && contentType !== "application/octet-stream") {
		if (contentType.includes("video/mp4")) filename += ".mp4";
		else if (contentType.includes("audio/mp4")) filename += ".m4a";
		else if (contentType.includes("audio/mpeg")) filename += ".mp3";
		else if (contentType.includes("video/")) filename += "." + contentType.split("/")[1].split(";")[0];
		else if (contentType.includes("audio/")) filename += "." + contentType.split("/")[1].split(";")[0];
		else if (contentType.includes("image/")) filename += "." + contentType.split("/")[1].split(";")[0].replace("jpeg", "jpg");
	}

	if (name) {
		const ext = filename.includes(".") ? filename.split(".").pop() : "";
		filename = ext ? `${name}.${ext}` : name;
	}

	const form = new FormData();
	const payload: any = {};

	if (clone && messageId && messageData) {
		if (onEmbed && messageData.embeds && messageData.embeds.length > 0) {
			payload.embeds = messageData.embeds;
			payload.embeds[0].image = { url: `attachment://${filename}` };
		}
	} else if (messageId) {
		payload.content = "";
		payload.embeds = [];
		payload.components = [];
		payload.attachments = [];
	} else {
		payload.content = "";
	}

	if (fileTooLarge) {
		if (fallbackEmbed && clone && messageData && messageData.embeds && messageData.embeds.length > 0) {
			payload.embeds = messageData.embeds;
			if (!payload.embeds[0].image) payload.embeds[0].image = {};
			payload.embeds[0].image.url = url;
			if (payload.content === undefined && messageData.content) payload.content = messageData.content;
			if (payload.components === undefined && messageData.components) payload.components = messageData.components;
		} else {
			let currentContent = payload.content;
			if (currentContent === undefined && clone && messageData) {
				currentContent = messageData.content;
			}
			currentContent = currentContent || "";

			const separator = currentContent.length > 0 ? "\n" : "";
			payload.content = currentContent + separator + url;
		}
	}

	if (videoBuffer) {
		payload.attachments = [
			{
				id: 0,
				filename: filename,
			},
		];
		// @ts-ignore
		form.append("files[0]", new Blob([videoBuffer]), filename);
	}

	form.append("payload_json", JSON.stringify(payload));

	try {
		const discordUrl = messageId ? `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}` : `https://discord.com/api/v10/channels/${channelId}/messages`;

		const response = await discordFetch(discordUrl, {
			method: messageId ? "PATCH" : "POST",
			headers: {
				Authorization: `Bot ${token}`,
				"User-Agent": discordUserAgent,
			},
			body: form,
		});

		const resJson: any = await response.json();
		return { data: resJson };
	} catch (e: any) {
		return { error: "Failed to upload to Discord: " + e.message };
	}
};

export const DiscordTTS = async function DiscordTTS(token: string, channelId: string, q: string, file_name?: string, messageId?: string, clone?: boolean, lang?: string, quality?: string) {
	if (!token) return { error: "Missing token" };
	if (!channelId) return { error: "Missing channelId" };
	if (!q) return { error: "Missing q" };

	let messageData: any = null;

	try {
		const channelCheck = await discordFetch(`https://discord.com/api/v10/channels/${channelId}`, {
			headers: {
				Authorization: `Bot ${token}`,
				"Content-Type": "application/json",
				"User-Agent": discordUserAgent,
			},
		});

		const channelData: any = await channelCheck.json();

		if (channelCheck.status !== 200) {
			return { error: channelData || "Channel verification failed" };
		}

		if (messageId) {
			const messageCheck = await discordFetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
				headers: {
					Authorization: `Bot ${token}`,
					"Content-Type": "application/json",
					"User-Agent": discordUserAgent,
				},
			});

			messageData = await messageCheck.json();

			if (messageCheck.status !== 200) {
				return { error: messageData || "Message verification failed" };
			}
		}
	} catch (e: any) {
		return { error: e.message || "Failed to verify Discord resources" };
	}

	const audio = quality && quality !== "low" ? await googleCloudTTS(q, lang || "en") : await googleTTS(q, lang || "en");
	if (!audio || audio.byteLength === 0) return { error: "Failed to synthesize speech" };

	const MAX_DISCORD_SIZE = 10485760;
	if (audio.byteLength > MAX_DISCORD_SIZE) {
		return { error: "Synthesized audio exceeds Discord's 10MB limit" };
	}

	let filename = file_name && file_name.length > 0 ? file_name : "tts.mp3";
	if (!filename.includes(".")) filename += ".mp3";

	const form = new FormData();
	const payload: any = { content: "" };

	if (clone && messageId && messageData) {
		payload.content = messageData.content || "";
		if (messageData.embeds && messageData.embeds.length > 0) {
			payload.embeds = messageData.embeds;
		}
		if (messageData.components && messageData.components.length > 0) {
			payload.components = messageData.components;
		}
	} else if (messageId) {
		payload.embeds = [];
		payload.components = [];
	}

	payload.attachments = [
		{
			id: 0,
			filename,
		},
	];
	// @ts-ignore
	form.append("files[0]", new Blob([audio]), filename);
	form.append("payload_json", JSON.stringify(payload));

	try {
		const discordUrl = messageId ? `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}` : `https://discord.com/api/v10/channels/${channelId}/messages`;

		const response = await discordFetch(discordUrl, {
			method: messageId ? "PATCH" : "POST",
			headers: {
				Authorization: `Bot ${token}`,
				"User-Agent": discordUserAgent,
			},
			body: form,
		});

		const resJson: any = await response.json();
		const ttsData = {
			text: q,
			lang: [lang || "en", findLangCode(lang || "en")],
			quality: quality || "low",
			size: audio.byteLength,
			filename,
		};
		return { data: resJson, altData: ttsData };
	} catch (e: any) {
		return { error: "Failed to upload to Discord: " + e.message };
	}
};

export const infoTwitterUser = async function infoTwitterUser(que: string, refresh_auth?: boolean): Promise<any> {
	if (!que) return null;
	if (refresh_auth || !twitterAuth || !twitterObj?.UserByScreenName || !twitterObj?.UserTweets) {
		await twitterKey("UserByScreenName");
		await twitterKey("UserTweets");
	}

	try {
		const queryId = twitterObj?.UserByScreenName?.[0];
		const features = JSON.stringify(twitterObj?.UserByScreenName?.[1]);
		const variables = JSON.stringify({
			screen_name: que,
			withGrokTranslatedBio: true,
		});
		const fieldToggles = JSON.stringify({
			withPayments: true,
			withAuxiliaryUserLabels: true,
		});

		const pul = await fetch(`https://api.x.com/graphql/${queryId}/UserByScreenName?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}&fieldToggles=${encodeURIComponent(fieldToggles)}`, {
			headers: {
				...commonHeaders,
				"content-type": "application/json",
				authorization: "Bearer " + twitterAuth,
				"x-client-transaction-id": twitterObj?.UserByScreenName?.[2],
			},
		});

		if (pul.status === 403) {
			return {
				error: "Bad auth",
			};
		}

		if (pul.status === 401 || pul.status === 400) return await infoTwitterUser(que, true);

		const responseText = await pul.text();
		let res;
		try {
			res = JSON.parse(responseText);
		} catch {
			return null;
		}
		let res2: any = {};
		let res3: any = {};
		if (res?.data?.user?.result?.rest_id) {
			const queryId2 = twitterObj?.UserTweets?.[0];
			const features2 = JSON.stringify(twitterObj?.UserTweets?.[1]);
			const variables2 = JSON.stringify({
				userId: res?.data?.user?.result?.rest_id,
				includePromotedContent: true,
				withQuickPromoteEligibilityTweetFields: true,
				withVoice: true,
			});
			const fieldToggles2 = JSON.stringify({ withArticlePlainText: true });
			const [pul2, pul3] = await Promise.all([
				fetch(`https://syndication.twitter.com/srv/timeline-profile/user-id/${res?.data?.user?.result?.rest_id}`, {
					headers: commonHeaders,
				}),
				fetch(`https://api.x.com/graphql/${queryId2}/UserTweets?variables=${encodeURIComponent(variables2)}&features=${encodeURIComponent(features2)}&fieldToggles=${encodeURIComponent(fieldToggles2)}`, {
					headers: {
						...commonHeaders,
						"content-type": "application/json",
						authorization: "Bearer " + twitterAuth,
						"x-client-transaction-id": twitterObj?.UserTweets?.[2],
					},
				}),
			]);
			try {
				const body2 = await pul2.text();
				if (body2 && body2.includes('type="application/json">')) {
					res2 = JSON.parse(body2.split('type="application/json">')[1].split("</script>")[0]);
				}
			} catch (e) {
				console.error("Twitter Syndication Parse Error:", e);
			}

			try {
				if (pul3.status === 200) {
					const res3_raw: any = await pul3.json();
					res3 = res3_raw?.data?.user?.result?.timeline?.timeline?.instructions?.flatMap((f: any) => f?.entries || (f?.entry ? [f.entry] : []));
				} else {
					res3 = {
						error: await pul3.text(),
					};
				}
			} catch (e) {
				console.error("Twitter API JSON Parse Error:", e);
			}
		}

		const finalres = {
			...(res?.data?.user?.result || null),
			timeline: {
				page: res3?.[0] ? res3 : { error: "Not available / Geo-restrict" },
				embed: res2?.props?.pageProps?.timeline?.entries?.[0] ? res2?.props?.pageProps?.timeline?.entries?.map((k: any) => k.content.tweet) : res2?.props?.pageProps?.contextProvider?.hasResults ? { error: "Not available / Geo-restrict" } : null,
			},
		};

		return { data: finalres?.rest_id ? finalres : null };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const infoTwitterTweet = async function infoTwitterTweet(que: string, refresh_auth?: boolean): Promise<any> {
	if (!que) return null;
	if (refresh_auth || !twitterAuth || !twitterObj?.TweetResultByRestId) {
		await twitterKey("TweetResultByRestId");
	}

	try {
		const queryId = twitterObj?.TweetResultByRestId?.[0];
		const features = JSON.stringify(twitterObj?.TweetResultByRestId?.[1]);
		const variables = JSON.stringify({
			tweetId: que,
			includePromotedContent: true,
			withBirdwatchNotes: true,
			withVoice: true,
			withCommunity: true,
		});

		const [pul, pul2] = await Promise.all([
			fetch(`https://api.x.com/graphql/${queryId}/TweetResultByRestId?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`, {
				headers: {
					...commonHeaders,
					"content-type": "application/json",
					authorization: "Bearer " + twitterAuth,
					"x-client-transaction-id": twitterObj?.TweetResultByRestId?.[2],
				},
			}),
			fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(que)}&lang=en&token=abc`, {
				headers: commonHeaders,
			}),
		]);

		if (pul.status === 401 || pul.status === 400) return await infoTwitterTweet(que, true);

		const tryParseJson = async (p: any) => {
			if (p.status !== 200) return null;
			try {
				return await p.json();
			} catch {
				return null;
			}
		};

		const [res, res2] = await Promise.all([pul.status === 403 ? Promise.resolve({ error: "Bad auth" }) : tryParseJson(pul), tryParseJson(pul2)]);

		return { data: [res?.data?.tweetResult?.result || null, res2 || null] };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const robloxGames = async function robloxGames(que: string) {
	if (!que) return null;

	try {
		const pul1 = await fetch(`https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(que)}&sessionId=abc`, {
			headers: commonHeaders,
		});

		const res1: any = await pul1.json();
		const gamesList = res1.searchResults?.flatMap((group: any) => group.contents) || [];
		const restIds = gamesList
			.filter((b: any) => b?.universeId)
			.map((b: any) => b.universeId)
			.join(",");

		if (!restIds) return { data: gamesList };

		const pul2 = await fetch(`https://games.roblox.com/v1/games?universeIds=${restIds}`, {
			headers: commonHeaders,
		});

		const res2: any = await pul2.json();
		const detailsMap = new Map(res2.data.map((game: any) => [game.id, game]));

		return {
			data: gamesList.map((b: any) => ({
				...b,
				details: b.universeId ? detailsMap.get(b.universeId) || null : null,
			})),
		};
	} catch {
		return null;
	}
};

export const YTChannel = async function YTChannel(que: string) {
	if (!que) return null;
	try {
		await getYoutubeVisitorKey();
		const bodyload = JSON.stringify({
			query: que,
			params: "EgIQAg%3D%3D",
			context: {
				client: {
					clientName: "MWEB",
					clientVersion: "2.20261230",
					hl: "en",
					gl: "US",
					...(poTokenCache?.visitor_data ? { visitorData: poTokenCache.visitor_data } : {}),
				},
			},
			...(poTokenCache?.po_token ? { serviceIntegrityDimensions: { poToken: poTokenCache.po_token } } : {}),
		});

		const response = await fetch("https://m.youtube.com/youtubei/v1/search?prettyPrint=false&fields=contents.sectionListRenderer.contents.itemSectionRenderer.contents.compactChannelRenderer", {
			headers: {
				...commonHeaders,
				"content-type": "application/json",
				...(keyYoutubeVisitor?.cookie ? { Cookie: keyYoutubeVisitor.cookie } : {}),
			},
			body: bodyload,
			method: "POST",
		});

		const res: any = await response.json();
		const contents = res?.contents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

		let alk: any[] = [];
		contents.forEach((item: any) => {
			const a = item.compactChannelRenderer;
			if (!a) return;

			try {
				const subRuns = a.subscriberCountText?.runs?.map((r: any) => r.text) || [];
				const videoRuns = a.videoCountText?.runs?.map((r: any) => r.text) || [];
				const allMetadata = [...subRuns, ...videoRuns, a.subscriberCountText?.simpleText, a.videoCountText?.simpleText].filter(Boolean);

				const handle = allMetadata.find((t) => t.startsWith("@"));
				const subs = allMetadata.find((t) => t.toLowerCase().includes("subscriber"));
				const videos = allMetadata.find((t) => t.toLowerCase().includes("video") || (t.match(/^\d+/) && !t.includes("subscriber") && !t.startsWith("@")));

				const ava = a.thumbnail?.thumbnails?.[0]?.url?.replace(/=s\d+.*/, "=s0");
				const fom = {
					channelId: a.channelId,
					url: "https://www.youtube.com/channel/" + a.channelId,
					handle: handle || null,
					avatar: (ava?.startsWith("//") ? "https:" + ava : ava) || null,
					banner: a.tvBanner?.thumbnails?.[0]?.url?.replace(/=w\d+.*/, "=s0") || null,
					name: a.title?.simpleText || a.title?.runs?.[0]?.text,
					subscriberCount: parseAbbreviatedNumber(subs),
					videoCount: parseAbbreviatedNumber(videos),
					verified: !!a.ownerBadges?.find((b: any) => b.metadataBadgeRenderer?.style === "BADGE_STYLE_TYPE_VERIFIED" || b.metadataBadgeRenderer?.style === "BADGE_STYLE_TYPE_VERIFIED_ARTIST"),
				};
				alk.push(fom);
			} catch (err) {
				console.error("Error parsing YouTube Channel item:", err);
			}
		});

		return { data: alk };
	} catch (e) {
		console.error("YTChannel Global Error:", e);
		return null;
	}
};

export const robloxAudio = async function robloxAudio(que: string) {
	if (!que) return null;

	try {
		const pul1 = await fetch(`https://apis.roblox.com/toolbox-service/v1/marketplace/3?limit=40&keyword=${encodeURIComponent(que)}`, {
			headers: commonHeaders,
		});

		const res1: any = await pul1.json();
		const assetList = res1.data || [];
		const assetIds = assetList.map((b: any) => b.id).join(",");

		if (!assetIds) return { data: null };

		const [pul2, pul3] = await Promise.all([
			fetch(`https://apis.roblox.com/toolbox-service/v1/items/details?assetIds=${assetIds}`, {
				headers: commonHeaders,
			}),
			fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${assetIds}&size=420x420&format=Png`, {
				headers: commonHeaders,
			}),
		]);

		const [res2, res3] = await Promise.all([pul2.json() as Promise<any>, pul3.json() as Promise<any>]);

		const thumbnails = res3.data || [];
		const details = res2.data || [];

		return {
			data: details.map((item: any) => {
				const thumb = thumbnails.find((t: any) => t.targetId === item.asset.id);
				return {
					title: item.asset.audioDetails?.title || item.asset.name,
					duration: item.asset.duration || 0,
					thumbnail: thumb?.imageUrl || "https://prod.docsiteassets.roblox.com/assets/feeds/robloxYoutubeAvatar.webp",
					url: `https://create.roblox.com/store/asset/${item.asset.id}`,
					...item,
				};
			}),
		};
	} catch {
		return null;
	}
};

export const Bandcamp = async function Bandcamp(que: string) {
	if (!que) return null;

	try {
		const body = {
			search_text: que,
			search_filter: "t",
			full_page: false,
		};

		const pul = await fetch(`https://bandcamp.com/api/bcsearch_public_api/1/autocomplete_elastic`, {
			method: "POST",
			body: JSON.stringify(body),
			headers: {
				...commonHeaders,
				"Content-Type": "application/json",
				Origin: "https://bandcamp.com",
			},
		});

		const res: any = await pul.json();
		const results = res?.auto?.results || [];

		return {
			data: results.map((b: any) => ({
				title: b.name,
				thumbnail: b.img_id === null ? (b.img ? b.img.replace("/img/", "/img/a") : null) : `https://f4.bcbits.com/img/a${b.art_id || b.img_id}_10.jpg`,
				url: b.item_url_path,
				...b,
			})),
		};
	} catch (e) {
		return null;
	}
};

export const Capcut = async function Capcut(que: string, limit_number: number = 1) {
	if (!que) return null;

	try {
		const time = Math.round(Date.now() / 1000);
		const linkhost = "https://edit-api-sg.capcut.com/lv/v1/cc_web/replicate/search_templates";

		const croppedHost = linkhost.slice(-7);

		const signStr = `9e2c|${croppedHost}|7|5.8.0|${time}||11ac`;
		const sign = crypto.createHash("md5").update(signStr).digest("hex");

		const body = {
			sdk_version: "100.0.0",
			count: limit_number,
			cursor: "0",
			query: que,
			scene: 1,
			search_version: 2,
		};

		const pul = await fetch(linkhost, {
			method: "POST",
			body: JSON.stringify(body),
			headers: {
				"Content-Type": "application/json",
				...commonHeaders,
				Sign: sign,
				"Sign-Ver": "1",
				"Device-Time": time.toString(),
				Pf: "7",
				Appvr: "5.8.0",
				"App-Sdk-Version": "48.0.0",
				Lan: "en",
				Loc: "sg",
				Origin: "https://www.capcut.com",
				Referer: "https://www.capcut.com",
				"Sec-Fetch-Site": "same-site",
			},
		});

		const res: any = await pul.json();
		const templates = res?.data?.video_templates || [];

		return {
			data: templates.map((tp: any) => ({
				url: `https://www.capcut.com/template-detail/${tp.web_id}`,
				title: tp.short_title || tp.title,
				duration: tp.duration,
				thumbnail: tp.optimized_cover_url?.cover_url_large || tp.cover_url,
				...tp,
			})),
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const redditSubreddit = async function redditSubreddit(que: string, refresh_auth: boolean = false) {
	if (!que) return null;

	try {
		if (refresh_auth || redditCookies === "") redditCookies = await refreshRedditAuth();

		const headers: any = commonHeaders;
		if (redditCookies) headers["Cookie"] = redditCookies;

		const req = await fetch(`https://www.reddit.com/search/.json?q=subreddit%3A${encodeURIComponent(que.toLowerCase()?.split(" ")?.[0])}&sort=new&restrict_sr=&t=all&include_over_18=on`, { headers });

		if (req.status === 451) {
			return { error: "This subreddit is not available in your country" };
		}

		if (req.status === 403) {
			if (!refresh_auth) return redditSubreddit(que, true);
			return { error: "IP Blocked" };
		}

		const res: any = await req.json();
		const finalres: any = res?.data?.children?.map((a: any) => a?.data);
		return {
			_wafChallenge: redditCookies !== "",
			data: JSON.parse(decodeHTML(JSON.stringify(finalres?.[0] ? finalres : null))),
		};
	} catch {
		return null;
	}
};

export const RedditPost = async (url: string, refresh_auth: boolean = false): Promise<any> => {
	if (!url) return null;

	try {
		let urlObj: URL;
		try {
			urlObj = new URL(url);
		} catch {
			return { error: "Invalid URL" };
		}
		const pathname = urlObj.pathname.replace(/\/+$/, "");
		const jsonUrl = `https://www.reddit.com${pathname}.json`;

		if (refresh_auth || redditCookies === "") redditCookies = await refreshRedditAuth();

		const headers: any = commonHeaders;
		if (redditCookies) headers["Cookie"] = redditCookies;

		const req = await fetch(jsonUrl, { headers });

		if (req.status === 451) {
			return { error: "This subreddit is not available in your country" };
		}

		if (req.status === 403) {
			if (!refresh_auth) return RedditPost(url, true);
			return { error: "IP Blocked" };
		}

		let res;
		try {
			res = await req.json();
			res = Array.isArray(res) ? res.flatMap((l: any) => l?.data?.children?.map((c: any) => c.data) || []) : res;
		} catch {
			redditCookies = await refreshRedditAuth();
			const retryReq2 = await fetch(jsonUrl, {
				headers: { ...headers, Cookie: redditCookies },
			});
			let retryRes2;
			try {
				retryRes2 = await retryReq2.json();
				retryRes2 = Array.isArray(retryRes2) ? retryRes2.flatMap((l: any) => l?.data?.children?.map((c: any) => c.data) || []) : retryRes2;
			} catch {
				return {
					error: "Invalid response. Probably anti-bot challenge return.",
				};
			}
			return { _wafChallenge: redditCookies !== "", data: retryRes2 };
		}

		return { _wafChallenge: redditCookies !== "", data: JSON.parse(decodeHTML(JSON.stringify(res))) };
	} catch (e: any) {
		return null;
	}
};

export const redditMedia = async function redditMedia(que: string, refresh_auth: boolean = false) {
	if (!que) return null;

	try {
		if (refresh_auth || redditCookies === "") redditCookies = await refreshRedditAuth();

		const headers: any = commonHeaders;
		if (redditCookies) headers["Cookie"] = redditCookies;

		const req = await fetch(`https://www.reddit.com/search/.json?q=${encodeURIComponent(que)}&restrict_sr=&sort=new&t=all&include_over_18=on`, { headers });

		if (req.status === 403) {
			if (!refresh_auth) return redditMedia(que, true);
			return { error: "IP Blocked" };
		}

		const res: any = await req.json();
		return {
			_wafChallenge: redditCookies !== "",
			data: JSON.parse(decodeHTML(JSON.stringify(res?.data?.children?.map((a: any) => a?.data) || null))),
		};
	} catch (e) {
		return null;
	}
};

// Have TLS Fingerprint, require http2 or above
export const instagramUser = async function instagramUser(que: string) {
	if (!que) return null;

	if (!keyInstagram) {
		keyInstagram = await instagramSession();
	}

	const instagramHeaders = {
		...(keyInstagram ? { Cookie: keyInstagram.cookie } : {}),
		...(keyInstagram?.csrf ? { "X-CSRFToken": keyInstagram.csrf } : {}),
		...(keyInstagram?.app_id ? { "X-IG-App-ID": keyInstagram.app_id } : { "X-IG-App-ID": "936619743392459" }),
	};

	try {
		const testreq = await fetch(`https://www.instagram.com/${encodeURIComponent(que)}`, {
			headers: {
				...commonHeaders,
				...(keyInstagram ? { Cookie: keyInstagram.cookie } : {}),
			},
		});

		// Critical error
		if (testreq.url.includes(`https://www.instagram.com/accounts/login`)) {
			return {
				error: "Please sign in",
			};
		}

		const resreq = await testreq.text();
		const scripts = [...resreq.matchAll(/<script type="application\/json"[^>]*data-sjs[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

		let a: any = null;
		let b: any = null;
		let isFallback = false;
		let isRestricted = false;
		let hasUserKey = false;

		for (const script of scripts) {
			try {
				const parsed = JSON.parse(script);
				const data = parsed?.require?.[0]?.[3]?.[0]?.__bbox?.require?.[0]?.[3]?.[1]?.__bbox?.result?.data;
				if (!data) continue;
				if ("xig_user_by_username" in data) {
					hasUserKey = true;
					const user = data.xig_user_by_username;
					if (user?.pk) {
						a = user;
						break;
					}
					if (user === null) isRestricted = true;
				}
			} catch {}
		}

		if (!a && isRestricted) {
			return {
				error: "Account restricted",
			};
		}

		if (!a && !hasUserKey) {
			return {
				data: null,
			};
		}

		if (!a) {
			isFallback = true;

			for (let attempt = 0; attempt < 2; attempt++) {
				const req = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(que)}`, {
					headers: {
						...commonHeaders,
						...instagramHeaders,
						"X-ASBD-ID": "198387",
						"X-IG-WWW-Claim": "0",
					},
				});

				try {
					const text = await req.text();
					if (text && text.trim() !== "") {
						const res = JSON.parse(text);
						a = res?.data?.user;
					}
				} catch {}

				if (!a) {
					const req2 = await fetch(`https://www.instagram.com/api/graphql`, {
						method: "POST",
						body: `lsd=${keyInstagram?.lsd || ""}&fb_api_caller_class=RelayModern&fb_api_req_friendly_name=PolarisLoggedOutDesktopWWWProfileRootContentQuery&server_timestamps=true&variables=${encodeURIComponent(JSON.stringify({ username: que }))}&doc_id=28213089111615909`,
						headers: {
							...commonHeaders,
							...instagramHeaders,
							Accept: "*/*",
							"Content-Type": "application/x-www-form-urlencoded",
							"Sec-Fetch-Site": "same-origin",
							...(keyInstagram?.lsd ? { "X-FB-LSD": keyInstagram.lsd } : {}),
							"X-ASBD-ID": "359341",
						},
					});
					try {
						const res2 = await req2.json();
						b = res2?.data?.xig_user_by_username || res2?.data?.user || res2?.data || res2;
						a = b?.user ? b.user : b;
					} catch {}
				}

				if (a) break;
				if (keyInstagram) keyInstagram = await instagramSession();
			}
		}

		const source = a;
		const formatted =
			source && source.id
				? {
						avatar_url: source.profile_pic_url_hd || source.profile_pic_url,
						userid: source.id,
						username: source.username,
						nickname: source.full_name,
						profile_url: "https://www.instagram.com/" + source.username,
						description: source.biography,
						category: source.category_name || null,
						external_links: source.bio_links,
						followed_count: source.edge_follow?.count || source.following_count,
						follower_count: source.edge_followed_by?.count || source.follower_count,
						post_count: source.edge_owner_to_timeline_media?.count || source.media_count,
						verified: source.is_verified,
						private: source.is_private,
						pronouns: source.pronouns?.[0] ? source.pronouns : null,
					}
				: null;

		return {
			_warning: "This endpoint might not work due to anti-bot protection",
			isFallback,
			data: [formatted || null, a || b || null],
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const infoThreadUser = async function infoThreadUser(que: string) {
	if (!que) return null;

	try {
		const bodyhttp = {
			username: que,
			__relay_internal__pv__BarcelonaIsInternalUserrelayprovider: false,
			__relay_internal__pv__BarcelonaIsLoggedInrelayprovider: false,
			__relay_internal__pv__BarcelonaHasSpoilerStylingInforelayprovider: false,
			__relay_internal__pv__BarcelonaShouldShowFediverseM1Featuresrelayprovider: false,
			__relay_internal__pv__BarcelonaHasEventBadgerelayprovider: false,
		};
		let bodyhttp2: any = {
			allow_page_info_for_lox_user: true,
			first: 50,
			skipGhostPosts: false,
			userID: null,
			__relay_internal__pv__BarcelonaIsLoggedInrelayprovider: false,
			__relay_internal__pv__BarcelonaHasProfileSelfReplyContextrelayprovider: false,
			__relay_internal__pv__BarcelonaHasInlineReplyComposerrelayprovider: false,
			__relay_internal__pv__BarcelonaIsReplyApprovalEnabledrelayprovider: false,
			__relay_internal__pv__BarcelonaIsReplyApprovalsConsumptionEnabledrelayprovider: false,
			__relay_internal__pv__BarcelonaHasDearAlgoConsumptionrelayprovider: true,
			__relay_internal__pv__BarcelonaHasEventBadgerelayprovider: false,
			__relay_internal__pv__BarcelonaIsSearchDiscoveryEnabledrelayprovider: false,
			__relay_internal__pv__BarcelonaHasPodcastConsumptionrelayprovider: true,
			__relay_internal__pv__BarcelonaHasCommunitiesrelayprovider: false,
			__relay_internal__pv__BarcelonaHasSelfThreadCountrelayprovider: false,
			__relay_internal__pv__IsTagIndicatorEnabledrelayprovider: true,
			__relay_internal__pv__BarcelonaHasDeepDiverelayprovider: false,
			__relay_internal__pv__BarcelonaHasGhostPostConsumptionrelayprovider: true,
			__relay_internal__pv__BarcelonaHasSpoilerStylingInforelayprovider: false,
			__relay_internal__pv__BarcelonaHasGhostPostEmojiActivationrelayprovider: false,
			__relay_internal__pv__BarcelonaOptionalCookiesEnabledrelayprovider: true,
			__relay_internal__pv__BarcelonaHasDearAlgoWebProductionrelayprovider: false,
			__relay_internal__pv__BarcelonaQuotedPostUFIEnabledrelayprovider: true,
			__relay_internal__pv__BarcelonaHasTopicTagsrelayprovider: true,
			__relay_internal__pv__BarcelonaIsCrawlerrelayprovider: false,
			__relay_internal__pv__BarcelonaHasDisplayNamesrelayprovider: false,
			__relay_internal__pv__BarcelonaHasCommunityTopContributorsrelayprovider: false,
			__relay_internal__pv__BarcelonaCanSeeSponsoredContentrelayprovider: false,
			__relay_internal__pv__BarcelonaShouldShowFediverseM075Featuresrelayprovider: false,
			__relay_internal__pv__BarcelonaImplicitTrendsGKrelayprovider: false,
			__relay_internal__pv__BarcelonaIsInternalUserrelayprovider: false,
		};

		const [per, per2] = await Promise.all([
			fetch(`https://www.threads.com/graphql/query?doc_id=26203769429220861&variables=${JSON.stringify(bodyhttp)}`, {
				headers: {
					...commonHeaders,
					"User-Agent": `Barcelona ${getRandomInt(400, 450)}.${getRandomInt(0, 9)}.${getRandomInt(0, 9)}.${getRandomInt(10, 99)}.${getRandomInt(100, 999)} Android (35/15; 480dpi; 1220x2712; Xiaomi/Redmi; 23090RA98G; zircon; mt6886; fr_FR; ${getRandomInt(100000000, 999999999)})`,
					Origin: "https://www.threads.com",
					"X-IG-App-ID": "1412234116260832",
					"X-LOGGED-OUT-THREADS-MIGRATED-REQUEST": "true",
				},
			}),
			fetch(`https://www.threads.com/@${encodeURIComponent(que)}`, {
				headers: commonHeaders,
			}),
		]);

		const [res, resText2]: [any, string] = await Promise.all([
			per.status === 200
				? (async () => {
						try {
							return await per.json();
						} catch {
							return null;
						}
					})()
				: Promise.resolve(null),
			per2.status === 200 ? per2.text() : Promise.resolve(""),
		]);

		let webData: any[] = [];
		try {
			if (resText2) {
				const sjsParts = resText2.split("data-sjs>");
				sjsParts.shift(); // Remove first part before script tags

				for (const part of sjsParts) {
					if (part.includes("RelayPrefetchedStreamCache")) {
						try {
							const jsonStr = part.split("</script>")[0];
							const parsed = JSON.parse(jsonStr);

							const reqs = parsed?.require || [];
							for (const req of reqs) {
								const args = req?.[3] || [];
								for (const arg of args) {
									const innerReqs = arg?.__bbox?.require || [];
									for (const innerReq of innerReqs) {
										if (innerReq?.[0]?.startsWith("RelayPrefetchedStreamCache")) {
											const data = innerReq?.[3]?.[1]?.__bbox?.result?.data;
											if (data) webData.push(data);
										}
									}
								}
							}
						} catch {}
					}
				}
			}
		} catch (e) {}

		let finalres: any = res?.data?.user || null;
		let edges: any = null;

		if (finalres) {
			bodyhttp2.userID = finalres.id;
			const per3 = await fetch(`https://www.threads.com/graphql/query?doc_id=33773912952222602&variables=${JSON.stringify(bodyhttp2)}`, {
				headers: {
					...commonHeaders,
					"User-Agent": `Barcelona ${getRandomInt(400, 450)}.${getRandomInt(0, 9)}.${getRandomInt(0, 9)}.${getRandomInt(10, 99)}.${getRandomInt(100, 999)} Android (35/15; 480dpi; 1220x2712; Xiaomi/Redmi; 23090RA98G; zircon; mt6886; fr_FR; ${getRandomInt(100000000, 999999999)})`,
					Origin: "https://www.threads.com",
					"X-IG-App-ID": "1412234116260832",
					"X-LOGGED-OUT-THREADS-MIGRATED-REQUEST": "true",
				},
			});

			if (per3.status === 200) {
				const res3 = (await per3.json()) as any;
				edges = res3?.data?.mediaData?.edges?.map((a: any) => a?.node?.thread_items?.[0]?.post) || null;
			}

			finalres = {
				...finalres,
				edges: edges || finalres.edges || null,
			};
		} else if (res?.status !== "ok") {
			finalres = {
				error: "Cannot process this",
				raw: res?.data || res,
			};
		}

		return {
			data: [
				finalres || null,
				{
					user: webData[0]?.user || null,
					edges: webData[1]?.mediaData?.edges?.map((a: any) => a?.node) || null,
				},
			],
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const Tenor = async function Tenor(que: string, type?: string) {
	if (!que) return null;

	const getSearchFilter = (t?: string) => {
		if (!t || t === "all") return "&searchfilter=none";
		if (t === "sticker") return "&searchfilter=sticker";
		if (t === "meme") return "&searchfilter=static,-sticker";
		return "&searchfilter=none";
	};

	const getFormatQuery = (t?: string) => {
		if (t === "gif") return "?format=gifs";
		if (t === "sticker") return "?format=stickers";
		if (t === "meme") return "?format=memes";
		return "";
	};

	try {
		const apiRes = await fetch(`https://tenor.googleapis.com/v2/search?prettyPrint=false&q=${encodeURIComponent(que.toLowerCase())}&fields=results&limit=50&client_key=tenor_web&locale=en${getSearchFilter(type)}`, {
			headers: {
				...commonHeaders,
				Referer: "https://tenor.com",
				Origin: "https://tenor.com",
				"X-Goog-Api-Key": process.env.GOOG_TENOR || "",
			},
		});

		if (apiRes.status === 200) {
			const apiData: any = await apiRes.json();
			return {
				data: {
					data: apiData?.results || [],
				},
			};
		}
	} catch {}

	try {
		const formatQuery = getFormatQuery(type);
		const webRes = await fetch(`https://tenor.com/search/${encodeURIComponent(que.toLowerCase())}-gifs${formatQuery}`, {
			headers: commonHeaders,
		});

		if (webRes.status !== 200) {
			return { error: `${webRes.status} - Can't process this` };
		}

		const html = await webRes.text();

		if (html.includes('form id="captcha-form"')) {
			return { error: "Blocked recaptcha" };
		}

		const storeMatch = html.match(/<script id="store-cache"[^>]*>([\s\S]*?)<\/script>/);
		if (!storeMatch) {
			return { error: "Failed to parse webpage data" };
		}

		const storeData = JSON.parse(storeMatch[1]);
		const searchKeys = Object.keys(storeData?.universal?.search || {});

		return {
			data: {
				data: searchKeys.length > 0 ? storeData.universal.search[searchKeys[0]]?.results : [],
			},
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const infoTenor = async function infoTenor(url: string) {
	if (!url) return null;

	try {
		const urlObj = new URL(url);
		if (!urlObj.hostname.endsWith("tenor.com")) {
			return { error: "Invalid Tenor URL" };
		}

		const pathParts = urlObj.pathname.split("/").filter(Boolean);
		const lastPart = pathParts[pathParts.length - 1] || "";
		const postId = lastPart.split("-").pop();

		if (!postId || !/^\d+$/.test(postId)) {
			return { error: "Invalid Tenor post ID" };
		}

		const res = await fetch(`https://tenor.com/embed/${postId}`, {
			headers: commonHeaders,
		});

		if (res.status !== 200) {
			return { error: `${res.status} - Can't process this` };
		}

		const html = await res.text();
		const gifMatch = html.match(/<script id="gif-json"[^>]*>([\s\S]*?)<\/script>/);

		if (!gifMatch) {
			return { error: "Failed to parse GIF data" };
		}

		const gifData = JSON.parse(gifMatch[1]);
		return { data: gifData };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const infoGiphy = async function infoGiphy(url: string) {
	if (!url) return null;

	try {
		const urlObj = new URL(url);
		if (!urlObj.hostname.endsWith("giphy.com")) {
			return { error: "Invalid Giphy URL" };
		}

		const res = await fetch(url, {
			headers: commonHeaders,
		});

		if (res.status !== 200) {
			return { error: `${res.status} - Can't process this` };
		}

		const html = await res.text();

		const keywordsMatch = html.match(/<meta\s+name="keywords"\s+content="([^"]*)"/i);
		const keywords =
			keywordsMatch?.[1]
				?.split(",")
				.map((k: string) => k.trim())
				.filter(Boolean) || null;

		const chunks = html.split("self.__next_f.push(");
		chunks.shift();

		let gifData: unknown = null;
		let userData: unknown = null;
		let relatedData: unknown = null;

		for (const chunk of chunks) {
			if (!chunk.includes("gif")) continue;

			try {
				let end = chunk.indexOf(")</script>");
				if (end === -1) end = chunk.indexOf(")\n");
				if (end === -1) end = chunk.lastIndexOf(")");

				const parsed = JSON.parse(chunk.substring(0, end));

				let innerData: unknown = parsed[1];
				if (typeof innerData === "string") {
					const colonIdx = innerData.indexOf(":");
					if (colonIdx !== -1) {
						try {
							innerData = JSON.parse(innerData.substring(colonIdx + 1));
						} catch {}
					}
				}

				if (!gifData) gifData = deepFind(innerData, "gif");
				if (!relatedData) relatedData = deepFind(innerData, "initialGifs");
				if (!userData) {
					const found = deepFind(innerData, "user");
					if (found && typeof found === "object") userData = found;
				}

				if (gifData) break;
			} catch {
				continue;
			}
		}

		return {
			data: {
				suggestion: keywords,
				data: gifData,
				user: userData,
				related: relatedData,
			},
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const Giphy = async function Giphy(que: string, type?: string) {
	if (!que) return null;

	const getTypeQuery = (t?: string) => {
		if (t === "sticker") return "-stickers";
		if (t === "clip") return "-clips";
		return "";
	};

	try {
		const res = await fetch(`https://www.giphy.com/search/${encodeURIComponent(que)}${getTypeQuery(type)}`, {
			headers: commonHeaders,
		});

		if (res.status !== 200) {
			return { error: `${res.status} - Can't process this` };
		}

		const html = await res.text();
		const chunks = html.split("self.__next_f.push(");
		chunks.shift();

		for (const chunk of chunks) {
			if (!chunk.includes("initialGifs")) continue;

			try {
				let end = chunk.indexOf(")</script>");
				if (end === -1) end = chunk.indexOf(")\n");
				if (end === -1) end = chunk.lastIndexOf(")");

				const parsed = JSON.parse(chunk.substring(0, end));

				let innerData: unknown = parsed[1];
				if (typeof innerData === "string") {
					const colonIdx = innerData.indexOf(":");
					if (colonIdx !== -1) {
						try {
							innerData = JSON.parse(innerData.substring(colonIdx + 1));
						} catch {}
					}
				}

				const gifs = deepFind(innerData, "initialGifs");
				if (gifs) return { data: gifs };
			} catch {
				continue;
			}
		}

		return { data: null };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const GiphyAPI = async function GiphyAPI(que: string, type?: string, refresh_auth: boolean = false) {
	if (!que) return null;

	const getTypeQuery = (t?: string) => {
		if (t === "sticker") return "stickers";
		if (t === "clip") return "clips";
		if (t === "gif" || !t) return "gifs";
		return "";
	};

	try {
		if (refresh_auth || !keygiphy) {
			keygiphy = await giphyKey();
		}

		const [res, res3] = await Promise.all([
			fetch(`https://api.giphy.com/v1/${getTypeQuery(type)}/search?api_key=${keygiphy}&q=${encodeURIComponent(que)}&limit=25`, {
				headers: commonHeaders,
			}),
			fetch(`https://api.giphy.com/v1/channels/search?api_key=${keygiphy}&q=${encodeURIComponent(que)}&limit=25`, {
				headers: commonHeaders,
			}),
		]);

		if (res.status === 401) {
			return await GiphyAPI(que, type, true);
		}

		let jl: any = {};
		let jl3: any = {};
		let jl4: any = {};
		try {
			jl = await res.json();
		} catch {}
		try {
			if (jl.data?.[0]?.id) {
				const fetchRelated = await fetch(`https://api.giphy.com/v1/${getTypeQuery(type)}/related?gif_id=${jl.data[0].id}&limit=25&api_key=${keygiphy}`, {
					headers: commonHeaders,
				});
				jl3 = await fetchRelated.json();
			}
		} catch {}
		try {
			jl4 = await res3.json();
		} catch {}

		return {
			data: jl?.data || null,
			related: jl3?.data || null,
			channel: jl4?.data || null,
			...jl?.pagination,
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export async function googleWeather(query: string): Promise<any> {
	if (!query) return null;

	try {
		const l = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`, {
			headers: commonHeaders,
		});

		let ls: any = await l.json();

		const item = ls?.[0];

		if (!item) return { data: null };

		const datageo: any = {
			geo: { latitude: item.lat, longitude: item.lon },
			address: {
				...item.address,
				display_name: item.display_name,
				place_id: item.place_id,
				osm_type: item.osm_type,
				osm_id: item.osm_id,
				boundingbox: item.boundingbox,
				type: item.type,
				addresstype: item.addresstype,
			},
		};

		if (!datageo) return { data: null };
		const coords = datageo.geo.latitude + "," + datageo.geo.longitude;

		const k = await fetch(`https://weather.googleapis.com/v1/currentConditions:lookup?location.latitude=${datageo.geo.latitude}&location.longitude=${datageo.geo.longitude}&prettyPrint=false`, {
			headers: {
				...commonHeaders,
				Referer: "https://storage.googleapis.com/",
				"X-Goog-Api-Key": process.env.GOOG_WEATHER || "",
			},
		});

		if (k.status !== 200) return { data: null };

		const finalk = await k.json();
		return {
			data: [
				{
					...datageo.address,
					...datageo.geo,
					mapsView: {
						preview: `https://maps.googleapis.com/maps/api/staticmap?alt=media&center=${coords}&zoom=15&size=800x300&markers=${encodeURI("color:red|" + coords)}&key=${process.env.GOOG_MAPS}`,
						highest: `https://maps.googleapis.com/maps/api/staticmap?alt=media&center=${coords}&zoom=15&size=2048x768&markers=${encodeURI("color:red|" + coords)}&key=${process.env.GOOG_MAPS}`,
					},
				},
				finalk,
			],
		};
	} catch {
		return null;
	}
}

export async function OpenRouterGPT(query: string, convo: any = null): Promise<any> {
	if (!query) return null;

	let messages: any[] = [];

	if (convo) {
		try {
			const parsed = JSON.parse(decryptConvo(convo));
			if (Array.isArray(parsed)) messages = parsed;
		} catch {
			messages = [];
		}
	}

	messages.push({ role: "user", content: query });

	try {
		const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
			method: "POST",
			body: JSON.stringify({
				model: "openai/gpt-oss-20b:free",
				messages: messages,
				reasoning: { enabled: true },
			}),
			headers: {
				Authorization: `Bearer ${process.env.OPEN}`,
				"Content-Type": "application/json",
			},
		});

		if (res.status === 429) {
			return {
				error: "Rate-limited",
			};
		}

		if (!res.ok) {
			return {
				error: "Service unavailable",
			};
		}

		const data: any = await res.json();
		const response = data.choices?.[0]?.message?.content;
		const reasoning = data.choices?.[0]?.message?.reasoning;

		if (response) {
			messages.push({ role: "assistant", content: response });
		}

		if (messages.length > 20) {
			messages = messages.slice(-20);
		}

		return {
			reasoning: reasoning || null,
			response: response || null,
			data: {
				conversation: encryptConvo(JSON.stringify(messages)),
				model: "gpt-oss-20b",
			},
		};
	} catch {
		return null;
	}
}

let driftCookies: string | null = null;

export async function DriftProfile(query: string): Promise<any> {
	if (!query) return null;
	const username = query.split(/[?#]/)[0].split("/").filter(Boolean).pop();
	if (!username || ["robots.txt", "favicon.ico", "message", "cdn-cgi", "customize", "login", "join", "auth", "media", "go"].includes(username.toLowerCase())) return null;
	const filterurl = new URL("https://drift.rip/" + username);
	let res: any;

	for (let attempts = 0; attempts < 3; attempts++) {
		try {
			res = await fetch(filterurl.toString(), {
				headers: {
					...commonHeaders,
					...(driftCookies ? { cookie: driftCookies } : {}),
				},
			});

			if (responseStatus(res) !== 403) {
				break;
			}

			if (attempts === 2) {
				const browserRes = await browserRequest({
					url: filterurl.toString(),
					fetcherType: "stealthy",
					headers: commonHeaders,
					extractHtml: true,
				});

				if (!browserRes.success || browserRes.status === 403) {
					return {
						error: "Cloudflare Turnstile asking to verify you're not a bot",
					};
				}

				if (browserRes.cookies && Object.keys(browserRes.cookies).length > 0) {
					driftCookies = Object.entries(browserRes.cookies)
						.map(([key, val]) => `${key}=${val}`)
						.join("; ");
				}

				res = {
					status: browserRes.status ?? 200,
					text: browserRes.html ?? "",
					url: browserRes.url ?? filterurl.toString(),
					headers: browserRes.headers ?? {},
				};
			}
		} catch (e) {
			if (attempts === 2) throw e;
		}
	}

	try {
		let test = await responseText(res);
		if (res.url?.includes("/message")) {
			return {
				data: null,
			};
		}
		const { document } = parseHTML(test);
		let schemaJson: any = document.querySelector('script[type="application/ld+json"]')?.textContent;

		try {
			schemaJson = JSON.parse(schemaJson || "{}");
		} catch {
			schemaJson = null;
		}

		const styles = Array.from(document.querySelectorAll("style"))
			.map((s: any) => s.textContent)
			.join("");
		const myProfileId = test?.split("let currentProfileId =")?.[1]?.split(";")?.[0]?.trim() || null;

		return {
			data: {
				user: {
					account_id: test?.split("let userSql = ")?.[1]?.split(";")?.[0]?.trim() || null,
					profile_id: myProfileId,
					name: schemaJson?.name?.split("|")?.[1]?.trim() || schemaJson?.mainEntity?.name || "",
					display_name: {
						text: document.querySelector("#bio-username")?.textContent?.trim() || "",
						color: styles.match(/#bio-username\s*\{[^}]*color:\s*([^;]+)/i)?.[1] || null,
					},
					description: {
						text: document.querySelector("#bio-description")?.textContent?.trim() || null,
						color: styles.match(/#bio-description\s*\{[^}]*color:\s*([^;]+)/i)?.[1] || null,
					},
					label: {
						text: document.querySelector("#bio-label")?.textContent?.trim() || null,
						color: styles.match(/#bio-label\s*\{[^}]*color:\s*([^;]+)/i)?.[1] || null,
					},
					about_me: {
						text: document.querySelector("#bio-aboutMe")?.textContent?.trim() || null,
						color: styles.match(/.bio-aboutMe\s*\{[^}]*color:\s*([^;]+)/i)?.[1] || null,
					},
					startPage: {
						text: document.querySelector("#bio-startText")?.textContent?.trim() || "",
						color: styles.match(/#bio-startText\s*\{[^}]*color:\s*([^;]+)/i)?.[1] || null,
					},
					views: document.querySelector("#profile-views-inner-container span.text-sm")?.textContent?.trim()?.replace(",", "") || null,
					badges: [
						...Array.from(document.querySelectorAll(".bio-badge"))
							.map((el: any) => {
								const parent = el.parentElement;
								const tippyContent = parent?.getAttribute("data-tippy-content");
								return tippyContent ? { name: tippyContent, icon: el.getAttribute("icon") } : null;
							})
							.filter(Boolean),
					],
					assets: {
						avatar: schemaJson?.mainEntity?.image ? (schemaJson?.mainEntity?.image?.startsWith("http") ? schemaJson.mainEntity.image : "https://drift.rip/" + schemaJson?.mainEntity?.image) : null,
						banner: styles.match(/.bio-banner-background\s*\{[^}]*background-image:\s*url\(['"]?([^'"]+)['"]?\)/i)?.[1] || null,
						background: (() => {
							const videoEl = document.querySelector("#video-background");
							const bg = test?.split('staticBackground.src = "')?.[1]?.split('"')[0] || videoEl?.getAttribute("src") || videoEl?.querySelector("source")?.getAttribute("src") || null;

							if (!bg) return null;
							return bg.startsWith("http") ? bg : "https://drift.rip" + (bg.startsWith("/") ? "" : "/") + bg;
						})(),
						audio: (() => {
							const aud = document.querySelector("#background-audio")?.getAttribute("src") || document.querySelector("#background-audio source")?.getAttribute("src") || (test?.includes("hasAudio = true") ? test?.split('audio.src = "')?.[1]?.split('"')[0] : null) || null;
							if (!aud) return null;
							return aud.startsWith("http") ? aud : "https://drift.rip" + (aud.startsWith("/") ? "" : "/") + aud;
						})(),
						cursor: styles.match(/cursor:\s*url\(['"]?([^'"]+)['"]?\)/i)?.[1] || null,
					},
					connections: [
						// Discord Users
						...Array.from(document.querySelectorAll("#profile-cards-section a[data-discord-user-json]")).map((el: any) => {
							const href = el.getAttribute("href") || "";
							const directUrl = href.includes("url=") ? decodeURIComponent(new URL(href).searchParams.get("url") || "") : href;
							let richContent: any = null;
							const rawJson = el.getAttribute("data-discord-user-json") || "";
							try {
								richContent = JSON.parse(rawJson);
							} catch {
								try {
									let fixed = rawJson;
									const openBraces = (fixed.match(/\{/g) || []).length - (fixed.match(/\}/g) || []).length;
									const openBrackets = (fixed.match(/\[/g) || []).length - (fixed.match(/\]/g) || []).length;
									if (!fixed.endsWith('"')) fixed += '"';
									for (let i = 0; i < openBrackets; i++) fixed += "]";
									for (let i = 0; i < openBraces; i++) fixed += "}";
									richContent = JSON.parse(fixed);
								} catch {}
							}
							const discordUserId = el.getAttribute("data-discord-user-id") || richContent?.userId || null;
							const imgEl = el.querySelector("img");
							return {
								type: "discordUser",
								text: richContent?.globalName || richContent?.username || el.querySelector(".module-titleText")?.textContent?.trim() || "",
								url: discordUserId ? `https://discord.com/users/${discordUserId}` : directUrl || null,
								tracking_url: href || null,
								icon_type: imgEl ? "image" : null,
								icon: imgEl?.getAttribute("src") || null,
								richContent,
							};
						}),

						...Array.from(document.querySelectorAll("#profile-cards-section a[data-guild-json]")).map((el: any) => {
							const href = el.getAttribute("href") || "";
							const directUrl = href.includes("url=") ? decodeURIComponent(new URL(href).searchParams.get("url") || "") : href;
							let richContent: any = null;
							try {
								richContent = JSON.parse(el.getAttribute("data-guild-json"));
							} catch {}
							const imgEl = el.querySelector("img");
							return {
								type: "discordServer",
								text: richContent?.serverName || el.querySelector(".module-titleText")?.textContent?.trim() || "",
								url: directUrl || null,
								tracking_url: href || null,
								icon_type: imgEl ? "image" : null,
								icon: imgEl?.getAttribute("src") || null,
								richContent,
							};
						}),

						...Array.from(document.querySelectorAll("#profile-cards-section a[data-fivem-id]")).map((el: any) => {
							const href = el.getAttribute("href") || "";
							const directUrl = href.includes("url=") ? decodeURIComponent(new URL(href).searchParams.get("url") || "") : href;
							const imgEl = el.querySelector("img");
							return {
								type: "fiveM",
								text: el.querySelector(".module-titleText")?.textContent?.trim() || "",
								url: directUrl || null,
								tracking_url: href || null,
								icon_type: imgEl ? "image" : null,
								icon: imgEl?.getAttribute("src") || null,
								richContent: { serverId: el.getAttribute("data-fivem-id") },
							};
						}),

						...Array.from(document.querySelectorAll("#profile-cards-section a[data-roblox-user-json]")).map((el: any) => {
							const href = el.getAttribute("href") || "";
							const directUrl = href.includes("url=") ? decodeURIComponent(new URL(href).searchParams.get("url") || "") : href;
							let richContent: any = null;
							try {
								richContent = JSON.parse(el.getAttribute("data-roblox-user-json"));
							} catch {}
							const imgEl = el.querySelector("img");
							return {
								type: "roblox",
								text: richContent?.username || el.querySelector(".module-titleText")?.textContent?.trim() || "",
								url: directUrl || (richContent?.profileId ? encodeURI("https://www.roblox.com/users/" + richContent?.profileId + "/profile") : null),
								tracking_url: href || (richContent?.profileId ? "https://drift.rip/go?ref=moduleInner&p=" + myProfileId + "&url=" + encodeURIComponent("https://www.roblox.com/users/" + richContent?.profileId + "/profile") : null),
								icon_type: imgEl ? "image" : null,
								icon: imgEl?.getAttribute("src") || null,
								richContent,
							};
						}),

						...Array.from(document.querySelectorAll("#section-profile-connections > a")).map((el: any) => {
							const href = el.getAttribute("href") || "";
							const directUrl = href.includes("url=") ? decodeURIComponent(new URL(href).searchParams.get("url") || "") : href;
							const iconEl = el.querySelector("iconify-icon");
							const imgEl = el.querySelector("img");
							const iconName = iconEl?.getAttribute("icon") || "";
							const platform = iconName.split(":")[1] || imgEl?.getAttribute("alt") || "unknown";
							const colorSocialText = (iconEl || imgEl)?.getAttribute("style")?.match(/color:\s*(#[0-9a-fA-F]{3,8})/)?.[1] || null;

							return {
								type: "social",
								text:
									el
										.getAttribute("data-tippy-content")
										?.replace(/<[^>]*>/g, "")
										?.trim() || platform,
								color: colorSocialText,
								url: directUrl || null,
								tracking_url: href || null,
								icon_type: iconEl ? "iconify" : imgEl ? "image" : null,
								icon: iconEl?.getAttribute("icon") || imgEl?.getAttribute("src") || null,
								richContent: null,
							};
						}),
					],
				},
				web: {
					webTitle: document.querySelector("head > title")?.textContent,
					webDesc: document.querySelector('head > meta[name="description"]')?.getAttribute("content"),
					title: document.querySelector('head > meta[property="og:title"]')?.getAttribute("content"),
					desc: document.querySelector('head > meta[property="og:description"]')?.getAttribute("content"),
					bannerUrl: document.querySelector('head > meta[property="og:image"]')?.getAttribute("content"),
					canonicalTitle: document.querySelector('h1[class="hdn"]')?.textContent,
					canonicalUrl: document.querySelector('head > link[rel="canonical"]')?.getAttribute("href"),
				},
			},
		};
	} catch (e) {
		console.error(e);
		return null;
	}
}

export async function PatreonProfile(query: string): Promise<any> {
	if (!query) return null;
	const username = query.split(/[?#]/)[0].split("/").filter(Boolean).pop();
	if (!username) return null;

	try {
		const res = await fetch(`https://www.patreon.com/cw/${username}`, {
			headers: commonHeaders,
		});

		if (res.status === 404) {
			return { error: "User not found" };
		}

		if (res.status !== 200) {
			return { data: null };
		}

		const html = await res.text();
		const chunks = html.split("self.__next_f.push(");
		chunks.shift();

		let campaignData: any = null;
		let userData: any = null;
		let mediaData: any[] = [];

		for (const chunk of chunks) {
			try {
				const endIdx = chunk.lastIndexOf(")</script>");
				if (endIdx === -1) continue;

				const pushArg = chunk.substring(0, endIdx);
				const parsed = JSON.parse(pushArg);

				if (!Array.isArray(parsed) || parsed[0] !== 1 || typeof parsed[1] !== "string") continue;

				const content = parsed[1];
				const lines = content.split("\n").filter((l: string) => l.trim());

				for (const line of lines) {
					const colonIdx = line.indexOf(":");
					if (colonIdx === -1) continue;

					const jsonPart = line.substring(colonIdx + 1);

					try {
						const innerParsed = JSON.parse(jsonPart);

						const traverse = (obj: any) => {
							if (!obj || typeof obj !== "object") return;

							if (obj.campaign && obj.campaign.data) {
								campaignData = obj.campaign.data;
							}
							if (obj.included && Array.isArray(obj.included)) {
								obj.included.forEach((inc: any) => {
									if (inc.type === "user") userData = inc;
									if (inc.type === "media") mediaData.push(inc);
								});
							}

							if (Array.isArray(obj)) {
								obj.forEach(traverse);
							} else {
								Object.values(obj).forEach(traverse);
							}
						};

						traverse(innerParsed);
					} catch {}
				}
			} catch {}
		}

		return {
			data: {
				campaigns: campaignData,
				media: mediaData,
				user: userData,
			},
		};
	} catch (e) {
		console.error("PatreonProfile Error:", e);
		return null;
	}
}

export async function SaweriaProfile(query: string, refresh_auth: boolean = false): Promise<any> {
	if (!query) return null;
	const username = query.split(/[?#]/)[0].split("/").filter(Boolean).pop();
	if (!username) return null;

	try {
		if (refresh_auth || !saweriaBuildId) {
			saweriaBuildId = await saweriaBuildKey();
		}

		if (!saweriaBuildId) {
			return {
				error: "Cloudflare Turnstile asking to verify you're not a bot",
			};
		}

		const dataRes = await fetch(`https://saweria.co/_next/data/${saweriaBuildId}/en/${username}.json`, {
			headers: commonHeaders,
		});

		if (dataRes.status === 403) {
			return {
				error: "Cloudflare Turnstile asking to verify you're not a bot",
			};
		}

		if (dataRes.status === 404 && !refresh_auth) {
			return await SaweriaProfile(query, true);
		}

		if (dataRes.status !== 200) {
			return { data: null };
		}

		const dataJson: any = await dataRes.json();
		if (dataJson?.pageProps?.error) {
			return {
				error: dataJson.pageProps.error?.json?.message || null,
			};
		}

		return { data: dataJson?.pageProps?.data || null };
	} catch (e) {
		console.error("SaweriaProfile Error:", e);
		return null;
	}
}

export async function TrakteerProfile(query: string): Promise<any> {
	if (!query) return null;
	const username = query.split(/[?#]/)[0].split("/").filter(Boolean).pop();
	if (!username || ["robots.txt", "favicon.ico", "login", "register", "forgot-password", "cdn-cgi", "terms", "privacy-policy", "auth", "search", "explore", "feed", "feature-and-pricing", "career"].includes(username.toLowerCase())) return null;

	try {
		const res = await fetch(`https://trakteer.id/${username}`, {
			headers: commonHeaders,
		});

		if (res.status === 403) {
			return {
				error: "Cloudflare Turnstile asking to verify you're not a bot",
			};
		}

		if (res.status === 404) {
			return { error: "User not found" };
		}

		if (res.status !== 200) {
			return { data: null };
		}

		const html = await res.text();
		const { document } = parseHTML(html);
		const appDiv = document.querySelector("#app");
		const dataPage = appDiv?.getAttribute("data-page");

		if (!dataPage) return { data: null };

		const decodedData = decodeHTML(dataPage);
		const dataJson = JSON.parse(decodedData);

		const creator = dataJson?.props?.creator;
		const extraCreator = dataJson?.props;
		return {
			data: creator
				? {
						...creator.data,
						...creator.meta,
						...extraCreator.extraCreatorData,
						...extraCreator.payload,
					}
				: null,
		};
	} catch (e) {
		console.error("TrakteerProfile Error:", e);
		return null;
	}
}

export async function SociaBuzzProfile(query: string): Promise<any> {
	if (!query) return null;
	const username = query.split(/[?#]/)[0].split("/").filter(Boolean).pop();
	if (!username) return null;

	try {
		const res = await fetch(`https://sociabuzz.com/${username}/tribe`, {
			redirect: "manual" as const,
			headers: commonHeaders,
		});

		if (res.status === 403) {
			return {
				error: "Cloudflare Turnstile asking to verify you're not a bot",
			};
		}

		if (res.status === 307) {
			return { error: "User not found" };
		}

		if (res.status !== 200) {
			return { data: null };
		}

		const html = await res.text();
		const match = html.match(/const userdata = (\{[\s\S]*?\});/);
		const userDataStr = match ? match[1] : null;
		if (!userDataStr) return { data: null };

		const dataJson = JSON.parse(userDataStr);
		return { data: dataJson || null };
	} catch (e) {
		console.error("SociaBuzzProfile Error:", e);
		return null;
	}
}

let gunsCookies: string | null = null;

export async function GunsProfile(query: string): Promise<any> {
	if (!query) return null;
	const username = query.split(/[?#]/)[0].split("/").filter(Boolean).pop()?.trim();
	if (!username || !/^[a-zA-Z0-9._-]+$/.test(username) || ["robots.txt", "favicon.ico", "register", "pricing", "login", "reset", "cdn-cgi", "account", "terms", "privacy", "dashboard", "leaderboard", "api", "de", "fr", "es", "tr", "ru", "pt", "ar"].includes(username.toLowerCase())) return null;

	let browserGuns: boolean = false;
	let dataResults: any[] = [];

	try {
		for (let retry = 0; retry < 2; retry++) {
			let res: any;
			browserGuns = false;

			for (let attempts = 0; attempts < 3; attempts++) {
				try {
					res = await (httpcloakGet as any)(`https://guns.lol/${username}`, {
						echConfigDomain: "cloudflare-ech.com",
						tlsOnly: true,
						headers: {
							...commonHeaders,
							...(gunsCookies ? { cookie: gunsCookies } : {}),
						},
					});

					const status = responseStatus(res);

					if (status === 429) {
						return { error: "Rate-limited" };
					}

					const html = await responseText(res);
					const { document: doc } = parseHTML(html);
					const pageTitle = doc.querySelector("title")?.textContent?.trim() || "";
					const isChallenge = status === 401 || status === 403 || status === 429 || pageTitle === "Just a moment...";

					if (!isChallenge) {
						break;
					}

					if (attempts === 2) {
						const browserRes = await browserRequest({
							url: `https://guns.lol/${username}`,
							fetcherType: "stealthy",
							headers: commonHeaders,
							extractHtml: true,
						});

						if (browserRes.status === 429) {
							return { error: "Rate-limited" };
						}

						const browserChallenge = !browserRes.success || browserRes.status === 401 || browserRes.status === 403;

						if (browserChallenge) {
							return { error: "Guns.lol asking to verify you're not a bot" };
						}

						if (browserRes.cookies && Object.keys(browserRes.cookies).length > 0) {
							gunsCookies = Object.entries(browserRes.cookies)
								.map(([key, val]) => `${key}=${val}`)
								.join("; ");
						}

						res = {
							status: browserRes.status ?? 200,
							text: browserRes.html ?? "",
							url: browserRes.url ?? `https://guns.lol/${username}`,
							headers: browserRes.headers ?? {},
						};

						browserGuns = true;
					}
				} catch (e) {
					console.error(e);
					if (attempts === 2) throw e;
				}
			}

			try {
				const html = await responseText(res);
				if (responseStatus(res) !== 200) {
					if (retry === 0) {
						continue;
					}
					return { data: null };
				}

				// Split on self.__next_f.push( to get all RSC chunks
				const chunks = html.split("self.__next_f.push(");
				chunks.shift(); // Remove the part before the first push

				dataResults = [];

				for (const chunk of chunks) {
					try {
						// Each chunk looks like: [1,"ID:content\n"])</script>

						const endIdx = chunk.lastIndexOf(")</script>");
						if (endIdx === -1) continue;

						const pushArg = chunk.substring(0, endIdx);
						const parsed = JSON.parse(pushArg);

						if (!Array.isArray(parsed) || parsed[0] !== 1 || typeof parsed[1] !== "string") continue;

						const content = parsed[1];

						const lines = content.split("\n").filter((l: string) => l.trim());

						for (const line of lines) {
							const colonIdx = line.indexOf(":");
							if (colonIdx === -1) continue;

							const jsonPart = line.substring(colonIdx + 1);
							if (!jsonPart.includes('"data"')) continue;

							try {
								const innerParsed = JSON.parse(jsonPart);

								if (Array.isArray(innerParsed)) {
									for (const item of innerParsed) {
										if (item && typeof item === "object" && !Array.isArray(item) && "data" in item) {
											dataResults.push(item.data);
										}
									}
								} else if (innerParsed && typeof innerParsed === "object" && "data" in innerParsed) {
									dataResults.push(innerParsed.data);
								}
							} catch {}
						}
					} catch {}
				}

				if (dataResults.length === 0 && browserGuns) {
					if (retry === 0) {
						await new Promise((resolve) => setTimeout(resolve, 1000));
						continue;
					}
					return {
						error: "Can't process this due Guns.lol sent empty response",
					};
				}

				break;
			} catch (e) {
				console.error(e);
				if (retry === 0) {
					continue;
				}
				throw e;
			}
		}

		if (dataResults.length === 0) {
			return { data: null };
		}

		const finalresult: any = dataResults[0];

		const { _gpp_ch, success, session: _session, ...rest } = finalresult;
		let secfinal: any = rest;
		if (secfinal?.config?.socials?.[0]) {
			secfinal.config.valid_socials = secfinal.config.socials
				?.map((a: any) => {
					try {
						new URL(a.value);
						return a;
					} catch {}
				})
				?.filter(Boolean);
		}

		return { data: secfinal };
	} catch (e) {
		console.error(e);
		return null;
	}
}

export async function RageProfile(query: string): Promise<any> {
	if (!query) return null;
	const username = query.split(/[?#]/)[0].split("/").filter(Boolean).pop();
	if (!username || ["robots.txt", "favicon.ico", "leaderboards", "pricing", "docs", "auth", "cdn-cgi", "terms", "privacy", "copyright", "docs", "dashboard", "main_og.png", "extra.css"].includes(username.toLowerCase())) return null;

	let res: any;

	for (let attempts = 0; attempts < 3; attempts++) {
		try {
			res = await fetch(`https://rage.wtf/${username}`, {
				headers: commonHeaders,
			});

			if (res.status !== 403) {
				break;
			}

			if (attempts === 2) {
				return { error: "Rage.wtf asking to verify you're not a bot" };
			}
		} catch (e) {
			if (attempts === 2) throw e;
		}
	}

	try {
		const html = await res.text();
		if (res.status !== 200) {
			return { data: null };
		}

		const chunks = html.split("self.__next_f.push(");
		chunks.shift();

		const dataResults: any[] = [];

		for (const chunk of chunks) {
			try {
				const endIdx = chunk.lastIndexOf(")</script>");
				if (endIdx === -1) continue;

				const pushArg = chunk.substring(0, endIdx);
				const parsed = JSON.parse(pushArg);

				if (!Array.isArray(parsed) || parsed[0] !== 1 || typeof parsed[1] !== "string") continue;

				const content = parsed[1];
				const lines = content.split("\n").filter((l: string) => l.trim());

				for (const line of lines) {
					const colonIdx = line.indexOf(":");
					if (colonIdx === -1) continue;

					const jsonPart = line.substring(colonIdx + 1);
					if (!jsonPart.includes('"user"') || !jsonPart.includes('"customization"')) continue;

					try {
						const innerParsed = JSON.parse(jsonPart);

						const findProfile = (obj: any): any => {
							if (!obj || typeof obj !== "object") return null;
							if (obj.user && obj.customization) return obj;

							if (Array.isArray(obj)) {
								for (const item of obj) {
									const result = findProfile(item);
									if (result) return result;
								}
							} else {
								for (const key in obj) {
									const result = findProfile(obj[key]);
									if (result) return result;
								}
							}
							return null;
						};

						const profile = findProfile(innerParsed);
						if (profile) {
							dataResults.push(profile);
						}
					} catch {}
				}
			} catch {}
		}

		if (dataResults.length === 0) {
			return { data: null };
		}

		return { data: dataResults[0] };
	} catch (e) {
		console.error(e);
		return null;
	}
}

export async function HauntProfile(query: string): Promise<any> {
	if (!query) return null;
	const username = query.split(/[?#]/)[0].split("/").filter(Boolean).pop();
	if (!username || ["robots.txt", "favicon.ico", "login", "register", "pricing", "cdn-cgi", "terms", "privacy", "copyright", "dashboard", "settings", "api", "leaderboard", "checkout", "marketplace", "redeem", "en", "de", "ru", "es", "fr", "pt", "ar", "it"].includes(username.toLowerCase())) return null;

	let res: any;

	for (let attempts = 0; attempts < 3; attempts++) {
		try {
			res = await fetch(`https://haunt.gg/${username}`, {
				headers: commonHeaders,
			});

			if (res.status !== 403) {
				break;
			}

			if (attempts === 2) {
				return { error: "Haunt.gg asking to verify you're not a bot" };
			}
		} catch (e) {
			if (attempts === 2) throw e;
		}
	}

	try {
		const html = await res.text();
		if (res.status !== 200) {
			return { data: null };
		}

		const chunks = html.split("self.__next_f.push(");
		chunks.shift();

		const rscEntries: Record<string, any> = {};
		let pendingText: {
			key: string;
			length: number;
			value: string;
			byteLength: number;
		} | null = null;

		const parseRscValue = (value: string): any => {
			try {
				return JSON.parse(value);
			} catch {}
			if (/^[A-Z]/.test(value)) {
				try {
					return JSON.parse(value.slice(1));
				} catch {}
			}
			return value;
		};

		const findProfile = (obj: any): any => {
			if (!obj || typeof obj !== "object") return null;
			if (obj.user && obj.links) return obj;

			if (Array.isArray(obj)) {
				for (const item of obj) {
					const result = findProfile(item);
					if (result) return result;
				}
			} else {
				for (const key in obj) {
					const result = findProfile(obj[key]);
					if (result) return result;
				}
			}
			return null;
		};

		const takeUtf8Prefix = (text: string, maxBytes: number) => {
			let byteLength = 0;
			let end = 0;
			while (end < text.length) {
				const codePoint = text.codePointAt(end);
				if (codePoint === undefined) break;

				const char = String.fromCodePoint(codePoint);
				const charBytes = Buffer.byteLength(char, "utf8");
				if (byteLength + charBytes > maxBytes) break;

				byteLength += charBytes;
				end += char.length;
			}

			return { value: text.slice(0, end), byteLength };
		};

		const processRscContent = (content: string) => {
			let index = 0;
			while (index < content.length) {
				if (pendingText) {
					const needed = pendingText.length - pendingText.byteLength;
					const textChunk = takeUtf8Prefix(content.slice(index), needed);
					if (!textChunk.value && needed > 0) break;
					pendingText.value += textChunk.value;
					pendingText.byteLength += textChunk.byteLength;
					index += textChunk.value.length;

					if (pendingText.byteLength >= pendingText.length) {
						rscEntries[pendingText.key] = pendingText.value;
						pendingText = null;
					}
					if (index >= content.length) break;
				}

				const nextLineIdx = content.indexOf("\n", index);
				const line = nextLineIdx === -1 ? content.slice(index) : content.slice(index, nextLineIdx);
				index = nextLineIdx === -1 ? content.length : nextLineIdx + 1;
				if (!line.trim()) continue;

				const colonIdx = line.indexOf(":");
				if (colonIdx === -1) continue;

				const key = line.slice(0, colonIdx);
				const value = line.slice(colonIdx + 1);
				const textMatch = value.match(/^T([0-9a-f]+),$/i);
				if (textMatch) {
					pendingText = {
						key,
						length: parseInt(textMatch[1], 16),
						value: "",
						byteLength: 0,
					};
					continue;
				}

				rscEntries[key] = parseRscValue(value);
			}
		};

		for (const chunk of chunks) {
			try {
				const endIdx = chunk.lastIndexOf(")</script>");
				if (endIdx === -1) continue;

				const pushArg = chunk.substring(0, endIdx);
				const parsed = JSON.parse(pushArg);

				if (!Array.isArray(parsed) || parsed[0] !== 1 || typeof parsed[1] !== "string") continue;

				processRscContent(parsed[1]);
			} catch {}
		}

		const dataResults = Object.values(rscEntries)
			.map((entry) => findProfile(entry))
			.filter(Boolean);

		if (dataResults.length === 0) {
			return { data: null };
		}

		const getRscPathValue = (value: any, pathParts: string[]): any => {
			let current = value;
			for (const part of pathParts) {
				if (part === "props" && Array.isArray(current)) {
					current = current[3];
				} else if (/^\d+$/.test(part) && Array.isArray(current)) {
					current = current[Number(part)];
				} else if (current && typeof current === "object") {
					current = current[part];
				} else {
					return undefined;
				}
			}
			return current;
		};

		const resolveRscRefs = (value: any, depth = 0, resolving = new Set<string>()): any => {
			if (depth > 80) return value;
			if (typeof value === "string") {
				const refMatch = value.match(/^\$([0-9a-f]+)(?::(.+))?$/i);
				if (!refMatch) return value;

				const [, refKey, refPath] = refMatch;
				const resolvingKey = `${refKey}:${refPath || ""}`;
				if (!(refKey in rscEntries) || resolving.has(resolvingKey)) return value;

				resolving.add(resolvingKey);
				const target = refPath ? getRscPathValue(rscEntries[refKey], refPath.split(":")) : rscEntries[refKey];
				const resolved = target === undefined ? value : resolveRscRefs(target, depth + 1, resolving);
				resolving.delete(resolvingKey);
				return resolved;
			}

			if (Array.isArray(value)) return value.map((item) => resolveRscRefs(item, depth + 1, resolving));
			if (value && typeof value === "object") {
				const resolved: Record<string, any> = {};
				for (const key of Object.keys(value)) {
					resolved[key] = resolveRscRefs(value[key], depth + 1, resolving);
				}
				return resolved;
			}
			return value;
		};

		const counters: Record<string, number> = {};
		const collectCounters = (obj: any) => {
			if (!obj || typeof obj !== "object") return;
			if (!Array.isArray(obj)) {
				const label = typeof obj.tooltipLabel === "string" ? obj.tooltipLabel : typeof obj.content === "string" ? obj.content : null;
				if (label && typeof obj.count === "number") {
					const key = label
						.trim()
						.toLowerCase()
						.replace(/[^a-z0-9]+([a-z0-9])/g, (_match: string, char: string) => char.toUpperCase());
					counters[key] = obj.count;
				}
			}

			const values = Array.isArray(obj) ? obj : Object.values(obj);
			for (const value of values) collectCounters(value);
		};

		for (const entry of Object.values(rscEntries)) collectCounters(entry);

		const finalresult: any = resolveRscRefs(dataResults[0]);
		if (!finalresult?.user) return { data: null };

		return {
			data: finalresult,
		};
	} catch (e) {
		console.error(e);
		return null;
	}
}

function formatDiscordApplicationInstallParams(params: any) {
	if (!params || typeof params !== "object") return params;
	const formatted = { ...params };
	if (formatted.permissions !== undefined && formatted.permissions !== null) {
		const resolvedArray = resolvePermissions(formatted.permissions);
		formatted.permissions_resolved = {
			array: resolvedArray,
			string: resolvedArray.join(", "),
		};
	}
	return formatted;
}

function formatDiscordApiError(req: { status: number; statusText: string }, data: any) {
	return { status: req.status, statusText: req.statusText, data };
}

function discordCdnExtension(hash: string) {
	return hash.startsWith("a_") ? "gif" : "png";
}

function formatDiscordUser(user: any) {
	if (!user || typeof user !== "object") return user;
	const formatted = { ...user };

	if (formatted.avatar && formatted.id) {
		formatted.avatar_url = `https://cdn.discordapp.com/avatars/${formatted.id}/${formatted.avatar}.${discordCdnExtension(formatted.avatar)}?size=4096`;
	}
	if (formatted.banner && formatted.id) {
		formatted.banner_url = `https://cdn.discordapp.com/banners/${formatted.id}/${formatted.banner}.${discordCdnExtension(formatted.banner)}?size=4096`;
	}
	if (formatted.public_flags !== undefined) formatted.badges = resolveFlags(formatted.public_flags);
	if (formatted.flags !== undefined) formatted.badges_raw = resolveFlags(formatted.flags);
	if (formatted.id) formatted.created_at = String(getSnowflakeDate(formatted.id));

	return formatted;
}

function formatDiscordGuild(guild: any) {
	if (!guild || typeof guild !== "object") return guild;
	const formatted = { ...guild };

	if (formatted.icon && formatted.id) {
		formatted.icon_url = `https://cdn.discordapp.com/icons/${formatted.id}/${formatted.icon}.${discordCdnExtension(formatted.icon)}?size=4096`;
	}
	if (formatted.banner && formatted.id) {
		formatted.banner_url = `https://cdn.discordapp.com/banners/${formatted.id}/${formatted.banner}.${discordCdnExtension(formatted.banner)}?size=4096`;
	}
	if (formatted.splash && formatted.id) {
		formatted.splash_url = `https://cdn.discordapp.com/splashes/${formatted.id}/${formatted.splash}.${discordCdnExtension(formatted.splash)}?size=4096`;
	}
	if (formatted.discovery_splash && formatted.id) {
		formatted.discovery_splash_url = `https://cdn.discordapp.com/discovery-splashes/${formatted.id}/${formatted.discovery_splash}.${discordCdnExtension(formatted.discovery_splash)}?size=4096`;
	}
	if (formatted.home_header && formatted.id) {
		formatted.home_header_url = `https://cdn.discordapp.com/home-headers/${formatted.id}/${formatted.home_header}.png?size=4096`;
	}
	if (Array.isArray(formatted.emojis)) {
		formatted.emojis = formatted.emojis.map((emoji: any) => ({
			...emoji,
			url: emoji.id ? `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "png"}?size=4096` : null,
			created_at: emoji.id ? String(getSnowflakeDate(emoji.id)) : null,
		}));
	}
	if (Array.isArray(formatted.stickers)) {
		formatted.stickers = formatted.stickers.map((sticker: any) => {
			const ext = sticker.format_type === 4 ? "gif" : sticker.format_type === 3 ? "json" : "png";
			return {
				...sticker,
				url: sticker.id ? `https://cdn.discordapp.com/stickers/${sticker.id}.${ext}?size=4096` : null,
				created_at: sticker.id ? String(getSnowflakeDate(sticker.id)) : null,
			};
		});
	}
	if (formatted.id) formatted.created_at = String(getSnowflakeDate(formatted.id));

	return formatted;
}

function formatDiscordDiscovery(discovery: any) {
	if (!discovery || typeof discovery !== "object") return discovery;
	return {
		...discovery,
		guild: formatDiscordGuild(discovery.guild),
	};
}

function formatDiscordApplication(app: any) {
	if (!app || typeof app !== "object") return app;
	const formatted = { ...app };

	if (formatted.guild_id) {
		const guild = formatted.guild && typeof formatted.guild === "object" ? formatted.guild : {};
		formatted.guild = formatDiscordGuild({
			...guild,
			id: guild.id || formatted.guild_id,
		});
		delete formatted.guild_id;
	} else if (formatted.guild) {
		formatted.guild = formatDiscordGuild(formatted.guild);
	}

	if (formatted.icon) {
		formatted.icon_url = `https://cdn.discordapp.com/app-icons/${formatted.id}/${formatted.icon}.${discordCdnExtension(formatted.icon)}?size=4096`;
	}
	if (formatted.cover_image) {
		formatted.cover_image_url = `https://cdn.discordapp.com/app-icons/${formatted.id}/${formatted.cover_image}.png?size=4096`;
	}
	if (formatted.bot) formatted.bot = formatDiscordUser(formatted.bot);
	if (formatted.owner) formatted.owner = formatDiscordUser(formatted.owner);
	if (formatted.team && typeof formatted.team === "object") {
		formatted.team = {
			...formatted.team,
			...(formatted.team.icon
				? {
						icon_url: `https://cdn.discordapp.com/team-icons/${formatted.team.id}/${formatted.team.icon}.png?size=4096`,
					}
				: {}),
			members: Array.isArray(formatted.team.members)
				? formatted.team.members.map((member: any) => ({
						...member,
						user: formatDiscordUser(member.user),
					}))
				: formatted.team.members,
		};
	}

	const resolvedFlags = resolveApplicationFlags(formatted.flags_new ?? formatted.flags);
	formatted.flags_resolved = {
		array: resolvedFlags,
		string: resolvedFlags.join(", "),
	};

	let applicationFlags = 0n;
	try {
		applicationFlags = BigInt(String(formatted.flags_new ?? formatted.flags ?? 0));
	} catch {}
	formatted.intents = {
		presence: (applicationFlags & ((1n << 12n) | (1n << 13n))) !== 0n,
		server_members: (applicationFlags & ((1n << 14n) | (1n << 15n))) !== 0n,
		message_content: (applicationFlags & ((1n << 18n) | (1n << 19n))) !== 0n,
	};
	formatted.verified_intents = {
		presence: (applicationFlags & (1n << 12n)) !== 0n,
		server_members: (applicationFlags & (1n << 14n)) !== 0n,
		message_content: (applicationFlags & (1n << 18n)) !== 0n,
	};

	if (formatted.install_params) {
		formatted.install_params = formatDiscordApplicationInstallParams(formatted.install_params);
	}

	if (formatted.integration_types_config && typeof formatted.integration_types_config === "object") {
		formatted.integration_types_config = Object.fromEntries(
			Object.entries(formatted.integration_types_config).map(([key, config]: [string, any]) => {
				const typeId = Number(key);
				return [
					key,
					{
						...config,
						type: {
							id: typeId,
							name: DISCORD_APPLICATION_INTEGRATION_TYPES[typeId] || "UNKNOWN",
						},
						oauth2_install_params: formatDiscordApplicationInstallParams(config?.oauth2_install_params),
					},
				];
			}),
		);
	}

	formatted.created_at = formatted.id ? String(getSnowflakeDate(formatted.id)) : null;
	if (formatted.bot?.id) formatted.bot.created_at = String(getSnowflakeDate(formatted.bot.id));

	return formatted;
}

function resolvePermissions(permissions: string | bigint | null | undefined): string[] {
	if (!permissions) return [];
	const p = typeof permissions === "string" ? BigInt(permissions) : permissions;
	const resolved: string[] = [];

	if ((p & DISCORD_PERMISSIONS["Administrator"]!) === DISCORD_PERMISSIONS["Administrator"]!) {
		return ["Administrator"];
	}

	for (const [name, bit] of Object.entries(DISCORD_PERMISSIONS)) {
		if ((p & bit) === bit) {
			resolved.push(name);
		}
	}
	return resolved;
}

function getMemberPermissions(
	member: any,
	rolesData: any[],
	guildData: any,
	guildId: string,
): {
	permissions: string;
	permissions_resolved: { array: string[]; string: string };
} {
	const ownerId = guildData?.owner_id;
	const everyoneRole = rolesData.find((r: any) => r.id === guildId);
	let permissions = BigInt(everyoneRole?.permissions || "0");

	const userId = member.user?.id || member.id;

	if (userId === ownerId) {
		permissions = 0x7fffffffffffffn;
	} else if (member.roles) {
		for (const roleId of member.roles) {
			const role = rolesData.find((r: any) => r.id === roleId);
			if (role) {
				permissions |= BigInt(role.permissions);
			}
		}
		if ((permissions & DISCORD_PERMISSIONS["Administrator"]!) === DISCORD_PERMISSIONS["Administrator"]!) {
			permissions = 0x7fffffffffffffn;
		}
	}

	const resolvedArray = resolvePermissions(permissions);
	return {
		permissions: permissions.toString(),
		permissions_resolved: {
			array: resolvedArray,
			string: resolvedArray.join(", "),
		},
	};
}

const getSnowflakeDate = (id: string) => {
	try {
		return Math.floor(Number((BigInt(id) >> 22n) + 1420070400000n) / 1000);
	} catch {
		return null;
	}
};

async function discordListCache(token: string, url: string, headers: any): Promise<DiscordListCacheValue> {
	const key = `${token}:${url}`;
	const now = Date.now();
	const cached = discordObj[key];

	if (cached) {
		if (cached.expiresAt > now) return cached.value;
		delete discordObj[key];
	}

	const activeFetch = discordListCacheFetches[key];
	if (activeFetch) return await activeFetch;

	const fetchCache = (async (): Promise<DiscordListCacheValue> => {
		const req = await discordFetch(url, { headers });
		let data: any = null;
		try {
			data = await req.json();
		} catch {}

		const value = { status: req.status, statusText: req.statusText, data };
		if (req.status === 200) {
			discordObj[key] = {
				expiresAt: Date.now() + DISCORD_LIST_CACHE_TTL,
				value,
			};
		}

		return value;
	})();

	discordListCacheFetches[key] = fetchCache;

	try {
		return await fetchCache;
	} finally {
		delete discordListCacheFetches[key];
	}
}

function discordListMembersCacheKey(token: string, guildId: string) {
	return `${token}:guild:${guildId}:members:all`;
}

function getDiscordListMembersCache(token: string, guildId: string): any[] | null {
	const key = discordListMembersCacheKey(token, guildId);
	const cached = discordObj[key];

	if (!cached) return null;
	if (cached.expiresAt <= Date.now()) {
		delete discordObj[key];
		return null;
	}

	return Array.isArray(cached.value.data) ? cached.value.data : null;
}

function getDiscordListMembersPartialCache(token: string, guildId: string): any[] | null {
	const key = discordListMembersCacheKey(token, guildId);
	const cached = discordListMemberPartialObj[key];

	if (!cached) return null;
	if (cached.expiresAt <= Date.now()) {
		delete discordListMemberPartialObj[key];
		return null;
	}

	return Array.isArray(cached.value.data) ? cached.value.data : null;
}

async function discordListMembersCache(token: string, guildId: string, headers: any) {
	const cacheKey = discordListMembersCacheKey(token, guildId);
	if (getDiscordListMembersCache(token, guildId)) return;

	let data: any[] = [];
	let lastMemberId: string | null = null;

	while (true) {
		let urlMembers = `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`;
		if (lastMemberId) urlMembers += `&after=${lastMemberId}`;

		const req = await discordListCache(token, urlMembers, headers);
		if (req.status !== 200 || !Array.isArray(req.data)) return;

		const batch = req.data;
		data.push(...batch);
		discordListMemberPartialObj[cacheKey] = {
			expiresAt: Date.now() + DISCORD_LIST_CACHE_TTL,
			value: { status: 200, statusText: "OK", data },
		};

		if (batch.length < 1000) break;

		lastMemberId = batch[batch.length - 1].user?.id;
		if (!lastMemberId) return;
	}

	discordObj[cacheKey] = {
		expiresAt: Date.now() + DISCORD_LIST_CACHE_TTL,
		value: { status: 200, statusText: "OK", data },
	};
	delete discordListMemberPartialObj[cacheKey];
}

function discordListMembersCacheLater(token: string, guildId: string, headers: any) {
	const cacheKey = discordListMembersCacheKey(token, guildId);
	if (getDiscordListMembersCache(token, guildId) || discordListMemberFetches[cacheKey]) return;

	discordListMemberFetches[cacheKey] = discordListMembersCache(token, guildId, headers)
		.catch(() => {})
		.finally(() => {
			delete discordListMemberFetches[cacheKey];
		});
}

async function ensureDiscordListMembersCache(token: string, guildId: string, headers: any): Promise<any[] | null> {
	const cacheKey = discordListMembersCacheKey(token, guildId);
	const cached = getDiscordListMembersCache(token, guildId);
	if (cached) return cached;

	if (!discordListMemberFetches[cacheKey]) {
		discordListMembersCacheLater(token, guildId, headers);
	}

	await discordListMemberFetches[cacheKey];
	return getDiscordListMembersCache(token, guildId);
}

export const DiscordInfoMember = async (token: string, userId: string, guildId?: string) => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!userId) return { error: "Missing userId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
	};

	try {
		const url = guildId ? `https://discord.com/api/v10/guilds/${guildId}/members/${userId}` : `https://discord.com/api/v10/users/${userId}`;

		const urlRoles = guildId ? `https://discord.com/api/v10/guilds/${guildId}/roles` : null;
		const urlGuild = guildId ? `https://discord.com/api/v10/guilds/${guildId}` : null;

		const urlDMs = `https://discord.com/api/v10/users/@me/channels`;

		const [req, rolesReq, guildReq, dmReq] = await Promise.all([
			discordFetch(url, { headers }),
			urlRoles ? discordFetch(urlRoles, { headers }) : Promise.resolve(null),
			urlGuild ? discordFetch(urlGuild, { headers }) : Promise.resolve(null),
			discordFetch(urlDMs, {
				method: "POST",
				headers,
				body: JSON.stringify({ recipient_id: userId }),
			}),
		]);

		let data: any = null;
		let rolesData: any = [];
		let guildData: any = null;
		let dmData: any = null;

		try {
			data = await req.json();
		} catch {}
		try {
			if (rolesReq && rolesReq.status === 200) rolesData = await rolesReq.json();
		} catch {}
		try {
			if (guildReq && guildReq.status === 200) guildData = await guildReq.json();
		} catch {}
		try {
			if (dmReq && dmReq.status === 200) dmData = await dmReq.json();
		} catch {}

		if (req.status !== 200) {
			return {
				data: null,
				error: data || { status: req.status, statusText: req.statusText },
			};
		}

		const userData = guildId ? data.user : data;

		const flagsBadges = resolveFlags(userData?.flags);
		const publicFlagsBadges = resolveFlags(userData?.public_flags);

		const avatarUrl = userData?.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.${userData.avatar.startsWith("a_") ? "gif" : "png"}?size=4096` : null;
		const bannerUrl = userData?.banner ? `https://cdn.discordapp.com/banners/${userData.id}/${userData.banner}.${userData.banner.startsWith("a_") ? "gif" : "png"}?size=4096` : null;

		const guildAvatarUrl = guildId && data.avatar ? `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/avatars/${data.avatar}.${data.avatar.startsWith("a_") ? "gif" : "png"}?size=4096` : null;

		const perms = guildId ? getMemberPermissions(data, rolesData, guildData, guildId) : {};

		const result: any = {
			_warning: "Using this endpoint can put your bot (discord) rate-limits faster",
			dmChannelId: dmData?.id || null,
			...data,
			...perms,
			avatar_url: guildAvatarUrl || avatarUrl,
			banner_url: bannerUrl,
			badges: publicFlagsBadges,
			badges_raw: flagsBadges,
			joined_at: data.joined_at ? String(Math.floor(new Date(data.joined_at).getTime() / 1000)) : null,
			premium_since: data.premium_since ? String(Math.floor(new Date(data.premium_since).getTime() / 1000)) : null,
			created_at: userData?.id ? String(getSnowflakeDate(userData.id)) : null,
		};

		return { data: result };
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const DiscordInfoApp = async (token: string | null, botId: string) => {
	if (!botId) return { error: "Missing botId" };

	const headers: any = {
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
	};
	if (token) headers["Authorization"] = `Bot ${token}`;

	try {
		const url = `https://discord.com/api/v10/applications/${botId}/rpc?with_guild_counts=true`;
		const req = await discordFetch(url, { headers });
		let data: any = null;
		try {
			data = await req.json();
		} catch {}

		if (req.status !== 200) {
			return {
				data: null,
				error: data || { status: req.status, statusText: req.statusText },
			};
		}

		const urlDirectory = `https://discord.com/api/v10/application-directory-static/applications/${botId}`;
		const urlSimilar = `https://discord.com/api/v10/application-directory-static/applications/${botId}/similar`;
		const urlStoreLayout = `https://discord.com/api/v10/applications/${botId}/store-layout`;
		const [directoryReq, similarReq, storeLayoutReq] = await Promise.all([discordFetch(urlDirectory, { headers }), discordFetch(urlSimilar, { headers }), discordFetch(urlStoreLayout, { headers })]);

		let directoryData: any = null;
		let similarData: any = null;
		let storeLayoutData: any = null;
		try {
			directoryData = await directoryReq.json();
		} catch {}
		try {
			similarData = await similarReq.json();
		} catch {}
		try {
			storeLayoutData = await storeLayoutReq.json();
		} catch {}

		data = formatDiscordApplication(data);
		const directory = directoryReq.status === 200 ? formatDiscordApplication(directoryData) : null;
		const guildId = data.guild?.id || directory?.guild?.id;

		if (guildId) {
			const urlGuildPreview = `https://discord.com/api/v10/guilds/${guildId}/preview`;
			const urlGuildDirectory = `https://discord.com/api/v10/discovery/${guildId}`;
			const urlGuildRichContent = `https://discord.com/api/guilds/${guildId}/widget.json`;
			const [guildPreviewReq, guildDirectoryReq, guildRichContentReq] = await Promise.all([discordFetch(urlGuildPreview, { headers }), discordFetch(urlGuildDirectory, { headers }), discordFetch(urlGuildRichContent, { headers })]);

			let guildPreviewData: any = null;
			let guildDirectoryData: any = null;
			let guildRichContentData: any = null;
			try {
				guildPreviewData = await guildPreviewReq.json();
			} catch {}
			try {
				guildDirectoryData = await guildDirectoryReq.json();
			} catch {}
			try {
				guildRichContentData = await guildRichContentReq.json();
			} catch {}

			data.guild = {
				id: guildId,
				preview:
					guildPreviewReq.status === 200
						? formatDiscordGuild(guildPreviewData)
						: {
								error: formatDiscordApiError(guildPreviewReq, guildPreviewData),
							},
				directory:
					guildDirectoryReq.status === 200
						? formatDiscordDiscovery(guildDirectoryData)
						: {
								error: formatDiscordApiError(guildDirectoryReq, guildDirectoryData),
							},
				richContent:
					guildRichContentReq.status === 200
						? guildRichContentData
						: {
								error: formatDiscordApiError(guildRichContentReq, guildRichContentData),
							},
				directory_alt: directory?.guild ? formatDiscordGuild(directory.guild) : {},
			};
		}

		if (directory) {
			const { guild, ...directoryWithoutGuild } = directory;
			data.directory = directoryWithoutGuild;
		} else
			data.directory = {
				error: formatDiscordApiError(directoryReq, directoryData),
			};

		if (similarReq.status === 200 && similarData) {
			data.similar = Array.isArray(similarData.applications) ? similarData.applications.map(formatDiscordApplication) : similarData.applications;
		} else {
			data.similar = { error: formatDiscordApiError(similarReq, similarData) };
		}

		if (storeLayoutReq.status === 200 && storeLayoutData) data.store_layout = storeLayoutData;
		else
			data.store_layout = {
				error: formatDiscordApiError(storeLayoutReq, storeLayoutData),
			};

		const countSources = [data, directory].filter(Boolean);
		const firstCount = (key: string) => countSources.find((source) => source[key] !== undefined && source[key] !== null)?.[key];
		data.serverCount = firstCount("approximate_guild_count") ?? directory?.directory_entry?.guild_count ?? 0;

		return {
			_warning: "Using this endpoint with token can put your bot (discord) rate-limits faster",
			data,
		};
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const DiscordInfoClient = async (token: string | null) => {
	if (!token) return { error: "Missing token" };

	const headers: any = {
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
		Authorization: `Bot ${token}`,
	};

	try {
		const validateReq = await discordFetch("https://discord.com/api/v10/users/@me/channels", { headers });
		if (validateReq.status !== 200) {
			const errData = await validateReq.json().catch(() => null);
			return {
				data: null,
				error: errData || {
					status: validateReq.status,
					statusText: validateReq.statusText,
				},
			};
		}

		const [req2, req3, req4] = await Promise.all([
			DiscordInfoApp(token, atob(token.split(".")[0])),
			discordFetch("https://discord.com/api/v10/oauth2/applications/@me", {
				headers,
			}),
			discordFetch("https://discord.com/api/v10/users/@me/guilds", { headers }),
		]);
		const [dmChannels, data2, data3, guilds] = [await validateReq.json(), await req2, await req3.json(), await req4.json()];
		const resolvedGuilds = (Array.isArray(guilds) ? guilds : []).map((g: any) => {
			const formatted = formatDiscordGuild(g);
			formatted.permissions_resolved = g.permissions ? resolvePermissions(g.permissions) : [];
			return formatted;
		});
		return {
			_warning: "Using this endpoint can put your bot (discord) rate-limits faster",
			data: {
				dmChannels,
				oauth2: data3,
				public_client: data2.data,
				guilds: resolvedGuilds,
			},
		};
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const DiscordListMember = async (token: string, guildId: string, limit: number = 10, type: string = "all", permission: string = "all") => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!guildId) return { error: "Missing guildId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
	};

	try {
		const types = type.split(",").map((t) => t.trim());
		const isBannedRequested = types.includes("banned");
		const isSpecial = types.some((t) => ["oldest", "newest", "no_role", "has_role"].includes(t));

		const targetLimit = isSpecial ? Math.max(1000, limit) : limit === -1 ? 1000 : limit;

		const urlRoles = `https://discord.com/api/v10/guilds/${guildId}/roles`;
		const urlGuild = `https://discord.com/api/v10/guilds/${guildId}`;
		const [rolesReq, guildReq] = await Promise.all([discordListCache(token, urlRoles, headers), discordListCache(token, urlGuild, headers)]);

		let rolesData: any = [];
		let guildData: any = null;
		if (rolesReq.status === 200) rolesData = rolesReq.data;
		if (guildReq.status === 200) guildData = guildReq.data;

		const memberCacheKey = discordListMembersCacheKey(token, guildId);
		let memberCacheBuilding = !!discordListMemberFetches[memberCacheKey];
		let cachedMembers = isBannedRequested && types.length === 1 ? null : getDiscordListMembersCache(token, guildId);
		if (!cachedMembers && !(isBannedRequested && types.length === 1)) {
			const partialMembers = getDiscordListMembersPartialCache(token, guildId);
			if (partialMembers && (isSpecial || partialMembers.length >= targetLimit)) {
				cachedMembers = partialMembers;
			}

			if (!cachedMembers && !memberCacheBuilding) {
				discordListMembersCacheLater(token, guildId, headers);
				memberCacheBuilding = !!discordListMemberFetches[memberCacheKey];
			}
		}

		let data: any[] = [];
		let cachedMembersCount = cachedMembers?.length ?? 0;
		if (cachedMembers) {
			data = isSpecial ? cachedMembers.slice() : cachedMembers.slice(0, targetLimit);
		} else {
			let lastMemberId: string | null = null;
			let membersFetchRemaining = isBannedRequested && types.length === 1 ? 0 : targetLimit;

			while (membersFetchRemaining > 0) {
				const currentFetchLimit = Math.min(membersFetchRemaining, 1000);
				const fetchLimit = memberCacheBuilding && !lastMemberId && currentFetchLimit < 1000 ? 1000 : currentFetchLimit;
				let urlMembers = `https://discord.com/api/v10/guilds/${guildId}/members?limit=${fetchLimit}`;
				if (lastMemberId) urlMembers += `&after=${lastMemberId}`;

				const req = await discordListCache(token, urlMembers, headers);
				if (req.status !== 200) break;

				const batch = req.data;
				if (!Array.isArray(batch) || batch.length === 0) break;
				const usedBatch = batch.slice(0, currentFetchLimit);

				data.push(...usedBatch);
				lastMemberId = batch[batch.length - 1].user?.id;
				membersFetchRemaining -= usedBatch.length;
				if (batch.length < fetchLimit || usedBatch.length < currentFetchLimit) break;
			}
			cachedMembersCount = data.length;
		}

		let bansData: any[] = [];
		if (isBannedRequested) {
			let lastBanId: string | null = null;
			let bansFetchRemaining = targetLimit;

			while (bansFetchRemaining > 0) {
				const currentFetchLimit = Math.min(bansFetchRemaining, 1000);
				let urlBans = `https://discord.com/api/v10/guilds/${guildId}/bans?limit=${currentFetchLimit}`;
				if (lastBanId) urlBans += `&after=${lastBanId}`;

				const req = await discordListCache(token, urlBans, headers);
				if (req.status !== 200) break;

				const batch = req.data;
				if (!Array.isArray(batch) || batch.length === 0) break;

				bansData.push(...batch);
				lastBanId = batch[batch.length - 1].user?.id;
				bansFetchRemaining -= batch.length;
				if (batch.length < currentFetchLimit) break;
			}
		}

		if (data.length === 0 && bansData.length === 0 && !isBannedRequested) {
			return {
				data: null,
				error: { message: "Failed to fetch members or bans" },
			};
		}

		const mappedBans = bansData.map((ban: any) => ({
			...ban.user,
			roles: [],
			joined_at: null,
			premium_since: null,
			is_banned: true,
			ban_reason: ban.reason,
			created_at: ban.user?.id ? String(getSnowflakeDate(ban.user.id)) : null,
		}));

		if (types.length === 1 && types[0] === "banned") {
			data = mappedBans;
		} else if (isBannedRequested) {
			data = [...data, ...mappedBans];
		}

		if (Array.isArray(data)) {
			data = data.map((member: any, index: number) => {
				const perms = member.is_banned ? { permissions: "0" } : getMemberPermissions(member, rolesData, guildData, guildId);
				return {
					...member,
					position: index + 1,
					...perms,
					joined_at: member.joined_at ? String(Math.floor(new Date(member.joined_at).getTime() / 1000)) : null,
					premium_since: member.premium_since ? String(Math.floor(new Date(member.premium_since).getTime() / 1000)) : null,
					created_at: member.user?.id ? String(getSnowflakeDate(member.user.id)) : null,
				};
			});

			if (permission !== "all") {
				const requestedPerms = permission.split(",").map((p) => p.trim().toLowerCase());
				const permBits = requestedPerms.map((p) => PERMISSION_KEYS[p]).filter((b) => b !== undefined) as bigint[];

				if (permBits.length > 0) {
					data = data.filter((member: any) => {
						const memberPerms = BigInt(member.permissions);

						if ((memberPerms & DISCORD_PERMISSIONS["Administrator"]!) === DISCORD_PERMISSIONS["Administrator"]!) return true;

						return permBits.every((bit) => (memberPerms & bit) === bit);
					});
				}
			}

			const botsCount = data.filter((member: any) => member.user?.bot || member.bot).length;
			const usersCount = data.filter((member: any) => !member.user?.bot && !member.bot).length;

			for (const t of types) {
				if (t === "user") {
					data = data.filter((member: any) => !member.user?.bot && !member.bot);
				} else if (t === "bot") {
					data = data.filter((member: any) => member.user?.bot || member.bot);
				} else if (t === "no_role") {
					data = data.filter((member: any) => !member.roles || member.roles.length === 0);
				} else if (t === "has_role") {
					data = data.filter((member: any) => member.roles && member.roles.length > 0);
				} else if (t === "oldest") {
					data.sort((a: any, b: any) => Number(a.joined_at || 0) - Number(b.joined_at || 0));
				} else if (t === "newest") {
					data.sort((a: any, b: any) => Number(b.joined_at || 0) - Number(a.joined_at || 0));
				}
			}

			if (isSpecial) {
				data = data.slice(0, limit);
			}

			return {
				_warning: "Using this endpoint can put your bot (discord) rate-limits faster",
				botsCount,
				usersCount,
				cachedMembersCount,
				limit: limit,
				data,
			};
		}

		return { cachedMembersCount, data };
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const DiscordListMemberRole = async (token: string, guildId: string, roleId: string, type: string = "all", permission: string = "all") => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!guildId) return { error: "Missing guildId" };
	if (!roleId) return { error: "Missing roleId" };

	const roleIds = roleId
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean);
	if (roleIds.length === 0) return { error: "Missing roleId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
	};

	try {
		const urlRoles = `https://discord.com/api/v10/guilds/${guildId}/roles`;
		const urlGuild = `https://discord.com/api/v10/guilds/${guildId}`;
		const cachedMembers = await ensureDiscordListMembersCache(token, guildId, headers);

		const [rolesReq, guildReq] = await Promise.all([discordListCache(token, urlRoles, headers), discordListCache(token, urlGuild, headers)]);

		let rolesData: any = [];
		let guildData: any = null;
		if (rolesReq.status === 200) rolesData = rolesReq.data;
		if (guildReq.status === 200) guildData = guildReq.data;

		if (!cachedMembers) {
			return {
				data: null,
				error: { message: "Failed to fetch members" },
			};
		}

		const altData = Array.isArray(rolesData)
			? roleIds
					.map((id) => rolesData.find((role: any) => role.id === id))
					.filter(Boolean)
					.map((role: any) => {
						const members = cachedMembers
							.filter((member: any) => Array.isArray(member.roles) && member.roles.includes(role.id))
							.map((member: any) => member.user?.id)
							.filter(Boolean);
						const resolvedArray = resolvePermissions(role.permissions);

						return {
							...role,
							membersCount: members.length,
							members,
							permissions_resolved: {
								array: resolvedArray,
								string: resolvedArray.join(", "),
							},
							created_at: role.id ? String(getSnowflakeDate(role.id)) : null,
						};
					})
			: [];

		const cachedMembersCount = cachedMembers.length;
		const types = type.split(",").map((t) => t.trim());
		let data = cachedMembers.map((member: any, index: number) => ({ ...member, position: index + 1 })).filter((member: any) => Array.isArray(member.roles) && roleIds.some((id) => member.roles.includes(id)));

		data = data.map((member: any) => {
			const perms = getMemberPermissions(member, rolesData, guildData, guildId);
			return {
				...member,
				...perms,
				joined_at: member.joined_at ? String(Math.floor(new Date(member.joined_at).getTime() / 1000)) : null,
				premium_since: member.premium_since ? String(Math.floor(new Date(member.premium_since).getTime() / 1000)) : null,
				created_at: member.user?.id ? String(getSnowflakeDate(member.user.id)) : null,
			};
		});

		if (permission !== "all") {
			const requestedPerms = permission.split(",").map((p) => p.trim().toLowerCase());
			const permBits = requestedPerms.map((p) => PERMISSION_KEYS[p]).filter((b) => b !== undefined) as bigint[];

			if (permBits.length > 0) {
				data = data.filter((member: any) => {
					const memberPerms = BigInt(member.permissions);
					if ((memberPerms & DISCORD_PERMISSIONS["Administrator"]!) === DISCORD_PERMISSIONS["Administrator"]!) return true;
					return permBits.every((bit) => (memberPerms & bit) === bit);
				});
			}
		}

		const botsCount = data.filter((member: any) => member.user?.bot || member.bot).length;
		const usersCount = data.filter((member: any) => !member.user?.bot && !member.bot).length;

		for (const t of types) {
			if (t === "user") {
				data = data.filter((member: any) => !member.user?.bot && !member.bot);
			} else if (t === "bot") {
				data = data.filter((member: any) => member.user?.bot || member.bot);
			} else if (t === "oldest") {
				data.sort((a: any, b: any) => Number(a.joined_at || 0) - Number(b.joined_at || 0));
			} else if (t === "newest") {
				data.sort((a: any, b: any) => Number(b.joined_at || 0) - Number(a.joined_at || 0));
			} else if (t === "oldest_position") {
				data.sort((a: any, b: any) => Number(a.position || 0) - Number(b.position || 0));
			} else if (t === "newest_position") {
				data.sort((a: any, b: any) => Number(b.position || 0) - Number(a.position || 0));
			}
		}

		return {
			botsCount,
			usersCount,
			membersCount: data.length,
			cachedMembersCount,
			data,
			altData,
		};
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const DiscordListRole = async (token: string, guildId: string, limit: number = 10, type: string = "all", permission: string = "all") => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!guildId) return { error: "Missing guildId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
	};

	try {
		const urlRoles = `https://discord.com/api/v10/guilds/${guildId}/roles`;
		const urlMembers = `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`;
		const memberCacheKey = discordListMembersCacheKey(token, guildId);
		let memberCacheBuilding = !!discordListMemberFetches[memberCacheKey];
		let cachedMembers = getDiscordListMembersCache(token, guildId);
		if (!cachedMembers) {
			cachedMembers = getDiscordListMembersPartialCache(token, guildId);
			if (!cachedMembers && !memberCacheBuilding) {
				discordListMembersCacheLater(token, guildId, headers);
				memberCacheBuilding = !!discordListMemberFetches[memberCacheKey];
			}
		}

		const membersReqPromise: Promise<DiscordListCacheValue> = cachedMembers ? Promise.resolve({ status: 200, statusText: "OK", data: cachedMembers }) : discordListCache(token, urlMembers, headers);

		const [rolesReq, membersReq] = await Promise.all([discordListCache(token, urlRoles, headers), membersReqPromise]);

		let rolesData: any = [];
		let membersData: any = [];

		if (rolesReq.status === 200) rolesData = rolesReq.data;
		if (membersReq.status === 200) membersData = membersReq.data;
		const cachedRolesCount = Array.isArray(rolesData) ? rolesData.length : 0;

		if (rolesReq.status !== 200) {
			return {
				data: null,
				error: rolesData || {
					status: rolesReq.status,
					statusText: rolesReq.statusText,
				},
			};
		}

		if (Array.isArray(rolesData)) {
			const totalRoles = rolesData.length;

			rolesData = rolesData.map((role: any) => {
				const members = membersData.filter((m: any) => m.roles.includes(role.id)).map((m: any) => m.user?.id);

				return {
					...role,
					membersCount: members.length,
					members,
					created_at: role.id ? String(getSnowflakeDate(role.id)) : null,
				};
			});

			if (permission !== "all") {
				const requestedPerms = permission.split(",").map((p) => p.trim().toLowerCase());
				const permBits = requestedPerms.map((p) => PERMISSION_KEYS[p]).filter((b) => b !== undefined) as bigint[];

				if (permBits.length > 0) {
					rolesData = rolesData.filter((role: any) => {
						const rolePerms = BigInt(role.permissions);
						if ((rolePerms & DISCORD_PERMISSIONS["Administrator"]!) === DISCORD_PERMISSIONS["Administrator"]!) return true;
						return permBits.every((bit) => (rolePerms & bit) === bit);
					});
				}
			}

			const types = type.split(",").map((t) => t.trim());
			for (const t of types) {
				if (t === "oldest") {
					rolesData.sort((a: any, b: any) => Number(a.created_at || 0) - Number(b.created_at || 0));
				} else if (t === "newest") {
					rolesData.sort((a: any, b: any) => Number(b.created_at || 0) - Number(a.created_at || 0));
				}
			}

			rolesData = rolesData.map((role: any) => {
				const resolvedArray = resolvePermissions(role.permissions);
				return {
					...role,
					permissions_resolved: {
						array: resolvedArray,
						string: resolvedArray.join(", "),
					},
					created_at: role.id ? String(getSnowflakeDate(role.id)) : null,
				};
			});

			rolesData = rolesData.slice(0, limit);

			return {
				_warning: "Using this endpoint can put your bot (discord) rate-limits faster",
				rolesCount: totalRoles,
				cachedRolesCount,
				limit: limit,
				data: rolesData,
			};
		}

		return { cachedRolesCount, data: rolesData };
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const DiscordListChannel = async (token: string, guildId: string, limit: number = 10, type: string = "all") => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!guildId) return { error: "Missing guildId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
	};

	try {
		const urlChannels = `https://discord.com/api/v10/guilds/${guildId}/channels`;
		const urlThreads = `https://discord.com/api/v10/guilds/${guildId}/threads/active`;

		const [reqChannels, reqThreads] = await Promise.all([discordFetch(urlChannels, { headers }), discordFetch(urlThreads, { headers })]);

		let channelsData: any = [];
		let threadsData: any = { threads: [] };

		if (reqChannels.status === 200) {
			try {
				channelsData = await reqChannels.json();
			} catch {}
		}
		if (reqThreads.status === 200) {
			try {
				threadsData = await reqThreads.json();
			} catch {}
		}

		let data = [...(Array.isArray(channelsData) ? channelsData : []), ...(Array.isArray(threadsData.threads) ? threadsData.threads : [])];

		if (data.length === 0 && reqChannels.status !== 200) {
			return {
				data: null,
				error: channelsData || {
					status: reqChannels.status,
					statusText: reqChannels.statusText,
				},
			};
		}

		if (Array.isArray(data)) {
			data = data.map((channel: any) => ({
				...channel,
				type: {
					id: channel.type,
					name: DISCORD_CHANNEL_TYPES[channel.type] || "unknown",
				},
				permission_overwrites: Array.isArray(channel.permission_overwrites)
					? channel.permission_overwrites.map((o: any) => {
							const allowResolved = resolvePermissions(o.allow);
							const denyResolved = resolvePermissions(o.deny);
							return {
								...o,
								allow_resolved: {
									array: allowResolved,
									string: allowResolved.join(", "),
								},
								deny_resolved: {
									array: denyResolved,
									string: denyResolved.join(", "),
								},
							};
						})
					: channel.permission_overwrites,
				created_at: channel.id ? String(getSnowflakeDate(channel.id)) : null,
			}));

			const types = type.split(",").map((t) => t.trim().toLowerCase());

			const totalChannel: any = {
				text: 0,
				voice: 0,
				category: 0,
				announcement: 0,
				announcement_thread: 0,
				public_thread: 0,
				private_thread: 0,
				stage: 0,
				directory: 0,
				forum: 0,
				media: 0,
				all: data.length,
			};

			data.forEach((channel: any) => {
				const typeName = channel.type.name;
				if (typeName && totalChannel[typeName] !== undefined) {
					totalChannel[typeName]++;
				}
			});

			if (!types.includes("all")) {
				data = data.filter((channel: any) => {
					const typeName = channel.type.name;
					if (typeName && types.includes(typeName)) return true;
					if (types.includes("threads") && [10, 11, 12].includes(channel.type.id)) return true;
					return false;
				});
			}

			const sliceLimit = limit === -1 ? data.length : limit;
			data = data.slice(0, sliceLimit);

			return {
				_warning: "Using this endpoint can put your bot (discord) rate-limits faster",
				data,
				totalChannel,
			};
		}
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const DiscordInfoServer = async (token: string, guildId: string) => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!guildId) return { error: "Missing guildId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
	};

	try {
		let botId: string | null = null;
		try {
			botId = Buffer.from(token.split(".")[0], "base64").toString();
		} catch {}

		const url = `https://discord.com/api/v10/guilds/${guildId}?with_counts=true`;
		const urlWebhooks = `https://discord.com/api/v10/guilds/${guildId}/webhooks`;
		const urlChannels = `https://discord.com/api/v10/guilds/${guildId}/channels`;
		const urlClientMember = botId ? `https://discord.com/api/v10/guilds/${guildId}/members/${botId}` : null;

		const [req, webhooksReq, channelsReq, clientMemberReq] = await Promise.all([discordFetch(url, { headers }), discordFetch(urlWebhooks, { headers }), discordFetch(urlChannels, { headers }), urlClientMember ? discordFetch(urlClientMember, { headers }) : Promise.resolve(null)]);

		let data: any = null;
		let webhooksData: any = [];
		let channelsData: any = [];
		let clientMemberData: any = null;

		try {
			data = await req.json();
		} catch {}
		try {
			if (webhooksReq.status === 200) webhooksData = await webhooksReq.json();
		} catch {}
		try {
			if (channelsReq.status === 200) channelsData = await channelsReq.json();
		} catch {}
		try {
			if (clientMemberReq && clientMemberReq.status === 200) clientMemberData = await clientMemberReq.json();
		} catch {}

		if (req.status !== 200) {
			return {
				data: null,
				error: data || { status: req.status, statusText: req.statusText },
			};
		}

		if (data.icon) {
			data.icon_url = `https://cdn.discordapp.com/icons/${data.id}/${data.icon}.${data.icon.startsWith("a_") ? "gif" : "png"}?size=4096`;
		}
		if (data.banner) {
			data.banner_url = `https://cdn.discordapp.com/banners/${data.id}/${data.banner}.${data.banner.startsWith("a_") ? "gif" : "png"}?size=4096`;
		}
		if (data.discovery_splash) {
			data.discovery_splash_url = `https://cdn.discordapp.com/discovery-splashes/${data.id}/${data.discovery_splash}.png?size=4096`;
		}
		if (data.splash) {
			data.splash_url = `https://cdn.discordapp.com/splashes/${data.id}/${data.splash}.png?size=4096`;
		}
		if (data.home_header) {
			data.home_header_url = `https://cdn.discordapp.com/home-headers/${data.id}/${data.home_header}.png?size=4096`;
		}

		if (data.roles) {
			data.roles = data.roles.map((r: any) => ({
				...r,
				created_at: r.id ? String(getSnowflakeDate(r.id)) : null,
			}));
		}
		if (data.emojis) {
			data.emojis = data.emojis.map((e: any) => ({
				...e,
				created_at: e.id ? String(getSnowflakeDate(e.id)) : null,
			}));
		}
		if (data.stickers) {
			data.stickers = data.stickers.map((s: any) => ({
				...s,
				created_at: s.id ? String(getSnowflakeDate(s.id)) : null,
			}));
		}

		if (Array.isArray(webhooksData)) {
			data.webhooks = webhooksData.map((w: any) => ({
				...w,
				created_at: w.id ? String(getSnowflakeDate(w.id)) : null,
			}));
		} else {
			data.webhooks = [];
		}

		const totalChannel: any = {
			text: 0,
			voice: 0,
			category: 0,
			announcement: 0,
			announcement_thread: 0,
			public_thread: 0,
			private_thread: 0,
			stage: 0,
			directory: 0,
			forum: 0,
			media: 0,
			all: 0,
		};

		if (Array.isArray(channelsData)) {
			totalChannel.all = channelsData.length;
			channelsData.forEach((channel: any) => {
				const typeName = DISCORD_CHANNEL_TYPES[channel.type];
				if (typeName) {
					totalChannel[typeName]++;
				}
			});

			data.channels = {
				totalChannel,
				data: channelsData.map((channel: any) => ({
					...channel,
					type: {
						id: channel.type,
						name: DISCORD_CHANNEL_TYPES[channel.type] || "unknown",
					},
					permission_overwrites: Array.isArray(channel.permission_overwrites)
						? channel.permission_overwrites.map((o: any) => {
								const allowResolved = resolvePermissions(o.allow);
								const denyResolved = resolvePermissions(o.deny);
								return {
									...o,
									allow_resolved: {
										array: allowResolved,
										string: allowResolved.join(", "),
									},
									deny_resolved: {
										array: denyResolved,
										string: denyResolved.join(", "),
									},
								};
							})
						: channel.permission_overwrites,
					created_at: channel.id ? String(getSnowflakeDate(channel.id)) : null,
				})),
			};
		} else {
			data.channels = {
				totalChannel,
				data: [],
			};
		}

		if (clientMemberData) {
			const userData = clientMemberData.user;
			const flagsBadges = resolveFlags(userData?.flags);
			const publicFlagsBadges = resolveFlags(userData?.public_flags);

			const avatarUrl = userData?.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.${userData.avatar.startsWith("a_") ? "gif" : "png"}?size=4096` : null;
			const bannerUrl = userData?.banner ? `https://cdn.discordapp.com/banners/${userData.id}/${userData.banner}.${userData.banner.startsWith("a_") ? "gif" : "png"}?size=4096` : null;
			const guildAvatarUrl = guildId && clientMemberData.avatar ? `https://cdn.discordapp.com/guilds/${guildId}/users/${userData.id}/avatars/${clientMemberData.avatar}.${clientMemberData.avatar.startsWith("a_") ? "gif" : "png"}?size=4096` : null;

			const perms = getMemberPermissions(clientMemberData, data.roles, data, guildId);

			data.client = {
				...clientMemberData,
				...perms,
				avatar_url: guildAvatarUrl || avatarUrl,
				banner_url: bannerUrl,
				badges: publicFlagsBadges,
				badges_raw: flagsBadges,
				joined_at: clientMemberData.joined_at ? String(Math.floor(new Date(clientMemberData.joined_at).getTime() / 1000)) : null,
				premium_since: clientMemberData.premium_since ? String(Math.floor(new Date(clientMemberData.premium_since).getTime() / 1000)) : null,
				created_at: userData?.id ? String(getSnowflakeDate(userData.id)) : null,
			};
		}

		data.created_at = data.id ? String(getSnowflakeDate(data.id)) : null;

		return {
			_warning: "Using this endpoint can put your bot (discord) rate-limits faster",
			data,
		};
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

const stickerCache = new Map<string, any>();

export const DiscordInfoSticker = async (token: string, q: string) => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!q) return { error: "Missing sticker ID or URL" };

	const match = q.match(/(?:cdn\.discordapp\.com\/stickers\/|discord\.com\/stickers\/)?(\d+)/);
	const stickerId = match ? match[1] : q;

	if (stickerCache.has(stickerId)) return { data: stickerCache.get(stickerId) };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
	};

	try {
		const url = `https://discord.com/api/v10/stickers/${stickerId}`;
		const req = await discordFetch(url, { headers });

		let data: any = null;
		try {
			data = await req.json();
		} catch {}

		if (req.status !== 200) {
			return {
				data: null,
				error: data || { status: req.status, statusText: req.statusText },
			};
		}

		if (data) {
			data.created_at = String(getSnowflakeDate(data.id));
			const ext = data.format_type === 4 ? "gif" : data.format_type === 3 ? "json" : "png";
			data.url = `https://cdn.discordapp.com/stickers/${data.id}.${ext}`;

			if (data.guild_id && token) {
				const guildRes = await DiscordInfoServer(token, data.guild_id);
				if (guildRes?.data) {
					data.guild = guildRes.data;
					data.guild.resultsType = "full";
				} else {
					try {
						const previewUrl = `https://discord.com/api/v10/guilds/${data.guild_id}/preview`;
						const previewReq = await discordFetch(previewUrl, {
							headers,
						});
						if (previewReq.status === 200) {
							const previewData: any = await previewReq.json();
							if (previewData) {
								previewData.icon_url = previewData.icon ? `https://cdn.discordapp.com/icons/${previewData.id}/${previewData.icon}.${previewData.icon.startsWith("a_") ? "gif" : "png"}?size=4096` : null;
								previewData.splash_url = previewData.splash ? `https://cdn.discordapp.com/splashes/${previewData.id}/${previewData.splash}.png?size=4096` : null;
								previewData.discovery_splash_url = previewData.discovery_splash ? `https://cdn.discordapp.com/discovery-splashes/${previewData.id}/${previewData.discovery_splash}.png?size=4096` : null;
								previewData.home_header_url = previewData.home_header ? `https://cdn.discordapp.com/home-headers/${previewData.id}/${previewData.home_header}.png?size=4096` : null;
								previewData.created_at = String(getSnowflakeDate(previewData.id));
								data.guild = previewData;
								data.guild.resultsType = "preview";
							} else {
								data.guild = {};
							}
						} else {
							data.guild = {};
						}
					} catch {}
				}

				if (!data.user) {
					try {
						const guildStickersUrl = `https://discord.com/api/v10/guilds/${data.guild_id}/stickers`;
						const gsReq = await discordFetch(guildStickersUrl, {
							headers,
						});
						if (gsReq.status === 200) {
							const stickers: any[] = (await gsReq.json()) as any;
							const found = stickers.find((st) => st.id === data.id);
							if (found && found.user) {
								data.user = found.user;
							}
						}
					} catch {}
				}
			}

			if (data.user) {
				const u = data.user;
				u.created_at = String(getSnowflakeDate(u.id));
				u.avatar_url = u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith("a_") ? "gif" : "png"}?size=4096` : null;
			} else {
				data.user = {};
			}
			stickerCache.set(stickerId, data);
		}

		return { data };
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

type DiscordCreateStickerPayload = {
	url: string;
	name: string;
	description?: string;
	tags?: string;
	reason?: string;
};

export const DiscordCreateSticker = async (token: string, guildId: string, payload: DiscordCreateStickerPayload) => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!guildId) return { error: "Missing guildId" };
	if (!payload.url) return { error: "Missing sticker URL" };

	const name = payload.name?.trim() || "";
	const description = payload.description ?? "";
	const tags = payload.tags?.trim() || name;

	if (name.length < 2 || name.length > 30) return { error: "Sticker name must be 2-30 characters" };
	if (description.length === 1 || description.length > 100) return { error: "Sticker description must be empty or 2-100 characters" };
	if (!tags || tags.length > 200) return { error: "Sticker tags must be 1-200 characters" };

	let stickerUrl: URL;
	try {
		stickerUrl = new URL(payload.url);
		if (stickerUrl.protocol !== "http:" && stickerUrl.protocol !== "https:") throw new Error();
	} catch {
		return { error: "Invalid sticker URL" };
	}

	try {
		const source = await fetch(stickerUrl, {
			headers: {
				Accept: "image/png,image/apng,image/gif,image/jpeg,image/webp,application/json,*/*;q=0.8",
				"User-Agent": userAgent,
			},
		});

		if (!source.ok) {
			return {
				data: null,
				error: {
					message: "Failed to download sticker file",
					status: source.status,
					statusText: source.statusText,
				},
			};
		}

		const rawContentType = source.headers.get("content-type")?.split(";")[0]?.toLowerCase() || "";
		const pathExt = stickerUrl.pathname.split(".").pop()?.toLowerCase() || "";
		const shouldConvertToPng = DISCORD_STICKER_CONVERT_MIME_TO_PNG.has(rawContentType) || DISCORD_STICKER_CONVERT_EXT_TO_PNG.has(pathExt);
		const sourceLimit = shouldConvertToPng ? DISCORD_STICKER_MAX_CONVERT_INPUT_BYTES : DISCORD_STICKER_MAX_BYTES;
		const contentLength = Number(source.headers.get("content-length") || 0);
		if (contentLength > sourceLimit) {
			return {
				error: `Sticker file is too large. Max ${sourceLimit} bytes${shouldConvertToPng ? " before conversion" : ""}`,
			};
		}

		const extFromUrl = !shouldConvertToPng && DISCORD_STICKER_EXT_TO_MIME[pathExt] ? pathExt : "";
		const extFromType = DISCORD_STICKER_MIME_TO_EXT[rawContentType] || "";
		const ext = shouldConvertToPng ? "png" : extFromUrl || extFromType;
		const mimeType = shouldConvertToPng ? "image/png" : DISCORD_STICKER_EXT_TO_MIME[ext] || (DISCORD_STICKER_MIME_TO_EXT[rawContentType] ? rawContentType : "");

		if (!ext || !mimeType) {
			return {
				error: "Unsupported sticker file type. Use PNG, APNG, GIF, Lottie JSON, JPEG, or WebP",
			};
		}

		const arrayBuffer = await source.arrayBuffer();
		if (arrayBuffer.byteLength > sourceLimit) {
			return {
				error: `Sticker file is too large. Max ${sourceLimit} bytes${shouldConvertToPng ? " before conversion" : ""}`,
			};
		}

		let fileBytes = new Uint8Array(arrayBuffer);
		if (shouldConvertToPng) {
			try {
				const sharp = (await import("sharp")).default;
				fileBytes = new Uint8Array(await sharp(Buffer.from(fileBytes)).rotate().png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer());
			} catch (err: any) {
				return {
					error: `Failed to convert sticker image to PNG: ${err?.message || err}`,
				};
			}
		}

		if (fileBytes.byteLength > DISCORD_STICKER_MAX_BYTES) {
			return {
				error: `Sticker file is too large after conversion. Max ${DISCORD_STICKER_MAX_BYTES} bytes`,
			};
		}

		const filenameBase = name.replace(/[^a-zA-Z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "") || "sticker";
		const form = new FormData();
		form.append("name", name);
		form.append("description", description);
		form.append("tags", tags);
		form.append("file", new Blob([fileBytes], { type: mimeType }), `${filenameBase}.${ext}`);

		const headers: any = {
			Authorization: `Bot ${token}`,
			"User-Agent": discordUserAgent,
		};
		if (payload.reason) headers["X-Audit-Log-Reason"] = encodeURIComponent(payload.reason);

		const response = await discordFetch(`https://discord.com/api/v10/guilds/${guildId}/stickers`, {
			method: "POST",
			headers,
			body: form,
		});

		let result: any = null;
		try {
			result = await response.json();
		} catch {}

		if (response.status < 200 || response.status >= 300) {
			return {
				data: null,
				error: result || {
					status: response.status,
					statusText: response.statusText,
				},
			};
		}

		if (result?.id) {
			result.created_at = String(getSnowflakeDate(result.id));
			const resultExt = result.format_type === 4 ? "gif" : result.format_type === 3 ? "json" : ext;
			result.url = `https://cdn.discordapp.com/stickers/${result.id}.${resultExt}`;
			stickerCache.set(result.id, result);
		}

		return { data: [result || true, null, response.status] };
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const DiscordDeleteSticker = async (token: string, guildId: string, stickerId: string) => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!guildId) return { error: "Missing guildId" };
	if (!stickerId) return { error: "Missing stickerId" };
	if (!/^\d+$/.test(guildId) || !/^\d+$/.test(stickerId)) return { error: "Invalid guildId or stickerId" };

	try {
		const response = await discordFetch(`https://discord.com/api/v10/guilds/${guildId}/stickers/${stickerId}`, {
			method: "DELETE",
			headers: {
				Authorization: `Bot ${token}`,
				"User-Agent": discordUserAgent,
			},
		});

		let result: any = null;
		if (response.status !== 204) {
			try {
				result = await response.json();
			} catch {}
		}

		if (response.status < 200 || response.status >= 300) {
			return {
				data: null,
				error: result || {
					status: response.status,
					statusText: response.statusText,
				},
			};
		}

		stickerCache.delete(stickerId);
		return { data: [result || true, null, response.status] };
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

const processDiscordMessage = async (m: any, token?: string) => {
	if (!m) return m;

	if (m.timestamp) {
		m.created_at = String(Math.floor(new Date(m.timestamp).getTime() / 1000));
		delete m.timestamp;
	}
	if (m.hasOwnProperty("edited_timestamp")) {
		if (m.edited_timestamp) {
			m.edited_at = String(Math.floor(new Date(m.edited_timestamp).getTime() / 1000));
		} else {
			m.edited_at = null;
		}
		delete m.edited_timestamp;
	}

	if (Array.isArray(m.sticker_items)) {
		for (let i = 0; i < m.sticker_items.length; i++) {
			const s = m.sticker_items[i];
			const ext = s.format_type === 4 ? "gif" : s.format_type === 3 ? "json" : "png";
			s.url = `https://cdn.discordapp.com/stickers/${s.id}.${ext}`;

			if (token) {
				const res = await DiscordInfoSticker(token, s.id);
				if (res?.data) {
					m.sticker_items[i] = { ...s, ...res.data };
				}
			}
		}
	} else {
		m.sticker_items = [];
	}

	const emojiRegex = /<(a?):(\w+):(\d+)>/g;
	const emojiItems = [];
	let match;
	while ((match = emojiRegex.exec(m.content)) !== null) {
		const animated = match[1] === "a";
		const name = match[2];
		const id = match[3];
		emojiItems.push({
			id,
			name,
			animated,
			url: `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}?size=4096`,
		});
	}
	m.emoji_items = emojiItems;

	const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
	const hyperlinkItems: any[] = [];
	const seenUrls = new Set();

	if (m.content) {
		let mdMatch;
		while ((mdMatch = mdLinkRegex.exec(m.content)) !== null) {
			const alt = mdMatch[1];
			const url = mdMatch[2];
			const normalizedUrl = url.replace(/\/$/, "");
			const richContent = m.embeds?.find((e: any) => e.url && e.url.replace(/\/$/, "") === normalizedUrl);
			hyperlinkItems.push({
				alt,
				url,
				richContent: richContent || null,
			});
			seenUrls.add(url);
		}

		const bareUrlRegex = /(?:^|\s)(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
		let bareMatch;
		while ((bareMatch = bareUrlRegex.exec(m.content)) !== null) {
			const url = bareMatch[1];
			if (seenUrls.has(url)) continue;
			const normalizedUrl = url.replace(/\/$/, "");
			const richContent = m.embeds?.find((e: any) => e.url && e.url.replace(/\/$/, "") === normalizedUrl);
			hyperlinkItems.push({
				alt: null,
				url,
				richContent: richContent || null,
			});
			seenUrls.add(url);
		}
	}
	m.hyperlink_items = hyperlinkItems;

	if (m.author && m.author.id) {
		m.author.created_at = String(getSnowflakeDate(m.author.id));
	}

	return m;
};

export const DiscordInfoMessages = async (token: string, channelId: string, sort: "asc" | "desc" = "desc", limit: number = 50) => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!channelId) return { error: "Missing channelId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
	};

	try {
		let url = `https://discord.com/api/v10/channels/${channelId}/messages`;
		const params: string[] = [];

		if (sort === "asc") params.push("after=0");
		if (limit) params.push(`limit=${limit}`);

		if (params.length > 0) url += "?" + params.join("&");

		const req = await discordFetch(url, { headers });

		let data: any = null;
		try {
			data = await req.json();
		} catch {}

		if (req.status !== 200) {
			return {
				data: null,
				error: data || { status: req.status, statusText: req.statusText },
			};
		}

		if (Array.isArray(data)) {
			data = await Promise.all(data.map((m) => processDiscordMessage(m, token)));
		}

		return {
			_warning: "Using this endpoint can put your bot (discord) rate-limits faster",
			limit,
			data,
		};
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const DiscordInfoMessage = async (token: string, channelId: string, messageId: string) => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!channelId) return { error: "Missing channelId" };
	if (!messageId) return { error: "Missing messageId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
	};

	try {
		const url = `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`;
		const req = await discordFetch(url, { headers });

		let data: any = null;
		try {
			data = await req.json();
		} catch {}

		if (req.status !== 200) {
			return {
				data: null,
				error: data || { status: req.status, statusText: req.statusText },
			};
		}

		if (data) {
			data = await processDiscordMessage(data, token);
		}

		return { data };
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const DiscordInfoInvite = async (token: string | null, q: string, guildId?: string) => {
	const match = q?.match(/(?:discord\.gg\/|discord\.com\/invite\/)([a-zA-Z0-9-]+)|^([a-zA-Z0-9-]+)$/);
	const code = match?.[1] ?? match?.[2] ?? null;

	if (!guildId && (!code || !/^[a-zA-Z0-9-]{2,30}$/.test(code))) {
		return { error: "Invalid or missing invite code" };
	}

	const headers: any = {
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
	};
	if (token) headers["Authorization"] = `Bot ${token}`;

	try {
		const url = guildId ? `https://discord.com/api/v10/guilds/${guildId}/invites` : `https://discord.com/api/v10/invites/${code}?with_counts=true&with_expiration=true&with_permissions=true&with_games=true`;

		const req = await discordFetch(url, { headers });
		let data: any = null;
		try {
			data = await req.json();
		} catch {}

		if (req.status !== 200) {
			return {
				data: null,
				error: data || { status: req.status, statusText: req.statusText },
			};
		}

		if (guildId && Array.isArray(data)) {
			const invite = data.find((i: any) => i.code === code);
			if (!invite) return { data: null, error: "Invite not found in guild" };
			data = invite;
		}

		if (data) {
			if (data.id) {
				data.created_at = String(getSnowflakeDate(data.id));
			}
			if (data.expires_at) {
				data.expires_at = String(Math.floor(new Date(data.expires_at).getTime() / 1000));
			}
		}

		if (data && data.guild) {
			const g = data.guild;
			const guildId = g.id;

			data.guild.icon_url = g.icon ? `https://cdn.discordapp.com/icons/${guildId}/${g.icon}.${g.icon.startsWith("a_") ? "gif" : "png"}?size=4096` : null;
			data.guild.splash_url = g.splash ? `https://cdn.discordapp.com/splashes/${guildId}/${g.splash}.png?size=4096` : null;
			data.guild.banner_url = g.banner ? `https://cdn.discordapp.com/banners/${guildId}/${g.banner}.${g.banner.startsWith("a_") ? "gif" : "png"}?size=4096` : null;
			data.guild.created_at = guildId ? String(getSnowflakeDate(guildId)) : null;
		}

		if (data && data.inviter) {
			const u = data.inviter;
			const userId = u.id;

			data.inviter.avatar_url = u.avatar ? `https://cdn.discordapp.com/avatars/${userId}/${u.avatar}.${u.avatar.startsWith("a_") ? "gif" : "png"}?size=4096` : null;
			data.inviter.banner_url = u.banner ? `https://cdn.discordapp.com/banners/${userId}/${u.banner}.${u.banner.startsWith("a_") ? "gif" : "png"}?size=4096` : null;
			data.inviter.badges = resolveFlags(u.public_flags);
			data.inviter.badges_raw = resolveFlags(u.flags);
			data.inviter.created_at = userId ? String(getSnowflakeDate(userId)) : null;
		}

		return { data };
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const DiscordListInvite = async (token: string, guildId: string, limit: number = 10, type: string = "all", authorId: string = "") => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!guildId) return { error: "Missing guildId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
	};

	try {
		const url = `https://discord.com/api/v10/guilds/${guildId}/invites`;
		const req = await discordFetch(url, { headers });

		let data: any = null;
		try {
			data = await req.json();
		} catch {}

		if (req.status !== 200) {
			return {
				data: null,
				error: data || { status: req.status, statusText: req.statusText },
			};
		}

		if (Array.isArray(data)) {
			data = data.map((invite: any) => {
				const enriched = { ...invite };
				if (enriched.inviter) {
					const u = enriched.inviter;
					enriched.inviter.avatar_url = u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith("a_") ? "gif" : "png"}?size=4096` : null;
					enriched.inviter.banner_url = u.banner ? `https://cdn.discordapp.com/banners/${u.id}/${u.banner}.${u.banner.startsWith("a_") ? "gif" : "png"}?size=4096` : null;
					enriched.inviter.badges = resolveFlags(u.public_flags);
					enriched.inviter.badges_raw = resolveFlags(u.flags);
					enriched.inviter.created_at = u.id ? String(getSnowflakeDate(u.id)) : null;
				}
				if (enriched.created_at) {
					enriched.created_at = String(Math.floor(new Date(enriched.created_at).getTime() / 1000));
				}
				if (enriched.expires_at) {
					enriched.expires_at = String(Math.floor(new Date(enriched.expires_at).getTime() / 1000));
				}
				return enriched;
			});

			const totalInvites = data.length;

			if (authorId) {
				data = data.filter((i: any) => i.inviter?.id === authorId);
			}

			const types = type.split(",").map((t) => t.trim().toLowerCase());
			const filterTypes = ["temporary", "permanent", "has_expire", "user", "bot"];
			const hasFilterType = types.some((t) => filterTypes.includes(t));

			if (!types.includes("all") && hasFilterType) {
				data = data.filter((i: any) => {
					let keep = false;
					if (types.includes("temporary") && i.temporary) keep = true;
					if (types.includes("permanent") && !i.temporary && i.max_age === 0) keep = true;
					if (types.includes("has_expire") && !!i.expires_at) keep = true;
					if (types.includes("user") && i.inviter && !i.inviter.bot) keep = true;
					if (types.includes("bot") && i.inviter && i.inviter.bot) keep = true;
					return keep;
				});
			}

			for (const t of types) {
				if (t === "oldest") {
					data.sort((a: any, b: any) => Number(a.created_at || 0) - Number(b.created_at || 0));
				} else if (t === "newest") {
					data.sort((a: any, b: any) => Number(b.created_at || 0) - Number(a.created_at || 0));
				}
			}

			const sliceLimit = limit === -1 ? data.length : limit;
			data = data.slice(0, sliceLimit);

			return {
				invitesCount: totalInvites,
				limit,
				data,
			};
		}

		return { data };
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const DiscordInfoChannel = async (token: string, channelId: string, guildId?: string) => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!channelId) return { error: "Missing channelId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
	};

	try {
		const url = guildId ? `https://discord.com/api/v10/guilds/${guildId}/channels` : `https://discord.com/api/v10/channels/${channelId}`;

		const req = await discordFetch(url, { headers });
		let data: any = null;
		try {
			data = await req.json();
		} catch {}

		if (req.status !== 200) {
			return {
				data: null,
				error: data || { status: req.status, statusText: req.statusText },
			};
		}

		if (guildId && Array.isArray(data)) {
			const channel = data.find((c: any) => c.id === channelId);
			if (!channel) return { data: null, error: "Channel not found in guild" };
			data = channel;
		}

		if (data && !Array.isArray(data)) {
			data.type = {
				id: data.type,
				name: DISCORD_CHANNEL_TYPES[data.type] || "unknown",
			};

			if (data.permission_overwrites) {
				data.permission_overwrites = data.permission_overwrites.map((o: any) => {
					const allowResolved = resolvePermissions(o.allow);
					const denyResolved = resolvePermissions(o.deny);
					return {
						...o,
						allow_resolved: {
							array: allowResolved,
							string: allowResolved.join(", "),
						},
						deny_resolved: {
							array: denyResolved,
							string: denyResolved.join(", "),
						},
					};
				});
			}
			data.created_at = data.id ? String(getSnowflakeDate(data.id)) : null;
		}

		return { data };
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const DiscordInfoRole = async (token: string, roleId: string, guildId: string) => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!roleId) return { error: "Missing roleId" };
	if (!guildId) return { error: "Missing guildId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
	};

	try {
		const urlRoles = `https://discord.com/api/v10/guilds/${guildId}/roles`;
		const urlCounts = `https://discord.com/api/v10/guilds/${guildId}/roles/member-counts`;

		const [rolesReq, countsReq] = await Promise.all([discordFetch(urlRoles, { headers }), discordFetch(urlCounts, { headers })]);

		let rolesData: any = [];
		let countsData: any = [];

		try {
			if (rolesReq.status === 200) rolesData = await rolesReq.json();
		} catch {}
		try {
			if (countsReq.status === 200) countsData = await countsReq.json();
		} catch {}

		if (rolesReq.status !== 200) {
			return {
				data: null,
				error: rolesData || {
					status: rolesReq.status,
					statusText: rolesReq.statusText,
				},
			};
		}

		let data: any = null;
		if (Array.isArray(rolesData)) {
			const role = rolesData.find((r: any) => r.id === roleId);
			if (!role) return { data: null, error: "Role not found" };
			data = role;
		}

		if (data && !Array.isArray(data)) {
			const membersCount = countsData && typeof countsData === "object" ? countsData[roleId] || 0 : 0;

			const resolvedArray = resolvePermissions(data.permissions);
			data = {
				...data,
				membersCount,
				permissions_resolved: {
					array: resolvedArray,
					string: resolvedArray.join(", "),
				},
				created_at: data.id ? String(getSnowflakeDate(data.id)) : null,
			};
		}

		return { data };
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const DiscordModifyRole = async (token: string, roleId: string, guildId: string, payload: any, reasonAudit?: string) => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!roleId) return { error: "Missing roleId" };
	if (!guildId) return { error: "Missing guildId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
		...(reasonAudit && { "X-Audit-Log-Reason": reasonAudit }),
	};

	const url = `https://discord.com/api/v10/guilds/${guildId}/roles/${roleId}`;

	try {
		const getReq = await discordFetch(url, { headers });

		let currentInfo: any = null;
		try {
			currentInfo = await getReq.json();
		} catch {}

		if (getReq.status !== 200) {
			return {
				data: [null, null],
				error: currentInfo || {
					status: getReq.status,
					statusText: getReq.statusText,
				},
			};
		}

		if (Object.keys(payload).length === 0) {
			return { data: [currentInfo, null] };
		}

		const allSame = Object.keys(payload).every((key) => {
			const currentVal = currentInfo[key] ?? null;
			const payloadVal = payload[key] ?? null;
			return currentVal === payloadVal;
		});

		if (allSame) {
			return { data: [false, null, 204] };
		}

		const response = await discordFetch(url, {
			method: "PATCH",
			headers,
			body: JSON.stringify(payload),
		});

		let patchResponse: any = null;
		try {
			patchResponse = await response.json();
		} catch {}

		if (response.status < 200 || response.status >= 300) {
			return {
				data: [currentInfo, null],
				error: patchResponse || { status: response.status },
			};
		}

		return {
			data: [currentInfo, patchResponse, response.status, ...(reasonAudit ? [reasonAudit] : [])],
		};
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const DiscordModifyChannel = async (token: string, channelId: string, payload: any, reasonAudit?: string) => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!channelId) return { error: "Missing channelId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
		...(reasonAudit && { "X-Audit-Log-Reason": reasonAudit }),
	};

	const url = `https://discord.com/api/v10/channels/${channelId}`;

	try {
		const getReq = await discordFetch(url, { headers });

		let currentInfo: any = null;
		try {
			currentInfo = await getReq.json();
		} catch {}

		if (getReq.status !== 200) {
			return {
				data: [null, null],
				error: currentInfo || {
					status: getReq.status,
					statusText: getReq.statusText,
				},
			};
		}

		if (Object.keys(payload).length === 0) {
			return { data: [currentInfo, null] };
		}

		const allSame = Object.keys(payload).every((key) => {
			const currentVal = currentInfo[key] ?? null;
			const payloadVal = payload[key] ?? null;
			return currentVal === payloadVal;
		});

		if (allSame) {
			return { data: [false, null, 204] };
		}

		const response = await discordFetch(url, {
			method: "PATCH",
			headers,
			body: JSON.stringify(payload),
		});

		let patchResponse: any = null;
		try {
			patchResponse = await response.json();
		} catch {}

		if (response.status < 200 || response.status >= 300) {
			return {
				data: [currentInfo, null],
				error: patchResponse || { status: response.status },
			};
		}

		return {
			data: [currentInfo, patchResponse, response.status, ...(reasonAudit ? [reasonAudit] : [])],
		};
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const DiscordCreateRole = async (token: string, guildId: string, payload: any, reasonAudit?: string) => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!guildId) return { error: "Missing guildId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
		...(reasonAudit && { "X-Audit-Log-Reason": reasonAudit }),
	};

	const url = `https://discord.com/api/v10/guilds/${guildId}/roles`;

	try {
		const response = await discordFetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify(payload),
		});

		let data: any = null;
		try {
			data = await response.json();
		} catch {}

		if (response.status < 200 || response.status >= 300) {
			return {
				data: [null, null],
				error: data || {
					status: response.status,
					statusText: response.statusText,
				},
			};
		}

		return {
			data: [data, response.status, ...(reasonAudit ? [reasonAudit] : [])],
		};
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const DiscordListWebhooks = async (token: string, guildId: string, type: string = "all") => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!guildId) return { error: "Missing guildId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
	};

	try {
		const url = `https://discord.com/api/v10/guilds/${guildId}/webhooks`;
		const req = await discordFetch(url, { headers });
		let data: any = null;
		try {
			data = await req.json();
		} catch {}

		if (req.status !== 200) {
			return {
				data: null,
				error: data || { status: req.status, statusText: req.statusText },
			};
		}

		if (Array.isArray(data)) {
			data = data.map((w: any) => ({
				...w,
				created_at: w.id ? String(getSnowflakeDate(w.id)) : null,
			}));

			const types = type.split(",").map((t) => t.trim().toLowerCase());
			for (const t of types) {
				if (t === "oldest") {
					data.sort((a: any, b: any) => Number(a.created_at || 0) - Number(b.created_at || 0));
				} else if (t === "newest") {
					data.sort((a: any, b: any) => Number(b.created_at || 0) - Number(a.created_at || 0));
				}
			}
		}

		return {
			_warning: "Using this endpoint can put your bot (discord) rate-limits faster",
			data,
		};
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const ImgurPost = async (query: string, refresh_auth: boolean = false): Promise<any> => {
	if (!query) return null;

	if (refresh_auth || !keyimgur) {
		keyimgur = await imgurKey();
	}

	try {
		const req = await fetch(`https://api.imgur.com/post/v1/posts/t/${encodeURIComponent(query)}?client_id=${keyimgur}&include=cover&page=1&sort=-time`, { headers: commonHeaders, signal: AbortSignal.timeout(90000) });
		if (req.status === 401 || req.status === 400) return await ImgurPost(query, true);
		const res: any = await req.json();
		return { data: res?.posts || null };
	} catch {
		return null;
	}
};

export const Klipy = async function Klipy(que: string, type?: string) {
	if (!que) return null;

	const getQueryType = (t?: string) => {
		if (t === "sticker") return "stickers";
		if (t === "clip") return "clips";
		if (t === "emoji") return "emojis";
		if (t === "ai_gif") return "ai-gifs";
		return "gifs";
	};

	try {
		const queryType = getQueryType(type);
		const req = await fetch(`https://api.klipy.com/api/v1/${process.env.KLIPY}/${queryType}/search?q=${encodeURIComponent(que)}&locale=en-US&per_page=100`, {
			headers: {
				...commonHeaders,
				Referer: "https://klipy.com",
				Origin: "https://klipy.com",
			},
		});

		if (req.status === 200) {
			const res: any = await req.json();
			return {
				data: res?.data?.data || null,
			};
		}

		return { error: `${req.status} - Can't process this` };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const infoKlipy = async function infoKlipy(url: string) {
	if (!url) return null;

	try {
		const urlObj = new URL(url);
		if (!urlObj.hostname.endsWith("klipy.com")) {
			return { error: "Invalid Klipy URL" };
		}

		const klipyPath = url.split("klipy.com/")[1];
		if (!klipyPath) {
			return { error: "Invalid Klipy URL path" };
		}

		const req = await fetch(`https://api.klipy.com/api/v1/${process.env.KLIPY}/${klipyPath}`, {
			headers: commonHeaders,
		});

		if (req.status === 404) {
			return { error: `${req.status} - Not found` };
		}

		if (req.status === 200) {
			const res: any = await req.json();
			return { data: res?.data || null };
		}

		return { error: `${req.status} - Can't process this` };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const TimezoneInfo = async function TimezoneInfo(q: string) {
	if (!q) return { error: "Missing parameter 'q'" };

	const timezones = Intl.supportedValuesOf("timeZone");
	const query = q.toLowerCase().trim().replace(/\s+/g, "_");
	let exactMatches: string[] = [];
	let softMatches: string[] = [];
	const d = new Date();

	const gmtUtcMatch = query.match(/^(?:gmt|utc)\s*([+-]?)\s*(\d{1,2})(?::?(\d{2}))?$/);

	if (gmtUtcMatch) {
		const sign = gmtUtcMatch[1] === "-" ? -1 : 1;
		const hrs = parseInt(gmtUtcMatch[2], 10);
		const mins = gmtUtcMatch[3] ? parseInt(gmtUtcMatch[3], 10) : 0;
		const targetOffsetMinutes = sign * (hrs * 60 + mins);

		softMatches = timezones.filter((tz) => {
			const formatter = new Intl.DateTimeFormat("en-US", {
				timeZone: tz,
				timeZoneName: "longOffset",
			});
			const parts = formatter.formatToParts(d);
			const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT";

			let gmtStr = offsetPart.replace("GMT", "");
			if (gmtStr === "") gmtStr = "+00:00";

			const s = gmtStr.startsWith("-") ? -1 : 1;
			const m = gmtStr.match(/([+-])?(\d{2}):?(\d{2})/);
			let tzOffsetMinutes = 0;
			if (m) {
				tzOffsetMinutes = s * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
			}
			return tzOffsetMinutes === targetOffsetMinutes;
		});

		if (softMatches.length > 0) {
			softMatches.sort((a, b) => {
				const aPri = a.startsWith("Antarctica/") || a.startsWith("Etc/") ? 1 : 0;
				const bPri = b.startsWith("Antarctica/") || b.startsWith("Etc/") ? 1 : 0;
				return aPri - bPri;
			});
			exactMatches = [softMatches[0]];
			softMatches = softMatches.slice(1);
		}
	} else {
		exactMatches = timezones.filter((tz) => tz.toLowerCase() === query || tz.toLowerCase().split("/").pop() === query);
		softMatches = timezones.filter((tz) => tz.toLowerCase().includes(query));
	}

	const matches = exactMatches.length > 0 ? exactMatches.concat(softMatches.filter((tz) => !exactMatches.includes(tz))) : softMatches;

	if (matches.length === 0) {
		return { error: "Timezone not found" };
	}

	const name = matches[0];
	const similarName = matches.slice(1);

	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone: name,
		timeZoneName: "longOffset",
	});

	function getOffsetMinutes(date: Date) {
		const parts = formatter.formatToParts(date);
		const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT";
		let str = offsetPart.replace("GMT", "");
		if (str === "") str = "+00:00";

		const sign = str.startsWith("-") ? -1 : 1;
		const match = str.match(/([+-])?(\d{2}):?(\d{2})/);
		if (!match) return 0;
		return sign * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10));
	}

	const dNow = new Date();
	const currentOffsetMinutes = getOffsetMinutes(dNow);

	const LocaleDate = dNow.toLocaleDateString("en-US", { timeZone: name });
	const LocaleTime = dNow.toLocaleTimeString("en-US", { timeZone: name });
	const Locale = dNow.toLocaleString("en-US", { timeZone: name });
	const dateFormatted = dNow.toLocaleDateString("en-US", {
		timeZone: name,
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "2-digit",
	});

	const formatterRaw = new Intl.DateTimeFormat("en-US", {
		timeZone: name,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});
	const partsRaw = formatterRaw.formatToParts(dNow);
	const p: any = {};
	partsRaw.forEach((part) => {
		p[part.type] = part.value;
	});

	const isoOffsetStr = (currentOffsetMinutes >= 0 ? "+" : "-") + String(Math.abs(Math.floor(currentOffsetMinutes / 60))).padStart(2, "0") + ":" + String(Math.abs(currentOffsetMinutes % 60)).padStart(2, "0");

	const isoLocal = `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${isoOffsetStr}`;
	const utcLocal =
		dNow.toLocaleDateString("en-US", {
			timeZone: name,
			weekday: "short",
			day: "2-digit",
			month: "short",
			year: "numeric",
		}) +
		", " +
		p.hour +
		":" +
		p.minute +
		":" +
		p.second +
		" GMT" +
		isoOffsetStr;

	return {
		data: {
			name,
			conversion: {
				LocaleDate,
				LocaleTime,
				Locale,
				Date: dateFormatted,
				ISO: isoLocal,
				UTC: utcLocal,
				Time: `${p.hour}:${p.minute}:${p.second}`,
			},
			offsetTimeM: String(currentOffsetMinutes),
			offsetTimeS: String(currentOffsetMinutes * 60),
			offsetTimeMS: String(currentOffsetMinutes * 60 * 1000),
			similarName,
		},
	};
};

export const PatreonSearch = async (query: string): Promise<any> => {
	if (!query) return null;

	try {
		const res = await fetch(`https://www.patreon.com/api/search?q=${encodeURIComponent(query)}`, {
			headers: commonHeaders,
		});

		const response = await res.json();

		if (!response?.data?.[0]) {
			return { data: null };
		}

		return {
			data: response.data,
		};
	} catch {
		return null;
	}
};

export const Trakteer = async (query: string): Promise<any> => {
	if (!query) return null;

	try {
		const res = await fetch(`https://api.trakteer.id/v3/discover/search?limit=10&keywords=${encodeURIComponent(query)}`, {
			headers: commonHeaders,
		});

		const response = await res.json();

		if (!response?.result?.data?.[0]) {
			return { data: null };
		}

		return {
			data: response.result.data,
		};
	} catch {
		return null;
	}
};

export const IMDB = async (query: string): Promise<any> => {
	if (!query) return null;

	try {
		const resBody: any = {
			includeAdult: true,
			isExactMatch: false,
			locale: "en-US",
			numResults: 5,
			originalTitleText: true,
			searchTerm: query,
			skipHasExact: true,
			typeFilter: "TITLE",
		};
		const exter: any = {
			persistedQuery: {
				sha256Hash: "600c8ca2deb61df89fced826818a7b5bdfc5539c39402a8bd285221aedbfa99a",
				version: 1,
			},
		};
		const res = await fetch(`https://caching.graphql.imdb.com/?operationName=FindPageSearch&variables=${encodeURIComponent(JSON.stringify(resBody))}&extensions=${encodeURIComponent(JSON.stringify(exter))}`, {
			headers: {
				...commonHeaders,
				Accept: "application/json",
				"Content-Type": "application/json",
			},
		});

		const response = await res.json();

		const finalres: any = response?.data?.results?.edges;

		return {
			data: finalres.map((a: any) => {
				const { __typename, ...node } = a?.node?.entity;
				return { url: "https://www.imdb.com/title/" + node?.id, ...node };
			}),
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const ImgflipSearch = async (query: string): Promise<any> => {
	if (!query) return null;

	const resolveUrl = (raw: string | null | undefined): string => {
		if (!raw) return "";
		if (raw.startsWith("//")) return `https:${raw}`;
		if (raw.startsWith("/")) return `https://imgflip.com${raw}`;
		return raw;
	};

	const hasClass = (el: any, name: string): boolean => el.getAttribute?.("class")?.split(" ").includes(name) ?? false;

	const text = (el: any): string => String(el?.textContent ?? "").trim();

	// Parse subtitle string into structured metadata per section
	const parseMeta = (section: string, subtitle: string, description: string) => {
		switch (section) {
			case "memes": {
				const captions = subtitle.match(/([\d,]+\+?)\s+captions?/)?.[1] ?? null;
				return { subtitle: captions };
			}
			case "images": {
				const type = subtitle.split(",")[0]?.trim() ?? null;
				const views = subtitle.match(/([\d,]+)\s+views?/)?.[1] ?? null;
				return {
					type,
					views,
					description: description || null,
				};
			}
			case "tags": {
				const count = subtitle.match(/([\d,]+)\s+images?/)?.[1] ?? null;
				return { count };
			}
			case "streams": {
				const count = subtitle.match(/([\d,]+)\s+submitted/)?.[1] ?? null;
				return {
					count,
					description: description || null,
				};
			}
			case "users": {
				const joined = subtitle.match(/joined\s+([^,]+)/)?.[1]?.trim() ?? null;
				const creations = subtitle.match(/([\d,]+)\s+creations?/)?.[1] ?? null;
				const comments = subtitle.match(/([\d,]+)\s+comments?/)?.[1] ?? null;
				return {
					joined,
					creations,
					comments,
				};
			}
			default:
				return { subtitle };
		}
	};

	try {
		const res = await fetch(`https://imgflip.com/search?q=${encodeURIComponent(query)}`, {
			headers: commonHeaders,
		});

		const html: string = await res.text();

		const { document } = parseHTML(html);
		const container = document.querySelector("#s-results");
		if (!container) return null;

		const data: Record<string, any[] | null> = {
			memes: null,
			images: null,
			tags: null,
			streams: null,
			users: null,
		};
		let currentSection = "unknown";

		for (const child of container.children) {
			const heading = child.tagName === "H2" ? child : child.querySelector?.("h2");

			if (heading) {
				currentSection = text(heading).toLowerCase();
				if (data[currentSection] === null) data[currentSection] = [];
				continue;
			}

			if (!hasClass(child, "s-result") && !hasClass(child, "s-more-results")) {
				continue;
			}

			const anchors: any[] = hasClass(child, "s-result") ? [child] : [...child.querySelectorAll("a.s-result")];

			for (const el of anchors) {
				const url = resolveUrl(el.getAttribute("href"));
				const title = text(el.querySelector(".s-result-title"));
				const subtitle = text(el.querySelector(".s-result-subtitle"));
				const rawCover = el.querySelector("img")?.getAttribute("src");
				const isGif = el.getAttribute("href")?.includes("/gif/") ?? false;
				const cover = resolveUrl(rawCover);
				const full_cover = isGif ? cover.replace("/2/", "/").replace(/\.jpg$/, ".mp4") : cover.replace("/2/", "/");
				const description = text(el.querySelector(".s-result-description"));

				const meta = parseMeta(currentSection, subtitle, description);

				const noCover = currentSection === "users" || currentSection === "streams";
				const entry: Record<string, any> = noCover
					? { url, title, ...meta }
					: {
							url,
							title,
							cover: cover || null,
							full_cover: full_cover || null,
							...meta,
						};

				if (Array.isArray(data[currentSection])) {
					data[currentSection]!.push(entry);
				}
			}
		}

		return { data };
	} catch {
		return null;
	}
};

export const DiscordVoice = async (token: string, guildId: string, action: string, payload: any) => {
	if (action === "setstatus") {
		const { channelId, content } = payload;
		const res = await discordFetch(`https://discord.com/api/v10/channels/${channelId}/voice-status`, {
			method: "PUT",
			headers: {
				Authorization: `Bot ${token}`,
				"Content-Type": "application/json",
				"User-Agent": discordUserAgent,
			},
			body: JSON.stringify({ status: content || "" }),
		});

		if (!res.ok) {
			const body = await res.text();
			let parsed: any;
			try {
				parsed = JSON.parse(body);
			} catch {
				parsed = { message: body };
			}
			return { error: parsed };
		}

		return {
			data: {
				channelId: channelId || null,
				content: content || null,
			},
		};
	}

	if (!token || !guildId || !action) return { error: "Missing required parameters" };

	const modifyMember = async (userId: string, data: any) => {
		const res = await discordFetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
			method: "PATCH",
			headers: {
				Authorization: `Bot ${token}`,
				"Content-Type": "application/json",
				"User-Agent": discordUserAgent,
			},
			body: JSON.stringify(data),
		});
		if (!res.ok) {
			const body = await res.text();
			let parsed: any;
			try {
				parsed = JSON.parse(body);
			} catch {
				parsed = { message: body };
			}
			const err: any = new Error(parsed.message || "Failed to modify member");
			err.json = parsed;
			err.status = res.status;
			throw err;
		}
		const body = res.status === 204 ? {} : await res.json();
		return { status: res.status, data: body };
	};

	try {
		const { getOrCreatePlayer } = await import("./musicPlayer.js");
		const { client } = await getOrCreatePlayer(token);
		const guild = await client.guilds.fetch(guildId);

		const formatMemberData = (m: any) => {
			return JSON.parse(JSON.stringify({ member: m, voiceState: m.voice }));
		};

		const buildAllResult = (action: string, channelId: string, oldData: any[], results: PromiseSettledResult<any>[], totalVoiceMembers: number, excludeAuthors: string[], extra?: Record<string, any>) => {
			const newData = oldData.map((old, i) => {
				const result = results[i];
				const formatted = JSON.parse(JSON.stringify(old));
				if (result.status === "fulfilled") {
					const apiData = result.value.data;
					if (apiData) {
						if (apiData.deaf !== undefined) formatted.voiceState.serverDeaf = apiData.deaf;
						if (apiData.mute !== undefined) formatted.voiceState.serverMute = apiData.mute;
					}
					if (action === "kickall" || action === "kick") {
						formatted.voiceState.channelId = null;
					}
					if (action === "moveall" && extra?.toChannelId) {
						formatted.voiceState.channelId = extra.toChannelId;
					}
				}
				return formatted;
			});

			return {
				data: {
					action,
					channelId,
					excludeAuthors: excludeAuthors,
					usersCount: totalVoiceMembers,
					affectedCount: results.length,
					success: results.filter((r) => r.status === "fulfilled").length,
					failed: results.filter((r) => r.status === "rejected").length,
					data: [oldData, newData],
					...extra,
				},
			};
		};

		if (["deafen", "undeafen", "mute", "unmute", "kick", "move"].includes(action)) {
			const { userId } = payload;
			if (!userId) return { error: "Missing valid parameter: userId" };

			const memberObj = await guild.members.fetch(userId);
			if (!memberObj.voice.channelId) {
				return {
					error: {
						message: "Target user is not connected to voice.",
						code: 40032,
					},
				};
			}
			const oldData = formatMemberData(memberObj);

			let result: any;
			if (action === "deafen") result = await modifyMember(userId, { deaf: true });
			else if (action === "undeafen") result = await modifyMember(userId, { deaf: false });
			else if (action === "mute") result = await modifyMember(userId, { mute: true });
			else if (action === "unmute") result = await modifyMember(userId, { mute: false });
			else if (action === "kick") result = await modifyMember(userId, { channel_id: null });
			else if (action === "move") {
				const { toChannelId } = payload;
				if (!toChannelId) return { error: "Missing valid parameter: toChannelId" };
				result = await modifyMember(userId, { channel_id: toChannelId });
			}

			const newData = formatMemberData(memberObj);
			if (result.data) {
				if (result.data.deaf !== undefined) newData.voiceState.serverDeaf = result.data.deaf;
				if (result.data.mute !== undefined) newData.voiceState.serverMute = result.data.mute;
			}
			if (action === "kick") {
				newData.voiceState.channelId = null;
			}
			if (action === "move") {
				newData.voiceState.channelId = payload.toChannelId;
			}

			return {
				data: {
					status: true,
					action,
					userId,
					data: [oldData, newData],
				},
			};
		}

		const { channelId } = payload;
		if (!channelId) return { error: "Missing valid parameter: channelId" };

		const channel: any = await guild.channels.fetch(channelId);
		if (!channel || !channel.isVoiceBased()) return { error: "Invalid voice channel" };

		if (action === "list") {
			const membersCount = channel.members.size;
			const membersList = channel.members.map((m: any) => {
				const { guild: _g, ...member } = m;
				const { guild: _vg, member: _vm, ...voiceState } = m.voice;
				return { member, voiceState };
			});
			return {
				data: {
					usersCount: membersCount,
					data: membersList,
					...channel,
				},
			};
		}

		const authorIds = (payload.authorId || "")
			.split(",")
			.map((id: string) => id.trim())
			.filter(Boolean);

		if (action === "muteall") {
			const members = [...channel.members.values()].filter((member: any) => !authorIds.includes(member.id));
			const oldData = members.map(formatMemberData);
			const results = await Promise.allSettled(members.map((member: any) => modifyMember(member.id, { mute: true })));
			return buildAllResult("muteall", channelId, oldData, results, channel.members.size, authorIds);
		}

		if (action === "unmuteall") {
			const members = [...channel.members.values()].filter((member: any) => !authorIds.includes(member.id));
			const oldData = members.map(formatMemberData);
			const results = await Promise.allSettled(members.map((member: any) => modifyMember(member.id, { mute: false })));
			return buildAllResult("unmuteall", channelId, oldData, results, channel.members.size, authorIds);
		}

		if (action === "deafall") {
			const members = [...channel.members.values()].filter((member: any) => !authorIds.includes(member.id));
			const oldData = members.map(formatMemberData);
			const results = await Promise.allSettled(members.map((member: any) => modifyMember(member.id, { deaf: true })));
			return buildAllResult("deafall", channelId, oldData, results, channel.members.size, authorIds);
		}

		if (action === "undeafall") {
			const members = [...channel.members.values()].filter((member: any) => !authorIds.includes(member.id));
			const oldData = members.map(formatMemberData);
			const results = await Promise.allSettled(members.map((member: any) => modifyMember(member.id, { deaf: false })));
			return buildAllResult("undeafall", channelId, oldData, results, channel.members.size, authorIds);
		}

		if (action === "kickall") {
			const members = [...channel.members.values()].filter((member: any) => !authorIds.includes(member.id));
			const oldData = members.map(formatMemberData);
			const results = await Promise.allSettled(members.map((member: any) => modifyMember(member.id, { channel_id: null })));
			return buildAllResult("kickall", channelId, oldData, results, channel.members.size, authorIds);
		}

		if (action === "moveall") {
			const { toChannelId } = payload;
			if (!toChannelId) return { error: "Missing valid parameter: toChannelId" };
			const members = [...channel.members.values()].filter((member: any) => !authorIds.includes(member.id));
			const oldData = members.map(formatMemberData);
			const results = await Promise.allSettled(members.map((member: any) => modifyMember(member.id, { channel_id: toChannelId })));
			return buildAllResult("moveall", channelId, oldData, results, channel.members.size, authorIds, { toChannelId });
		}

		return { error: "Unknown action" };
	} catch (e: any) {
		return { error: e.json ?? { message: e.message } };
	}
};

export const Audiomack = async function Audiomack(que: string, type: string = "songs", limits: number = 30): Promise<any> {
	if (!que) return null;

	let searchType = type.toLowerCase();
	if (searchType === "song" || searchType === "songs") searchType = "songs";
	else if (searchType === "album" || searchType === "albums") searchType = "albums";
	else if (searchType === "playlist" || searchType === "playlists") searchType = "playlists";
	else if (searchType === "artist" || searchType === "artists") searchType = "artists";
	else searchType = "songs";

	try {
		const { signature, params } = await mackOauth("GET", "https://api.audiomack.com/v1/search", {
			q: que,
			show: searchType,
			sort: "popular",
			limit: limits,
			page: 1,
		});

		const searchParams = new URLSearchParams(Object.entries({ ...params, oauth_signature: signature }).map(([k, v]): [string, string] => [k, String(v)]));

		const pull = await fetch(`https://api.audiomack.com/v1/search?${searchParams}`, {
			headers: commonHeaders,
		});

		if (pull.status !== 200) {
			return {
				error: `${pull.status} - Can't process this`,
			};
		}

		const res: any = await pull.json();
		return { signature: signature, data: res?.results || null };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const CrunchySearch = async function CrunchySearch(que: string, refresh_auth: boolean = false) {
	if (!que) return null;

	try {
		if (refresh_auth || !keycrunchy) {
			keycrunchy = await crunchyKey();
		}

		const per = await fetch(`https://beta-api.crunchyroll.com/content/v2/discover/search?q=${encodeURIComponent(que)}&n=20&type=series,episode,top_results&ratings=true&locale=en`, {
			headers: {
				...commonHeaders,
				Accept: "application/json",
				Authorization: "Bearer " + keycrunchy,
			},
		});

		if (per.status === 403) {
			return {
				error: "Cloudflare Turnstile asking to verify you're not a bot",
			};
		}

		if (per.status === 400 || per.status === 401) {
			return await CrunchySearch(que, true);
		}

		const res: any = await per.json();
		const finalres: any = {
			episode: res?.data?.find((a: any) => a.type == "episode")?.items,
			series: res?.data?.find((a: any) => a.type == "series")?.items,
			topResults: res?.data?.find((a: any) => a.type == "top_results")?.items,
		};
		return { data: finalres || null };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const SafeBooru = async function SafeBooru(que: string) {
	if (!que) return null;

	try {
		const per = await fetch(`https://safebooru.org/autocomplete.php?q=${encodeURIComponent(que)}`, {
			headers: commonHeaders,
		});

		if (per.status === 403) {
			return {
				error: "Cloudflare Turnstile asking to verify you're not a bot",
			};
		}

		const res: any = await per.text();
		let parseres: any = {};
		try {
			parseres = JSON.parse(res);
		} catch {}

		if (!parseres?.[0]) {
			return {
				data: null,
			};
		}

		const finalres = await Promise.allSettled(
			parseres.map(async (e: any) => {
				const req2 = await fetch(`https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(e.value)}&limit=100`, {
					headers: commonHeaders,
				});

				const res2: any = await req2.json();

				const totalMatch = e.label.match(/\((\d+)\)/);
				const total = totalMatch ? totalMatch[1] : "0";

				return {
					title: e.value,
					total: total,
					data: res2,
				};
			}),
		);

		return {
			data: finalres.map((r) => (r.status === "fulfilled" ? r.value : null)).filter(Boolean),
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const Konachan = async function Konachan(que: string) {
	if (!que) return null;

	try {
		if (!konaSummary || konaSummary.length === 0) {
			const pullinfo = await fetch(`https://konachan.net/tag/summary.json`, {
				headers: commonHeaders,
			});

			const lookinfo: any = await pullinfo.json();
			const data = lookinfo.data || "";
			// Konachan summary format: "category`tag1`tag2` category`tag3`..."
			konaSummary = data.split(" ").flatMap((group: string) => group.split("`").slice(1, -1));
		}

		const specificTags = konaSummary.filter((tag: string) => tag.includes(que.toLowerCase())).slice(0, 5);

		if (specificTags.length === 0) {
			return {
				data: null,
			};
		}

		const finalres = await Promise.allSettled(
			specificTags.map(async (tag: string) => {
				const req2 = await fetch(`https://konachan.net/post.json?limit=20&tags=${encodeURIComponent(tag)}`, {
					headers: commonHeaders,
				});

				const res2: any = await req2.json();

				return {
					title: tag,
					data: res2 || [],
				};
			}),
		);

		return {
			data: finalres.map((r) => (r.status === "fulfilled" ? r.value : null)).filter(Boolean),
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const Tumblr = async (query: string): Promise<any> => {
	if (!query) return null;

	try {
		const res = await fetch(`https://api.tumblr.com/v2/timeline/search?limit=40&query=${encodeURIComponent(query)}&mode=recent&timeline_type=post&post_role=any&reblog_info=true&notes_info=true&days=0&npf=true`, {
			headers: {
				...commonHeaders,
				Authorization: "Bearer " + keytumblr,
			},
		});

		if (res.status === 429) {
			return {
				error: "Rate-limited",
			};
		}

		const response = await res.json();

		if (!response?.response?.timeline?.elements?.[0]) {
			return { data: null };
		}

		return {
			data: response?.response?.timeline?.elements?.map((a: any) => (a.object_type === "post" ? a : null)).filter(Boolean),
		};
	} catch {
		return null;
	}
};

export const googleImgSearch = async (query: string, sort: string = "relevance"): Promise<any> => {
	if (!query) return null;

	try {
		const dateRestrictParam = sort === "latest" ? "&dateRestrict=d1" : "";

		const fetchPage = (start: number) => {
			return fetch(`https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&prettyPrint=false&searchType=image&num=10&start=${start}${dateRestrictParam}&cx=${process.env.GOOG_CX}`, {
				headers: {
					...commonHeaders,
					Referer: process.env.GOOG_RX || "",
					"X-Goog-Api-Key": process.env.GOOG_EX || "",
				},
			});
		};

		const [res1, res2] = await Promise.all([fetchPage(1).catch(() => ({ status: 500, json: async () => ({}) }) as any), fetchPage(11).catch(() => ({ status: 500, json: async () => ({}) }) as any)]);

		const isOk1 = res1.status === 200;
		const isOk2 = res2.status === 200;

		if (!isOk1 && !isOk2) {
			if (res1.status === 503) return { error: "Service unavailable" };
			if (res1.status === 429) return { error: "Rate-limited" };
			return null;
		}

		const response1: any = isOk1 ? await res1.json() : {};
		const response2: any = isOk2 ? await res2.json() : {};

		const combinedItems = [...(response1.items || []), ...(response2.items || [])];
		const validResponse = response1.queries ? response1 : response2;

		let filterResponse = {};
		if (validResponse.queries?.request?.[0]) {
			const { cx, count, startIndex, ...rest } = validResponse.queries.request[0];
			filterResponse = rest;
		}

		return {
			data: {
				...filterResponse,
				sort: sort,
				items: combinedItems,
			},
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const googleImgSearchV2 = async (query: string, refresh_auth: boolean = false): Promise<any> => {
	if (!query) return null;

	try {
		if (refresh_auth || !googleImgSpAuth?.cx) {
			googleImgSpAuth = await googleAuthKey();
		}

		const res = await fetch(`https://cse.google.com/cse/element/v1?rsz=${googleImgSpAuth?.uiOptions?.resultSetSize}&hl=${googleImgSpAuth?.language}&source=gcsc&cselibv=${googleImgSpAuth?.cselibVersion}&searchtype=image&cx=${googleImgSpAuth?.cx}&${googleImgSpAuth?.uiOptions?.queryParameterName}=${encodeURIComponent(query)}&safe=off&cse_tok=${encodeURIComponent(googleImgSpAuth?.cse_token)}&lr=&cr=&gl=&filter=0&sort=&as_oq=&as_sitesearch=&exp=${encodeURIComponent(googleImgSpAuth?.exp?.join(",") || "")}&fexp=${encodeURIComponent(googleImgSpAuth?.fexp?.join(",") || "")}&callback=google.search.cse.api&rurl=${encodeURI(googleImgSpAuth?.uiOptions?.resultsUrl || "")}`, {
			headers: commonHeaders,
		});

		if (res.status === 403) {
			return {
				error: "Google asking to verify you're not a bot",
			};
		}

		if (res.status === 429) {
			return {
				error: "Rate-limited",
			};
		}

		let raw = await res.text();

		if (!raw) {
			return { data: null };
		}

		const jsonpMatch = raw.match(/^\/\*.*?\*\/\s*\w[\w.]*\(([\s\S]+)\);?\s*$/);
		if (jsonpMatch) {
			raw = jsonpMatch[1];
		}

		if (raw.trim().startsWith("<")) {
			return { error: "Google asking to verify you're not a bot" };
		}

		const response = JSON.parse(raw);

		if (response?.error?.code === 400 || response?.error?.code === 401 || res.status === 400 || res.status === 401) {
			return await googleImgSearchV2(query, true);
		}

		if (!response?.cursor?.estimatedResultCount) {
			googleImgSpAuth = await googleAuthKey();
			return await googleImgSearchV2(query);
		}

		return {
			data: {
				estimatedResultCount: response.cursor?.estimatedResultCount || "0",
				searchResultTime: response.cursor?.searchResultTime || "0",
				items: response.results || [],
			},
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const googleSearch = async (query: string, refresh_auth: boolean = false): Promise<any> => {
	if (!query) return null;

	try {
		if (refresh_auth || !googleImgSpAuth?.cx) {
			googleImgSpAuth = await googleAuthKey();
		}

		const res = await fetch(`https://cse.google.com/cse/element/v1?rsz=${googleImgSpAuth?.uiOptions?.resultSetSize}&hl=${googleImgSpAuth?.language}&source=gcsc&cselibv=${googleImgSpAuth?.cselibVersion}&cx=${googleImgSpAuth?.cx}&${googleImgSpAuth?.uiOptions?.queryParameterName}=${encodeURIComponent(query)}&safe=off&cse_tok=${encodeURIComponent(googleImgSpAuth?.cse_token)}&lr=&cr=&gl=&filter=0&sort=&as_oq=&as_sitesearch=&exp=${encodeURIComponent(googleImgSpAuth?.exp?.join(",") || "")}&fexp=${encodeURIComponent(googleImgSpAuth?.fexp?.join(",") || "")}&callback=google.search.cse.api&rurl=${encodeURI(googleImgSpAuth?.uiOptions?.resultsUrl || "")}`, {
			headers: commonHeaders,
		});

		if (res.status === 403) {
			return {
				error: "Google asking to verify you're not a bot",
			};
		}

		if (res.status === 429) {
			return {
				error: "Rate-limited",
			};
		}

		let raw = await res.text();

		if (!raw) {
			return { data: null };
		}

		const jsonpMatch = raw.match(/^\/\*.*?\*\/\s*\w[\w.]*\(([\s\S]+)\);?\s*$/);
		if (jsonpMatch) {
			raw = jsonpMatch[1];
		}

		if (raw.trim().startsWith("<")) {
			return { error: "Google asking to verify you're not a bot" };
		}

		const response = JSON.parse(raw);

		if (response?.error?.code === 400 || response?.error?.code === 401 || res.status === 400 || res.status === 401) {
			return await googleSearch(query, true);
		}

		if (!response?.cursor?.estimatedResultCount) {
			googleImgSpAuth = await googleAuthKey();
			return await googleSearch(query);
		}

		return {
			data: {
				estimatedResultCount: response.cursor?.estimatedResultCount || "0",
				searchResultTime: response.cursor?.searchResultTime || "0",
				items:
					response.results?.map((a: any) => {
						const { clicktrackUrl, ...c } = a;
						return c;
					}) || [],
			},
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const duckSearch = async (query: string): Promise<any> => {
	if (!query) return null;

	try {
		const res = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
			headers: commonHeaders,
		});

		if (res.status === 403) {
			return {
				error: "Blocked / Challenge",
			};
		}

		if (res.status === 429) {
			return {
				error: "Rate-limited",
			};
		}

		const duckHtml = await res.text();
		const linkstarget = duckHtml.split("initialize('")?.[1]?.split("',")?.[0];

		const res2 = await fetch(`https://links.duckduckgo.com${linkstarget}`, {
			headers: {
				...commonHeaders,
				Accept: "*/*",
				Referer: "https://duckduckgo.com/",
				"Sec-Fetch-Dest": "script",
				"Sec-Fetch-Mode": "no-cors",
				"Sec-Fetch-Site": "same-site",
			},
		});

		if (res2.status === 403) {
			return {
				error: "Blocked / Challenge",
			};
		}

		if (res2.status === 429) {
			return {
				error: "Rate-limited",
			};
		}

		if (res2.status === 202) {
			return {
				error: "Can't process due unusual requests",
			};
		}

		const final = await res2.text();

		let instantAnswers: any = null;
		try {
			const deepMatch = final.match(/DDG\.deep\.deepPayload\s*=\s*(\{[\s\S]*?\});/);
			if (deepMatch) {
				const payload = JSON.parse(deepMatch[1]);
				instantAnswers = payload?.instantAnswers?.[0]?.data || null;
			}

			if (!instantAnswers) {
				const duckbarMatch = final.match(/DDG\.duckbar\.add\((\{[\s\S]*?"from":"deep_answer"[\s\S]*?\})\);/);
				if (duckbarMatch) {
					const duckbarData = JSON.parse(duckbarMatch[1]);
					instantAnswers = duckbarData?.data || null;
				}
			}

			if (!instantAnswers) {
				const iaMatch = final.match(/^(\{.*?\});/);
				if (iaMatch) {
					const iaJson = JSON.parse(iaMatch[1]);
					instantAnswers = iaJson?.instantAnswers?.[0]?.data || null;
				}
			}
		} catch {}

		let organicResults: any[] = [];
		try {
			const organicMatch = final.match(/DDG\.pageLayout\) DDG\.pageLayout\.load\('d',\s*(\[[\s\S]*?\])\);/);
			if (organicMatch) {
				const parsed = JSON.parse(organicMatch[1]);
				organicResults = parsed
					.filter((r: any) => r.u)
					.map((r: any) => ({
						title: r.t || null,
						url: r.u || null,
						snippet: (r.a || "").replace(/<\/?b>/g, ""),
						domain: r.d || null,
						siteName: r.sn || null,
						icon: r.i ? `https://external-content.duckduckgo.com/ip3/${r.i}.ico` : null,
						siteLinks:
							r.l?.map((sl: any) => ({
								text: sl.text,
								url: sl.targetUrl,
								snippet: sl.snippet,
							})) || [],
						date: r.e || null,
					}));
			}
		} catch {}

		// Extract related searches from DDG.duckbar.loadModule('related_searches', {...})
		let relatedSearches: any[] = [];
		try {
			const relatedMatch = final.match(/DDG\.duckbar\.loadModule\('related_searches',\s*(\{[\s\S]*?\})\);/);
			if (relatedMatch) {
				const parsed = JSON.parse(relatedMatch[1]);
				relatedSearches =
					parsed.results?.map((r: any) => ({
						text: r.text,
						displayText: (r.display_text || "").replace(/<\/?b>/g, ""),
					})) || [];
			}
		} catch {}

		return {
			data: {
				instantAnswer: instantAnswers
					? {
							answer: instantAnswers.answer || null,
							expandedAnswer: instantAnswers.expanded_answer || null,
							sources: instantAnswers.sources || [],
							query: instantAnswers.query || query,
						}
					: null,
				relatedSearches,
				items: organicResults,
			},
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const duckImageSearch = async (query: string): Promise<any> => {
	if (!query) return null;

	try {
		const landingUrl = `https://duckduckgo.com/?q=${query}&iax=images&ia=images`;
		const res = await fetch(landingUrl, {
			headers: commonHeaders,
		});

		if (res.status === 403) {
			return {
				error: "Blocked / Challenge",
			};
		}

		if (res.status === 429) {
			return {
				error: "Rate-limited",
			};
		}

		const duckHtml = await res.text();
		const vqd = duckHtml.match(/vqd=['"]?([^'"&<>\\]+)/)?.[1];
		if (!vqd) {
			return {
				error: "Can't get vqd token",
			};
		}

		const imageHeaders = {
			...commonHeaders,
			Accept: "*/*",
			Referer: "https://duckduckgo.com/",
			"Sec-Fetch-Dest": "empty",
			"Sec-Fetch-Mode": "cors",
			"Sec-Fetch-Site": "same-origin",
		};

		const res2 = await fetch(`https://duckduckgo.com/i.js?o=json&q=${encodeURIComponent(query)}&l=us-en&vqd=${encodeURIComponent(vqd)}&p=-1&ct=US`, {
			headers: imageHeaders,
		});

		if (res2.status === 403) {
			return {
				error: "Blocked / Challenge",
			};
		}

		if (res2.status === 429) {
			return {
				error: "Rate-limited",
			};
		}

		if (res2.status === 202) {
			return {
				error: "Can't process due unusual requests",
			};
		}

		const response = JSON.parse(await res2.text());

		return {
			data: {
				items: response.results || [],
			},
			altData: response.query_expansions || [],
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const duckVideoSearch = async (query: string): Promise<any> => {
	if (!query) return null;

	try {
		const landingUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=videos&ia=videos`;
		const res = await fetch(landingUrl, {
			headers: commonHeaders,
		});

		if (res.status === 403) {
			return {
				error: "Blocked / Challenge",
			};
		}

		if (res.status === 429) {
			return {
				error: "Rate-limited",
			};
		}

		const duckHtml = await res.text();
		const vqd = duckHtml.match(/vqd=['"]?([^'"&<>\\]+)/)?.[1];
		if (!vqd) {
			return {
				error: "Can't get vqd token",
			};
		}

		const videoHeaders = {
			...commonHeaders,
			Referer: landingUrl,
			"Sec-Fetch-Dest": "empty",
			"Sec-Fetch-Mode": "cors",
			"Sec-Fetch-Site": "same-origin",
		};

		const res2 = await fetch(`https://duckduckgo.com/v.js?o=json&q=${encodeURIComponent(query)}&l=us-en&vqd=${encodeURIComponent(vqd)}&p=-2&ct=US`, {
			headers: videoHeaders,
		});

		if (res2.status === 403) {
			return {
				error: "Blocked / Challenge",
			};
		}

		if (res2.status === 429) {
			return {
				error: "Rate-limited",
			};
		}

		if (res2.status === 202) {
			return {
				error: "Can't process due unusual requests",
			};
		}

		const response = JSON.parse(await res2.text());

		return {
			data: {
				items: response.results || [],
			},
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

// ──── Emoji Lookup ────

type EmojiDatabase = {
	knownSupportedEmoji: string[];
	data: Record<string, any>;
	combinations: Record<string, any>;
};

const EMOJI_SOURCE_URL = "https://emojikitchen.dev/metadata.json";

let emojiDataCache: EmojiDatabase | null = null;
let emojiLoadPromise: Promise<EmojiDatabase | null> | null = null;

async function loadEmojiData() {
	if (emojiDataCache) return emojiDataCache;
	if (emojiLoadPromise) return emojiLoadPromise;

	emojiLoadPromise = (async () => {
		try {
			const res = await fetch(EMOJI_SOURCE_URL);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			emojiDataCache = (await res.json()) as EmojiDatabase;
			return emojiDataCache;
		} catch (e) {
			console.error("Failed to fetch emoji data:", e);
			emojiLoadPromise = null;
			return emojiDataCache;
		}
	})();

	const result = await emojiLoadPromise;
	emojiLoadPromise = null;
	return result;
}

export const warmupEmojiData = loadEmojiData;

export const EmojiLookup = async function EmojiLookup(query: string, limit: number = 25) {
	if (!query || query.trim().length === 0) return { error: "Missing parameter 'q'" };

	const qInput = query.trim();

	const discordEmojiMatch = qInput.match(/^<(a?):(\w+):(\d+)>$/);

	if (discordEmojiMatch) {
		const name = discordEmojiMatch[2];
		const id = discordEmojiMatch[3];

		let isAnimated = true;
		let emojiUrl = `https://media.discordapp.net/emojis/${id}.gif`;
		let available = await fetch(emojiUrl, { method: "HEAD" })
			.then((a) => a.ok)
			.catch(() => false);

		if (!available) {
			isAnimated = false;
			emojiUrl = `https://media.discordapp.net/emojis/${id}.png`;
			available = await fetch(emojiUrl, { method: "HEAD" })
				.then((a) => a.ok)
				.catch(() => false);
		}

		const finalUrl = emojiUrl + "?size=4096&quality=lossless";

		return {
			query: qInput,
			count: 1,
			limit: limit,
			data: [
				{
					type: "discordEmoji",
					id: id,
					name: name,
					animated: isAnimated,
					available: available,
					emojiUrl: finalUrl,
					created_at: String(getSnowflakeDate(id)),
				},
			],
		};
	}

	const trimmed = query.trim();

	const isEmoji = /\p{Emoji}/u.test(trimmed);
	let emojibaseMatches: any[] = [];

	if (isEmoji) {
		emojibaseMatches = emojibaseData.filter((e: any) => e.emoji === trimmed);
	} else {
		const searchQ = trimmed.toLowerCase();
		emojibaseMatches = emojibaseData.filter((e: any) => e.label.toLowerCase().includes(searchQ) || e.tags?.some((t: string) => t.toLowerCase().includes(searchQ)));

		emojibaseMatches.sort((a: any, b: any) => {
			const aLabel = a.label.toLowerCase();
			const bLabel = b.label.toLowerCase();
			const aTags = (a.tags || []).map((t: string) => t.toLowerCase());
			const bTags = (b.tags || []).map((t: string) => t.toLowerCase());

			if (aLabel === searchQ && bLabel !== searchQ) return -1;
			if (bLabel === searchQ && aLabel !== searchQ) return 1;

			if (aLabel.startsWith(searchQ) && !bLabel.startsWith(searchQ)) return -1;
			if (bLabel.startsWith(searchQ) && !aLabel.startsWith(searchQ)) return 1;

			const aHasExactTag = aTags.includes(searchQ);
			const bHasExactTag = bTags.includes(searchQ);
			if (aHasExactTag && !bHasExactTag) return -1;
			if (bHasExactTag && !aHasExactTag) return 1;

			return (a.order || 0) - (b.order || 0);
		});
	}

	if (emojibaseMatches.length > 0) {
		const limited = emojibaseMatches.slice(0, limit);
		return {
			query: trimmed,
			count: emojibaseMatches.length,
			limit,
			data: limited.map((entry: any) => {
				const codepoint = entry.hexcode.toLowerCase().replace(/-fe0f/g, "");
				const cpNoto = codepoint.replace(/-/g, "_");
				return {
					type: "twemoji",
					alt: entry.label,
					emoji: entry.emoji,
					codepoint,
					emojiUrl: `https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u${cpNoto}.png`,
					emojiUrl2: `https://raw.githubusercontent.com/jdecked/twemoji/refs/heads/main/assets/72x72/${codepoint}.png`,
					gBoardOrder: entry.order,
					keywords: [entry.label.toLowerCase().replace(/ /g, "_"), ...(entry.tags ?? [])],
					category: (emojibaseGroups.groups as any)[entry.group]?.toLowerCase() || "",
					subcategory: (emojibaseGroups.subgroups as any)[entry.subgroup] || "",
				};
			}),
			isFallback: false,
		};
	}

	// Fallback to Google Emoji Kitchen data
	const db = await loadEmojiData();
	if (!db) return { error: "Emoji data unavailable" };

	const q = query.toLowerCase().trim();
	const terms = q.split(/\s+/);
	const results: any[] = [];

	// Check if query looks like a codepoint (hex string like "2615" or "1f600")
	const isCodepointQuery = /^[0-9a-f]+(-[0-9a-f]+)*$/i.test(q.replace(/\s+/g, "-"));

	const normalizedQuery = query.trim().replace(/\uFE0F/g, "");

	for (const [codepoint, entry] of Object.entries(db.data)) {
		// Direct emoji character match
		if (entry.emoji && entry.emoji.replace(/\uFE0F/g, "") === normalizedQuery) {
			results.unshift({ ...entry, codepoint });
			continue;
		}

		// Direct codepoint match
		if (isCodepointQuery && codepoint.toLowerCase() === q.replace(/\s+/g, "-")) {
			results.unshift({ ...entry, codepoint });
			continue;
		}

		const alt = (entry.alt || "").toLowerCase();
		const keywords: string[] = (entry.keywords || []).map((k: string) => k.toLowerCase());
		const category = (entry.category || "").toLowerCase();
		const subcategory = (entry.subcategory || "").toLowerCase();
		const searchable = `${alt} ${keywords.join(" ")} ${category} ${subcategory}`;

		const matches = terms.every((term) => searchable.includes(term));
		if (matches) {
			results.push({ ...entry, codepoint });
		}
	}

	const totalCount = results.length;
	// Apply limit to the results before heavy mapping
	const limitedResults = results.slice(0, limit);

	// Attach combinations for each matched emoji
	const withCombinations = limitedResults.map((entry) => {
		const combos = entry.combinations;
		const combinationList: any[] = [];

		if (combos && typeof combos === "object") {
			for (const [partnerCodepoint, comboEntries] of Object.entries(combos)) {
				if (Array.isArray(comboEntries)) {
					for (const combo of comboEntries) {
						combinationList.push({
							...combo,
							partnerCodepoint,
						});
					}
				}
			}
		}

		return {
			type: "twemoji",
			alt: entry.alt,
			emoji: entry.emoji,
			codepoint: entry.codepoint,
			emojiUrl: `https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u${entry.codepoint.toLowerCase().replace(/-fe0f$/, "")}.png`,
			emojiUrl2: `https://raw.githubusercontent.com/jdecked/twemoji/refs/heads/main/assets/72x72/${entry.codepoint.toLowerCase().replace(/-fe0f$/, "")}.png`,
			gBoardOrder: entry.gBoardOrder,
			keywords: entry.keywords,
			category: entry.category,
			subcategory: entry.subcategory,
			combinationCount: combinationList.length,
		};
	});

	return {
		query: q,
		count: totalCount,
		limit: limit,
		data: withCombinations,
		isFallback: true,
	};
};

export const EmojiKitchen = async function EmojiKitchen(q1: string, q2: string) {
	if (!q1 || !q2) return null;

	const fetchEmoji = async (query: string) => {
		const url = `https://tenor.googleapis.com/v2/featured?key=${process.env.GOOG_TENOR_EMOJI}&client_key=emoji_kitchen_funbox&q=${encodeURIComponent(query)}&collection=emoji_kitchen_v6`;
		const res = await fetch(url, {
			headers: commonHeaders,
		});
		if (res.status === 200) {
			const data = (await res.json()) as any;
			if (data.results && data.results.length > 0) {
				return data.results[0];
			}
		}
		return null;
	};

	try {
		let result = await fetchEmoji(`${q1}_${q2}`);
		if (!result) {
			result = await fetchEmoji(`${q2}_${q1}`);
		}

		if (!result) return { error: "No combination found" };

		return {
			data: result,
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

function discordAutomodName(map: Record<string, number>, value: number) {
	return Object.entries(map).find(([, v]) => v === value)?.[0] || "UNKNOWN";
}

function parseDiscordAutomodMappedNumber(value: any, map: Record<string, number>, label: string) {
	if (value === undefined || value === null || value === "") return { value: undefined as number | undefined };
	const raw = String(value).trim();
	if (/^\d+$/.test(raw)) return { value: parseInt(raw, 10) };
	const key = raw.toUpperCase().replace(/[\s-]+/g, "_");
	if (map[key] !== undefined) return { value: map[key] };
	return {
		error: `Invalid ${label}. Use: ${Object.keys(map).join(", ")} or numeric value`,
	};
}

function parseDiscordAutomodBoolean(value: any, label: string) {
	if (value === undefined || value === null || value === "") return { value: undefined as boolean | undefined };
	const raw = String(value).trim().toLowerCase();
	if (raw === "true" || raw === "1" || raw === "yes") return { value: true };
	if (raw === "false" || raw === "0" || raw === "no") return { value: false };
	return { error: `Invalid ${label}. Use true or false` };
}

function parseDiscordAutomodNumber(value: any, label: string) {
	if (value === undefined || value === null || value === "") return { value: undefined as number | undefined };
	const parsed = parseInt(String(value), 10);
	if (!Number.isFinite(parsed)) return { error: `Invalid ${label}. Use a number` };
	return { value: parsed };
}

function parseDiscordAutomodStringArray(value: any, label: string, jsonArrayOnly = false) {
	if (value === undefined || value === null) return { value: undefined as string[] | undefined };
	if (Array.isArray(value)) return { value: value.map((v) => String(v)).filter(Boolean) };
	const raw = String(value).trim();
	if (!raw) return { value: [] };
	if (raw.startsWith("[")) {
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) return { value: parsed.map((v) => String(v)).filter(Boolean) };
		} catch {}
		return {
			error: `Invalid ${label}. Use a JSON array${jsonArrayOnly ? "" : " or comma-separated values"}`,
		};
	}
	if (jsonArrayOnly) return { error: `Invalid ${label}. Use a JSON array` };
	return {
		value: raw
			.split(",")
			.map((v) => v.trim())
			.filter(Boolean),
	};
}

function parseDiscordAutomodPresetArray(value: any) {
	const parsed = parseDiscordAutomodStringArray(value, "presets");
	if (parsed.error || parsed.value === undefined) return parsed as { value?: number[]; error?: string };

	const presets: number[] = [];
	for (const item of parsed.value) {
		const preset = parseDiscordAutomodMappedNumber(item, DISCORD_AUTOMOD_PRESET_TYPES, "presets");
		if (preset.error || preset.value === undefined) return { error: preset.error || "Invalid presets" };
		presets.push(preset.value);
	}

	return { value: presets };
}

function formatDiscordAutomodRule(rule: any) {
	if (!rule || typeof rule !== "object") return rule;
	const formatted = { ...rule };
	formatted.trigger_type_name = discordAutomodName(DISCORD_AUTOMOD_TRIGGER_TYPES, formatted.trigger_type);
	formatted.event_type_name = discordAutomodName(DISCORD_AUTOMOD_EVENT_TYPES, formatted.event_type);
	formatted.created_at = formatted.id ? String(getSnowflakeDate(formatted.id)) : null;

	if (Array.isArray(formatted.actions)) {
		formatted.actions = formatted.actions.map((action: any) => ({
			...action,
			type_name: discordAutomodName(DISCORD_AUTOMOD_ACTION_TYPES, action.type),
		}));
	}

	if (formatted.trigger_metadata?.presets) {
		formatted.trigger_metadata = {
			...formatted.trigger_metadata,
			presets_resolved: formatted.trigger_metadata.presets.map((p: number) => discordAutomodName(DISCORD_AUTOMOD_PRESET_TYPES, p)),
		};
	}

	return formatted;
}

function buildDiscordAutomodPayload(params: any, mode: "set" | "modify") {
	const rawPayload = params.payload || params.body || params.rule;
	if (rawPayload) {
		try {
			const parsed = JSON.parse(String(rawPayload));
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return { payload: parsed };
		} catch {}
		return { error: "Invalid payload. Use a JSON object" };
	}

	const payload: any = {};
	const name = params.name;
	if (name !== undefined) payload.name = String(name);

	const eventRaw = params.eventType ?? params.event_type;
	const eventType = parseDiscordAutomodMappedNumber(eventRaw ?? (mode === "set" ? "MESSAGE_SEND" : undefined), DISCORD_AUTOMOD_EVENT_TYPES, "eventType");
	if (eventType.error) return { error: eventType.error };
	if (eventType.value !== undefined) payload.event_type = eventType.value;

	const triggerRaw = params.triggerType ?? params.trigger_type;
	const triggerType = parseDiscordAutomodMappedNumber(triggerRaw, DISCORD_AUTOMOD_TRIGGER_TYPES, "triggerType");
	if (triggerType.error) return { error: triggerType.error };
	if (triggerType.value !== undefined) payload.trigger_type = triggerType.value;

	const enabled = parseDiscordAutomodBoolean(params.enabled ?? (mode === "set" ? "true" : undefined), "enabled");
	if (enabled.error) return { error: enabled.error };
	if (enabled.value !== undefined) payload.enabled = enabled.value;

	if (mode === "set") {
		if (!payload.name) return { error: "Missing parameter: name" };
		if (!payload.trigger_type) return { error: "Missing parameter: triggerType" };
	}

	const triggerMetadata: any = {};
	const keywordFilter = parseDiscordAutomodStringArray(params.keywordFilter ?? params.keyword_filter, "keywordFilter", true);
	if (keywordFilter.error) return { error: keywordFilter.error };
	if (keywordFilter.value !== undefined) triggerMetadata.keyword_filter = keywordFilter.value;

	const regexPatterns = parseDiscordAutomodStringArray(params.regexPatterns ?? params.regex_patterns, "regexPatterns");
	if (regexPatterns.error) return { error: regexPatterns.error };
	if (regexPatterns.value !== undefined) triggerMetadata.regex_patterns = regexPatterns.value;

	const allowList = parseDiscordAutomodStringArray(params.allowList ?? params.allow_list, "allowList");
	if (allowList.error) return { error: allowList.error };
	if (allowList.value !== undefined) triggerMetadata.allow_list = allowList.value;

	const presets = parseDiscordAutomodPresetArray(params.presets);
	if (presets.error) return { error: presets.error };
	if (presets.value !== undefined) triggerMetadata.presets = presets.value;

	const mentionTotalLimit = parseDiscordAutomodNumber(params.mentionTotalLimit ?? params.mention_total_limit, "mentionTotalLimit");
	if (mentionTotalLimit.error) return { error: mentionTotalLimit.error };
	if (mentionTotalLimit.value !== undefined) triggerMetadata.mention_total_limit = mentionTotalLimit.value;

	const mentionRaidProtection = parseDiscordAutomodBoolean(params.mentionRaidProtection ?? params.mention_raid_protection_enabled, "mentionRaidProtection");
	if (mentionRaidProtection.error) return { error: mentionRaidProtection.error };
	if (mentionRaidProtection.value !== undefined) triggerMetadata.mention_raid_protection_enabled = mentionRaidProtection.value;

	const eventTypeName = eventType.value !== undefined ? discordAutomodName(DISCORD_AUTOMOD_EVENT_TYPES, eventType.value) : undefined;
	const triggerTypeName = triggerType.value !== undefined ? discordAutomodName(DISCORD_AUTOMOD_TRIGGER_TYPES, triggerType.value) : undefined;

	if (mode === "set") {
		if (eventTypeName === "MESSAGE_SEND" && triggerTypeName === "MEMBER_PROFILE") {
			return {
				error: "Invalid triggerType for eventType MESSAGE_SEND. Use KEYWORD, SPAM, KEYWORD_PRESET, or MENTION_SPAM",
			};
		}
		if (eventTypeName === "GUILD_MEMBER_JOIN_OR_UPDATE" && triggerTypeName !== "MEMBER_PROFILE") {
			return {
				error: "Invalid triggerType for eventType GUILD_MEMBER_JOIN_OR_UPDATE. Use MEMBER_PROFILE",
			};
		}

		if ((triggerTypeName === "KEYWORD" || triggerTypeName === "MEMBER_PROFILE") && !keywordFilter.value?.length && !regexPatterns.value?.length) {
			return { error: "Missing parameter: keywordFilter or regexPatterns" };
		}
		if (triggerTypeName === "KEYWORD_PRESET" && !presets.value?.length) {
			return { error: "Missing parameter: presets" };
		}
		if (triggerTypeName === "MENTION_SPAM" && mentionTotalLimit.value === undefined) {
			return { error: "Missing parameter: mentionTotalLimit" };
		}
	}

	if (Object.keys(triggerMetadata).length || mode === "set") payload.trigger_metadata = triggerMetadata;

	if (params.actions) {
		try {
			const actions = JSON.parse(String(params.actions));
			if (!Array.isArray(actions)) return { error: "actions must be a JSON array" };
			payload.actions = actions;
		} catch {
			return { error: "Invalid actions. Use a JSON array" };
		}
	} else {
		const hasActionInput = params.actionType !== undefined || params.action !== undefined || params.alertChannelId !== undefined || params.alert_channel_id !== undefined || params.timeoutSeconds !== undefined || params.duration_seconds !== undefined || params.customMessage !== undefined || params.custom_message !== undefined;
		if (hasActionInput || mode === "set") {
			const rawActionType = String(params.actionType ?? params.action ?? "BLOCK_MESSAGE")
				.trim()
				.replace(/[\s]+/g, "");
			const actionTypeEntries = rawActionType
				.split(",")
				.map((v: string) => v.trim())
				.filter(Boolean);

			const actions: any[] = [];
			const alertChannelId = params.alertChannelId ?? params.alert_channel_id;
			const timeoutSeconds = parseDiscordAutomodNumber(params.timeoutSeconds ?? params.duration_seconds, "timeoutSeconds");
			if (timeoutSeconds.error) return { error: timeoutSeconds.error };

			for (const entry of actionTypeEntries) {
				const actionType = parseDiscordAutomodMappedNumber(entry, DISCORD_AUTOMOD_ACTION_TYPES, "actionType");
				if (actionType.error || actionType.value === undefined) return { error: actionType.error || "Invalid actionType" };
				const actionTypeName = discordAutomodName(DISCORD_AUTOMOD_ACTION_TYPES, actionType.value);

				if (mode === "set") {
					if (triggerTypeName === "MEMBER_PROFILE" && actionTypeName !== "BLOCK_MEMBER_INTERACTION") {
						return {
							error: "Invalid actionType for triggerType MEMBER_PROFILE. Use BLOCK_MEMBER_INTERACTION",
						};
					}
					if (triggerTypeName !== "MEMBER_PROFILE" && actionTypeName === "BLOCK_MEMBER_INTERACTION") {
						return {
							error: "Invalid actionType. BLOCK_MEMBER_INTERACTION requires triggerType MEMBER_PROFILE",
						};
					}
				}

				const action: any = { type: actionType.value };
				const metadata: any = {};
				const customMessage = params.customMessage ?? params.custom_message;
				if (customMessage !== undefined) metadata.custom_message = String(customMessage);
				if (actionTypeName === "SEND_ALERT_MESSAGE" && (alertChannelId === undefined || alertChannelId === "")) return { error: "Missing parameter: alertChannelId" };
				if (alertChannelId !== undefined && alertChannelId !== "") metadata.channel_id = String(alertChannelId);
				if (actionTypeName === "TIMEOUT" && timeoutSeconds.value === undefined) return { error: "Missing parameter: timeoutSeconds" };
				if (timeoutSeconds.value !== undefined) metadata.duration_seconds = timeoutSeconds.value;
				if (Object.keys(metadata).length) action.metadata = metadata;
				actions.push(action);
			}

			payload.actions = actions;
		}
	}

	const exemptRoles = parseDiscordAutomodStringArray(params.exemptRoles ?? params.exempt_roles, "exemptRoles");
	if (exemptRoles.error) return { error: exemptRoles.error };
	if (exemptRoles.value !== undefined) payload.exempt_roles = exemptRoles.value;

	const exemptChannels = parseDiscordAutomodStringArray(params.exemptChannels ?? params.exempt_channels, "exemptChannels");
	if (exemptChannels.error) return { error: exemptChannels.error };
	if (exemptChannels.value !== undefined) payload.exempt_channels = exemptChannels.value;

	return { payload };
}

async function fetchDiscordAutomodRule(ruleUrl: string, headers: any) {
	const req = await discordFetch(ruleUrl, { headers });
	let data: any = null;
	try {
		data = await req.json();
	} catch {}
	return { status: req.status, statusText: req.statusText, data };
}

export const DiscordSetAutomod = async (token: string, guildId: string, ruleId: string | undefined, params: any, mode: "set" | "modify") => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!guildId) return { error: "Missing guildId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
	};
	const reason = params.reason;
	if (reason) headers["X-Audit-Log-Reason"] = encodeURIComponent(String(reason));

	try {
		const baseUrl = `https://discord.com/api/v10/guilds/${guildId}/auto-moderation/rules`;
		let operationMode = mode;
		let resolvedRuleId = ruleId;
		let existingRule: any = null;

		if (resolvedRuleId) {
			const existing = await fetchDiscordAutomodRule(`${baseUrl}/${resolvedRuleId}`, headers);
			if (existing.status === 200) existingRule = existing.data;
			else if (existing.status !== 404) {
				return {
					data: null,
					error: existing.data || {
						status: existing.status,
						statusText: existing.statusText,
					},
				};
			}
		} else if (operationMode === "modify") {
			if (!params.name) return { error: "Missing parameter: ruleId or name" };
			const rules = await fetchDiscordAutomodRule(baseUrl, headers);
			if (rules.status !== 200) {
				return {
					data: null,
					error: rules.data || {
						status: rules.status,
						statusText: rules.statusText,
					},
				};
			}
			if (!Array.isArray(rules.data)) return { error: "Invalid automod rules response" };
			existingRule = rules.data.find((rule: any) => rule?.name === String(params.name));
			resolvedRuleId = existingRule?.id;
		}

		if (operationMode === "set" && existingRule) {
			return {
				data: null,
				error: {
					message: "Automod rule already exists",
					ruleId: resolvedRuleId,
					rule: formatDiscordAutomodRule(existingRule),
				},
			};
		}

		if (operationMode === "modify" && (!existingRule || !resolvedRuleId)) {
			if (!ruleId) operationMode = "set";
			else
				return {
					data: null,
					error: {
						message: "Automod rule not found",
						ruleId: resolvedRuleId,
						name: params.name ? String(params.name) : undefined,
					},
				};
		}

		const built = buildDiscordAutomodPayload(params, operationMode);
		if (built.error) return { error: built.error };
		const payload = built.payload || {};

		if (operationMode === "modify" && existingRule) {
			for (const field of ["name", "event_type", "trigger_type", "enabled", "trigger_metadata", "actions", "exempt_roles", "exempt_channels"] as const) {
				if (payload[field] === undefined && existingRule[field] !== undefined) {
					payload[field] = existingRule[field];
				}
			}
		}

		if (operationMode === "modify" && Object.keys(payload).length === 0) {
			return { data: [formatDiscordAutomodRule(existingRule), null, 204] };
		}

		const response = await discordFetch(operationMode === "modify" ? `${baseUrl}/${resolvedRuleId}` : baseUrl, {
			method: operationMode === "modify" ? "PATCH" : "POST",
			headers,
			body: JSON.stringify(payload),
		});

		let result: any = null;
		try {
			result = await response.json();
		} catch {}

		if (response.status < 200 || response.status >= 300) {
			return {
				data: operationMode === "modify" ? [formatDiscordAutomodRule(existingRule), null, response.status] : null,
				error: result || {
					status: response.status,
					statusText: response.statusText,
				},
			};
		}

		return {
			data: [operationMode === "modify" ? formatDiscordAutomodRule(existingRule) : null, formatDiscordAutomodRule(result), response.status, ...(reason ? [String(reason)] : [])],
		};
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const DiscordInfoAutomod = async (token: string, guildId: string, ruleId: string | null = null) => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!guildId) return { error: "Missing guildId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
	};

	try {
		const urlRules = ruleId ? `https://discord.com/api/v10/guilds/${guildId}/auto-moderation/rules/${ruleId}` : `https://discord.com/api/v10/guilds/${guildId}/auto-moderation/rules`;
		const urlGuild = `https://discord.com/api/v10/guilds/${guildId}`;

		const [rulesReq, guildReq] = await Promise.all([discordFetch(urlRules, { headers }), discordFetch(urlGuild, { headers })]);

		let rulesData: any = null;
		let guildData: any = null;

		try {
			rulesData = await rulesReq.json();
		} catch {}
		try {
			guildData = await guildReq.json();
		} catch {}

		if (rulesReq.status !== 200) {
			return {
				data: null,
				error: rulesData || {
					status: rulesReq.status,
					statusText: rulesReq.statusText,
				},
			};
		}

		let formattedRules = rulesData;
		if (!Array.isArray(rulesData) && rulesData && ruleId) {
			formattedRules = [rulesData];
		}
		if (Array.isArray(formattedRules)) {
			formattedRules = formattedRules.map((rule: any) => {
				const triggerTypeName = discordAutomodName(DISCORD_AUTOMOD_TRIGGER_TYPES, rule.trigger_type);
				const eventTypeName = discordAutomodName(DISCORD_AUTOMOD_EVENT_TYPES, rule.event_type);
				const resolvedActions = (rule.actions || []).map((action: any) => {
					const actionTypeName = discordAutomodName(DISCORD_AUTOMOD_ACTION_TYPES, action.type);
					return {
						...action,
						type_name: actionTypeName,
					};
				});

				const triggerMetadata = rule.trigger_metadata || {};
				if (triggerMetadata.presets) {
					triggerMetadata.presets_resolved = triggerMetadata.presets.map((p: number) => discordAutomodName(DISCORD_AUTOMOD_PRESET_TYPES, p));
				}

				return {
					...rule,
					trigger_type_name: triggerTypeName,
					event_type_name: eventTypeName,
					actions: resolvedActions,
					trigger_metadata: triggerMetadata,
					created_at: rule.id ? String(getSnowflakeDate(rule.id)) : null,
				};
			});
		}

		let contentFilters: any = null;
		if (guildReq.status === 200 && guildData && guildData.explicit_content_filter !== undefined) {
			const filterLevel = guildData.explicit_content_filter;
			const EXPLICIT_CONTENT_FILTER_LEVELS: Record<number, { name: string; description: string }> = {
				0: { name: "DISABLED", description: "Do not filter" },
				1: {
					name: "MEMBERS_WITHOUT_ROLES",
					description: "Filter messages from server members without roles",
				},
				2: {
					name: "ALL_MEMBERS",
					description: "Filter messages from all members",
				},
			};
			const resolved = EXPLICIT_CONTENT_FILTER_LEVELS[filterLevel] || {
				name: "UNKNOWN",
				description: "Unknown",
			};
			contentFilters = {
				explicit_content_filter: filterLevel,
				...resolved,
			};
		}

		const count = {
			total: 0,
			disable: 0,
			enable: 0,
			types: {
				MESSAGE_SEND: 0,
				UNKNOWN: 0,
			} as Record<string, number>,
			triggers: {
				SPAM: 0,
				UNKNOWN: 0,
				MENTION_SPAM: 0,
				KEYWORD: 0,
				KEYWORD_PRESET: 0,
			} as Record<string, number>,
		};

		if (Array.isArray(formattedRules)) {
			count.total = formattedRules.length;
			formattedRules.forEach((rule: any) => {
				if (rule.enabled) {
					count.enable++;
				} else {
					count.disable++;
				}
				const eventTypeName = rule.event_type_name || "UNKNOWN";
				count.types[eventTypeName] = (count.types[eventTypeName] || 0) + 1;

				const triggerTypeName = rule.trigger_type_name || "UNKNOWN";
				count.triggers[triggerTypeName] = (count.triggers[triggerTypeName] || 0) + 1;
			});
		}

		return {
			data: {
				content: formattedRules,
				content_filters: contentFilters,
			},
			count: count,
		};
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const AppleMusicSearch = async function AppleMusicSearch(query: string, limit: number = 1) {
	if (!query) return null;
	try {
		const [res, res2, res3, res4, res5, res6] = await Promise.all([
			fetch(`https://itunes.apple.com/search?media=music&limit=${limit}&country=US&term=${encodeURIComponent(query)}`, {
				headers: commonHeaders,
			}),
			fetch(`https://music.apple.com/us/search?term=${encodeURIComponent(query)}`, {
				headers: commonHeaders,
			}),
			fetch(`https://itunes.apple.com/search?media=audiobook&limit=${limit}&country=US&term=${encodeURIComponent(query)}`, {
				headers: commonHeaders,
			}),
			fetch(`https://itunes.apple.com/search?media=podcast&limit=${limit}&country=US&term=${encodeURIComponent(query)}`, {
				headers: commonHeaders,
			}),
			fetch(`https://itunes.apple.com/search?media=musicVideo&limit=${limit}&country=US&term=${encodeURIComponent(query)}`, {
				headers: commonHeaders,
			}),
			fetch(`https://itunes.apple.com/search?media=tvShow&limit=${limit}&country=US&term=${encodeURIComponent(query)}`, {
				headers: commonHeaders,
			}),
		]);

		const [lks, lks2, lks3, lks4, lks5, lks6]: any = await Promise.all([res.json(), res2.text(), res3.json(), res4.json(), res5.json(), res6.json()]);

		let parselks2: any = [];
		try {
			const serverDataMatch = lks2.match(/<script[^>]*id=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/);
			if (serverDataMatch) {
				parselks2 = JSON.parse(serverDataMatch[1]);
			}
		} catch (e) {
			console.error("Apple Music parse error:", e);
		}

		return {
			data: [
				{
					music: lks?.results || null,
					musicVideo: lks5?.results || null,
					audiobook: lks3?.results || null,
					podcast: lks4?.results || null,
					tvShow: lks6?.results || null,
				},
				parselks2?.data?.[0]?.data?.sections || null,
			],
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const stockCake = async function stockCake(query: string) {
	if (!query) return null;
	try {
		const req = await fetch(`https://stockcake.com/api/search-typesense?size=100&page=1&locale=en&keyword=${encodeURIComponent(query)}`, { headers: commonHeaders });

		if (req.status === 403) {
			return {
				error: "Cloudflare Turnstile asking to verify you're not a bot",
			};
		}

		const res: any = await req.json();
		return { total: res.total, data: res?.results || [] };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const Pixabay = async function Pixabay(query: string) {
	if (!query) return null;
	try {
		const req = await fetch(`https://pixabay.com/en/images/search/${encodeURIComponent(query)}/?pagi=1`, {
			headers: {
				...commonHeaders,
				Accept: "application/json",
				"x-fetch-bootstrap": "1",
				"sec-fetch-dest": "empty",
				"sec-fetch-mode": "cors",
				"sec-fetch-site": "same-origin",
				referer: `https://pixabay.com/id/images/search/${encodeURIComponent(query)}/`,
				"user-agent": commonHeaders["User-Agent"] + " Pixabay",
			},
		});

		if (req.status === 403) {
			return {
				error: "Cloudflare Turnstile asking to verify you're not a bot",
			};
		}

		const res: any = await req.json();
		const res2: any = res.page.results?.map((a: any) => (a?.mediaType === "photo" ? a : null)).filter(Boolean);
		return { total: res.page.total, data: res2 || [] };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const SnapchatProfile = async function SnapchatProfile(query: string) {
	if (!query) return null;
	try {
		const req = await fetch(`https://www.snapchat.com/@${encodeURIComponent(query)}`, {
			headers: commonHeaders,
		});

		if (req.status === 403) {
			return { error: "IP Blocked" };
		}

		const res: any = await req.text();
		let finalres: any;
		try {
			finalres = JSON.parse(res.split('script id="__NEXT_DATA__" type="application/json">')?.[1]?.split("</script>")?.[0]);
		} catch {}

		if (finalres?.props?.pageProps?.status) return { data: null };
		const { viewerInfo, localization, showSnapExpiredToast, lensCursor, curatedHighlightsCursor, spotlightHighlightsCursor, gaid, locale, messages, serverSideConfigs, ...secres } = finalres.props.pageProps;
		return {
			data: {
				...secres,
				...(secres?.encodedSpotlightComments
					? {
							encodedSpotlightComments: JSON.parse(secres.encodedSpotlightComments).flat(Infinity),
						}
					: {}),
				userProfile: secres?.userProfile?.publicProfileInfo || null,
			},
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const GoogleGemma = async function GoogleGemma(query: string) {
	if (!query) return null;

	try {
		const res = await fetch(atob("aHR0cHM6Ly9tdWx0aS1tb2RhbC5haS5jbG91ZGZsYXJlLmNvbS9hcGkvaW5mZXJlbmNl"), {
			method: "POST",
			headers: { ...commonHeaders, "Content-Type": "application/json" },
			body: JSON.stringify({
				model: "@hf/google/gemma-7b-it",
				prompt: query,
				max_tokens: 256,
				stream: true,
			}),
		});

		if (!res.ok) {
			return { error: `${res.status} - Can't process this` };
		}

		const text = await res.text();
		let response = "";
		let usage = null;

		for (const line of text.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed.startsWith("data:")) continue;
			const payload = trimmed.slice(5).trim();
			if (payload === "[DONE]") break;
			try {
				const json = JSON.parse(payload);
				if (json.response) response += json.response;
				if (json.usage) usage = json.usage;
			} catch {}
		}

		return {
			response: response || null,
			data: { model: "gemma-7b-it", ...(usage || {}) },
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const DiscordDeleteAutomod = async (token: string, guildId: string, ruleId: string, reasonAudit?: string) => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!guildId) return { error: "Missing guildId" };
	if (!ruleId) return { error: "Missing ruleId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
		...(reasonAudit && { "X-Audit-Log-Reason": reasonAudit }),
	};

	try {
		const ruleUrl = `https://discord.com/api/v10/guilds/${guildId}/auto-moderation/rules/${ruleId}`;
		const req = await discordFetch(ruleUrl, { method: "DELETE", headers });

		if (req.status === 204 || req.status === 200) {
			return { data: [null, req.status] };
		}

		let data: any = null;
		try {
			data = await req.json();
		} catch {}

		return {
			data: null,
			error: data || {
				status: req.status,
				statusText: req.statusText,
			},
		};
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const RadioSearch = async function RadioSearch(query: string) {
	if (!query) return null;
	try {
		const res = await fetch(`https://all.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(query)}&limit=25&order=votes&reverse=true`, {
			headers: commonHeaders,
		});
		let data: any;
		try {
			data = await res.json();
		} catch {}
		return {
			data: data || null,
		};
	} catch (e: any) {
		return null;
	}
};

// Helper to recursively replace placeholder pattern "{w}x{h}{c}.{f}" with "1x1ss.png" in any string values within an object
function replacePlaceholdersInLockup(value: any): any {
	if (typeof value === "string") {
		return value.replace(/\{w\}x\{h\}\{c\}\.\{f\}/g, "1x1ss.png");
	}
	if (Array.isArray(value)) {
		return value.map(replacePlaceholdersInLockup);
	}
	if (value && typeof value === "object") {
		const newObj: any = {};
		for (const k in value) {
			newObj[k] = replacePlaceholdersInLockup(value[k]);
		}
		return newObj;
	}
	return value;
}

export const AppstoreSearch = async function AppstoreSearch(query: string, type: string) {
	if (!query) return null;
	try {
		const req = await fetch(`https://apps.apple.com/us/${type}/search?term=${query}`, { headers: commonHeaders });

		let parseres: any;
		try {
			const res = await req.text();
			const serverDataMatch = res.match(/<script[^>]*id=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/);
			if (serverDataMatch) {
				parseres = JSON.parse(serverDataMatch[1]);
			}
		} catch (e) {
			console.error("App Store parse error:", e);
		}

		const finalres: any = parseres?.data?.[0]?.data?.shelves?.[0]?.items
			?.filter((a: any) => !!a?.lockup)
			?.map((a: any) => {
				const processedLockup = replacePlaceholdersInLockup(a.lockup);
				const processedAppEvent = replacePlaceholdersInLockup(a?.appEvent);
				return {
					...processedLockup,
					currentEvent: processedAppEvent || null,
				};
			});

		return {
			_warning: "Strict rate-limiting. Response may return null",
			searchType: type,
			data: finalres || null,
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const DiscordListMemberTags = async (token: string, guildId: string, type: string = "all", outputLimit: number | null = null, self: boolean = false) => {
	if (!token || token === "null") return { error: "Missing token" };
	if (!guildId) return { error: "Missing guildId" };

	const headers: any = {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
		"User-Agent": discordUserAgent,
	};

	try {
		let data: any[] = [];
		let lastMemberId: string | null = null;
		let guildInfo: any = null;

		const [memberStartRes, guildRes] = await Promise.all([
			discordFetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, { headers }),
			discordFetch(`https://discord.com/api/v10/guilds/${guildId}`, {
				headers,
			}),
		]);

		if (guildRes.status === 200) {
			try {
				guildInfo = await guildRes.json();
			} catch {}
		}

		if (memberStartRes.status === 200) {
			try {
				const batch: any = await memberStartRes.json();
				if (Array.isArray(batch) && batch.length > 0) {
					data.push(...batch);
					if (batch.length >= 1000) {
						lastMemberId = batch[batch.length - 1].user?.id;
					}
				}
			} catch {}
		}

		while (lastMemberId) {
			const currentFetchLimit = 1000;
			const urlMembers = `https://discord.com/api/v10/guilds/${guildId}/members?limit=${currentFetchLimit}&after=${lastMemberId}`;

			const memberRes = await discordFetch(urlMembers, { headers });
			if (memberRes.status !== 200) break;

			const batch: any = await memberRes.json();
			if (!Array.isArray(batch) || batch.length === 0) break;

			data.push(...batch);
			if (batch.length < currentFetchLimit) break;
			lastMemberId = batch[batch.length - 1].user?.id;
		}

		if (type) {
			const typeSet = type.split(",").map((t: string) => t.trim());
			for (const t of typeSet) {
				if (t === "oldest") data.sort((a: any, b: any) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
				else if (t === "newest") data.sort((a: any, b: any) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime());
			}
		}

		const guildMap: Record<string, any> = {};

		for (const member of data) {
			const user = member.user || member;
			const clan = member.clan || user.clan || member.primary_guild || user.primary_guild;
			const identityGuildId = clan?.identity_guild_id || (clan ? guildId : null);

			if (!identityGuildId) continue;

			if (!guildMap[identityGuildId]) {
				guildMap[identityGuildId] = {
					id: identityGuildId,
					tag: null,
					badge: null,
					badge_url: null,
					identify_enabled: null,
					members: [],
				};
			}

			const entry = guildMap[identityGuildId];
			if (clan) {
				entry.tag = clan.tag || null;
				entry.badge = clan.badge || null;
				entry.badge_url = clan.badge ? `https://cdn.discordapp.com/clan-badges/${identityGuildId}/${clan.badge}.png` : null;
				entry.identify_enabled = clan.identity_enabled ?? null;
			}
			entry.members.push(formatDiscordUser(user));
		}

		if (guildInfo && !guildMap[guildId]) {
			if (guildInfo.tag) {
				guildMap[guildId] = {
					id: guildId,
					tag: guildInfo.tag || null,
					badge: guildInfo.badge || null,
					badge_url: guildInfo.badge ? `https://cdn.discordapp.com/clan-badges/${guildId}/${guildInfo.badge}.png` : null,
					identify_enabled: guildInfo.identity_enabled ?? null,
					members: [],
				};
			} else {
				guildMap[guildId] = { id: guildId };
			}
		} else if (guildInfo?.tag && guildMap[guildId]) {
			guildMap[guildId].tag = guildMap[guildId].tag || guildInfo.tag;
			guildMap[guildId].badge = guildMap[guildId].badge || guildInfo.badge;
			guildMap[guildId].badge_url = guildMap[guildId].badge_url || (guildInfo.badge ? `https://cdn.discordapp.com/clan-badges/${guildId}/${guildInfo.badge}.png` : null);
			guildMap[guildId].identify_enabled = guildMap[guildId].identify_enabled ?? guildInfo.identity_enabled ?? null;
		}

		let dataArray = Object.values(guildMap);

		if (type) {
			const typeSet = type.split(",").map((t: string) => t.trim());
			for (const t of typeSet) {
				if (t === "oldest_guild") dataArray.sort((a: any, b: any) => parseInt(a.id || "0") - parseInt(b.id || "0"));
				else if (t === "newest_guild") dataArray.sort((a: any, b: any) => parseInt(b.id || "0") - parseInt(a.id || "0"));
			}
		}

		if (self) {
			dataArray = dataArray.filter((e: any) => e.id === guildId);
		}

		const output = outputLimit ? dataArray.slice(0, outputLimit) : dataArray;
		const outputMap: Record<string, any> = {};
		for (const entry of output) {
			const { id, ...rest } = entry;
			outputMap[id] = rest;
		}

		const tagsCount = Object.values(guildMap).filter((e: any) => e.tag).length;
		const usersCount = Object.values(guildMap).reduce((acc: number, e: any) => acc + (e.members?.length || 0), 0);
		const cachedMembersCount = data.length;

		return {
			_warning: "Using this endpoint can put your bot (discord) rate-limits faster",
			tagsCount,
			usersCount,
			cachedMembersCount,
			data: outputMap,
		};
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

// Country metadata cache
let countriesCache: any = null;
let countriesCachePromise: Promise<void> | null = null;

async function ensureCountriesCache() {
	if (countriesCache) return;
	if (countriesCachePromise) return countriesCachePromise;
	countriesCachePromise = (async () => {
		try {
			const res = await fetch("https://countries.altoal.com/api/v1/metadata.json", { headers: commonHeaders });
			const json: any = await res.json();
			countriesCache = json?.countries || null;
		} catch (e) {
			console.error("Failed to fetch countries metadata:", e);
		}
	})();
	return countriesCachePromise;
}

export const warmupCountriesCache = ensureCountriesCache;

export const CountrySearch = async (query: string) => {
	if (!query) return { error: "Missing query" };
	await ensureCountriesCache();
	if (!countriesCache) return { error: "Failed to load countries data" };

	const lowerQuery = query.toLowerCase();
	let matchedKey: string | null = null;

	if (countriesCache[lowerQuery]) matchedKey = lowerQuery;

	if (!matchedKey) {
		for (const [key, country] of Object.entries<any>(countriesCache)) {
			if (country.name?.toLowerCase() === lowerQuery || country.code?.iso2?.toLowerCase() === lowerQuery || country.code?.iso3?.toLowerCase() === lowerQuery) {
				matchedKey = key;
				break;
			}
		}
	}

	if (!matchedKey) {
		for (const [key, country] of Object.entries<any>(countriesCache)) {
			if (country.name?.toLowerCase().includes(lowerQuery)) {
				matchedKey = key;
				break;
			}
		}
	}

	if (!matchedKey) return { error: "Country not found" };

	const allMatches = [matchedKey];
	for (const [key, country] of Object.entries<any>(countriesCache)) {
		if (key !== matchedKey && (country.name?.toLowerCase().includes(lowerQuery) || country.code?.iso2?.toLowerCase().includes(lowerQuery) || country.code?.iso3?.toLowerCase().includes(lowerQuery))) {
			allMatches.push(key);
		}
	}

	const similarNames = allMatches.slice(1).map((key: string) => ({
		key,
		name: countriesCache[key]?.name,
	}));

	try {
		const res = await fetch(`https://countries.altoal.com/api/v1/name/${encodeURIComponent(matchedKey)}.json`, { headers: commonHeaders });
		const detail: any = await res.json();
		const d = detail?.data;

		const altData: Record<string, any> = {};
		if (d) {
			const langs = d.people_and_society?.languages?.value?.map((l: any) => l.label) || [];
			altData.name = d.name;
			altData.description = d.introduction?.background?.value?.string ?? null;
			altData.icon = d.identity?.iso?.alpha2 ? `https://flagcdn.com/w320/${d.identity.iso.alpha2.toLowerCase()}.png` : null;
			altData.area = d.geography?.area?.value?.total?.measurement ?? null;
			altData.area_unit = d.geography?.area?.value?.total?.unit ?? null;
			altData.calling_code = d.identity?.communication?.calling_code ?? null;
			altData.capital = d.government?.capital?.value?.name?.string ?? null;
			altData.continent = d.identity?.classification?.continent ?? null;
			altData.cca2 = d.identity?.iso?.alpha2 ?? null;
			altData.cca3 = d.identity?.iso?.alpha3 ?? null;
			altData.ccn3 = d.identity?.iso?.numeric ?? null;
			altData.currency_symbol = d.identity?.currency?.symbol ?? null;
			altData.currency_name = d.identity?.currency?.name ?? null;
			altData.sovereign_type = d.identity?.classification?.type ?? null;
			altData.landlocked = d.identity?.classification?.landlocked ?? null;
			altData.population = d.people_and_society?.population?.value?.total?.number ?? null;
			altData.region = d.identity?.classification?.region ?? null;
			altData.subregion = d.identity?.classification?.subregion ?? null;
			altData.tld = d.identity?.communication?.tld ?? null;
			altData.un_member = d.identity?.memberships?.united_nations?.member ?? null;
			altData.languages = {
				array: langs,
				string: langs.join(", "),
			};
		}

		return {
			data: d || null,
			altData: Object.keys(altData).length > 0 ? altData : null,
			similarName: similarNames.length > 0 ? similarNames : null,
		};
	} catch (e: any) {
		return { error: e.message || "Failed to fetch country details" };
	}
};

export const MealRecipe = async (query: string) => {
	if (!query) return { error: "Missing query" };
	try {
		const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`, {
			headers: commonHeaders,
		});
		const json: any = await res.json();
		const meals = json?.meals || null;
		if (!meals) return { data: null };

		const simplified = meals.map((meal: any) => {
			const ingredients: { name: string; measure: string }[] = [];
			for (let i = 1; i <= 20; i++) {
				const name = meal[`strIngredient${i}`];
				const measure = meal[`strMeasure${i}`];
				if (name?.trim()) {
					ingredients.push({
						name: name.trim(),
						measure: (measure || "").trim(),
					});
				}
			}

			const ingredientsString = ingredients.map((i) => `${i.measure} ${i.name}`).join(", ");

			// 😭
			const { strIngredient1, strMeasure1, strIngredient2, strMeasure2, strIngredient3, strMeasure3, strIngredient4, strMeasure4, strIngredient5, strMeasure5, strIngredient6, strMeasure6, strIngredient7, strMeasure7, strIngredient8, strMeasure8, strIngredient9, strMeasure9, strIngredient10, strMeasure10, strIngredient11, strMeasure11, strIngredient12, strMeasure12, strIngredient13, strMeasure13, strIngredient14, strMeasure14, strIngredient15, strMeasure15, strIngredient16, strMeasure16, strIngredient17, strMeasure17, strIngredient18, strMeasure18, strIngredient19, strMeasure19, strIngredient20, strMeasure20, strCreativeCommonsConfirmed, strImageSource, dateModified, ...rest } = meal;

			return {
				...rest,
				ingredients,
				ingredientsString,
				dateModified: dateModified ? Math.floor(new Date(dateModified).getTime() / 1000) : null,
			};
		});

		return { data: simplified };
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

export const holidaysTime = async (query: string, year: string) => {
	const getEaster = (y: number): Date => {
		const a = y % 19;
		const b = Math.floor(y / 100);
		const c = y % 100;
		const d = Math.floor(b / 4);
		const e = b % 4;
		const f = Math.floor((b + 8) / 25);
		const g = Math.floor((b - f + 1) / 3);
		const h = (19 * a + b - d - g + 15) % 30;
		const i = Math.floor(c / 4);
		const k = c % 4;
		const l = (32 + 2 * e + 2 * i - h - k) % 7;
		const m = Math.floor((a + 11 * h + 22 * l) / 451);
		const month = Math.floor((h + l - 7 * m + 114) / 31);
		const day = ((h + l - 7 * m + 114) % 31) + 1;
		return new Date(y, month - 1, day);
	};

	const getThanksgiving = (y: number): Date => {
		const d = new Date(y, 10, 1);
		const dow = d.getDay();
		const firstThu = 1 + ((4 - dow + 7) % 7);
		return new Date(y, 10, firstThu + 21);
	};

	if (!query) {
		const yearNum = year && /^\d{4}$/.test(year) ? parseInt(year) : new Date().getFullYear();
		const now = Math.floor(Date.now() / 1000);
		const pad = (n: number) => String(n).padStart(2, "0");
		const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
		const data: Record<string, any> = {};
		for (const y of [yearNum, yearNum + 1]) {
			const easter = getEaster(y);
			const thanksgiving = getThanksgiving(y);
			const defaults = [
				{
					key: "new_years_day",
					name: "New Year's Day",
					date: `${y}-01-01`,
					countryCode: "US",
					nationalHoliday: true,
					types: ["Public"],
				},
				{
					key: "valentines_day",
					name: "Valentine's Day",
					date: `${y}-02-14`,
					countryCode: "US",
					nationalHoliday: false,
					types: ["Observance"],
				},
				{
					key: "april_fools",
					name: "April Fools' Day",
					date: `${y}-04-01`,
					countryCode: "US",
					nationalHoliday: false,
					types: ["Observance"],
				},
				{
					key: "easter_egg",
					name: "Easter",
					date: fmt(easter),
					countryCode: "US",
					nationalHoliday: false,
					types: ["Observance"],
				},
				{
					key: "halloween",
					name: "Halloween",
					date: `${y}-10-31`,
					countryCode: "US",
					nationalHoliday: false,
					types: ["Observance"],
				},
				{
					key: "thanksgiving_day",
					name: "Thanksgiving Day",
					date: fmt(thanksgiving),
					countryCode: "US",
					nationalHoliday: true,
					types: ["Public"],
				},
				{
					key: "christmas_day",
					name: "Christmas Day",
					date: `${y}-12-25`,
					countryCode: "US",
					nationalHoliday: true,
					types: ["Public"],
				},
			];
			for (const h of defaults) {
				const timestamp = Math.floor(new Date(h.date).getTime() / 1000);
				if (timestamp - now < 0) continue;
				if (data[h.key]) continue;
				data[h.key] = {
					date: h.date,
					name: h.name,
					countryCode: h.countryCode,
					nationalHoliday: h.nationalHoliday,
					types: h.types,
					timestamp,
					remainTimestamp: timestamp - now,
				};
			}
		}
		return { data, altData: null };
	}

	if (!year || !/^\d{4}$/.test(year)) return { error: "Missing or invalid year" };

	await ensureCountriesCache();
	if (!countriesCache) return { error: "Failed to load countries data" };

	const lowerQuery = query.toLowerCase();
	let countryCode: string | null = null;
	let countryNameSlug: string | null = null;

	for (const [, country] of Object.entries<any>(countriesCache)) {
		if (country.name?.toLowerCase() === lowerQuery || country.code?.iso2?.toLowerCase() === lowerQuery || country.code?.iso3?.toLowerCase() === lowerQuery) {
			countryCode = country.code?.iso2;
			countryNameSlug = country.name
				?.toLowerCase()
				.replace(/[^a-z]/g, "-")
				.replace(/-+/g, "-")
				.replace(/^-|-$/g, "");
			break;
		}
	}

	if (!countryCode) {
		for (const [, country] of Object.entries<any>(countriesCache)) {
			if (country.name?.toLowerCase().includes(lowerQuery)) {
				countryCode = country.code?.iso2;
				countryNameSlug = country.name
					?.toLowerCase()
					.replace(/[^a-z]/g, "-")
					.replace(/-+/g, "-")
					.replace(/^-|-$/g, "");
				break;
			}
		}
	}

	if (!countryCode) return { error: "Country not found" };

	try {
		const yNum = parseInt(year);
		const [holidayRes, holidayResNext, countryRes] = await Promise.all([fetch(`https://date.nager.at/api/v4/Holidays/${countryCode.toUpperCase()}/${yNum}`, { headers: commonHeaders }), fetch(`https://date.nager.at/api/v4/Holidays/${countryCode.toUpperCase()}/${yNum + 1}`, { headers: commonHeaders }), fetch(`https://countries.altoal.com/api/v1/name/${countryNameSlug}.json`, { headers: commonHeaders }).catch(() => null)]);

		if (holidayRes.status === 204) return { error: "Access restricted" };
		else if (holidayRes.status !== 200) return { error: await holidayRes.json() };

		let holidays: any[] = [];
		try {
			const cur = await holidayRes.json();
			if (Array.isArray(cur)) holidays = holidays.concat(cur);
		} catch {}
		if (holidayResNext.status === 200) {
			try {
				const nxt = await holidayResNext.json();
				if (Array.isArray(nxt)) holidays = holidays.concat(nxt);
			} catch {}
		}

		const countryJson = countryRes?.ok ? await countryRes.json().catch(() => null) : null;
		const identity = countryJson?.data?.identity || null;

		const altData: Record<string, any> | null = identity
			? {
					icon: `https://flagcdn.com/w320/${identity.iso?.alpha2?.toLowerCase()}.png`,
					name: identity.names?.common,
					official_name: identity.names?.official,
					native_name: identity.names?.native,
					cca2: identity.iso?.alpha2,
					cca3: identity.iso?.alpha3,
					ccn3: identity.iso?.numeric,
					type: identity.classification?.type,
					region: identity.classification?.region,
					subregion: identity.classification?.subregion,
					continent: identity.classification?.continent,
					island_nation: identity.classification?.island_nation,
					calling_code: identity.communication?.calling_code,
					tld: identity.communication?.tld,
				}
			: null;

		const now = Math.floor(Date.now() / 1000);
		const data: Record<string, any> = {};
		for (const h of holidays) {
			const timestamp = Math.floor(new Date(h.date).getTime() / 1000);
			if (timestamp - now < 0) continue;
			const key = h.name
				.replace(/'/g, "")
				.replace(/[^a-zA-Z0-9]/g, "_")
				.replace(/_+/g, "_")
				.replace(/^_|_$/g, "")
				.toLowerCase();
			if (data[key]) continue;
			data[key] = {
				date: h.date,
				name: h.name,
				countryCode: h.countryCode,
				nationalHoliday: h.nationalHoliday,
				types: h.holidayTypes,
				timestamp,
				remainTimestamp: timestamp - now,
			};
		}

		return { data, altData };
	} catch (e: any) {
		return { error: e.message || "Something just happened" };
	}
};

let googleTtsWiz: {
	fSid: string;
	bl: string;
	at: string | null;
	expire: number;
} | null = null;
let googleTtsCookies: string | null = null;

const getGoogleTtsWiz = async () => {
	if (googleTtsWiz && googleTtsWiz.expire > Date.now()) return googleTtsWiz;
	const res = await fetch("https://translate.google.com", {
		headers: commonHeaders,
	});
	const text = await res.text();
	const fSid = text.match(/"FdrFJe":"(.*?)"/)?.[1];
	const bl = text.match(/"cfb2h":"(.*?)"/)?.[1];
	const at = text.match(/"SNlM0e":"(.*?)"/)?.[1] || null;
	if (!fSid || !bl) throw new Error("Failed to fetch Google Translate wiz data");
	googleTtsWiz = { fSid, bl, at, expire: Date.now() + 3600 * 1000 };
	if (res.headers.getSetCookie) {
		googleTtsCookies = normalizeCookies(res.headers.getSetCookie());
	} else {
		googleTtsCookies = normalizeCookies(res.headers.get("set-cookie"));
	}
	return googleTtsWiz!;
};

const MAX_TTS_CHUNK = 100;

const splitTtsText = (text: string): string[] => {
	const out: string[] = [];
	let cur = "";
	for (const word of text.split(/\s+/)) {
		if (!word) continue;
		if (!cur) cur = word;
		else if (cur.length + 1 + word.length <= MAX_TTS_CHUNK) cur += " " + word;
		else {
			out.push(cur);
			cur = word;
		}
	}
	if (cur) out.push(cur);
	return out.flatMap((c) => (c.length <= MAX_TTS_CHUNK ? [c] : (c.match(new RegExp(`.{1,${MAX_TTS_CHUNK}}`, "g")) as string[])));
};

const synthTtsChunk = async (text: string, langCode: string): Promise<Buffer | null> => {
	try {
		const wiz = await getGoogleTtsWiz();
		const rpcId = "jQ1olc";
		const payload = [text, langCode, null];
		const query = new URLSearchParams({
			rpcids: rpcId,
			"f.sid": wiz.fSid,
			bl: wiz.bl,
			hl: "en",
			"soc-app": "1",
			"soc-platform": "1",
			"soc-device": "1",
			_reqid: String(Math.floor(1000 + Math.random() * 9000)),
			rt: "c",
		});
		const body = new URLSearchParams();
		body.set("f.req", JSON.stringify([[[rpcId, JSON.stringify(payload), null, "generic"]]]));
		if (wiz.at) body.set("at", wiz.at);

		const res = await fetch(`https://translate.google.com/_/TranslateWebserverUi/data/batchexecute?${query.toString()}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
				...commonHeaders,
				...(googleTtsCookies ? { Cookie: googleTtsCookies } : {}),
				// Actually need 'X-Goog-BatchExecute-Bgr' header but not yet
			},
			body: body.toString(),
		});
		if (!res.ok) return null;
		const respText = await res.text();
		const match = respText.match(/\d+/);
		if (!match) return null;
		const start = (match.index ?? 0) + match[0].length;
		const jsonStr = respText.slice(start, start + Number(match[0]));
		const envelopes = JSON.parse(jsonStr);
		const payloadStr = envelopes?.[0]?.[2];
		if (!payloadStr) return null;
		const parsed = JSON.parse(payloadStr);
		const audioB64 = parsed?.[0];
		if (!audioB64) return null;
		return Buffer.from(audioB64, "base64");
	} catch (e: any) {
		console.error("googleTTS error:", e);
		return null;
	}
};

export const googleTTS = async (text: string, lang: string): Promise<Buffer | null> => {
	const langCode = findLangCode(lang) || "en";
	const chunks = splitTtsText(text);
	const buffers: Buffer[] = [];
	for (const chunk of chunks) {
		const buf = await synthTtsChunk(chunk, langCode);
		if (!buf) return null;
		buffers.push(buf);
	}
	return buffers.length ? Buffer.concat(buffers) : null;
};

export const googleCloudTTS = async (text: string, lang: string): Promise<Buffer | null> => {
	try {
		const langCode = findLangCode(lang) || "en";
		const region = GOOGLE_TTS_REGION[langCode] || langCode.toUpperCase();
		const languageCode = `${langCode}-${region}`;
		const url = `https://content-texttospeech.googleapis.com/v1/text:synthesize?prettyPrint=false&alt=json`;
		const res = await fetch(url, {
			method: "POST",
			headers: {
				...commonHeaders,
				"Content-Type": "application/json",
				Referer: process.env.GOOG_RX || "",
				"X-Goog-Api-Key": process.env.GOOG_EX || "",
			},
			body: JSON.stringify({
				input: { text },
				voice: { languageCode },
				audioConfig: { audioEncoding: "MP3" },
			}),
		});
		if (!res.ok) return null;
		const data: any = await res.json();
		const audioB64 = data?.audioContent;
		if (!audioB64) return null;
		return Buffer.from(audioB64, "base64");
	} catch (e: any) {
		console.error("googleCloudTTS error:", e);
		return null;
	}
};

export const YTSuggest = async function YTSuggest(que: string) {
	if (!que) return null;
	try {
		const rescomplete = await fetch(`https://suggestqueries-clients6.youtube.com/complete/search?ds=yt&hl=en&client=youtube&gs_ri=youtube&ytvs=1&q=${encodeURIComponent(que)}`, { headers: commonHeaders });
		const autoresText = (await rescomplete.text()).slice(19, -1);
		let alj: any[] = [];
		try {
			const autores = JSON.parse(autoresText);
			(autores?.[1] || []).forEach((o: any) => {
				if (o?.[0]) alj.push(o[0]);
			});
		} catch {}
		return { autocomplete: alj };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const TenorSuggest = async function TenorSuggest(que: string) {
	if (!que) return null;
	try {
		const tenorHeaders = {
			...commonHeaders,
			Referer: "https://tenor.com",
			Origin: "https://tenor.com",
			"X-Goog-Api-Key": process.env.GOOG_TENOR || "",
		};
		const [apiRes2, apiRes3] = await Promise.all([fetch(`https://tenor.googleapis.com/v2/autocomplete?prettyPrint=false&q=${encodeURIComponent(que.toLowerCase())}&type=trending&profile_limit=0&limit=50&client_key=tenor_web&locale=en`, { headers: tenorHeaders }), fetch(`https://tenor.googleapis.com/v2/search_suggestions?prettyPrint=false&client_key=tenor_web&locale=en&q=${encodeURIComponent(que.toLowerCase())}&limit=50`, { headers: tenorHeaders })]);
		const apiData2: any = await apiRes2.json();
		const apiData3: any = await apiRes3.json();
		return {
			suggestion: apiData3?.results || [],
			autocomplete: apiData2?.results || [],
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const GiphySuggest = async function GiphySuggest(que: string) {
	if (!que) return null;
	try {
		if (!keygiphy) {
			keygiphy = await giphyKey();
		}
		const res2 = await fetch(`https://api.giphy.com/v1/gifs/search/tags?api_key=${keygiphy}&q=${encodeURIComponent(que)}&limit=25`, {
			headers: commonHeaders,
		});
		if (res2.status === 401) {
			keygiphy = await giphyKey();
			return await GiphySuggest(que);
		}
		const jl2: any = await res2.json();
		return {
			suggestion: jl2?.data?.map((b: any) => b.name) || [],
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const KlipySuggest = async function KlipySuggest(que: string) {
	if (!que) return null;
	try {
		const [req2, req3] = await Promise.all([
			fetch(`https://api.klipy.com/api/v1/${process.env.KLIPY}/search-suggestions/${encodeURIComponent(que)}?limit=50`, {
				headers: {
					...commonHeaders,
					Referer: "https://klipy.com",
					Origin: "https://klipy.com",
				},
			}),
			fetch(`https://api.klipy.com/api/v1/${process.env.KLIPY}/autocomplete/${encodeURIComponent(que)}?limit=50`, {
				headers: {
					...commonHeaders,
					Referer: "https://klipy.com",
					Origin: "https://klipy.com",
				},
			}),
		]);
		let res2: any;
		let res3: any;
		try {
			res2 = await req2.json();
		} catch {}
		try {
			res3 = await req3.json();
		} catch {}
		return {
			suggestion: res2?.data || [],
			autocomplete: res3?.data || [],
		};
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const DeviantArt = async (query: string, refresh_auth: boolean = false): Promise<any> => {
	if (!query) return null;
	try {
		if (!keydevian || refresh_auth) keydevian = await devianKey();
		if (!keydevian) return { error: "Can't process this" };

		const res = await fetch(`https://www.deviantart.com/_puppy/dabrowse/search/all?q=${query}&csrf_token=${keydevian.csrfToken}&preload=true`, {
			headers: {
				...commonHeaders,
				...(keydevian?.cookie ? { Cookie: keydevian.cookie } : {}),
				"sec-fetch-dest": "empty",
				"sec-fetch-mode": "cors",
				"sec-fetch-site": "same-origin",
				referer: `https://www.deviantart.com/search?q=${query}`,
			},
		});

		if (res.status === 400) {
			if (!refresh_auth) return await DeviantArt(query, true);
			return {
				error: "Can't process this",
			};
		}

		if (res.status === 403) {
			return {
				error: "IP Blocked",
			};
		}

		if (res.status === 429) {
			return {
				error: "Rate-limited",
			};
		}

		const secres = await res.text();

		let parsed: any;
		try {
			parsed = JSON.parse(secres);
		} catch {
			return { data: null };
		}

		if (!Array.isArray(parsed.deviations)) return { data: null };

		const isDownloadAud = (tok: string): boolean => {
			try {
				const seg = tok.split(".");
				if (seg.length !== 3) return false;
				const p = JSON.parse(Buffer.from(seg[1], "base64url").toString());
				return Array.isArray(p?.aud) && p.aud.includes("urn:service:file.download");
			} catch {
				return false;
			}
		};

		// Decode a token payload, returning { aud, blur, maxW, maxH }.
		const decodeToken = (tok: string): any => {
			try {
				const seg = tok.split(".");
				if (seg.length !== 3) return null;
				const p = JSON.parse(Buffer.from(seg[1], "base64url").toString());
				const obj = Array.isArray(p?.obj) ? p.obj : [];
				const bound = Array.isArray(obj[0]) ? obj[0][0] : obj[0]; // handle both [{...}] and [[{...}]]
				return {
					aud: p?.aud,
					blur: typeof bound?.blur === "string",
					maxW: parseInt(String(bound?.width ?? "").replace(/\D/g, ""), 10) || 0,
					maxH: parseInt(String(bound?.height ?? "").replace(/\D/g, ""), 10) || 0,
				};
			} catch {
				return null;
			}
		};

		const applyBestParams = (url: string): string =>
			url
				.replace(/q_\d+/g, "q_100")
				.replace(/blur_\d+/g, "blur_10")
				.replace(/,strp/g, "");

		// Replace each deviation's media with exactly two URLs:
		// original (file.download token) when present, then the highest resolution variant.
		for (const dev of parsed.deviations) {
			const med = dev?.media;
			if (!med?.baseUri || !Array.isArray(med.token)) continue;

			const urls: string[] = [];
			const ext = med.baseUri.match(/\.(\w+)$/)?.[1] ?? "jpg";

			const dlToken = med.token.find((t: any) => typeof t === "string" && isDownloadAud(t));
			const previewToken = med.token[0];
			const pt = typeof previewToken === "string" ? decodeToken(previewToken) : null;

			if (dlToken) {
				urls.push(med.baseUri + "?token=" + dlToken);
			}

			let bestUrl = "";
			let bestArea = -1;

			if (pt && !pt.blur && pt.maxW && pt.maxH) {
				bestUrl = med.baseUri + `/v1/fill/w_${pt.maxW},h_${pt.maxH},q_100/` + (med.prettyName ?? "x") + "." + ext + "?token=" + previewToken;
			} else if (typeof previewToken === "string" && Array.isArray(med.types)) {
				for (const v of med.types) {
					if (typeof v?.c !== "string" || typeof v?.s === "string") continue;
					const area = (typeof v?.w === "number" ? v.w : 0) * (typeof v?.h === "number" ? v.h : 0);
					if (area > bestArea) {
						bestArea = area;
						const dir = v.c.slice(0, v.c.lastIndexOf("/") + 1);
						bestUrl = applyBestParams(med.baseUri + dir + (med.prettyName ?? "x") + "." + ext + "?token=" + previewToken);
					}
				}
			}

			if (bestUrl) urls.push(bestUrl);

			if (urls.length) dev.media = urls;
		}

		return { estTotal: parsed.estTotal, data: parsed.deviations };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const TiktokInfoUser = async function TiktokInfoUser(query: string) {
	if (!query) return null;
	try {
		const response = await fetch(`https://www.tiktok.com/@${query.toLowerCase()}`, { headers: { ...commonHeaders, Cookie: tiktokSessionKeys?.cookie, "User-Agent": userAgent_mobile } });
		const html = await response.text();
		const scriptContent = html.split('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">')[1]?.split("</script>")[0];
		if (!scriptContent) return { error: "Akamai Captcha asking to verify you're not a bot" };
		const json = JSON.parse(scriptContent);
		const userDetail = json?.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo?.user;
		if (!userDetail) return { error: "User not found" };
		const userStats = json?.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo?.statsV2;
		return { data: { ...userDetail, statistics: userStats } };
	} catch (e) {
		console.error(e);
		return null;
	}
};
