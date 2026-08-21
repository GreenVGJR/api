import crypto from "crypto";
import { Buffer } from "buffer";
import { commonHeaders, userAgent_mobile } from "./request.js";
import { ClientTransaction } from "x-client-transaction-id";
import { parseHTML } from "linkedom";

export let twitterDocument: any = null;
export let twitterTransaction: any = null;
export const twitterObj: Record<string, any> = {};

export let keytidal: string | undefined = "txNoH4kkV41MfH25";
export const keytidalopen: string = "txNoH4kkV41MfH25";
export function setKeyTidal(val: string | undefined) {
	keytidal = val;
}

/**
 * Normalizes cookies into a request-ready `Cookie` header value.
 * Accepts either an array of raw `Set-Cookie` strings (with attributes) or a
 * single `set-cookie` header string, and returns only `name=value` pairs
 * joined by `; ` (strips expires/path/domain/Secure/HttpOnly/SameSite).
 */
export function normalizeCookies(cookies: string | string[] | undefined | null): string {
	if (!cookies) return "";
	const list = Array.isArray(cookies) ? cookies : cookies.split(",");
	return list
		.map((c: string) => c.trim().split(";")[0])
		.filter(Boolean)
		.join("; ");
}

export async function youtubeVisitorKey(): Promise<{
	visitor_data: string;
	cookie: string;
	client_version: string;
	platform_type: string;
} | null> {
	try {
		const res = await fetch("https://www.youtube.com/sw.js_data", {
			headers: commonHeaders,
		});
		const text = await res.text();
		const finaltext: any = JSON.parse(text.split("\n")?.[2] || "null");
		const visitor_data = finaltext?.[0]?.[2]?.[6];
		if (!visitor_data) return null;
		const client_version = finaltext?.[0]?.[2]?.[0]?.[0]?.[16];
		const platform_type = finaltext?.[0]?.[2]?.[0]?.[0]?.[17];
		let cookie = "";
		if (res.headers.getSetCookie) {
			cookie = normalizeCookies(res.headers.getSetCookie());
		} else {
			cookie = normalizeCookies(res.headers.get("set-cookie"));
		}
		return { visitor_data, cookie, client_version, platform_type };
	} catch (e) {
		console.error("Error fetching visitorData:", e);
		return null;
	}
}

export const googleAuthKey = async function googleAuthKey() {
	try {
		const res = await fetch(`https://cse.google.com/cse.js?hpg=1&cx=${process.env.GOOG_CX}`, {
			headers: {
				...commonHeaders,
			},
		});
		if (res.status !== 200) return undefined;
		const text = await res.text();
		const extractObject = text?.split("})(")?.[1]?.slice(0, -2);
		return JSON.parse(extractObject);
	} catch {
		return undefined;
	}
};

export const giphyKey = async function giphyKey() {
	try {
		const res = await fetch("https://giphy.com/", {
			headers: {
				...commonHeaders,
			},
		});
		const text = await res.text();
		const extractHash = text?.split("app/layout-")?.[1]?.split('"')?.[0];
		if (!extractHash) return undefined;
		const res2 = await fetch(`https://giphy.com/_next/static/chunks/app/layout-${extractHash}`, {
			headers: {
				...commonHeaders,
			},
		});
		const text2 = await res2.text();
		return text2.split('mobileApiKey:"')[1].split('"')[0];
	} catch {
		return undefined;
	}
};

export const flickrKey = async function flickrKey() {
	try {
		const res = await fetch("https://flickr.com/photos/", {
			headers: {
				...commonHeaders,
			},
		});
		const text = await res.text();
		return text.split("flickr.api.site_key =")[1].split('"')[1];
	} catch {
		return undefined;
	}
};

export const soundcloudKey = async function soundcloudKey() {
	try {
		const res = await fetch("https://m.soundcloud.com", {
			method: "GET",
			headers: {
				...commonHeaders,
			},
		});
		const text = await res.text();
		return text.split('"clientId":"')[1].split('"')[0];
	} catch {
		return undefined;
	}
};

export const spotifyKey = async function spotifyKey(): Promise<string | undefined> {
	const decodeSecret = (bytes: number[], offset = 33, addend = 9): Buffer => Buffer.from(Array.from(bytes, (value, i) => value ^ ((i % offset) + addend)).join(""), "utf8");

	const getSpotifySecret = (): { key: Buffer; version: string } => ({
		key: decodeSecret(Array.from(',7/*F("rLJ2oxaKL^f+E1xvP@N', (c) => c.charCodeAt(0))),
		version: "61",
	});

	const getTotp = (key: Buffer): string => {
		const st = Math.floor(Date.now() / 1000);
		const counter = Math.floor(st / 30);
		const cb = Buffer.alloc(8);
		cb.writeBigUInt64BE(BigInt(counter));
		const h = crypto.createHmac("sha1", key).update(cb).digest();
		const bin = h.readUInt32BE((h[h.length - 1] ?? 0) & 0xf) & 0x7fffffff;
		return String(bin % 1000000).padStart(6, "0");
	};

	const requestToken = async (key: Buffer, version: string): Promise<string | undefined> => {
		const totp = getTotp(key);
		const url = new URL("https://open.spotify.com/api/token");
		url.searchParams.append("reason", "init");
		url.searchParams.append("productType", "mobile-web-player");
		url.searchParams.append("totp", totp);
		url.searchParams.append("totpServer", totp);
		url.searchParams.append("totpVer", version);

		const res = await fetch(url.toString(), {
			method: "GET",
			headers: {
				...commonHeaders,
				...(process.env.SPOTIFY_COOKIES ? { cookie: process.env.SPOTIFY_COOKIES } : {}),
				Origin: "https://open.spotify.com/",
				Referer: "https://open.spotify.com/",
				Accept: "application/json",
			},
		});
		if (res.status !== 200) return undefined;
		const data: any = await res.json();
		return data.accessToken as string;
	};

	try {
		const { key, version } = getSpotifySecret();
		const token = await requestToken(key, version);
		if (token) return token;
	} catch {}

	try {
		const res = await fetch(`https://embed.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT`, {
			headers: {
				...commonHeaders,
				...(process.env.SPOTIFY_COOKIES ? { cookie: process.env.SPOTIFY_COOKIES } : {}),
			},
		});
		const text = await res.text();
		return text.match(/"accessToken":"([^"]+)"/)?.[1];
	} catch {
		return undefined;
	}
};

export const spotifyKeyToken = async function spotifyKeyToken() {
	const clientId = {
		web_player: "d8a5ed958d274c2e8ee717e6a4b0971d",
		mobile_web_player: "f6a40776580943a7bc5173125a1e8832",
		embeds: "ab9ad0d96a624805a7d51e8868df1f97",
	};

	const bodyhttp = {
		client_data: {
			client_version: "1.0",
			client_id: clientId.mobile_web_player,
			js_sdk_data: {},
		},
	};

	try {
		const req = await fetch(`https://clienttoken.spotify.com/v1/clienttoken`, {
			method: "POST",
			body: JSON.stringify(bodyhttp),
			headers: {
				...commonHeaders,
				...(process.env.SPOTIFY_COOKIES ? { cookie: process.env.SPOTIFY_COOKIES } : {}),
				Origin: "https://clienttoken.spotify.com",
				Accept: "application/json",
				"Content-Type": "application/json",
			},
		});

		const res: any = await req.json();
		return res.granted_token.token;
	} catch {
		return undefined;
	}
};

const CONSUMER_KEY_MACK = "audiomack-web";
const CONSUMER_SECRET_MACK = "bd8a07e9f23fbe9d808646b730f89b8e";
const STRICT_URI_RE = /[!'()*]/g;

type OAuthParamValue = string | number | boolean;

function strictEncodeURIComponent(value: OAuthParamValue): string {
	return encodeURIComponent(String(value)).replace(STRICT_URI_RE, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildParamString(params: Record<string, OAuthParamValue>): string {
	return Object.keys(params)
		.sort()
		.map((key) => `${strictEncodeURIComponent(key)}=${strictEncodeURIComponent(params[key] ?? "")}`)
		.join("&");
}

export const mackOauth = async function mackOauth(method: string, url: string, additionalParams: Record<string, OAuthParamValue> = {}): Promise<{ signature: string; params: Record<string, OAuthParamValue> }> {
	const params: Record<string, OAuthParamValue> = {
		...additionalParams,
		oauth_consumer_key: CONSUMER_KEY_MACK,
		oauth_nonce: crypto.randomBytes(16).toString("hex"),
		oauth_signature_method: "HMAC-SHA1",
		oauth_timestamp: Math.floor(Date.now() / 1000),
		oauth_version: "1.0",
	};

	const paramString = buildParamString(params);
	const signatureBase = `${method.toUpperCase()}&${strictEncodeURIComponent(url)}&${strictEncodeURIComponent(paramString)}`;
	const signingKey = `${strictEncodeURIComponent(CONSUMER_SECRET_MACK)}&`;
	const signature = crypto.createHmac("sha1", signingKey).update(signatureBase).digest("base64");

	return { signature, params };
};

export const tidalKeys = async function tidalKeys() {
	try {
		const rest = await fetch(`https://embed.tidal.com/tracks/${[406956243, 1550546][Math.floor(Math.random() * 2)]}`, {
			method: "GET",
			headers: {
				...commonHeaders,
			},
		});
		const rest_get = await rest.text();
		const rest2 = await fetch("https://embed.tidal.com" + rest_get.split('type="module"')[0].split('script src="')[1].split('"')[0], {
			headers: {
				...commonHeaders,
			},
		});
		const rest2_get = await rest2.text();
		return rest2_get.split('"X-Tidal-Token","')[1].split('"')[0];
	} catch {
		return undefined;
	}
};

export const tidalKeysToken = async function tidalKeysToken(refresh: boolean = false) {
	try {
		if (!keytidal || refresh) {
			keytidal = await tidalKeys();
		}

		const rt = new URLSearchParams();
		rt.append("client_id", keytidalopen);
		rt.append("client_secret", decodeURIComponent("dQjy0MinCEvxi1O4UmxvxWnDjt4cgHBPw8ll6nYBk98%3D"));
		rt.append("grant_type", "client_credentials");

		const rest = await fetch(`https://auth.tidal.com/v1/oauth2/token`, {
			method: "POST",
			body: rt.toString(),
			headers: {
				...commonHeaders,
				"Content-Type": "application/x-www-form-urlencoded",
			},
		});

		if (rest.status === 400 || rest.status === 401) {
			return await tidalKeysToken(true);
		}

		const res: any = await rest.json();
		return res.access_token;
	} catch {
		return undefined;
	}
};

export const deezerKeys = async function deezerKeys() {
	try {
		const rest = await fetch("https://auth.deezer.com/login/anonymous?jo=p&rto=p", {
			headers: {
				...commonHeaders,
			},
		});
		let rest_get: any = await rest.text();
		rest_get = JSON.parse(rest_get);
		return rest_get.jwt;
	} catch {
		return undefined;
	}
};

export const imgurKey = async function imgurKey() {
	try {
		const req = await fetch("https://imgur.com", {
			headers: commonHeaders,
		});
		const res = await req.text();

		const mainAssetPath = res.split("desktop-assets/js/main")[1]?.split(">")[0];
		if (!mainAssetPath) return undefined;

		const req2 = await fetch("https://s.imgur.com/desktop-assets/js/main" + mainAssetPath, { headers: commonHeaders });
		const res2 = await req2.text();
		return res2.split('apiClientId:"')[1]?.split('"')[0];
	} catch (e) {
		console.error("Imgur Key Error:", e);
	}
};

export const crunchyKey = async function crunchyKey() {
	try {
		const req = await fetch(atob("aHR0cHM6Ly93d3cuY3J1bmNoeXJvbGwuY29tL2F1dGgvdjEvdG9rZW4="), {
			headers: {
				...commonHeaders,
				Accept: "application/json",
				Authorization: "Basic Y3Jfd2ViOg==",
				"Content-Type": "application/x-www-form-urlencoded",
				Cookie: `device_id=${crypto.randomUUID()}; c_locale=en`,
				Origin: "https://www.crunchyroll.com",
			},
			method: "POST",
			body: "grant_type=client_id",
		});
		if (req.status !== 200) return;
		const res = await req.json();
		return res.access_token;
	} catch (e) {
		console.error(e);
	}
};

export const saweriaBuildKey = async function saweriaBuildKey(): Promise<string | undefined> {
	const mainRes = await fetch("https://saweria.co", {
		headers: commonHeaders,
	});

	if (mainRes.status === 403) return undefined;
	const mainText = await mainRes.text();
	return mainText.split('"buildId":"')[1]?.split('"')[0];
};

export const instagramSession = async function instagramSession(): Promise<{
	cookie: string;
	lsd: string | null;
	csrf: string | null;
	app_id: string | null;
} | null> {
	try {
		const res = await fetch("https://www.instagram.com/", {
			headers: {
				...commonHeaders,
				"User-Agent": userAgent_mobile,
			},
		});
		const text = await res.text();
		const cookie = res.headers.getSetCookie ? normalizeCookies(res.headers.getSetCookie()) : normalizeCookies(res.headers.get("set-cookie"));
		const csrf = /csrftoken=([^;\s]+)/.exec(cookie)?.[1] || /"csrf_token":"([^"]+)"/.exec(text)?.[1] || null;
		const lsd = /\["LSD",\[\],\{"token":"([^"]+)"/.exec(text)?.[1] || /"LSD"[\s\S]*?"token":"([^"]+)"/.exec(text)?.[1] || null;
		const app_id = /"APP_ID":"([^"]+)"/.exec(text)?.[1] || null;
		return { cookie, lsd, csrf, app_id };
	} catch (e) {
		console.error(e);
		return null;
	}
};

export const instagramKey = async function instagramKey(): Promise<string | null> {
	const session = await instagramSession();
	return session?.cookie ?? null;
};

export const twitterKey = async function twitterKey(typeName: string) {
	try {
		const response = await fetch("https://x.com/i/jf/onboarding/web", {
			headers: commonHeaders,
		});
		const html = await response.text();
		const { document } = parseHTML(html);
		twitterDocument = document;

		twitterTransaction = new ClientTransaction(twitterDocument);
		await twitterTransaction.initialize();

		const pul1 = await fetch("https://abs.twimg.com/responsive-web/client-web/main" + html.split("client-web/main")[1].split('"')[0], { headers: commonHeaders });

		const res1 = await pul1.text();

		const opIndex = res1.indexOf(`operationName:"${typeName}"`);
		const queryId_user = opIndex >= 0 ? /queryId:"([^"]+)"/.exec(res1.slice(Math.max(0, opIndex - 300), opIndex))?.[1] : undefined;
		const featuresSegment = opIndex >= 0 ? res1.match(new RegExp(`operationName:"${typeName}"[\\s\\S]*?featureSwitches:(\\[[^\\]]*\\])`))?.[1] : undefined;
		const features_user = JSON.parse(featuresSegment || "[]").reduce((acc: any, key: any) => {
			acc[key] = true;
			return acc;
		}, {});

		twitterObj[typeName] = [queryId_user, features_user, await twitterTransaction.generateTransactionId("GET", "/graphql/" + queryId_user + "/" + typeName)];
	} catch (e) {
		console.error(e);
	}
};

export const refreshRedditAuth = async (): Promise<any> => {
	try {
		const fetchLogin = async (targetDomain: string) => {
			return await fetch(`https://${targetDomain}/login/`, {
				headers: commonHeaders,
				redirect: "manual",
			});
		};

		let loginRes = await fetchLogin("old.reddit.com");

		if (loginRes.status === 403) {
			loginRes = await fetchLogin("www.reddit.com");
		}

		if (loginRes.headers.getSetCookie) {
			return normalizeCookies(loginRes.headers.getSetCookie());
		} else {
			return normalizeCookies(loginRes.headers.get("set-cookie"));
		}
	} catch {
		return null;
	}
};

export async function tiktokSessions(): Promise<{
	cookie: string;
	device_id: string;
	odin_id: string;
	app_id: string;
	abVersion: string;
	deviceIdCreate: string;
} | null> {
	try {
		const fet = await fetch("https://www.tiktok.com/node-webapp/api/common-app-context", {
			headers: commonHeaders,
		});
		const res = await fet.json();
		return {
			cookie: [`ttwid=${res.encryptedWebid}`, `tt_csrf_token=${res.csrfToken}`].join("; "),
			device_id: res.wid,
			odin_id: res.odinId,
			app_id: res.appId,
			abVersion: res.abTestVersion.versionName,
			deviceIdCreate: res.webIdCreatedTime,
		};
	} catch (e) {
		console.error(e);
		return null;
	}
}

export const devianKey = async function devianKey(): Promise<{
	cookie: string;
	csrfToken: string;
} | null> {
	try {
		const res = await fetch("https://www.deviantart.com/join", { headers: commonHeaders });
		let cookie: string;

		if (res.headers.getSetCookie) {
			cookie = normalizeCookies(res.headers.getSetCookie());
		} else {
			cookie = normalizeCookies(res.headers.get("set-cookie"));
		}

		const secres = await res.text();

		const initialMatch = secres.match(/window\.__INITIAL_STATE__\s*=\s*JSON\.parse\(\s*"((?:\\.|[^"\\])*)"\s*\)/);
		if (!initialMatch?.[1]) return null;

		// The captured group is the JS string literal content. Decode it the way the
		// browser's JS engine would (tolerant of non-JSON escapes), then JSON.parse.
		const unescapeJsString = (lit: string): string => {
			let out = "";
			for (let i = 0; i < lit.length; i++) {
				const c = lit[i];
				if (c !== "\\") {
					out += c;
					continue;
				}
				const n = lit[i + 1];
				i++;
				switch (n) {
					case '"':
						out += '"';
						break;
					case "\\":
						out += "\\";
						break;
					case "/":
						out += "/";
						break;
					case "b":
						out += "\b";
						break;
					case "f":
						out += "\f";
						break;
					case "n":
						out += "\n";
						break;
					case "r":
						out += "\r";
						break;
					case "t":
						out += "\t";
						break;
					case "u":
						out += String.fromCharCode(parseInt(lit.slice(i + 1, i + 5), 16));
						i += 4;
						break;
					default:
						out += n;
						break; // JS tolerates unknown escapes
				}
			}
			return out;
		};

		const parsed: any = JSON.parse(unescapeJsString(initialMatch[1]));
		const csrfToken = parsed["@@publicSession"].csrfToken;
		return { cookie, csrfToken };
	} catch (e) {
		console.error(e);
		return null;
	}
};

let zmn_0ka: string | null = null;
let lqp_7xb = 0;

const qwz_8kp = async (): Promise<string | null> => {
	try {
		// Sometimes unsplash redirect multiple times
		const base = await fetch("https://unsplash.com/", {
			headers: commonHeaders,
		});
		if (base.status !== 401) return null;
		const baseSC = (base.headers.getSetCookie ? base.headers.getSetCookie() : [base.headers.get("set-cookie")]) as string[];
		const html = await base.text();
		const marker = '<script id="anubis_challenge" type="application/json">';
		const i = html.indexOf(marker);
		if (i < 0) return null;
		const ch = JSON.parse(html.slice(i + marker.length, html.indexOf("</script>", i)));
		const target = "0".repeat(ch.challenge.difficulty);
		let nonce = 0;
		let hash = "";
		const solveStart = Date.now();
		for (;;) {
			hash = crypto
				.createHash("sha256")
				.update(ch.challenge.randomData + nonce, "utf8")
				.digest("hex");
			if (hash.startsWith(target)) break;
			nonce++;
			if (nonce > 50_000_000) return null;
		}
		const elapsedTime = Date.now() - solveStart;
		const submitUrl = `https://unsplash.com/.within.website/x/cmd/anubis/api/pass-challenge?id=${encodeURIComponent(ch.challenge.id)}&response=${hash}&nonce=${nonce}&redir=%2F&elapsedTime=${elapsedTime}`;
		const sub = await fetch(submitUrl, {
			headers: {
				...commonHeaders,
				Referer: "https://unsplash.com/.within.website?redir=%2F",
				"Sec-Fetch-Site": "same-origin",
				Cookie: baseSC.map((c: string) => c.split(";")[0]).join("; "),
			},
			redirect: "manual",
		});
		const subSC = (sub.headers.getSetCookie ? sub.headers.getSetCookie() : [sub.headers.get("set-cookie")]) as string[];
		const auth = subSC.find((c: string) => c.startsWith("techaro.lol-anubis-auth="));
		if (!auth) return null;
		return auth.split(";")[0];
	} catch {
		return null;
	}
};

export const vnm_2xd = async (): Promise<string | null> => {
	if (zmn_0ka && lqp_7xb > Date.now()) return zmn_0ka;
	const c = await qwz_8kp();
	if (c) {
		zmn_0ka = c;
		lqp_7xb = Date.now() + 6 * 3600 * 1000;
	}
	return c;
};
