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
                const res   = await SCMusic(query, undefined, 1);
                const track = res?.data?.[0]?.[0];
                if (!track?.permalink_url) return null;
                return {
                    url:    track.permalink_url,
                    title:  track.title,
                    author: track.user?.username || track.publisher_metadata?.artist,
                };
            }
            case 'spotify': {
                const res   = await SPMusic(query, undefined, 1);
                const track = res?.data?.tracks?.[0];
                if (!track?.id) return null;
                return {
                    url:    `https://open.spotify.com/track/${track.id}`,
                    title:  track.name,
                    author: track.artists?.items?.map((a: any) => a.profile?.name).join(', '),
                };
            }
            case 'youtube': {
                const res   = await YTVideo(query, false);
                const track = res?.data?.[0];
                if (!track?.url) return null;
                return { url: track.url, title: track.title, author: track.author };
            }
            case 'youtubemusic': {
                const res   = await YTMusic(query, false);
                const track = res?.data?.[0];
                if (!track?.url) return null;
                return { url: track.url, title: track.title, author: track.author };
            }
            case 'applemusic': {
                const amRes  = await request(
                    `https://itunes.apple.com/search?media=music&limit=1&country=US&term=${encodeURIComponent(query)}`,
                    { method: 'GET', headers: commonHeaders }
                );
                const parsed: any = await amRes.json();
                const track = parsed?.results?.[0];
                if (!track) return null;
                return {
                    url:    track.trackViewUrl,
                    title:  track.trackName,
                    author: track.artistName,
                };
            }
            case 'deezer': {
                const res   = await Deezer(query);
                const track = res?.data?.[0];
                if (!track?.link) return null;
                return {
                    url:    track.link,
                    title:  track.title,
                    author: track.artist?.name,
                };
            }
            case 'tidal': {
                const res   = await Tidal(query);
                const track = res?.data?.[0];
                if (!track?.url) return null;
                return {
                    url:    track.url,
                    title:  track.title,
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
        await log('Request accepted');

        const token      = c.req.query('token');
        const query      = c.req.query('q');
        const platform   = (c.req.query('platform') || 'applemusic').toLowerCase();
        const voiceId    = c.req.query('voiceId');
        const reqGuildId = c.req.query('guildId');
        const authorId   = c.req.query('authorId');
        const isDeaf     = c.req.query('isDeaf') !== 'false';
        const req247     = c.req.query('247');

        if (!token || !query) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, q' })}}`);
            return;
        }

        const queryStr = query as string;
        const isUrl    = queryStr.startsWith('http://') || queryStr.startsWith('https://');

        // Verify platform if not a URL
        const supportedPlatforms = ['youtube', 'youtubemusic', 'soundcloud', 'spotify', 'applemusic', 'deezer', 'tidal'];
        if (!isUrl && !supportedPlatforms.includes(platform)) {
            await log(`Unsupported search platform: "${platform}"`);
            await s.write(`],"error":${JSON.stringify({ message: `Search engine "${platform}" is not supported.`, list: supportedPlatforms.join(', ') })}}`);
            return;
        }

        // ── Client Setup ──────────────────────────────────────────────────

        const isNew = !hasActivePlayer(token);
        await log(isNew ? 'Creating new discord.js client...' : 'Reusing existing discord.js client');

        const { client, player: manager } = await getOrCreatePlayer(token, log);
        await log(isNew ? 'Discord.js client ready' : 'Client retrieved');
        await log('Lavalink manager active');

        // ── Resolve Voice Channel ─────────────────────────────────────────

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

        if (!channel) {
            await log('No voice channel found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Cant find a voice channel' })}}`);
            return;
        }

        const guildId = channel.guild.id;

        // ── Requester ─────────────────────────────────────────────────────

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

        // ── Create / Retrieve Lavalink Player ─────────────────────────────

        let guildPlayer = manager.players.get(guildId);
        const isNewGuildPlayer = !guildPlayer || (
            !guildPlayer.playing &&
            !guildPlayer.paused &&
            guildPlayer.queue.tracks.length === 0 &&
            !guildPlayer.queue.current
        );
        if (!guildPlayer) {
            await log('Creating Lavalink player...');
            guildPlayer = await manager.createPlayer({
                guildId,
                voiceChannelId: channel.id,
                selfDeaf: isDeaf,
                selfMute: false
            });
        } else {
            guildPlayer.options.selfDeaf = isDeaf;
        }

        let is247 = get247(token!, guildId);
        if (req247 !== undefined) {
            is247 = req247 === 'true';
            set247(token!, guildId, is247);
        }

        if (!guildPlayer.connected) {
            guildPlayer.options.selfDeaf = isDeaf;
            await log('Connecting to voice channel...');
            await guildPlayer.connect();
            await log('Connected');
        }

        // ── Search ────────────────────────────────────────────────────────

        const doSearch = async (q: string, src: string) => {
            try {
                const res = await guildPlayer!.search(
                    { query: q, source: (src === 'url' ? undefined : src) as any },
                    requester
                );
                if (!res?.tracks?.length) throw new Error(`No results for "${q}"`);
                return res;
            } catch (err: any) {
                if (err?.message === 'Failed to parse JSON') {
                    throw new Error("sourceManager disabled or lavalink don't support");
                }
                throw err;
            }
        };

        let searchResult: any;

        if (isUrl) {
            // ── Direct URL ────────────────────────────────────────────────
            await log(`Loading URL directly: "${queryStr}"`);
            try {
                searchResult = await doSearch(queryStr, 'url');
            } catch (err: any) {
                await log(`URL load failed: ${err?.message}`);
                await s.write(`],"error":${JSON.stringify({ message: err?.message || 'Failed to load URL' })}}`);
                return;
            }
        } else {
            // ── Attempt 1: Custom search → direct URL ─────────────────────
            await log(`[Attempt 1] Custom ${platform} search: "${queryStr}"`);
            const customResult = await customSearch(platform, queryStr);

            if (customResult) {
                await log(`[Attempt 1] Got URL: "${customResult.url}" — loading via Lavalink`);
                try {
                    searchResult = await doSearch(customResult.url, 'url');
                    await log('[Attempt 1] Direct URL load succeeded');
                } catch (e: any) {
                    await log(`[Attempt 1] Direct URL load failed (${e?.message}) — falling back to Lavalink search`);
                }
            } else {
                await log(`[Attempt 1] No URL returned — falling back to Lavalink search`);
            }

            // ── Attempt 2: Lavalink named search ──────────────────────────
            // If custom search returned title+author (e.g. SCMusic found the track but the node
            // has no SC source manager), try ytmsearch with that metadata first before falling
            // back to the platform's own search prefix.
            if (!searchResult) {
                const hasMeta        = customResult?.title && customResult?.author;
                const ytQuery        = hasMeta ? `${customResult!.title} ${customResult!.author}` : null;
                const platformSearch = PLATFORM_SEARCH[platform] || 'ytmsearch';

                const attempts: Array<{ label: string; q: string; src: string }> = [];
                if (ytQuery) attempts.push({ label: 'ytmsearch (metadata)', q: ytQuery,  src: 'ytmsearch' });
                attempts.push(            { label: platformSearch,          q: queryStr, src: platformSearch });

                for (const attempt of attempts) {
                    await log(`[Attempt 2] Lavalink search: "${attempt.src}:${attempt.q}"`);
                    try {
                        searchResult = await doSearch(attempt.q, attempt.src);
                        await log(`[Attempt 2] Lavalink search succeeded (${attempt.label})`);
                        break;
                    } catch (err: any) {
                        await log(`[Attempt 2] "${attempt.label}" failed: ${err?.message}`);
                        if (attempt === attempts[attempts.length - 1]) {
                            await s.write(`],"error":${JSON.stringify({ message: err?.message || 'All search methods failed' })}}`);
                            return;
                        }
                    }
                }
            }
        }

        // ── Queue Tracks ──────────────────────────────────────────────────

        const isPlaylist = searchResult.loadType === 'playlist';
        const tracks     = searchResult.tracks;

        if (isPlaylist) {
            const playlistName   = searchResult.playlist?.name || 'Unknown Playlist';
            const playlistUrl    = searchResult.playlist?.uri || searchResult.playlist?.url || '';
            const playlistTracks = tracks.map((t: any) => ({ ...t.info }));

            tracks.forEach((t: any) => {
                t.playlist = { name: playlistName, url: playlistUrl, tracks: playlistTracks };
            });

            // Filter out live tracks from the playlist
            const filteredTracks = tracks.filter((t: any) => !t.info.isStream);
            if (filteredTracks.length === 0) {
                await log('No non-live tracks found in playlist');
                await s.write(`],"error":${JSON.stringify({ message: 'Playlist contains only live tracks, which are not allowed' })}}`);
                return;
            }

            await log(`Playlist resolved: "${playlistName}" (${filteredTracks.length} tracks, ${tracks.length - filteredTracks.length} live tracks removed)`);
            await guildPlayer.queue.add(filteredTracks);
            await log('Playlist added to queue');
        } else {
            const track = tracks[0];
            if (track.info.isStream) {
                await log(`Live track blocked: "${track.info.title}"`);
                await s.write(`],"error":${JSON.stringify({ message: 'Live tracks (streams) are not allowed' })}}`);
                return;
            }
            await log(`Track resolved: "${track.info.title}" by ${track.info.author}`);
            await guildPlayer.queue.add(track);
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

        const queueTracks        = guildPlayer.queue.tracks.slice(0, 3).map(t => formatTrack(t as any));
        const totalQueueDuration = guildPlayer.queue.tracks.reduce((acc, track) => acc + (track.info.duration ?? 0), 0);
        const activeFilters      = getActiveFilters(guildPlayer);

        await s.write(`],"data":${JSON.stringify({
            status: true,
            nodeId: guildPlayer.node?.id ?? null,
            data: {
                isNewPlayer: isNewGuildPlayer,
                track: formatTrack(tracks[0]),
                platform,
                is247,
                isPlaying: guildPlayer.playing,
                isPaused:  guildPlayer.paused,
                filters: {
                    array:  activeFilters.length > 0 ? activeFilters : [],
                    string: activeFilters.length > 0 ? activeFilters.join(', ') : '',
                },
                queue: {
                    size: guildPlayer.queue.tracks.length,
                    tracks: queueTracks,
                    elapsedTime: {
                        label: formatDuration(totalQueueDuration),
                        value: String(totalQueueDuration),
                    },
                    currentTrack: guildPlayer.queue.current ? formatTrack(guildPlayer.queue.current) : null,
                },
            },
        })}}`);
    });
});

export default app;