import { Number_random } from './request.ts';
import crypto from 'crypto';

const smellyFeel = "8f3a1b2c5d9e4f0a7b6c5d4e3f2a1b0c";
const hash = crypto.createHash('sha256').update(smellyFeel).digest();
export const xt = Array.from({ length: 10 }, (_, i) => {
    return (hash[i % hash.length] * (i + 1) + 123) % 1000;
});

export function pullInfo(r: string) {
    const ip = crypto.createHash('md5').update(r.replaceAll('.', '-')).digest('hex');
    const time = Date.now().toString();
    const slicekf = crypto.createHash('md5').update(time.slice(-4)).digest('hex').replace(/[^0-9]/g, '').slice(0, 18);
    const xtIndex = Number_random(0, xt.length - 1);
    
    return {
        _message: "Germany (DE) only. Outside that, you need to solve this challenge.",
        _submit: {
            name: "x-challenge-codes",
            type: "header",
            challengeTarget: "c",
        },
        c: [btoa(JSON.stringify(xt)), 10, [slicekf, ip], time, xtIndex]
    }
}

type ChallengeResponse = [string, number, [string, string], string, number];

export function verifyChallenge(responseStr: string | undefined | null, r: string): boolean {
    if (!responseStr) return false;

    let response: ChallengeResponse;
    try {
        response = JSON.parse(responseStr);
    } catch (e) {
        return false;
    }

    if (!Array.isArray(response) || response.length < 5) {
        return false;
    }

    const [receivedHash, validType, [slicekf, ip], time, xtIndex] = response;

    if(validType !== 10) return false;

    const timeNum = parseInt(time);
    if (isNaN(timeNum) || Date.now() - timeNum > 2 * 60 * 60 * 1000) {
        return false;
    }

    const expectedIp = crypto.createHash('md5').update(r.replaceAll('.', '-')).digest('hex');
    const expectedSlice = crypto.createHash('md5').update(time.slice(-4)).digest('hex').replace(/[^0-9]/g, '').slice(0, 18);

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
        .update(time)
        .update(secretValue.toString())
        .update(ip)
        .digest('base64url');

    if (receivedHash !== expectedHash) {
        return false;
    }

    return true;
}