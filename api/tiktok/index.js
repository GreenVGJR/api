// api/getCookieTiktok.js
import axios from 'axios/dist/node/axios.cjs';

const cooldownTime = 15 * 1000;
let lastRequestTime = Date.now();

let requestCount = 0;
const maxRequestsPerCooldown = 5;

export default async function handler(req, res) {
    const url = 'https://www.tiktok.com';
    const headers = {
        'User-Agent': 'undici',
        'Referer': 'https://www.tiktok.com/'
    };

    const ua = req.headers['user-agent'];

    const currentTime = Date.now();

    // Reset request count if cooldown period has elapsed
    if (currentTime - lastRequestTime > cooldownTime) {
        lastRequestTime = currentTime;
        requestCount = 0;
    }

    // Check if request count exceeds maximum allowed
    if (requestCount >= maxRequestsPerCooldown) {
        return res.status(429).end();
    }

    // Increment request count
    requestCount++;

    try {
        const response = await axios.get(url, { headers: headers });
        const setCookieHeader = response.headers['set-cookie'];
        const setCookieString = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader;
        let match = setCookieString.match(/tt_chain_token=[^;]+/);
        match = match ? match[0] : '';
        res.status(200).json({
            status: true, 
            cookies: setCookieString,
            filter_cookie: match,
            user_agent: ua
        });
    } catch {
        res.status(429).end();
    }
}