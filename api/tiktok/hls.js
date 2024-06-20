import axios from 'axios/dist/node/axios.cjs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { PassThrough } from 'stream';

const pipelineAsync = promisify(pipeline);
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

async function getCookieTiktok() {
    try {
        const headers = {
            'User-Agent': 'undici', // Replace with an appropriate user agent
            'Referer': 'https://www.tiktok.com/'
        };

        const response = await axios.get("https://www.tiktok.com", { headers });
        const setCookieHeader = response.headers['set-cookie'];
        return Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader;
    } catch (error) {
        console.error('Failed to fetch TikTok cookie:', error);
        throw new Error('Failed to fetch TikTok cookie'); // Re-throw the error to be caught by the caller
    }
}

export default async function handler(req, res) {
    const { url } = req.query;

    if (!url || typeof url !== 'string' || !url.includes('tiktok.com')) {
        return res.status(400).json({ error: 'Invalid or missing URL parameter' });
    }

    let token;
    try {
        token = await getCookieTiktok(); // Wait for the cookie to be fetched

        const headers = {
            'User-Agent': 'undici',
            'Referer': 'https://www.tiktok.com/',
            'Cookie': token // Use the retrieved token as a cookie
        };

        const response = await axios.get(url, { headers });
        const data = response.data;
        const playAddrPart = data.split('"playAddr":"')[1];
        let playAddr = playAddrPart.split('"')[0];

        // Replace occurrences of \\u002F with /
        playAddr = playAddr.replace(/\\u002F/g, '/');

        // Decode URI component
        playAddr = decodeURIComponent(playAddr);

        // Stream the video from TikTok to the client
        const videoResponse = await axios.get(playAddr, { headers, responseType: 'stream' });

        // PassThrough stream to handle video processing
        const passThrough = new PassThrough();

        ffmpeg(videoResponse.data)
            .videoCodec('libx264')
            .outputOptions('-crf 32') // Compression options
            .outputOptions('-preset', 'veryfast')
            .format('mp4')
            .on('end', () => {
                console.log('Compression finished');
            })
            .on('error', (err) => {
                console.error('Compression error:', err);
                res.status(500).json({ error: 'Failed to compress video' });
            })
            .pipe(passThrough, { end: true });

        // Set appropriate headers for video streaming
        res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Set-Cookie': token
        });

        // Pipe the compressed video stream to the client's response
        await pipelineAsync(passThrough, res);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            // Axios error handling
            if (error.response) {
                console.error('Request failed with status code:', error.response.status);
                res.status(error.response.status).json({
                    error: `Request failed with status code ${error.response.status}`,
                    data: [{
                        hls: `${playAddr || 'N/A'}`,
                        cookie: `${token || 'N/A'}`
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
            res.status(500).json({ error: 'Unhandled error', cookie: token || 'N/A' });
        }
    }
}