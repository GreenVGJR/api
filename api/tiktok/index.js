// api/getCookieTiktok.js
import axios from 'axios/dist/node/axios.cjs';
import Cooldown from 'cooldown/cooldown.js';

const cooldownTime = 10 * 1000; // 15 seconds
const maxRequestsPerCooldown = 5;
const cooldown = new Cooldown(cooldownTime, maxRequestsPerCooldown);


export default async function handler(req, res) {
    const url = 'https://www.tiktok.com';
    const headers = {
        'User-Agent': 'undici',
        'Referer': 'https://www.tiktok.com/'
    };

    const ua = req.headers['user-agent'];

    if (!cooldown.checkCooldown()) {
        res.status(429).end();
        return;
    }

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