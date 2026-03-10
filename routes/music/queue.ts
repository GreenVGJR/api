import { Hono } from 'hono';
const app = new Hono();

import { getOrCreatePlayer, getQueue, formatTrack, hasActivePlayer, createMusicStream } from '../../functions/musicPlayer.js';
import { YTMusic, YTLyrics } from '../../functions/request.js';


app.get('/nowplaying', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }

        if (!hasActivePlayer(token)) {
            await log('No active player found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        await log('Retrieving player...');
        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue || !queue.currentTrack) {
            await log('No active queue found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        await log(`Now playing: "${queue.currentTrack.title}"`);

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: {
                current: formatTrack(queue.currentTrack),
                playing: queue.node.isPlaying(),
                paused: queue.node.isPaused(),
                volume: queue.node.volume,
                progress: queue.node.getTimestamp(),
            }
        })}}`);
    });
});


app.get('/nowplaying/lyrics', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }

        if (!hasActivePlayer(token)) {
            await log('No active player found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        await log('Retrieving player...');
        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue || !queue.currentTrack) {
            await log('No active queue found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const track = queue.currentTrack;
        await log(`Current track: "${track.title}" by ${track.author}`);

        try {
            let trackUrl = track.url;
            const isYouTube = trackUrl.includes('youtube.com') || trackUrl.includes('youtu.be');

            if (!isYouTube) {
                await log('Track is not from YouTube, searching for YouTube version...');
                const searchRes = await YTMusic(`${track.title} ${track.author}`);
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
                    lyrics: lyricsData.lyrics,
                    footer: lyricsData.footer
                }
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
        const token = c.req.query('token');
        const guildId = c.req.query('guildId');
        const limit = Math.max(1, parseInt(c.req.query('limit') || '20', 10));
        const offset = Math.max(0, parseInt(c.req.query('offset') || '0', 10));

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }

        if (!hasActivePlayer(token)) {
            await log('No active player found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        await log('Retrieving player...');
        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue) {
            await log('No active queue found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const allTracks = queue.tracks.toArray();
        await log(`Queue has ${allTracks.length} tracks (showing offset=${offset}, limit=${limit})`);

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: {
                current: queue.currentTrack ? formatTrack(queue.currentTrack) : null,
                tracks: allTracks.slice(offset, offset + limit).map(formatTrack),
                total: allTracks.length,
                limit,
                offset,
                playing: queue.node.isPlaying(),
            }
        })}}`);
    });
});

export default app;
