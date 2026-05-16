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
import { SCMusic, SPMusic, YTMusic, YTVideo, Deezer, Tidal, infoYoutube, infoSpotify, infoITunes, infoSoundcloud, infoSoundcloudStream, request, commonHeaders } from '../../functions/request.js';
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

function normalizeUrl(url: string): string {
    if (!url) return url;
    if (url.startsWith('http://www.tidal.com')) {
        return url.replace('http://', 'https://');
    }
    return url;
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

async function getUrlMetadata(url: string): Promise<CustomSearchResult | null> {
    try {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const info: any = await infoYoutube(url, false);
            if (info?.data?.title) {
                return {
                    url,
                    title: info.data.title,
                    author: info.data.owners?.name,
                    thumbnail: info.data.thumbnail,
                    sourceName: 'youtubemusic'
                };
            }
        }

        if (url.includes('spotify.com')) {
            const info: any = await infoSpotify(url);
            if (info?.data?.name) {
                return {
                    url,
                    title: info.data.name,
                    author: info.data.artists?.[0]?.name,
                    thumbnail: info.data.album?.images?.[0]?.url,
                    sourceName: 'spotify'
                };
            }
        }

        if (url.includes('music.apple.com')) {
            const info: any = await infoITunes(url);
            if (info?.data?.target?.attributes) {
                return {
                    url,
                    title: info.data.target.attributes.name,
                    author: info.data.target.attributes.artistName,
                    sourceName: 'applemusic'
                };
            }
        }

        if (url.includes('soundcloud.com')) {
            const info: any = await infoSoundcloud(url);
            const track = info?.data?.[0];
            if (track?.title) {
                return {
                    url,
                    title: track.title,
                    author: track.user?.username,
                    thumbnail: track.artwork_url,
                    sourceName: 'soundcloud'
                };
            }
        }

        // Fallback to oEmbed for others
        let endpoint = '';
        if (url.includes('soundcloud.com')) {
            endpoint = `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        } else if (url.includes('spotify.com')) {
            endpoint = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
        }

        if (endpoint) {
            const res = await request(endpoint, { headers: commonHeaders });
            const data: any = await res.json().catch(() => null);
            if (data && data.title) {
                return {
                    url,
                    title: data.title,
                    author: data.author_name,
                    thumbnail: data.thumbnail_url,
                    sourceName: getPlatformFromUrl(url) || undefined
                };
            }
        }

        return null;
    } catch {
        return null;
    }
}

async function customSearch(platform: string, query: string): Promise<CustomSearchResult | null> {
    try {
        const isUrl = query.startsWith('http://') || query.startsWith('https://');

        if (isUrl) {
            const metadata = await getUrlMetadata(query);
            if (metadata) return metadata;
        }
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
                    url: track.url.startsWith('http://') ? track.url.replace('http://', 'https://') : track.url,
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
        const platform = (c.req.query('platform') || 'spotify').toLowerCase().replace(/\s+/g, '');
        const voiceId = c.req.query('voiceId');
        const reqGuildId = c.req.query('guildId');
        const authorId = c.req.query('authorId');
        const isDeaf = c.req.query('isDeaf') !== 'false';
        const req247 = c.req.query('247');
        const allowFallback = c.req.query('fallback') !== 'false';

        if (!token || !query || (!voiceId && (!reqGuildId || !authorId))) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, q, and either voiceId OR (guildId and authorId)', type: { primary: "error", alt: "invalid_query" } })}}`);
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
                let fetched = client.users.cache.get(authorId as string);
                if (!fetched) {
                    fetched = await client.users.fetch(authorId as string).catch(() => undefined);
                }
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
                let guild = client.guilds.cache.get(reqGuildId as string);
                if (!guild) {
                    guild = await client.guilds.fetch(reqGuildId as string).catch(() => undefined);
                }
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
                const normalizedQ = normalizeUrl(q);
                const res = await gp.search(
                    { query: normalizedQ, source: (src === 'url' ? undefined : src) as any },
                    requester
                );
                if (!res?.tracks?.length) throw new Error(`No results for "${normalizedQ}"`);
                return res;
            };

            let result: any = null;
            if (isUrl) {
                await log(`Loading URL directly: "${queryStr}"`);
                try {
                    result = await doSearch(queryStr, 'url');
                    applyOverlay(result, customResult);
                } catch (e: any) {
                    // SoundCloud manual stream resolution fallback
                    if (effectivePlatform === 'soundcloud') {
                        await log(`[Attempt 1] SoundCloud direct load failed — attempting manual stream resolution`);
                        const scStream = await infoSoundcloudStream(queryStr);
                        if (scStream) {
                            await log(`[Attempt 2] Manual stream resolved — loading via Lavalink`);
                            try {
                                result = await doSearch(scStream, 'url');
                                applyOverlay(result, customResult);
                                await log(`[Attempt 2] "SoundCloud Manual" succeeded`);
                            } catch (err2) {
                                await log(`[Attempt 2] "SoundCloud Manual" failed to load stream: ${err2}`);
                            }
                        }
                    }
                    if (!result) await log(`[Attempt 1] Direct URL load failed (${e?.message})${allowFallback ? ' — falling back to search' : ' — fallback disabled'}`);
                }
            }

            if (isUrl && !result && allowFallback) {
                // URL failed — run the same fallback chain as plain-string mode.
                // We MUST have metadata (title) to search on other platforms.
                const metaQuery = customResult?.title ? (customResult.author ? `${customResult.title} ${customResult.author}` : customResult.title) : null;

                if (!metaQuery) {
                    await log(`[Attempt 1] Could not extract track title from URL — skipping fallback search`);
                    throw new Error(`Direct load failed and no metadata found for "${queryStr}"`);
                }

                await log(`[Attempt 1] Extracted metadata: "${metaQuery}" — starting fallback search`);
                const urlFallbackQuery = metaQuery;
                const urlFallbacks: Array<{ label: string; searchPlatform: string; query: string }> = [];

                if (effectivePlatform !== 'youtubemusic') {
                    urlFallbacks.push({ label: 'YouTube Music', searchPlatform: 'youtubemusic', query: urlFallbackQuery });
                }
                if (effectivePlatform !== 'spotify') {
                    urlFallbacks.push({ label: 'Spotify', searchPlatform: 'spotify', query: urlFallbackQuery });
                }
                if (effectivePlatform !== 'applemusic') {
                    urlFallbacks.push({ label: 'Apple Music', searchPlatform: 'applemusic', query: urlFallbackQuery });
                }
                if (effectivePlatform !== 'soundcloud') {
                    urlFallbacks.push({ label: 'SoundCloud', searchPlatform: 'soundcloud', query: urlFallbackQuery });
                }
                if (effectivePlatform !== 'deezer') {
                    urlFallbacks.push({ label: 'Deezer', searchPlatform: 'deezer', query: urlFallbackQuery });
                }
                if (effectivePlatform !== 'tidal') {
                    urlFallbacks.push({ label: 'Tidal', searchPlatform: 'tidal', query: urlFallbackQuery });
                }

                let currentAttempt = 2;
                for (const attempt of urlFallbacks) {
                    await log(`[Attempt ${currentAttempt}] Custom ${attempt.label} search: "${attempt.query}"`);
                    try {
                        const fallbackResult = await customSearch(attempt.searchPlatform, attempt.query);
                        if (!fallbackResult?.url) {
                            await log(`[Attempt ${currentAttempt}] "${attempt.label}" returned no results`);
                            currentAttempt++;
                            continue;
                        }
                        await log(`[Attempt ${currentAttempt}] Got URL: "${fallbackResult.url}" — loading via Lavalink`);
                        try {
                            result = await doSearch(fallbackResult.url, 'url');
                            applyOverlay(result, customResult ?? fallbackResult);
                            await log(`[Attempt ${currentAttempt}] "${attempt.label}" succeeded`);
                            break;
                        } catch (err: any) {
                            // SoundCloud manual stream resolution fallback in loop
                            if (attempt.searchPlatform === 'soundcloud' && fallbackResult.url) {
                                await log(`[Attempt ${currentAttempt}] SoundCloud direct load failed — attempting manual stream resolution`);
                                const scStream = await infoSoundcloudStream(fallbackResult.url);
                                if (scStream) {
                                    await log(`[Attempt ${currentAttempt}.1] Manual stream resolved — loading via Lavalink`);
                                    try {
                                        result = await doSearch(scStream, 'url');
                                        applyOverlay(result, customResult ?? fallbackResult);
                                        await log(`[Attempt ${currentAttempt}.1] "SoundCloud Manual" succeeded`);
                                        break;
                                    } catch (err2) {
                                        await log(`[Attempt ${currentAttempt}.1] "SoundCloud Manual" failed: ${err2}`);
                                    }
                                }
                            }
                            throw err; // Re-throw if not SC or SC manual also failed
                        }
                    } catch (err: any) {
                        await log(`[Attempt ${currentAttempt}] "${attempt.label}" failed: ${err?.message}`);
                    }
                    currentAttempt++;
                }
            } else if (!isUrl) {
                await log(`[Attempt 1] Custom ${platform} search: "${queryStr}"`);
                if (customResult) {
                    await log(`[Attempt 1] Got URL: "${customResult.url}" — loading via Lavalink`);
                    try {
                        result = await doSearch(customResult.url, 'url');
                        applyOverlay(result, customResult);
                        await log('[Attempt 1] Direct URL load succeeded');
                    } catch (e: any) {
                        // SoundCloud manual stream resolution fallback for non-URL search (Attempt 1)
                        if (platform === 'soundcloud' && customResult?.url) {
                            await log(`[Attempt 1] SoundCloud direct load failed — attempting manual stream resolution`);
                            const scStream = await infoSoundcloudStream(customResult.url);
                            if (scStream) {
                                await log(`[Attempt 1.1] Manual stream resolved — loading via Lavalink`);
                                try {
                                    result = await doSearch(scStream, 'url');
                                    applyOverlay(result, customResult);
                                    await log(`[Attempt 1.1] "SoundCloud Manual" succeeded`);
                                } catch (err2) {
                                    await log(`[Attempt 1.1] "SoundCloud Manual" failed to load stream: ${err2}`);
                                }
                            }
                        }
                        if (!result) await log(`[Attempt 1] Direct URL load failed (${e?.message})${allowFallback ? ' — falling back to Lavalink search' : ' — fallback disabled'}`);
                    }
                } else {
                    await log(`[Attempt 1] No URL returned${allowFallback ? ' — falling back to Lavalink search' : ' — fallback disabled'}`);
                }

                if (!result && allowFallback) {
                    const hasMeta = customResult?.title && customResult?.author;
                    const metaQuery = hasMeta ? `${customResult!.title} ${customResult!.author}` : null;

                    // Build fallback attempts
                    const fallbacks: Array<{ label: string; searchPlatform: string; query: string }> = [];

                    if (metaQuery) {
                        fallbacks.push({ label: 'YouTube Music (metadata)', searchPlatform: 'youtubemusic', query: metaQuery });
                    }
                    if (!metaQuery && platform !== 'youtubemusic') {
                        fallbacks.push({ label: 'YouTube Music', searchPlatform: 'youtubemusic', query: queryStr });
                    }
                    if (platform !== 'spotify') fallbacks.push({ label: 'Spotify', searchPlatform: 'spotify', query: queryStr });
                    if (platform !== 'applemusic') fallbacks.push({ label: 'Apple Music', searchPlatform: 'applemusic', query: queryStr });
                    if (platform !== 'soundcloud') fallbacks.push({ label: 'SoundCloud', searchPlatform: 'soundcloud', query: queryStr });
                    if (platform !== 'deezer') fallbacks.push({ label: 'Deezer', searchPlatform: 'deezer', query: queryStr });
                    if (platform !== 'tidal') fallbacks.push({ label: 'Tidal', searchPlatform: 'tidal', query: queryStr });

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
                            try {
                                result = await doSearch(fallbackResult.url, 'url');
                                applyOverlay(result, customResult ?? fallbackResult);
                                await log(`[Attempt ${currentAttempt}] "${attempt.label}" succeeded`);
                                break;
                            } catch (err: any) {
                                // SoundCloud manual stream resolution fallback in loop
                                if (attempt.searchPlatform === 'soundcloud' && fallbackResult.url) {
                                    await log(`[Attempt ${currentAttempt}] SoundCloud direct load failed — attempting manual stream resolution`);
                                    const scStream = await infoSoundcloudStream(fallbackResult.url);
                                    if (scStream) {
                                        await log(`[Attempt ${currentAttempt}.1] Manual stream resolved — loading via Lavalink`);
                                        try {
                                            result = await doSearch(scStream, 'url');
                                            applyOverlay(result, customResult ?? fallbackResult);
                                            await log(`[Attempt ${currentAttempt}.1] "SoundCloud Manual" succeeded`);
                                            break;
                                        } catch (err2) {
                                            await log(`[Attempt ${currentAttempt}.1] "SoundCloud Manual" failed: ${err2}`);
                                        }
                                    }
                                }
                                throw err;
                            }
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