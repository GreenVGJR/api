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
} from '../../functions/musicPlayer.js';
import { SCMusic, SPMusic, request, commonHeaders } from '../../functions/request.js';

app.get('/play', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');

        const token    = c.req.query('token');
        let query      = c.req.query('q');
        const platform = (c.req.query('platform') || 'spotify').toLowerCase();
        const voiceId  = c.req.query('voiceId');
        const reqGuildId = c.req.query('guildId');
        const authorId = c.req.query('authorId');
        const isDeaf   = c.req.query('isDeaf') !== 'false';
        const req247   = c.req.query('247');

        if (!token || !query) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, q' })}}`);
            return;
        }

        let queryStr = query as string;
        let forcedMetadata: any = null;
        const isUrl = queryStr.startsWith('http://') || queryStr.startsWith('https://');

        // ── Platform Search Resolution ────────────────────────────────────

        if (platform === 'soundcloud' && !isUrl) {
            // Use SCMusic to get rich metadata (thumbnail, exact title, author, url)
            // but let Lavalink resolve the actual stream via scsearch — avoids
            // raw-URL load failures on nodes without the SC plugin file server.
            await log(`Searching SoundCloud using custom engine: "${queryStr}"`);
            const scRes = await SCMusic(queryStr, undefined, 1);
            const scTracks = scRes?.data?.[0];
            if (scTracks && scTracks.length > 0) {
                const scTrack = scTracks[0];
                forcedMetadata = {
                    title: scTrack.title,
                    author: scTrack.user?.username || scTrack.publisher_metadata?.artist || 'Unknown',
                    thumbnail: scTrack.artwork_url?.replace('-large', '-original') || '',
                    durationMS: scTrack.duration || 0,
                    url: scTrack.permalink_url,
                };
                // scsearch query: plain title + author (no "audio" suffix)
                queryStr = `${forcedMetadata.title} ${forcedMetadata.author}`.trim();
                await log(`SoundCloud metadata found: "${forcedMetadata.title}" — will try scsearch, fallback ytsearch`);
            } else {
                await log(`No SoundCloud results found for "${queryStr}"`);
                await s.write(`],"error":${JSON.stringify({ message: `No results found for "${queryStr}" on SoundCloud` })}}`);
                return;
            }

        } else if (platform === 'spotify' && !isUrl) {
            await log(`Searching Spotify using custom engine: "${queryStr}"`);
            const spRes = await SPMusic(queryStr, undefined, 1);
            const tracksV1 = spRes?.data?.[0];
            const tracksV2 = spRes?.data?.[1]?.tracksV2?.items;

            if (Array.isArray(tracksV1) && tracksV1.length > 0 && !tracksV1[0].error) {
                const spTrack = tracksV1[0];
                forcedMetadata = {
                    title: spTrack.name,
                    author: spTrack.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
                    thumbnail: spTrack.album?.images?.[0]?.url || '',
                    durationMS: spTrack.duration_ms,
                    url: spTrack.external_urls?.spotify || `https://open.spotify.com/track/${spTrack.id}`,
                };
            } else if (Array.isArray(tracksV2) && tracksV2.length > 0) {
                const item = tracksV2[0].item?.data;
                if (item) {
                    forcedMetadata = {
                        title: item.name,
                        author: item.artists?.items?.map((a: any) => a.profile?.name).join(', ') || 'Unknown',
                        thumbnail: item.albumOfTrack?.coverArt?.sources?.[0]?.url || '',
                        durationMS: item.duration?.totalMilliseconds || 0,
                        url: `https://open.spotify.com/track/${item.id}`,
                    };
                }
            }

            if (forcedMetadata) {
                queryStr = `${forcedMetadata.title} ${forcedMetadata.author} audio`;
                await log(`Mapped to YouTube search: "${queryStr}"`);
            } else {
                await log(`No Spotify results found for "${queryStr}"`);
                await s.write(`],"error":${JSON.stringify({ message: `No results found for "${queryStr}" on Spotify` })}}`);
                return;
            }

        } else if (platform === 'applemusic' && !isUrl) {
            await log(`Searching Apple Music using custom engine: "${queryStr}"`);
            try {
                const amRes = await request(
                    `https://itunes.apple.com/search?media=music&limit=1&country=US&term=${encodeURIComponent(queryStr)}`,
                    { method: 'GET', headers: commonHeaders }
                );
                const parseAm: any = await amRes.body.json();
                const tracks = parseAm?.results;
                if (tracks && tracks.length > 0) {
                    const amTrack = tracks[0];
                    forcedMetadata = {
                        title: amTrack.trackName,
                        author: amTrack.artistName,
                        thumbnail: amTrack.artworkUrl100?.replace('100x100bb', '500x500bb') || '',
                        durationMS: amTrack.trackTimeMillis,
                        url: amTrack.trackViewUrl,
                    };
                    queryStr = `${forcedMetadata.title} ${forcedMetadata.author} audio`;
                    await log(`Mapped to YouTube search: "${queryStr}"`);
                } else {
                    await log(`No Apple Music results found for "${queryStr}"`);
                    await s.write(`],"error":${JSON.stringify({ message: `No results found for "${queryStr}" on Apple Music` })}}`);
                    return;
                }
            } catch (e) {
                await log(`Failed to search Apple Music: ${e}`);
                await s.write(`],"error":${JSON.stringify({ message: `Failed to search Apple Music for "${queryStr}"` })}}`);
                return;
            }
        }

        // ── Determine Search Source ───────────────────────────────────────

        let searchSource: string;
        if (queryStr.startsWith('http://') || queryStr.startsWith('https://')) {
            searchSource = 'url';
        } else if (forcedMetadata && platform === 'soundcloud') {
            searchSource = 'scsearch'; // try SC first, fallback handled at search time
        } else if (forcedMetadata) {
            searchSource = 'ytsearch'; // Spotify / Apple Music always via YouTube
        } else {
            searchSource = PLATFORM_SEARCH[platform] || 'ytsearch';
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
        } else {
            await log('Looking for existing voice connection...');
            for (const [, guild] of client.guilds.cache) {
                const me = guild.members.me;
                if (me?.voice.channel) {
                    channel = me.voice.channel;
                    break;
                }
            }
            if (!channel && authorId && reqGuildId) {
                await log(`Looking for author's voice connection (${authorId}) in guild ${reqGuildId}...`);
                const guild = client.guilds.cache.get(reqGuildId as string);
                if (guild) {
                    const voiceState = guild.voiceStates.cache.get(authorId as string);
                    if (voiceState?.channel) {
                        channel = voiceState.channel;
                    }
                }
            }
            if (channel) {
                await log(`Found target in voice channel: ${channel.name}`);
                checkVoicePermissions(channel, client.user!);
            } else {
                await log('No voice channel found');
                await s.write(`],"error":${JSON.stringify({ message: 'Please join a voice channel' })}}`);
                return;
            }
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
        if (!guildPlayer) {
            await log('Creating Lavalink player...');
            guildPlayer = await manager.createPlayer({
                guildId,
                voiceChannelId: channel.id,
                selfDeaf: isDeaf,
                selfMute: false,
                volume: 50,
            });
        }
        
        let is247 = get247(token!, guildId);
        if (req247 !== undefined) {
            is247 = req247 === 'true';
            set247(token!, guildId, is247);
        }

        if (!guildPlayer.connected) {
            await log('Connecting to voice channel...');
            await guildPlayer.connect();
            await log('Connected');
        }

        // ── Search ────────────────────────────────────────────────────────

        await log(`Searching: "${queryStr}" (source: ${searchSource})`);

        let searchResult: any;

        const doSearch = async (q: string, src: string) => {
            const res = await guildPlayer!.search(
                { query: q, source: (src === 'url' ? undefined : src) as any },
                requester
            );
            if (!res?.tracks?.length) throw new Error(`No results for "${q}"`);
            return res;
        };

        try {
            searchResult = await doSearch(queryStr, searchSource);
        } catch (firstErr: any) {
            // SoundCloud: scsearch failed → retry with ytsearch
            if (platform === 'soundcloud' && forcedMetadata && searchSource === 'scsearch') {
                const ytQuery = `${forcedMetadata.title} ${forcedMetadata.author} audio`;
                await log(`scsearch failed (${firstErr?.message}) — retrying with ytsearch: "${ytQuery}"`);
                try {
                    searchResult = await doSearch(ytQuery, 'ytsearch');
                } catch (secondErr: any) {
                    await log(`ytsearch fallback also failed: ${secondErr?.message}`);
                    await s.write(`],"error":${JSON.stringify({ message: secondErr?.message || 'Search failed' })}}`);
                    return;
                }
            } else {
                await log(`Search failed: ${firstErr?.message || firstErr}`);
                await s.write(`],"error":${JSON.stringify({ message: firstErr?.message || 'Search failed' })}}`);
                return;
            }
        }

        const isPlaylist = searchResult.loadType === 'playlist';
        const tracks = searchResult.tracks;

        // ── Override Metadata (Spotify / Apple Music) ─────────────────────
        // (Only for single tracks, usually playlists don't use forcedMetadata here
        // as the search result itself carries the rich info from the URL)
        if (forcedMetadata && !isPlaylist) {
            const track = tracks[0];
            track.info.title     = forcedMetadata.title;
            track.info.author    = forcedMetadata.author;
            track.info.artworkUrl = forcedMetadata.thumbnail;
            track.info.uri       = forcedMetadata.url;
            if (forcedMetadata.durationMS) track.info.duration = forcedMetadata.durationMS;
            await log(`Metadata overridden: "${forcedMetadata.title}" by ${forcedMetadata.author}`);
        }

        if (isPlaylist) {
            const playlistName = searchResult.playlist?.name || 'Unknown Playlist';
            const playlistUrl = searchResult.playlist?.uri || searchResult.playlist?.url || '';
            const playlistTracks = tracks.map((t: any) => ({
                title: t.info.title,
                author: t.info.author,
                url: t.info.uri,
            }));

            tracks.forEach((t: any) => {
                t.playlist = {
                    name: playlistName,
                    url: playlistUrl,
                    tracks: playlistTracks,
                };
            });

            await log(`Playlist resolved: "${playlistName}" (${tracks.length} tracks)`);
            await guildPlayer.queue.add(tracks);
            await log('Playlist added to queue');
        } else {
            const track = tracks[0];
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
                        setTimeout(() => reject(new Error('Play request timed out')), 15_000)
                    ),
                ]);
            } catch (err: any) {
                await log(`Play failed: ${err?.message || err}`);
                await s.write(`],"error":${JSON.stringify({ message: err?.message || 'Failed to play track' })}}`);
                return;
            }
        }

        await log('Successfully playing');
        await log('Ending logs response...');

        const queueTracks = guildPlayer.queue.tracks.slice(0, 20).map(t => formatTrack(t as any));

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: {
                track: formatTrack(tracks[0]),
                platform,
                is247,
                isPlaying: guildPlayer.playing,
                isPaused: guildPlayer.paused,
                queue: {
                    size: guildPlayer.queue.tracks.length,
                    tracks: queueTracks,
                    currentTrack: guildPlayer.queue.current ? formatTrack(guildPlayer.queue.current) : null,
                },
            },
        })}}`);
    });
});

export default app;