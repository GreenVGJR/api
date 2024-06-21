// api/tiktok/hls.js
import axios from 'axios/dist/node/axios.cjs';

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
        console.error('Failed to fetch TikTok cookie:', error);
        throw new Error('Failed to fetch TikTok cookie'); // Re-throw the error to be caught by the caller
    }
}

export default async function handler(req, res) {
    const { url, watermark } = req.query;

      if (!url || typeof url !== 'string' || !url.includes('tiktok.com')) {
      return res.status(400).json({ error: 'Invalid or missing URL parameter (url)' });
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
        const playAddrPart = data.split(wm)[1];
        let playAddr = playAddrPart.split('"')[0];

        // Replace occurrences of \\u002F with /
        playAddr = playAddr.replace(/\\u002F/g, '/');

        // Decode URI component
        playAddr = decodeURIComponent(playAddr);

        // Stream the video from TikTok to the client
        const videoResponse = await axios.get(playAddr, { headers, responseType: 'stream' });

        // Set appropriate headers for video streaming
        if (videoResponse.headers['content-length'] > 4400000) {
         res.status(500).json({ 
            status: false,
            error: 'Vercel Errors: Video size exceeded limit.',
            payload_limit: '4.5 MB',
            video_size: videoResponse.headers['content-length'] / 1000 / 1000 + ' MB',
            data: [{
                hls: `${playAddr}`,
                cookie: `${token}`
            }],
            alternative: "https://tikcdn.io/ssstik/" + url.split('/')[5]
            });
         }
        else {
         res.writeHead(200, { 
            'Content-Type': 'video/mp4',
            'Content-Length': videoResponse.headers['content-length'],
            'Cache-Cookie': token // Use the retrieved token as a cookie
        });

        // Pipe the video stream to the client's response
        videoResponse.data.pipe(res);
        }

    } catch (error) {
        if (axios.isAxiosError(error)) {
            // Axios error handling
            if (error.response) {
                console.error('Request failed with status code:', error.response.status);
                res.status(error.response.status).json({ 
                    error: `Request failed with status code ${error.response.status}`,
                    data: [{
                        hls: `${playAddr}`,
                        cookie: `${token}`
                    }]
                });
            } else if (error.request) {
                console.error('Request made but no response received:', error.request);
                res.status(500).json({ error: 'Request made but no response received' });
            } else {
                console.error('Error setting up request:', error.message);
                res.status(500).json({ error: 'Error setting up request' });
            }
        } else {
            // Other non-Axios errors
            console.error('Unhandled error:', error.message);
            res.status(500).json({ error: 'Unhandled error' });
        }
    }
}
