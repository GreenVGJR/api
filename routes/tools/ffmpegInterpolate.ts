import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

const app = new Hono();

app.get('/ffmpeg/interpolate', async (c) => {
    const videoUrl = c.req.query('videoUrl');
    const multi = parseFloat(c.req.query('multi') || '2');

    if (!videoUrl)
        return c.json({ error: "Missing parameter 'videoUrl'" }, 202);

    if (isNaN(multi) || multi < 2 || multi > 4)
        return c.json({ error: "Invalid 'multi' parameter. Must be between 2 and 4." }, 202);

    let resp;
    try {
        resp = await fetch(videoUrl);
        if (!resp.ok) return c.json({ error: "Failed to fetch video" }, 400);
    }
    catch {
        return c.json({ error: "Failed to fetch video" }, 400);
    }

    const contentLength = resp.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024)
        return c.json({ error: "Too large to process" }, 400);

    const arrayBuffer = await resp.arrayBuffer();
    if (arrayBuffer.byteLength > 50 * 1024 * 1024)
        return c.json({ error: "Too large to process" }, 400);

    const tempDir = os.tmpdir();
    const requestId = crypto.randomBytes(16).toString('hex');
    const inputPath = path.join(tempDir, `${requestId}`);
    fs.writeFileSync(inputPath, Buffer.from(arrayBuffer));

    try {
        const probe = spawn('ffprobe', [
            '-v', '0',
            '-of', 'json',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=r_frame_rate,width,height,duration,nb_frames,codec_type',
            '-show_entries', 'format=duration',
            inputPath
        ]);

        let probeStr = '';
        for await (const chunk of probe.stdout) probeStr += chunk;
        await new Promise(resolve => probe.on('close', resolve));

        const probeData = JSON.parse(probeStr);
        const stream0 = probeData.streams?.[0];

        const duration = parseFloat(stream0.duration ?? probeData.format?.duration ?? '0');
        const nbFrames = parseInt(stream0.nb_frames ?? '0');

        if (!stream0 || stream0.codec_type !== 'video' || (duration <= 0 && nbFrames <= 1)) {
            fs.unlinkSync(inputPath);
            return c.json({ error: "Failed to read video metadata" }, 400);
        }

        const [num, den] = (stream0.r_frame_rate as string).split('/').map(Number);
        const inputFps = den ? num / den : num;
        if (inputFps > 59) {
            fs.unlinkSync(inputPath);
            return c.json({ error: "Video over 60fps doesn't allow to process" }, 400);
        }

        if (duration > 300) {
            fs.unlinkSync(inputPath);
            return c.json({ error: "Video over 5 minutes doesn't allow to process" }, 400);
        }

        const width: number = stream0.width;
        const height: number = stream0.height;

        const longerEdge = Math.max(width, height);
        const shorterEdge = Math.min(width, height);

        if (longerEdge > 1920 || shorterEdge > 1080) {
            fs.unlinkSync(inputPath);
            return c.json({ error: "Too large to process" }, 400);
        }

        const targetFps = Math.round(inputFps * multi);

        c.header('Content-Type', 'video/mp4');
        c.header('Cache-Control', 'public, no-transform, max-age=60');
        c.header('Transfer-Encoding', 'chunked');
        c.header('X-Warning', 'You are using experimental endpoint. Expect errors');

        return stream(c, async (s) => {
            try {
                const ffmpeg = spawn('ffmpeg', [
                    '-threads', String(os.cpus().length),
                    '-i', inputPath,
                    '-filter_threads', String(os.cpus().length),
                    '-filter:v', `minterpolate=fps=${targetFps}:me=epzs:mb_size=16:vsbmc=1`,
                    '-preset', 'ultrafast',
                    '-movflags', 'frag_keyframe+empty_moov+faststart',
                    '-f', 'mp4',
                    'pipe:1'
                ]);

                // ffmpeg.stderr.on('data', (data) => console.log(`FFmpeg log: ${data}`));
                ffmpeg.stdout.on('data', async (chunk) => await s.write(chunk));

                await new Promise((resolve, reject) => {
                    ffmpeg.on('close', (code) => code === 0 ? resolve(null) : reject(null));
                    ffmpeg.on('error', reject);
                    s.onAbort(() => {
                        ffmpeg.kill('SIGKILL');
                        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                    });
                });

            } catch { }
            finally {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            }
        });

    } catch (err: any) {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        console.error("Probe error:", err);
        return c.json({ error: "Failed to process video" }, 500);
    }
});

export default app;