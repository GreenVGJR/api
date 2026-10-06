import { sign, verify } from "hono/jwt";
import { getCookie } from "hono/cookie";
import type { Context } from "hono";

const vsJwtKey = (): string => {
	const key = process.env.MD_KEY;
	if (!key) throw new Error("Missing required environment variable: MD_KEY");
	return key;
};

export const VS_CHALLENGE_MAX_AGE = 300;
export const VS_COOKIE = "xf";
export const VS_COOKIE_MAX_AGE = 43200;

export const signVsChallenge = async (vs: string, ua: string): Promise<string> => {
	const now = Math.floor(Date.now() / 1000);
	return sign({ sub: "vs-challenge", vs, ua, iat: now, exp: now + VS_CHALLENGE_MAX_AGE }, vsJwtKey());
};

export const signVsCookie = async (ua: string): Promise<string> => {
	const now = Math.floor(Date.now() / 1000);
	return sign({ sub: "vs", ua, iat: now, exp: now + VS_COOKIE_MAX_AGE }, vsJwtKey());
};

export const verifyVsCookie = async (c: Context): Promise<boolean> => {
	try {
		const token = getCookie(c, VS_COOKIE);
		if (!token) return false;
		const payload: any = await verify(token, vsJwtKey(), "HS256");
		if (payload?.sub !== "vs") return false;
		return payload?.ua === (c.req.header("user-agent") ?? "");
	} catch {
		return false;
	}
};
