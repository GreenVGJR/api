// api/tiktok/hls.js
import axios from 'axios/dist/node/axios.cjs';
import Cooldown from '../../cooldown/cooldown';

export default async function handler(req, res) {
    const { url, watermark, audio } = req.query;

    if (!Cooldown.checkCooldown()) {
        res.status(429).end();
        return;
    }

    async function getCookieTiktok() {
        try {
            const headers = {
                'User-Agent': 'undici', // Replace with an appropriate user agent
                'Referer': 'https://www.tiktok.com/'
            };
    
            const response = await axios.get("https://www.tiktok.com", { headers });
            const setCookieHeader = response.headers['set-cookie'];
            return Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader;
            /*
            const match = setCookieString.match(/tt_chain_token=[^;]+/);
            return match ? match[0] : ''; // Return the matched token or an empty string if not found
            */
        } catch (error) {
            return res.status(502).end();
        }
    }
      if (!url || typeof url !== 'string' || !url.includes('tiktok.com')) {
      return res.status(400).json({ status: false, error: 'Invalid or missing URL parameter (url)' });
      }

    let wm;
    if(watermark == 'true') {
      wm = '"downloadAddr":"';
    }
    else {
      wm = '"playAddr":"';
    }

    
    try {
        const token = await getCookieTiktok(); // Wait for the cookie to be fetched

        const headers = {
            'User-Agent': 'undici',
            'Referer': 'https://www.tiktok.com/',
            'Cookie': token // Use the retrieved token as a cookie
        };

        const response = await axios.get(url, { headers });
        const data = response.data;
        let playAddr;
        if(audio == 'true') {
            const playAddrPart = data.split('"music"')[1];
            const playAddrPart2 = playAddrPart.split('"playUrl":"')[1];
            playAddr = playAddrPart2.split('"')[0];
        }
        else {
        const playAddrPart = data.split(wm)[1];
        playAddr = playAddrPart.split('"')[0];
        }

        // Replace occurrences of \\u002F with /
        playAddr = playAddr.replace(/\\u002F/g, '/');

        // Decode URI component
        playAddr = decodeURIComponent(playAddr);

        // Set appropriate headers for video streaming
        if (videoResponse.headers['content-length'] > 4500000) {
         res.status(500).json({ 
            status: false,
            error: 'Vercel Errors: Video size exceeded limit.',
            payload_limit: '4.5 MB',
            video_size: Math.floor(videoResponse.headers['content-length'] / 1000 / 1000 * 10) / 10 + ' MB',
            data: [{
                hls: `${playAddr}`,
                cookie: `${token}`
            }],
            alternative: "https://tikcdn.io/ssstik/" + url.split('/')[5]
            });
         }
        else {
        const cacheDuration = 60 * 60 * 24 * 1; // 1 days in seconds
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', videoResponse.headers['content-length']);
        res.setHeader('Cache-Control', `public, max-age=${cacheDuration}, immutable, preload`);
        res.setHeader('Cache-Cookie', token);
        if (!audio) {
            res.setHeader('video', playAddr);
        }
        if (audio === 'true') {
            res.setHeader('audio', playAddr);
        }

        // Temporary redirect to the final URL
        res.setHeader('Location', playAddr);
        res.status(307).end(JSON.stringify({
            status: 'Temporary Redirect',
            location: playAddr
        }, null, 2)); // Pretty-print the response 
        }
    }
     catch (error) {
        if (axios.isAxiosError(error)) {
            // Axios error handling
            if (error.response) {
                res.status(error.response.status).json({ 
                    status: false,
                    error: `Request failed with status code ${error.response.status}`,
                    data: [{
                        hls: `${playAddr}`,
                        cookie: `${token}`
                    }],
                    alternative: "https://tikcdn.io/ssstik/" + url.split('/')[5]
                });
            } else if (error.request) {
                res.status(500).json({ status: false, error: 'Request made but no response received' });
            } else {
                res.status(500).json({ status: false, error: 'Error setting up request' });
            }
        } else {
            console.error(error);
            res.status(500).end();
        }
    }
}
