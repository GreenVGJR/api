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
import { YTMusic, YTLyrics, tidalLyrics, SPLyrics } from '../../functions/request.js';
import { getActiveFilters } from './filters.js';

app.get('/nowplaying', async (c) => {
    return await createMusicStream(c, async (log, s) => {
        const token = c.req.query('token');
        const guildId = c.req.query('guildId');
        const voiceId = c.req.query('voiceId');

        if (!token || !guildId) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId', type: { primary: "error", alt: "invalid_query" } })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found', type: { primary: "error", alt: "inactive_player" } })}}`);
            return;
        }

        await log('Retrieving player...');
        const { client, player } = await getOrCreatePlayer(token, log);
        const queue = getQueue(player, guildId);

        if (!queue || !queue.queue.current) {
            await log('No active queue or current track found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found', type: { primary: "error", alt: "inactive_player" } })}}`);
            return;
        }

        const current: any = queue.queue.current;
        const previous: any = queue.queue.previous?.[0];
        const currentQueueIndex = queue.queue.tracks.findIndex((track: any) => track.info.identifier === current.info.identifier);
        const upcomingTracks = currentQueueIndex === 0 ? queue.queue.tracks.slice(1) : queue.queue.tracks;
        const next: any = upcomingTracks[0];
        const totalQueueDuration = upcomingTracks.reduce((acc, track) => acc + (track.info.duration ?? 0), 0);
        const activeFilters = getActiveFilters(queue);

        await log(`Now playing: "${current.info.title}"`);

        await s.write(`],"data":${JSON.stringify({
            status: true,
            nodeId: queue.node?.id ?? null,
            data: {
                client: queue?.options || null,
                current: formatTrack(current, client, queue),
                previous: previous ? formatTrack(previous, client, queue) : null,
                next: next ? formatTrack(next, client, queue) : null,
                is247: get247(token!, guildId!),
                playing: queue.playing,
                paused: queue.paused,
                volume: queue.volume,
                loop: queue.get('autoplay') ? 'autoplay' : queue.repeatMode,
                filters: {
                    array: activeFilters.length > 0 ? activeFilters : [],
                    string: activeFilters.length > 0 ? activeFilters.join(", ") : ""
                },
                queueSize: upcomingTracks.length,
                queueElapsedTime: {
                    label: formatDuration(totalQueueDuration),
                    value: String(totalQueueDuration)
                },
                progress: {
                    current: { label: formatDuration(queue.position), value: String(queue.position) },
                    total: { label: formatDuration(current.info.duration), value: String(current.info.duration) },
                },
            },
            type: { primary: "final", alt: "success" }
        })}}`);
    });
});

app.get('/nowplaying/lyrics', async (c) => {
    return await createMusicStream(c, async (log, s) => {
        const token = c.req.query('token');
        const guildId = c.req.query('guildId');
        const voiceId = c.req.query('voiceId');

        if (!token || !guildId) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId', type: { primary: "error", alt: "invalid_query" } })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found', type: { primary: "error", alt: "inactive_player" } })}}`);
            return;
        }

        await log('Retrieving player...');
        const { client, player } = await getOrCreatePlayer(token, log);
        const queue = getQueue(player, guildId);

        if (!queue || !queue.queue.current) {
            await log('No active queue found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found', type: { primary: "error", alt: "inactive_player" } })}}`);
            return;
        }

        const track = queue.queue.current;
        const searchQuery = `${track.info.title} ${track.info.author}`;
        const totalQueueDuration = queue.queue.tracks.reduce((acc, t) => acc + (t.info.duration ?? 0), 0);
        const activeFilters = getActiveFilters(queue);
        await log(`Current track: "${track.info.title}" by ${track.info.author}`);

        try {

            await log('[1/3] Trying YouTube Music lyrics...');
            let lyrics: string | null = null;
            let syncLyrics: any = null;
            let source: string = '';
            let footer: string | null = null;

            try {
                let trackUrl = track.info.uri;
                const isYouTube = trackUrl?.includes('youtube.com') || trackUrl?.includes('youtu.be');

                if (!isYouTube) {
                    const searchRes = await YTMusic(searchQuery);
                    const firstResult = searchRes?.data?.[0];
                    if (firstResult?.url) {
                        trackUrl = firstResult.url;
                        await log(`Found YouTube version: ${trackUrl}`);
                    }
                }

                if (trackUrl) {
                    const ytData = await YTLyrics(trackUrl);
                    if (ytData?.lyrics) {
                        lyrics = ytData.lyrics;
                        footer = ytData.footer || null;
                        source = 'youtubemusic';
                        await log('YouTube Music lyrics found');
                    }
                }
            } catch (e: any) {
                await log(`YouTube Music lyrics failed: ${e?.message || 'unknown'}`);
            }

            if (!lyrics) {
                await log('[2/3] Trying Tidal lyrics...');
                try {
                    const tidalData = await tidalLyrics(searchQuery);
                    if (tidalData?.lyrics) {
                        lyrics = tidalData.lyrics;
                        syncLyrics = tidalData.syncLyrics || null;
                        source = 'tidal';
                        footer = tidalData.name ? `Source: ${tidalData.name}` : null;
                        await log('Tidal lyrics found');
                    }
                } catch (e: any) {
                    await log(`Tidal lyrics failed: ${e?.message || 'unknown'}`);
                }
            }

            if (!lyrics) {
                await log('[3/3] Trying Spotify lyrics...');
                try {
                    const spData = await SPLyrics(searchQuery);
                    if (spData?.lyrics) {
                        lyrics = spData.lyrics;
                        syncLyrics = spData.syncLyrics || null;
                        source = 'spotify';
                        footer = spData.providerDisplayName ? `Source: ${spData.providerDisplayName}` : null;
                        await log('Spotify lyrics found');
                    }
                } catch (e: any) {
                    await log(`Spotify lyrics failed: ${e?.message || 'unknown'}`);
                }
            }

            if (!lyrics) {
                await log('No lyrics found from any provider');
                await s.write(`],"data":${JSON.stringify({ status: false, message: 'No lyrics found', type: { primary: "error", alt: "invalid_query" } })}}`);
                return;
            }

            await log(`Lyrics retrieved successfully (source: ${source})`);
            await s.write(`],"data":${JSON.stringify({
                status: true,
                data: {
                    lyrics,
                    syncLyrics,
                    source,
                    footer,
                    client: queue?.options || null,
                    track: formatTrack(track, client, queue),
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
                        total: { label: formatDuration(track.info.duration), value: String(track.info.duration) },
                    },
                },
                type: { primary: "final", alt: "success" }
            })}}`);
        } catch (err: any) {
            await log(`Lyrics fetch failed: ${err.message}`);
            await s.write(`],"data":${JSON.stringify({ status: false, message: `Failed to fetch lyrics: ${err.message}`, type: { primary: "error", alt: "critical" } })}}`);
        }
    });
});

app.get('/queue', async (c) => {
    return await createMusicStream(c, async (log, s) => {
        const token = c.req.query('token');
        const guildId = c.req.query('guildId');
        const voiceId = c.req.query('voiceId');
        const limit = Math.max(1, parseInt(c.req.query('limit') || '20', 10));
        const offset = Math.max(0, parseInt(c.req.query('offset') || '0', 10));

        if (!token || !guildId) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId', type: { primary: "error", alt: "invalid_query" } })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found', type: { primary: "error", alt: "inactive_player" } })}}`);
            return;
        }

        await log('Retrieving player...');
        const { client, player } = await getOrCreatePlayer(token, log);
        const queue = getQueue(player, guildId);

        if (!queue || !queue.queue.current) {
            await log('No active queue or current track found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found', type: { primary: "error", alt: "inactive_player" } })}}`);
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
                client: queue?.options || null,
                current: queue.queue.current ? formatTrack(queue.queue.current, client, queue) : null,
                is247: get247(token!, guildId!),
                playing: queue.playing,
                paused: queue.paused,
                volume: queue.volume,
                loop: queue.get('autoplay') ? 'autoplay' : queue.repeatMode,
                filters: {
                    array: activeFilters.length > 0 ? activeFilters : [],
                    string: activeFilters.length > 0 ? activeFilters.join(", ") : ""
                },
                tracks: allTracks.length ? allTracks.slice(offset, offset + limit).map(t => formatTrack(t as any, client, queue)) : null,
                previousTracks: allPreviousTracks.length ? allPreviousTracks.slice(offset, offset + limit).map(t => formatTrack(t as any, client, queue)) : null,
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
            type: { primary: "final", alt: "success" }
        })}}`);
    });
});

export default app;
