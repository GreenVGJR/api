import { Number_random } from './request.ts';
import crypto from 'crypto';

const smellyFeel = "fda0bd57ec7312592292772bdb8780cadbcb884d59b4cc79b5ed45f680cc06b2";
const hash = crypto.createHash('sha256').update(smellyFeel).digest();
export const xt = Array.from({ length: 2000 }, (_, i) => {
    return (hash[i % hash.length] * (i + 1) + 123) % 1000;
});

function xorEncrypt(text: string, key: string): string {
    const mask = crypto.createHash('sha256').update(key).digest();
    const data = Buffer.from(text);
    for (let i = 0; i < data.length; i++) {
        data[i] ^= mask[i % mask.length];
    }
    return data.toString('base64url');
}

function xorDecrypt(base64: string, key: string): string {
    const mask = crypto.createHash('sha256').update(key).digest();
    const data = Buffer.from(base64, 'base64url');
    for (let i = 0; i < data.length; i++) {
        data[i] ^= mask[i % mask.length];
    }
    return data.toString();
}

export function ipToNumber(ip: string): number | string {
    if (ip.includes(':')) return ip;
    const octets = ip.split('.');
    if (octets.length !== 4) return ip;
    return octets.reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

export function pullInfo(r: string | number, q: string, s: string) {
    const formattedIp = String(typeof r === 'number' ? r : ipToNumber(r));
    const ip = crypto.createHash('md5').update(formattedIp).digest('hex');
    const time = Date.now().toString();
    const slicekf = crypto.createHash('md5').update(time.slice(-4)).digest('hex').replace(/[^0-9]/g, '');

    const xtIndex = Number_random(0, xt.length - 1);
    let keyIndex: number;
    do {
        keyIndex = Number_random(0, xt.length - 1);
    } while (keyIndex === xtIndex);

    const obfuscatedXt = xt.map((val, i) => i === keyIndex ? q : xorEncrypt(val.toString(), q));
    const mx = btoa(JSON.stringify(obfuscatedXt));
    const cPayload = JSON.stringify([mx, 1000, [slicekf, ip], btoa(time), xtIndex, keyIndex]);

    const fullResponse = {
        _submit: {
            name: "x-challenge-codes",
            type: ["GET", "header", 1],
            challengeTarget: "c",
            challengeExpire: 7200000
        },
        data: { type: { primary: "error", alt: "challenge" } },
        c: btoa(cPayload)
    };
    
    return xorEncrypt(JSON.stringify(fullResponse), s);
}

type ChallengeResponse = [string, number, [string, string], string, number, number];

export async function verifyChallenge(responseStr: string | undefined | null, r: string | number, q: string, ouuid: string): Promise<boolean> {
    if (!responseStr) return false;

    if (!ouuid || !ouuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return false;
    }

    let response: ChallengeResponse;
    try {
        let decoded = decodeURIComponent(atob(responseStr));
        decoded = xorDecrypt(decoded, q);
        response = JSON.parse(decoded);
    } catch (e) {
        return false;
    }

    if (!Array.isArray(response) || response.length < 6) {
        return false;
    }

    const [receivedHash, validType, [slicekf, ip], time, xtIndex, keyIndex] = response;

    if (validType !== 1000) return false;

    let expectedIp: any;
    let expectedSlice: any;
    try {
        const timeNum = parseInt(atob(time));
        if (isNaN(timeNum) || Date.now() - timeNum > 2 * 60 * 60 * 1000) {
            return false;
        }

        const formattedIp = String(typeof r === 'number' ? r : ipToNumber(r));
        expectedIp = crypto.createHash('md5').update(formattedIp).digest('hex');
        expectedSlice = crypto.createHash('md5').update(atob(time).slice(-4)).digest('hex').replace(/[^0-9]/g, '');
    }
    catch {
        return false;
    }

    if (ip !== expectedIp) {
        return false;
    }
    if (slicekf !== expectedSlice) {
        return false;
    }

    const secretValue = xt[xtIndex];
    if (secretValue === undefined) return false;

    const expectedHash = crypto
        .createHash('sha256')
        .update(atob(time))
        .update(secretValue.toString())
        .update(ip)
        .digest('base64url');

    if (receivedHash !== expectedHash) {
        return false;
    }

    return true;
}