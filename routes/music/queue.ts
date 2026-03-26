import { Hono } from 'hono';
const app = new Hono();

import {
    getOrCreatePlayer,
    getQueue,
    formatTrack,
    hasActivePlayer,
    createMusicStream,
    get247,
} from '../../functions/musicPlayer.js';
import { YTMusic, YTLyrics } from '../../functions/request.js';


app.get('/nowplaying', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token   = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        await log('Retrieving player...');
        const { player } = await getOrCreatePlayer(token, log);
        const queue = getQueue(player, guildId);

        if (!queue || !queue.queue.current) {
            await log('No active queue or current track found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const current = queue.queue.current;
        await log(`Now playing: "${current.info.title}"`);

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: {
                current: formatTrack(current),
                is247: get247(token!, guildId!),
                playing: queue.playing,
                paused: queue.paused,
                volume: queue.volume,
                loop: queue.repeatMode,
                queueSize: queue.queue.tracks.length,
                progress: {
                    current: { label: formatMs(queue.position), value: queue.position },
                    total: { label: formatMs(current.info.duration), value: current.info.duration },
                },
            },
        })}}`);
    });
});


app.get('/nowplaying/lyrics', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token   = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        await log('Retrieving player...');
        const { player } = await getOrCreatePlayer(token, log);
        const queue = getQueue(player, guildId);

        if (!queue || !queue.queue.current) {
            await log('No active queue found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const track = queue.queue.current;
        await log(`Current track: "${track.info.title}" by ${track.info.author}`);

        try {
            let trackUrl = track.info.uri;
            const isYouTube = trackUrl.includes('youtube.com') || trackUrl.includes('youtu.be');

            if (!isYouTube) {
                await log('Track is not from YouTube, searching for YouTube version...');
                const searchRes = await YTMusic(`${track.info.title} ${track.info.author}`);
                const firstResult = searchRes?.data?.[0];
                if (firstResult?.url) {
                    trackUrl = firstResult.url;
                    await log(`Found YouTube version: ${trackUrl}`);
                } else {
                    await log('Could not find YouTube version for lyrics');
                }
            }

            await log('Fetching lyrics...');
            const lyricsData = await YTLyrics(trackUrl);

            if (!lyricsData || !lyricsData.lyrics) {
                await log('No lyrics found for this track');
                await s.write(`],"data":${JSON.stringify({ status: false, message: 'No lyrics found' })}}`);
                return;
            }

            await log('Lyrics retrieved successfully');
            await s.write(`],"data":${JSON.stringify({
                status: true,
                data: {
                    track: formatTrack(track),
                    is247: get247(token!, guildId!),
                    lyrics: lyricsData.lyrics,
                    footer: lyricsData.footer,
                },
            })}}`);
        } catch (err: any) {
            await log(`Lyrics fetch failed: ${err.message}`);
            await s.write(`],"data":${JSON.stringify({ status: false, message: `Failed to fetch lyrics: ${err.message}` })}}`);
        }
    });
});


app.get('/queue', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token   = c.req.query('token');
        const guildId = c.req.query('guildId');
        const limit   = Math.max(1, parseInt(c.req.query('limit')  || '20', 10));
        const offset  = Math.max(0, parseInt(c.req.query('offset') || '0',  10));

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        await log('Retrieving player...');
        const { player } = await getOrCreatePlayer(token, log);
        const queue = getQueue(player, guildId);

        if (!queue) {
            await log('No active queue found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const allTracks = queue.queue.tracks;
        await log(`Queue has ${allTracks.length} tracks (showing offset=${offset}, limit=${limit})`);

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: {
                current: queue.queue.current ? formatTrack(queue.queue.current) : null,
                is247: get247(token!, guildId!),
                tracks: allTracks.slice(offset, offset + limit).map(t => formatTrack(t as any)),
                total: allTracks.length,
                limit,
                offset,
                playing: queue.playing,
            },
        })}}`);
    });
});


// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
    if (!ms || ms <= 0) return '0:00';
    const s   = Math.floor(ms / 1000);
    const h   = Math.floor(s / 3600);
    const m   = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
}

export default app;