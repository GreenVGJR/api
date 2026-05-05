import { Hono } from 'hono';
const app = new Hono();

import {
    getOrCreatePlayer,
    resolveVoiceChannel,
    formatTrack,
    hasActivePlayer,
    set247,
    get247,
    createMusicStream,
    checkVoicePermissions,
    formatDuration,
    updateVoiceStatus,
} from '../../functions/musicPlayer.js';
import { SCMusic, SPMusic, YTMusic, YTVideo, Deezer, Tidal, request, commonHeaders } from '../../functions/request.js';
import { getActiveFilters } from './filters.js';

// ── Custom search result ──────────────────────────────────────────────────────

interface CustomSearchResult {
    id?: string;
    url: string;
    // Title + author are used to build a ytsearch fallback when the URL itself
    // can't be loaded by Lavalink (e.g. no SC source manager on the node).
    title?: string;
    author?: string;
    thumbnail?: string;
    sourceName?: string;
    duration?: number;
}

function getPlatformFromUrl(url: string): string | null {
    if (url.includes('spotify.com')) return 'spotify';
    if (url.includes('soundcloud.com')) return 'soundcloud';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtubemusic';
    if (url.includes('apple.com')) return 'applemusic';
    if (url.includes('deezer.com')) return 'deezer';
    if (url.includes('tidal.com')) return 'tidal';
    return null;
}

async function customSearch(platform: string, query: string): Promise<CustomSearchResult | null> {
    try {
        const isUrl = query.startsWith('http://') || query.startsWith('https://');
        switch (platform) {
            case 'soundcloud': {
                const res = await SCMusic(query, undefined, 1);
                const track = res?.data?.[0]?.[0];
                if (!track?.permalink_url) return null;
                return {
                    id: String(track.id),
                    url: track.permalink_url,
                    title: track.title,
                    author: track.user?.username || track.publisher_metadata?.artist,
                    thumbnail: track.artwork_url?.replace('-large', '-t500x500') || track.user?.avatar_url,
                    sourceName: 'soundcloud',
                    duration: track.duration,
                };
            }
            case 'spotify': {
                // If it's a URL, we can try to extract the ID directly
                let trackId = null;
                if (isUrl && query.includes('/track/')) {
                    trackId = query.split('/track/')[1]?.split('?')[0];
                }

                if (trackId) {
                    // We could do a direct lookup here, but for now let's just search
                }

                const res = await SPMusic(query, undefined, 1);
                const track = res?.data?.tracks?.[0];
                if (!track?.id) return null;
                return {
                    id: track.id,
                    url: `https://open.spotify.com/track/${track.id}`,
                    title: track.name,
                    author: track.artists?.items?.map((a: any) => a.profile?.name).join(', '),
                    thumbnail: track.albumOfTrack?.coverArt?.sources?.sort((a: any, b: any) => (b.width || 0) - (a.width || 0))?.[0]?.url,
                    sourceName: 'spotify',
                    duration: track.duration?.totalMilliseconds,
                };
            }
            case 'youtube': {
                const res = await YTVideo(query, false);
                const track = res?.data?.[0];
                if (!track?.url) return null;
                return { id: track.videoId, url: track.url, title: track.title, author: track.author, thumbnail: track.thumbnail, sourceName: 'youtube' };
            }
            case 'youtubemusic': {
                const res = await YTMusic(query, false);
                const track = res?.data?.[0];
                if (!track?.url) return null;
                return { id: track.videoId, url: track.url, title: track.title, author: track.author, thumbnail: track.thumbnail, sourceName: 'youtube' };
            }
            case 'applemusic': {
                const amRes = await request(
                    `https://itunes.apple.com/search?media=music&limit=1&country=US&term=${encodeURIComponent(query)}`,
                    { method: 'GET', headers: commonHeaders }
                );
                const parsed: any = await amRes.json();
                const track = parsed?.results?.[0];
                if (!track) return null;
                return {
                    id: String(track.trackId),
                    url: track.trackViewUrl,
                    title: track.trackName,
                    author: track.artistName,
                    thumbnail: track.artworkUrl100?.replace('100x100', '600x600'),
                    sourceName: 'applemusic',
                    duration: track.trackTimeMillis,
                };
            }
            case 'deezer': {
                const res = await Deezer(query);
                const track = res?.data?.[0];
                if (!track?.link) return null;
                return {
                    id: String(track.id),
                    url: track.link,
                    title: track.title,
                    author: track.artist?.name,
                    thumbnail: track.album?.cover_big || track.album?.cover_medium,
                    sourceName: 'deezer',
                    duration: track.duration ? track.duration * 1000 : undefined,
                };
            }
            case 'tidal': {
                const res = await Tidal(query);
                const track = res?.data?.[0];
                if (!track?.url) return null;
                return {
                    id: String(track.id),
                    url: track.url,
                    title: track.title,
                    author: track.artist?.name || track.artists?.[0]?.name,
                    thumbnail: track.album?.cover ? `https://resources.tidal.com/images/${track.album.cover.replace(/-/g, '/')}/640x640.jpg` : undefined,
                    sourceName: 'tidal',
                    duration: track.duration ? track.duration * 1000 : undefined,
                };
            }
            default:
                return null;
        }
    } catch {
        return null;
    }
}

app.get('/play', async (c) => {
    return await createMusicStream(c, async (log, s) => {

        const token = c.req.query('token');
        const query = c.req.query('q');
        const platform = (c.req.query('platform') || 'spotify').toLowerCase();
        const voiceId = c.req.query('voiceId');
        const reqGuildId = c.req.query('guildId');
        const authorId = c.req.query('authorId');
        const isDeaf = c.req.query('isDeaf') !== 'false';
        const req247 = c.req.query('247');

        if (!token || !query || (!reqGuildId && !voiceId && !authorId)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, q, guildId, voiceId', type: { primary: "error", alt: "invalid_query" } })}}`);
            return;
        }

        const queryStr = query as string;
        const isUrl = queryStr.startsWith('http://') || queryStr.startsWith('https://');

        // Verify platform if not a URL
        const supportedPlatforms = ['youtube', 'youtubemusic', 'soundcloud', 'spotify', 'applemusic', 'deezer', 'tidal'];
        if (!isUrl && !supportedPlatforms.includes(platform)) {
            await log(`Unsupported search platform: "${platform}"`);
            await s.write(`],"data":${JSON.stringify({ status: false, message: `Search engine "${platform}" is not supported.`, list: supportedPlatforms.join(', '), type: { primary: "error", alt: "invalid_query" } })}}`);
            return;
        }

        // ── Parallel Setup ──────────────────────────────────────────────────

        const isNew = !hasActivePlayer(token);
        await log(isNew ? 'Creating new discord.js client...' : 'Reusing existing discord.js client');

        // Detect effective platform for metadata lookup
        const effectivePlatform = isUrl ? (getPlatformFromUrl(queryStr) || platform) : platform;

        // Start tasks
        const pCustom = customSearch(effectivePlatform, queryStr);
        const { client, player: manager } = await getOrCreatePlayer(token, log);

        await log(isNew ? 'Discord.js client ready' : 'Client retrieved');
        await log('Lavalink manager active');

        const applyOverlay = (result: any, customResult: CustomSearchResult | null) => {
            if (result?.tracks?.[0] && customResult) {
                const t = result.tracks[0];
                t.info = {
                    ...t.info,
                    ...(customResult.id ? { identifier: customResult.id } : {}),
                    ...(customResult.title ? { title: customResult.title } : {}),
                    ...(customResult.author ? { author: customResult.author } : {}),
                    ...(customResult.url ? { uri: customResult.url } : {}),
                    ...(customResult.thumbnail ? { artworkUrl: customResult.thumbnail } : {}),
                    actualSourceName: t.info.sourceName,
                    ...(customResult.sourceName ? { sourceName: customResult.sourceName } : {}),
                    ...(customResult.duration ? { duration: customResult.duration } : {}),
                };
            }
        };

        // Parallel tasks after client is ready
        const pRequester = (async () => {
            let requester: any = { id: authorId || 'api', username: 'API' };
            if (authorId) {
                await log(`Fetching user: ${authorId}`);
                const fetched = await client.users.fetch(authorId as string).catch(() => null);
                if (fetched) {
                    requester = fetched;
                    await log(`User found: ${fetched.tag}`);
                } else {
                    await log('User not found, using fallback requester');
                }
            }
            return requester;
        })();

        const pVoice = (async () => {
            let channel: any = null;
            if (voiceId) {
                await log(`Resolving voice channel: ${voiceId}`);
                channel = await resolveVoiceChannel(client, voiceId);
                await log('Voice channel resolved');
            } else if (authorId && reqGuildId) {
                await log(`Looking for author's voice connection (${authorId}) in guild ${reqGuildId}...`);
                const guild = client.guilds.cache.get(reqGuildId as string);
                if (guild) {
                    const voiceState = guild.voiceStates.cache.get(authorId as string);
                    if (voiceState?.channel) channel = voiceState.channel;
                }
                if (channel) {
                    await log(`Found target in voice channel: ${channel.name}`);
                    checkVoicePermissions(channel, client.user!);
                }
            }
            return channel;
        })();

        const pGP = (async () => {
            const channel = await pVoice;
            if (!channel) return null;

            const guildId = channel.guild.id;
            let gp = manager.players.get(guildId);
            const isNewGP = !gp || (
                !gp.playing &&
                !gp.paused &&
                gp.queue.tracks.length === 0 &&
                !gp.queue.current
            );

            if (!gp) {
                await log('Creating Lavalink player...');
                gp = await manager.createPlayer({
                    guildId,
                    voiceChannelId: channel.id,
                    selfDeaf: isDeaf,
                    selfMute: false
                });
            } else {
                gp.options.selfDeaf = isDeaf;
            }

            return { gp, isNewGP };
        })();

        const pConnect = (async () => {
            const setup = await pGP;
            if (!setup) return;
            const { gp } = setup;
            if (!gp.connected) {
                await log('Connecting to voice channel...');
                await gp.connect();
                await log('Connected');
            }
        })();

        const pSearch = (async () => {
            const [customResult, requester, setup] = await Promise.all([pCustom, pRequester, pGP]);
            if (!setup) throw new Error('No voice channel found');
            const { gp } = setup;

            const doSearch = async (q: string, src: string) => {
                const res = await gp.search(
                    { query: q, source: (src === 'url' ? undefined : src) as any },
                    requester
                );
                if (!res?.tracks?.length) throw new Error(`No results for "${q}"`);
                return res;
            };

            let result: any = null;
            if (isUrl) {
                await log(`Loading URL directly: "${queryStr}"`);
                result = await doSearch(queryStr, 'url');
                applyOverlay(result, customResult);
            } else {
                await log(`[Attempt 1] Custom ${platform} search: "${queryStr}"`);
                if (customResult) {
                    await log(`[Attempt 1] Got URL: "${customResult.url}" — loading via Lavalink`);
                    try {
                        result = await doSearch(customResult.url, 'url');
                        applyOverlay(result, customResult);
                        await log('[Attempt 1] Direct URL load succeeded');
                    } catch (e: any) {
                        await log(`[Attempt 1] Direct URL load failed (${e?.message}) — falling back to Lavalink search`);
                    }
                } else {
                    await log(`[Attempt 1] No URL returned — falling back to Lavalink search`);
                }

                if (!result) {
                    const hasMeta = customResult?.title && customResult?.author;
                    const metaQuery = hasMeta ? `${customResult!.title} ${customResult!.author}` : null;

                    // Build fallback attempts using custom search functions (not Lavalink search prefixes)
                    const fallbacks: Array<{ label: string; searchPlatform: string; query: string }> = [];

                    // If we have metadata from Attempt 1, try YouTube Music with enriched query
                    if (metaQuery) {
                        fallbacks.push({ label: 'YouTube Music (metadata)', searchPlatform: 'youtubemusic', query: metaQuery });
                    }

                    // Try YouTube Music with the original query (skip if already queued above with same query)
                    if (!metaQuery && platform !== 'youtubemusic') {
                        fallbacks.push({ label: 'YouTube Music', searchPlatform: 'youtubemusic', query: queryStr });
                    }

                    // Try Spotify with the original query (skip if that was the initial platform — already tried)
                    if (platform !== 'spotify') {
                        fallbacks.push({ label: 'Spotify', searchPlatform: 'spotify', query: queryStr });
                    }

                    // Try Apple Music with the original query (skip if that was the initial platform — already tried)
                    if (platform !== 'applemusic') {
                        fallbacks.push({ label: 'Apple Music', searchPlatform: 'applemusic', query: queryStr });
                    }

                    // Try SoundCloud with the original query (skip if that was the initial platform — already tried)
                    if (platform !== 'soundcloud') {
                        fallbacks.push({ label: 'SoundCloud', searchPlatform: 'soundcloud', query: queryStr });
                    }

                    // Try Deezer with the original query (skip if that was the initial platform — already tried)
                    if (platform !== 'deezer') {
                        fallbacks.push({ label: 'Deezer', searchPlatform: 'deezer', query: queryStr });
                    }

                    // Try Tidal with the original query (skip if that was the initial platform — already tried)
                    if (platform !== 'tidal') {
                        fallbacks.push({ label: 'Tidal', searchPlatform: 'tidal', query: queryStr });
                    }

                    let currentAttempt = 2;
                    for (const attempt of fallbacks) {
                        await log(`[Attempt ${currentAttempt}] Custom ${attempt.label} search: "${attempt.query}"`);
                        try {
                            const fallbackResult = await customSearch(attempt.searchPlatform, attempt.query);
                            if (!fallbackResult?.url) {
                                await log(`[Attempt ${currentAttempt}] "${attempt.label}" returned no results`);
                                currentAttempt++;
                                continue;
                            }
                            await log(`[Attempt ${currentAttempt}] Got URL: "${fallbackResult.url}" — loading via Lavalink`);
                            result = await doSearch(fallbackResult.url, 'url');
                            applyOverlay(result, customResult);
                            await log(`[Attempt ${currentAttempt}] "${attempt.label}" succeeded`);
                            break;
                        } catch (err: any) {
                            await log(`[Attempt ${currentAttempt}] "${attempt.label}" failed: ${err?.message}`);
                        }
                        currentAttempt++;
                    }
                }
            }
            if (!result) throw new Error('All search methods failed');
            return result;
        })();

        // Join results
        const [searchResult, setup, _] = await Promise.allSettled([pSearch, pGP, pConnect]);

        if (searchResult.status === 'rejected') {
            await s.write(`],"data":${JSON.stringify({ status: false, message: searchResult.reason?.message || 'Search failed', type: { primary: "error", alt: "critical" } })}}`);
            return;
        }

        if (setup.status === 'rejected' || !setup.value) {
            await log(setup.status === 'rejected' ? `Voice setup failed: ${setup.reason?.message}` : 'No voice channel found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: setup.status === 'rejected' ? setup.reason?.message : 'Cant find a voice channel', type: { primary: "error", alt: "unknown_voice" } })}}`);
            return;
        }

        const { gp: guildPlayer, isNewGP: isNewGuildPlayer } = setup.value;
        const tracks = searchResult.value.tracks;
        const isPlaylist = searchResult.value.loadType === 'playlist';

        const guildId = guildPlayer.guildId;
        let is247 = get247(token!, guildId);
        if (req247 !== undefined) {
            is247 = req247 === 'true';
            set247(token!, guildId, is247);
        }

        if (isPlaylist) {
            const playlistName = searchResult.value.playlist?.name || 'Unknown Playlist';
            const playlistUrl = searchResult.value.playlist?.uri || searchResult.value.playlist?.url || '';
            const playlistTracks = tracks.map((t: any) => ({ ...t.info }));

            tracks.forEach((t: any) => {
                t.playlist = { name: playlistName, url: playlistUrl, tracks: playlistTracks };
            });

            const filteredTracks = tracks.filter((t: any) => !t.info.isStream);
            if (filteredTracks.length === 0) {
                await log('No non-live tracks found in playlist');
                await s.write(`],"data":${JSON.stringify({ status: false, message: 'Playlist contains only live tracks, which are not allowed', type: { primary: "error", alt: "invalid_query" } })}}`);
                return;
            }

            await log(`Playlist resolved: "${playlistName}" (${filteredTracks.length} tracks, ${tracks.length - filteredTracks.length} live tracks removed)`);
            if (guildPlayer.get('autoplay')) {
                const autoplayIndex = guildPlayer.queue.tracks.findIndex(t => (t.requester as any)?.isAutoplay);
                if (autoplayIndex !== -1) {
                    await guildPlayer.queue.add(filteredTracks, autoplayIndex);
                } else {
                    await guildPlayer.queue.add(filteredTracks);
                }
            } else {
                await guildPlayer.queue.add(filteredTracks);
            }
            await log('Playlist added to queue');
        } else {
            const track = tracks[0];
            if (track.info.isStream) {
                await log(`Live track blocked: "${track.info.title}"`);
                await s.write(`],"data":${JSON.stringify({ status: false, message: 'Live tracks (streams) are not allowed', type: { primary: "error", alt: "invalid_query" } })}}`);
                return;
            }
            await log(`Track resolved: "${track.info.title}" by ${track.info.author}`);
            if (guildPlayer.get('autoplay')) {
                const autoplayIndex = guildPlayer.queue.tracks.findIndex(t => (t.requester as any)?.isAutoplay);
                if (autoplayIndex !== -1) {
                    await guildPlayer.queue.add(track, autoplayIndex);
                } else {
                    await guildPlayer.queue.add(track);
                }
            } else {
                await guildPlayer.queue.add(track);
            }
            await log('Track added to queue');
        }

        // ── Start Playback ────────────────────────────────────────────────

        if (!guildPlayer.playing && !guildPlayer.paused) {
            await log('Starting playback...');
            try {
                await Promise.race([
                    guildPlayer.play(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Play request timed out after 30s')), 30_000)
                    ),
                ]);
            } catch (err: any) {
                await log(`Play failed: ${err?.message || err}`);
                await s.write(`],"data":${JSON.stringify({ status: false, message: err?.message || 'Failed to play track', type: { primary: "error", alt: "critical" } })}}`);
                return;
            }
        }

        const queueTracks = guildPlayer.queue.tracks.slice(0, 3).map(t => formatTrack(t as any, client, guildPlayer));
        const totalQueueDuration = guildPlayer.queue.tracks.reduce((acc, track) => acc + (track.info.duration ?? 0), 0);
        const activeFilters = getActiveFilters(guildPlayer);

        await s.write(`],"data":${JSON.stringify({
            status: true,
            nodeId: guildPlayer.node?.id ?? null,
            data: {
                isNewPlayer: isNewGuildPlayer,
                client: guildPlayer?.options || null,
                track: formatTrack(tracks[0], client, guildPlayer),
                platform,
                is247,
                isPlaying: guildPlayer.playing,
                isPaused: guildPlayer.paused,
                filters: {
                    array: activeFilters.length > 0 ? activeFilters : [],
                    string: activeFilters.length > 0 ? activeFilters.join(', ') : '',
                },
                queue: {
                    size: guildPlayer.queue.tracks.length,
                    limit_size: 3,
                    tracks: queueTracks,
                    elapsedTime: {
                        label: formatDuration(totalQueueDuration),
                        value: String(totalQueueDuration),
                    }
                },
            },
            type: { primary: "final", alt: "success" }
        })}}`);
    });
});

export default app;