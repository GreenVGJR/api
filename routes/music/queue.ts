import { Hono } from 'hono';
const app = new Hono();

import {
    getOrCreatePlayer,
    getQueue,
    formatTrack,
    hasActivePlayer,
    createMusicStream,
    get247,
    formatDuration,
} from '../../functions/musicPlayer.js';
import { YTMusic, YTLyrics } from '../../functions/request.js';
import { getActiveFilters } from './filters.js';


app.get('/nowplaying', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token   = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId' })}}`);
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

        const current: any = queue.queue.current;
        const previous: any = queue.queue.previous?.[0];
        const next: any = queue.queue.tracks?.[0];
        const totalQueueDuration = queue.queue.tracks.reduce((acc, track) => acc + (track.info.duration ?? 0), 0);
        const activeFilters = getActiveFilters(queue);

        await log(`Now playing: "${current.info.title}"`);

        await s.write(`],"data":${JSON.stringify({
            status: true,
            nodeId: queue.node?.id ?? null,
            data: {
                previous: previous ? formatTrack(previous) : null,
                current: formatTrack(current),
                next: next ? formatTrack(next) : null,
                is247: get247(token!, guildId!),
                playing: queue.playing,
                paused: queue.paused,
                volume: queue.volume,
                loop: queue.get('autoplay') ? 'autoplay' : queue.repeatMode,
                filters: {
                    array: activeFilters.length > 0 ? activeFilters : [],
                    string: activeFilters.length > 0 ? activeFilters.join(", ") : ""
                },
                queueSize: queue.queue.tracks.length,
                queueElapsedTime: {
                    label: formatDuration(totalQueueDuration),
                    value: String(totalQueueDuration)
                },
                progress: {
                    current: { label: formatDuration(queue.position), value: String(queue.position) },
                    total: { label: formatDuration(current.info.duration), value: String(current.info.duration) },
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
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId' })}}`);
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
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId' })}}`);
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

        const allTracks = queue.queue.tracks;
        const currentTrack: any = queue.queue.current;
        const allPreviousTracks = queue.queue.previous;
        const totalQueueDuration = allTracks.reduce((acc, track) => acc + (track.info.duration ?? 0), 0);
        const activeFilters = getActiveFilters(queue);

        await s.write(`],"data":${JSON.stringify({
            status: true,
            nodeId: queue.node?.id ?? null,
            data: {
                current: queue.queue.current ? formatTrack(queue.queue.current) : null,
                is247: get247(token!, guildId!),
                playing: queue.playing,
                paused: queue.paused,
                volume: queue.volume,
                loop: queue.get('autoplay') ? 'autoplay' : queue.repeatMode,
                filters: {
                    array: activeFilters.length > 0 ? activeFilters : [],
                    string: activeFilters.length > 0 ? activeFilters.join(", ") : ""
                },
                tracks: allTracks.length ? allTracks.slice(offset, offset + limit).map(t => formatTrack(t as any)) : null,
                previousTracks: allPreviousTracks.length ? allPreviousTracks.slice(offset, offset + limit).map(t => formatTrack(t as any)) : null,
                total: allTracks.length,
                limit,
                offset,
                elapsedTime: {
                    label: formatDuration(totalQueueDuration),
                    value: String(totalQueueDuration)
                },
                progress: currentTrack ? {
                    current: { label: formatDuration(queue.position), value: String(queue.position) },
                    total: { label: formatDuration(currentTrack.info.duration), value: String(currentTrack.info.duration) },
                } : null,
            },
        })}}`);
    });
});

export default app;