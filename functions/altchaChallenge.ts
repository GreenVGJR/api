import type { Context } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import { create, CappedMap, deriveHmacKeySecret, randomInt } from "altcha-lib/frameworks/hono";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import config from "../config.json" with { type: "json" };

const cfg: any = (config as any).altcha ?? {};
const ALTCHA_COOKIE: string = cfg.cookie ?? "altcha";
const ALGORITHM: string = cfg.algorithm ?? "PBKDF2/SHA-256";
const COST: number = cfg.cost ?? 500;
const COUNTER_MIN: number = cfg.counterMin ?? 300;
const COUNTER_MAX: number = cfg.counterMax ?? 800;
const EXPIRES_MS: number = cfg.expiresMs ?? 600_000;
const STORE_MAX: number = cfg.storeMax ?? 1000;

type AltchaState = {
	instance: ReturnType<typeof create>;
	hmacSignatureSecret: string;
	hmacKeySignatureSecret: string;
	store: CappedMap<string, boolean>;
};

let cached: Promise<AltchaState> | null = null;

const getState = (): Promise<AltchaState> => {
	if (!cached) {
		cached = (async () => {
			const secret = process.env.MD_KEY;
			if (!secret) throw new Error("Missing required environment variable: MD_KEY");
			const hmacKeySignatureSecret = await deriveHmacKeySecret(secret);
			const store = new CappedMap<string, boolean>({ maxSize: STORE_MAX });
			const instance = create({
				hmacSignatureSecret: secret,
				hmacKeySignatureSecret,
				deriveKey,
				createChallengeParameters: () => ({
					algorithm: ALGORITHM,
					cost: COST,
					counter: randomInt(COUNTER_MIN, COUNTER_MAX),
					expiresAt: new Date(Date.now() + EXPIRES_MS),
				}),
				setCookie: { name: ALTCHA_COOKIE, path: "/", sameSite: "Lax" },
				store,
			});
			return { instance, hmacSignatureSecret: secret, hmacKeySignatureSecret, store };
		})();
	}
	return cached;
};

export const altchaChallengeHandler = async (c: Context) => {
	const { instance } = await getState();
	return instance.challengeHandler(c);
};

export const verifyAltchaCookie = async (c: Context): Promise<boolean> => {
	try {
		const payload = getCookie(c, ALTCHA_COOKIE);
		if (!payload) return false;
		const state = await getState();
		const { error, verification } = await state.instance.verify(payload, deriveKey, state.hmacSignatureSecret, state.hmacKeySignatureSecret, state.store);
		if (error || !verification?.verified) return false;
		deleteCookie(c, ALTCHA_COOKIE, { path: "/" });
		return true;
	} catch {
		return false;
	}
};
