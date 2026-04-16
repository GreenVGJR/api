import { Number_random } from './request.ts';
import crypto from 'crypto';

const smellyFeel = "fda0bd57ec7312592992772bdb8780cadbcb884d59b4ca79b5ed45a680cc06b2";
const hash = crypto.createHash('sha256').update(smellyFeel).digest();
export const xt = Array.from({ length: 100 }, (_, i) => {
    return (hash[i % hash.length] * (i + 1) + 123) % 1000;
});

export function pullInfo(r: string) {
    const ip = crypto.createHash('md5').update(r.replaceAll('.', '-')).digest('hex');
    const time = Date.now().toString();
    const slicekf = crypto.createHash('md5').update(time.slice(-4)).digest('hex').replace(/[^0-9]/g, '');
    const xtIndex = Number_random(0, xt.length - 1);

    return {
        _message: "Germany (DE) only. Outside that, you need to solve this challenge.",
        _submit: {
            name: "x-challenge-codes",
            type: "header",
            challengeTarget: "c",
            challengeExpire: 7200000
        },
        c: [btoa(JSON.stringify(xt)), 100, [slicekf, ip], time, xtIndex]
    }
}

type ChallengeResponse = [string, number, [string, string], string, number];

export function verifyChallenge(responseStr: string | undefined | null, r: string): boolean {
    if (!responseStr) return false;

    let response: ChallengeResponse;
    try {
        response = JSON.parse(decodeURIComponent(responseStr));
    } catch (e) {
        return false;
    }

    if (!Array.isArray(response) || response.length < 5) {
        return false;
    }

    const [receivedHash, validType, [slicekf, ip], time, xtIndex] = response;

    if (validType !== 100) return false;

    const timeNum = parseInt(time);
    if (isNaN(timeNum) || Date.now() - timeNum > 2 * 60 * 60 * 1000) {
        return false;
    }

    const expectedIp = crypto.createHash('md5').update(r.replaceAll('.', '-')).digest('hex');
    const expectedSlice = crypto.createHash('md5').update(time.slice(-4)).digest('hex').replace(/[^0-9]/g, '');

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