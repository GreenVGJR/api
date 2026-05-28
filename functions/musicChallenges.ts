import crypto from 'crypto';

function getMdKey(): string {
    const key = process.env.MD_KEY;
    if (!key) throw new Error('Missing required environment variable: MD_KEY');
    return key;
}

const CHALLENGE_MAGIC = Buffer.from([0xf3, 0xc2, 0xd0, 0xd9]);
const CHALLENGE_EXPIRY = 6 * 60 * 60 * 1000;
const DEFAULT_DIFFICULTY = 15;

export function ipToNumber(ip: string): number | string {
    if (ip.includes(':')) return ip;
    const octets = ip.split('.');
    if (octets.length !== 4) return ip;
    return octets.reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function hashInput(input: string): string {
    return crypto.createHash('sha256').update(input).digest('base64url');
}

function encryptPayload(data: object, key: string): string {
    const cipherKey = crypto.createHash('sha256').update(key).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', cipherKey, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, encrypted, tag]).toString('base64url');
}

function decryptPayload(payload: string, key: string): object | null {
    try {
        const cipherKey = crypto.createHash('sha256').update(key).digest();
        const raw = Buffer.from(payload, 'base64url');
        if (raw.length < 28) return null;
        const iv = raw.subarray(0, 12);
        const tag = raw.subarray(raw.length - 16);
        const encrypted = raw.subarray(12, raw.length - 16);
        const decipher = crypto.createDecipheriv('aes-256-gcm', cipherKey, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return JSON.parse(decrypted.toString('utf8'));
    } catch {
        return null;
    }
}

export function generateChallenge(ip: string | number): { challenge: string; difficulty: number } {
    const formattedIp = String(typeof ip === 'number' ? ip : ipToNumber(ip));
    const ipHash = hashInput(formattedIp);
    const timestamp = Date.now();
    const salt = crypto.randomBytes(8);

    const challengePayload = Buffer.concat([
        CHALLENGE_MAGIC,
        salt,
        Buffer.from(timestamp.toString(16).padStart(16, '0'), 'hex'),
    ]);

    const encrypted = encryptPayload({
        ip: ipHash,
        time: timestamp,
    }, getMdKey());

    return {
        challenge: challengePayload.toString('base64url') + '.' + encrypted,
        difficulty: DEFAULT_DIFFICULTY,
    };
}

export function verifyChallenge(solution: string | undefined | null, ip: string | number): boolean {
    if (!solution) return false;

    const formattedIp = String(typeof ip === 'number' ? ip : ipToNumber(ip));
    const ipHash = hashInput(formattedIp);

    let payload: any;
    let solutionStr: string;
    try {
        let base64 = solution.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        solutionStr = atob(base64);
    } catch {
        return false;
    }

    try {
        const parts = solutionStr.split('.');
        if (parts.length !== 3) return false;

        const [challengeB64, encrypted, nonceStr] = parts;
        const nonce = parseInt(nonceStr, 10);
        if (isNaN(nonce) || nonce < 0) return false;

        const challengeBytes = Buffer.from(challengeB64, 'base64url');
        if (challengeBytes.length < 20) return false;

        const magic = challengeBytes.subarray(0, 4);
        if (!magic.equals(CHALLENGE_MAGIC)) return false;

        const hashInputStr = challengeB64 + nonceStr;
        const hash = crypto.createHash('sha256').update(hashInputStr).digest();

        let zeroBits = 0;
        for (const byte of hash) {
            if (byte === 0) {
                zeroBits += 8;
            } else {
                let b = byte;
                while ((b & 0x80) === 0) {
                    zeroBits++;
                    b <<= 1;
                }
                break;
            }
        }
        if (zeroBits < DEFAULT_DIFFICULTY) return false;

        payload = decryptPayload(encrypted, getMdKey());
        if (!payload) return false;
    } catch {
        return false;
    }

    if (payload.ip !== ipHash) return false;

    const timeNum = payload.time;
    if (typeof timeNum !== 'number' || isNaN(timeNum)) return false;
    if (Date.now() - timeNum > CHALLENGE_EXPIRY) return false;

    return true;
}
