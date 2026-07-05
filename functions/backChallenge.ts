import { Context } from "hono";
import crypto from "crypto";

export const BACK_CHALLENGE_COOKIE = "_ftm";
export const BACK_CHALLENGE_ENCRYPTION_KEY = crypto.randomBytes(32);
const BACK_CHALLENGE_MAX_AGE_UPPER = 30;
const BACK_CHALLENGE_MIN_DIFFICULTY = 10;
const BACK_CHALLENGE_MAX_AGE_MS = BACK_CHALLENGE_MAX_AGE_UPPER * 1000;

export function encryptChallengeValue(value: string): string {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv(
		"aes-256-gcm",
		BACK_CHALLENGE_ENCRYPTION_KEY,
		iv,
	);
	const encrypted = Buffer.concat([
		cipher.update(value, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();
	return (
		iv.toString("base64url") +
		authTag.toString("base64url") +
		encrypted.toString("base64url")
	);
}

export function decryptChallengeValue(encrypted: string): string | null {
	try {
		const iv = Buffer.from(encrypted.slice(0, 16), "base64url");
		const authTag = Buffer.from(encrypted.slice(16, 38), "base64url");
		const data = Buffer.from(encrypted.slice(38), "base64url");
		const decipher = crypto.createDecipheriv(
			"aes-256-gcm",
			BACK_CHALLENGE_ENCRYPTION_KEY,
			iv,
		);
		decipher.setAuthTag(authTag);
		return decipher.update(data) + decipher.final("utf8");
	} catch {
		return null;
	}
}

export function getBackChallengeValue(c: Context): string {
	const ipHash = crypto
		.createHash("md5")
		.update(c.req.header("cf-connecting-ip") || "")
		.digest("hex");
	return encryptChallengeValue(`${ipHash}:${Date.now()}`);
}

export function isBackChallengeProofValid(
	value: string,
	nonce: string,
): boolean {
	if (!/^\d+$/.test(nonce)) return false;
	const hash = crypto
		.createHash("sha512")
		.update(value + nonce)
		.digest();
	let zeroBits = 0;
	for (const byte of hash) {
		if (byte === 0) {
			zeroBits += 8;
		} else {
			let current = byte;
			while ((current & 0x80) === 0) {
				zeroBits++;
				current <<= 1;
			}
			break;
		}
	}
	return zeroBits >= BACK_CHALLENGE_MIN_DIFFICULTY;
}

export function cookieChallengeIsValid(c: Context, cookieValue: any) {
	if (!cookieValue) return false;
	const ua = c.req.header("user-agent") || "";
	const key = crypto.createHash("sha512").update(ua).digest();
	let decoded: string;
	try {
		const raw = Buffer.from(cookieValue, "base64url");
		const unmasked = Buffer.alloc(raw.length);
		for (let i = 0; i < raw.length; i++) {
			unmasked[i] = raw[i] ^ key[i % key.length];
		}
		decoded = unmasked.toString("utf8");
	} catch {
		return false;
	}
	const parts = decoded.split(".");
	if (parts.length < 2) return false;
	const [encrypted, nonce, ...hashes] = parts;
	for (const h of hashes) {
		if (h !== "" && !/^[0-9a-f]{128}$/i.test(h)) return false;
	}
	if (!isBackChallengeProofValid(encrypted, nonce)) return false;
	const decrypted = decryptChallengeValue(encrypted);
	if (!decrypted) return false;
	const colonIdx = decrypted.lastIndexOf(":");
	if (colonIdx === -1) return false;
	const cookieHash = decrypted.slice(0, colonIdx);
	const cookieTs = Number(decrypted.slice(colonIdx + 1));
	if (!cookieTs || Number.isNaN(cookieTs)) return false;
	const ipHash = crypto
		.createHash("md5")
		.update(c.req.header("cf-connecting-ip") || "")
		.digest("hex");
	return (
		cookieHash === ipHash && Date.now() - cookieTs < BACK_CHALLENGE_MAX_AGE_MS
	);
}
