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
            'User-Agent': 'undici',
            'Referer': 'https://www.tiktok.com/'
        };

        const response = await axios.get("https://www.tiktok.com", { headers });
        const setCookieHeader = response.headers['set-cookie'];
        return Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader;
    } catch (error) {
        console.error('Failed to fetch TikTok cookie:', error);
        throw new Error('Failed to fetch TikTok cookie');
    }
}

export default async function handler(req, res) {
    const { url } = req.query;

    if (!url || typeof url !== 'string' || !url.includes('tiktok.com')) {
        return res.status(400).json({ error: 'Invalid or missing URL parameter' });
    }

    let token;
    try {
        token = await getCookieTiktok();

        const headers = {
            'User-Agent': 'undici',
            'Referer': 'https://www.tiktok.com/',
            'Cookie': token
        };

        const response = await axios.get(url, { headers });
        const data = response.data;
        const playAddrPart = data.split('"playAddr":"')[1];
        let playAddr = playAddrPart.split('"')[0];

        playAddr = playAddr.replace(/\\u002F/g, '/');
        playAddr = decodeURIComponent(playAddr);

        console.log('Fetching video from playAddr:', playAddr);

        const videoResponse = await axios.get(playAddr, { headers, responseType: 'stream' });
        console.log('Fetched video response with status:', videoResponse.status);

        const passThrough = new PassThrough();

        ffmpeg(videoResponse.data)
            .videoCodec('libx264')
            .outputOptions('-crf 32')
            .outputOptions('-preset', 'veryfast')
            .format('mp4')
            .on('start', (commandLine) => {
                console.log('Spawned Ffmpeg with command: ' + commandLine);
            })
            .on('codecData', (data) => {
                console.log('Input is ' + data.audio + ' audio ' + 'with ' + data.video + ' video');
            })
            .on('progress', (progress) => {
                console.log('Processing: ' + progress.percent + '% done');
            })
            .on('error', (err, stdout, stderr) => {
                console.error('Error: ' + err.message);
                console.error('ffmpeg stdout: ' + stdout);
                console.error('ffmpeg stderr: ' + stderr);
                res.status(500).json({ error: 'Failed to compress video' });
            })
            .on('end', () => {
                console.log('Compression finished');
            })
            .pipe(passThrough, { end: true });

        res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Set-Cookie': token
        });

        console.log('Piping video stream to response');

        await pipelineAsync(passThrough, res);
        console.log('Video stream piped successfully');
    } catch (error) {
        if (axios.isAxiosError(error)) {
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
            console.error('Unhandled error:', error.message);
            res.status(500).json({ error: 'Unhandled error', cookie: token || 'N/A' });
        }
    }
}
