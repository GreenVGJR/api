import type { Context } from "hono";
import { sign, verify } from "hono/jwt";
import crypto from "crypto";
import { ipToNumber } from "./musicChallenges.ts";

export const MUSIC_VS_TOKEN_HEADER = "x-eagle-token";
export const MUSIC_VS_POPUP_HEADER = "x-music-vs";
export const MUSIC_VS_PATH_HEADER = "x-vs-path";
export const MUSIC_VS_VERIFY_URL = "/music/verify";
export const MUSIC_VS_CHANNEL = "vgjr-music-verify";
const TOKEN_SUB = "eagle";
const TOKEN_MAX_AGE = 600;
const SESSION_TTL = 60_000;
const SESSION_MAX = 1000;

type PendingSession = { sid: string; ip: string; ua: string; exp: number };
const pendingSessions = new Map<string, PendingSession>();

const tokenKey = (): string => {
	const key = process.env.MD_KEY;
	if (!key) throw new Error("Missing required environment variable: MD_KEY");
	return key;
};

const pruneSessions = (): void => {
	const now = Date.now();
	for (const [id, entry] of pendingSessions) {
		if (entry.exp <= now) pendingSessions.delete(id);
	}
};

export const musicVsRequestIp = (c: Context): string => String(ipToNumber(c.req.header("cf-connecting-ip") || c.req.header("x-real-ip") || "127.0.0.1"));

export const createMusicVsSession = (ip: string, ua: string): { id: string; sid: string } => {
	pruneSessions();
	if (pendingSessions.size >= SESSION_MAX) {
		const oldest = pendingSessions.keys().next().value;
		if (oldest !== undefined) pendingSessions.delete(oldest);
	}
	const id = crypto.randomBytes(12).toString("base64url");
	const sid = crypto.randomBytes(18).toString("base64url");
	pendingSessions.set(id, { sid, ip, ua, exp: Date.now() + SESSION_TTL });
	return { id, sid };
};

export const hasMusicVsSession = (id: string | undefined, sid: string | undefined): boolean => {
	if (!id || !sid) return false;
	pruneSessions();
	const entry = pendingSessions.get(id);
	return !!entry && entry.sid === sid && entry.exp > Date.now();
};

export const consumeMusicVsSession = (c: Context, id: string | undefined, sid: string | undefined): boolean => {
	if (!id || !sid) return false;
	pruneSessions();
	const entry = pendingSessions.get(id);
	if (!entry) return false;
	pendingSessions.delete(id);
	if (entry.sid !== sid || entry.exp <= Date.now()) return false;
	if (entry.ua !== (c.req.header("user-agent") ?? "")) return false;
	if (entry.ip !== musicVsRequestIp(c)) return false;
	return true;
};

export const signMusicVsToken = async (ua: string, ip: string | number): Promise<string> => {
	const now = Math.floor(Date.now() / 1000);
	return sign(
		{
			sub: TOKEN_SUB,
			ua,
			ip: String(typeof ip === "number" ? ip : ipToNumber(ip)),
			iat: now,
			exp: now + TOKEN_MAX_AGE,
		},
		tokenKey(),
	);
};

export const verifyMusicVsToken = async (c: Context): Promise<boolean> => {
	const token = c.req.header(MUSIC_VS_TOKEN_HEADER);
	if (!token) return false;
	try {
		const payload: any = await verify(token, tokenKey(), "HS256");
		if (payload?.sub !== TOKEN_SUB) return false;
		if (payload?.ua !== (c.req.header("user-agent") ?? "")) return false;
		if (payload?.ip !== musicVsRequestIp(c)) return false;
		if (typeof payload?.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) return false;
		return true;
	} catch {
		return false;
	}
};
