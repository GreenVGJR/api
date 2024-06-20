// api/getCookieTiktok.js
import axios from 'axios/dist/node/axios.cjs';

export default async function handler(req, res) {
    const url = 'https://www.tiktok.com';
    const headers = {
        'User-Agent': req.headers['user-agent'] || 'undici',
        'Referer': 'https://www.tiktok.com/'
    };

    try {
        const response = await axios.get(url, { headers: headers });
        const setCookieHeader = response.headers['set-cookie'];
        const setCookieString = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader;
        const match = setCookieString.match(/tt_chain_token=[^;]+/);

        res.status(200).json({
            status: 'true', 
            cookies: match ? match[0] : ''
        });
    } catch (error) {
        res.status(500).json({
            status: 'false',
            cookie: 'Failed to fetch cookies',
            error: 'Rate-limited' });
    }
}