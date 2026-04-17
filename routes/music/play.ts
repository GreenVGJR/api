import { Hono } from 'hono';
const app = new Hono();

import {
    getOrCreatePlayer,
    resolveVoiceChannel,
    formatTrack,
    PLATFORM_SEARCH,
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
    url: string;
    // Title + author are used to build a ytsearch fallback when the URL itself
    // can't be loaded by Lavalink (e.g. no SC source manager on the node).
    title?: string;
    author?: string;
}

async function customSearch(platform: string, query: string): Promise<CustomSearchResult | null> {
    try {
        switch (platform) {
            case 'soundcloud': {
                const res = await SCMusic(query, undefined, 1);
                const track = res?.data?.[0]?.[0];
                if (!track?.permalink_url) return null;
                return {
                    url: track.permalink_url,
                    title: track.title,
                    author: track.user?.username || track.publisher_metadata?.artist,
                };
            }
            case 'spotify': {
                const res = await SPMusic(query, undefined, 1);
                const track = res?.data?.tracks?.[0];
                if (!track?.id) return null;
                return {
                    url: `https://open.spotify.com/track/${track.id}`,
                    title: track.name,
                    author: track.artists?.items?.map((a: any) => a.profile?.name).join(', '),
                };
            }
            case 'youtube': {
                const res = await YTVideo(query, false);
                const track = res?.data?.[0];
                if (!track?.url) return null;
                return { url: track.url, title: track.title, author: track.author };
            }
            case 'youtubemusic': {
                const res = await YTMusic(query, false);
                const track = res?.data?.[0];
                if (!track?.url) return null;
                return { url: track.url, title: track.title, author: track.author };
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
                    url: track.trackViewUrl,
                    title: track.trackName,
                    author: track.artistName,
                };
            }
            case 'deezer': {
                const res = await Deezer(query);
                const track = res?.data?.[0];
                if (!track?.link) return null;
                return {
                    url: track.link,
                    title: track.title,
                    author: track.artist?.name,
                };
            }
            case 'tidal': {
                const res = await Tidal(query);
                const track = res?.data?.[0];
                if (!track?.url) return null;
                return {
                    url: track.url,
                    title: track.title,
                    author: track.artist?.name || track.artists?.[0]?.name,
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
    return createMusicStream(c, async (log, s) => {

        const token = c.req.query('token');
        const query = c.req.query('q');
        const platform = (c.req.query('platform') || 'youtubemusic').toLowerCase();
        const voiceId = c.req.query('voiceId');
        const reqGuildId = c.req.query('guildId');
        const authorId = c.req.query('authorId');
        const isDeaf = c.req.query('isDeaf') !== 'false';
        const req247 = c.req.query('247');

        if (!token || !query) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, q' })}}`);
            return;
        }

        const queryStr = query as string;
        const isUrl = queryStr.startsWith('http://') || queryStr.startsWith('https://');

        // Verify platform if not a URL
        const supportedPlatforms = ['youtube', 'youtubemusic', 'soundcloud', 'spotify', 'applemusic', 'deezer', 'tidal'];
        if (!isUrl && !supportedPlatforms.includes(platform)) {
            await log(`Unsupported search platform: "${platform}"`);
            await s.write(`],"error":${JSON.stringify({ message: `Search engine "${platform}" is not supported.`, list: supportedPlatforms.join(', ') })}}`);
            return;
        }

        // ── Parallel Setup ──────────────────────────────────────────────────

        const isNew = !hasActivePlayer(token);
        await log(isNew ? 'Creating new discord.js client...' : 'Reusing existing discord.js client');

        // Start tasks
        const pCustom = !isUrl ? customSearch(platform, queryStr) : Promise.resolve(null);
        const { client, player: manager } = await getOrCreatePlayer(token, log);

        await log(isNew ? 'Discord.js client ready' : 'Client retrieved');
        await log('Lavalink manager active');

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
            } else {
                await log(`[Attempt 1] Custom ${platform} search: "${queryStr}"`);
                if (customResult) {
                    await log(`[Attempt 1] Got URL: "${customResult.url}" — loading via Lavalink`);
                    try {
                        result = await doSearch(customResult.url, 'url');
                        await log('[Attempt 1] Direct URL load succeeded');
                    } catch (e: any) {
                        await log(`[Attempt 1] Direct URL load failed (${e?.message}) — falling back to Lavalink search`);
                    }
                } else {
                    await log(`[Attempt 1] No URL returned — falling back to Lavalink search`);
                }

                if (!result) {
                    const hasMeta = customResult?.title && customResult?.author;
                    const ytQuery = hasMeta ? `${customResult!.title} ${customResult!.author}` : null;
                    const platformSearch = PLATFORM_SEARCH[platform] || 'ytmsearch';

                    const attempts: Array<{ label: string; q: string; src: string }> = [];
                    if (ytQuery) attempts.push({ label: 'ytmsearch (metadata)', q: ytQuery, src: 'ytmsearch' });
                    attempts.push({ label: platformSearch, q: queryStr, src: platformSearch });

                    for (const attempt of attempts) {
                        await log(`[Attempt 2] Lavalink search: "${attempt.src}:${attempt.q}"`);
                        try {
                            result = await doSearch(attempt.q, attempt.src);
                            await log(`[Attempt 2] Lavalink search succeeded (${attempt.label})`);
                            break;
                        } catch (err: any) {
                            await log(`[Attempt 2] "${attempt.label}" failed: ${err?.message}`);
                        }
                    }
                }
            }
            if (!result) throw new Error('All search methods failed');
            return result;
        })();

        // Join results
        const [searchResult, setup, _] = await Promise.allSettled([pSearch, pGP, pConnect]);

        if (searchResult.status === 'rejected') {
            await s.write(`],"error":${JSON.stringify({ message: searchResult.reason?.message || 'Search failed' })}}`);
            return;
        }

        if (setup.status === 'rejected' || !setup.value) {
            await log(setup.status === 'rejected' ? `Voice setup failed: ${setup.reason?.message}` : 'No voice channel found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: setup.status === 'rejected' ? setup.reason?.message : 'Cant find a voice channel' })}}`);
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
                await s.write(`],"error":${JSON.stringify({ message: 'Playlist contains only live tracks, which are not allowed' })}}`);
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
                await s.write(`],"error":${JSON.stringify({ message: 'Live tracks (streams) are not allowed' })}}`);
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
                await s.write(`],"error":${JSON.stringify({ message: err?.message || 'Failed to play track' })}}`);
                return;
            }
        }

        const queueTracks = guildPlayer.queue.tracks.slice(0, 3).map(t => formatTrack(t as any));
        const totalQueueDuration = guildPlayer.queue.tracks.reduce((acc, track) => acc + (track.info.duration ?? 0), 0);
        const activeFilters = getActiveFilters(guildPlayer);

        await s.write(`],"data":${JSON.stringify({
            status: true,
            nodeId: guildPlayer.node?.id ?? null,
            data: {
                isNewPlayer: isNewGuildPlayer,
                track: formatTrack(tracks[0]),
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
                    tracks: queueTracks,
                    elapsedTime: {
                        label: formatDuration(totalQueueDuration),
                        value: String(totalQueueDuration),
                    }
                },
            },
        })}}`);
    });
});

export default app;