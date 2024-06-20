// api/getCookieTiktok.js
import axios from 'axios/dist/node/axios.cjs';

export default async function handler(req, res) {
    const url = 'https://www.tiktok.com';
    const headers = {
        'User-Agent': 'undici',
        'Referer': 'https://www.tiktok.com/'
    };

    const ua = 'undici';

    try {
        const response = await axios.get(url, { headers: headers });
        const setCookieHeader = response.headers['set-cookie'];
        const setCookieString = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader;
        let match = setCookieString.match(/tt_chain_token=[^;]+/);
        match = match ? match[0] : '';
        res.status(200).json({
            status: 'true', 
            cookies: match,
            user_agent: ua
        });
    } catch (error) {
        res.status(500).json({
            status: 'false',
            cookie: 'Failed to fetch cookies',
            error: 'Rate-limited' });
    }
}