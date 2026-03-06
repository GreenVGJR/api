import { Hono } from 'hono';
const app = new Hono();

import { getOrCreatePlayer, resolveVoiceChannel, formatTrack, PLATFORM_MAP, QueryType, hasActivePlayer, createMusicStream } from '../../functions/musicPlayer.js';
import { SCMusic, SPMusic, request, commonHeaders } from '../../functions/request.js';

app.get('/play', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token = c.req.query('token');
        let query = c.req.query('q');
        const platform = (c.req.query('platform') || 'soundcloud').toLowerCase();
        const voiceId = c.req.query('voiceId');
        const authorId = c.req.query('authorId');
        const isDeaf = c.req.query('isDeaf') !== 'false'; 

        if (!token || !query) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, q' })}}`);
            return;
        }


        let queryStr = query as string;

        let forcedMetadata: any = null;
        const isUrl = queryStr.startsWith('http://') || queryStr.startsWith('https://');


        if (platform === 'soundcloud' && !isUrl) {
            await log(`Searching SoundCloud using custom engine: "${queryStr}"`);
            const scRes = await SCMusic(queryStr, undefined, 1);
            const tracks = scRes?.data?.[0]; 
            if (tracks && tracks.length > 0) {
                queryStr = tracks[0].permalink_url;
                await log(`SoundCloud track found: ${queryStr}`);
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
                    url: spTrack.external_urls?.spotify || `https://open.spotify.com/track/${spTrack.id}`
                };
            } else if (Array.isArray(tracksV2) && tracksV2.length > 0) {
                const item = tracksV2[0].item?.data;
                if (item) {
                     forcedMetadata = {
                         title: item.name,
                         author: item.artists?.items?.map((a: any) => a.profile?.name).join(', ') || 'Unknown',
                         thumbnail: item.albumOfTrack?.coverArt?.sources?.[0]?.url || '',
                         durationMS: item.duration?.totalMilliseconds || 0,
                         url: `https://open.spotify.com/track/${item.id}`
                     };
                }
            }

            if (forcedMetadata) {
                queryStr = `${forcedMetadata.title} ${forcedMetadata.author} audio`;
                await log(`Mapped to YouTube search: "${queryStr}"`);
            } else {
                await log(`No Spotify results found for "${queryStr}" (V1: ${tracksV1?.error || 'Empty'}, V2: ${tracksV2 ? 'Empty' : 'Error'})`);
                await s.write(`],"error":${JSON.stringify({ message: `No results found for "${queryStr}" on Spotify` })}}`);
                return;
            }
        } else if (platform === 'applemusic' && !isUrl) {
            await log(`Searching Apple Music using custom engine: "${queryStr}"`);
            try {
                const amRes = await request(`https://itunes.apple.com/search?media=music&limit=1&country=US&term=${encodeURIComponent(queryStr)}`, {
                    method: 'GET',
                    headers: commonHeaders
                });
                const parseAm: any = await amRes.body.json();
                const tracks = parseAm?.results;
                if (tracks && tracks.length > 0) {
                    const amTrack = tracks[0];
                    forcedMetadata = {
                         title: amTrack.trackName,
                         author: amTrack.artistName,
                         thumbnail: amTrack.artworkUrl100?.replace('100x100bb', '500x500bb') || '',
                         durationMS: amTrack.trackTimeMillis,
                         url: amTrack.trackViewUrl
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

        let searchEngine: string;

        if (queryStr.startsWith('http://') || queryStr.startsWith('https://')) {
            searchEngine = QueryType.AUTO;
        } else if (forcedMetadata) {
            searchEngine = QueryType.YOUTUBE_SEARCH;
        } else {
            searchEngine = PLATFORM_MAP[platform] || QueryType.AUTO;
        }

        const isNew = !hasActivePlayer(token);
        await log(isNew ? 'Creating new discord.js client...' : 'Reusing existing discord.js client');

        const { client, player } = await getOrCreatePlayer(token);
        await log(isNew ? 'Discord.js client ready' : 'Client retrieved');
        await log('discord-player active');


        let channel: any = null;
        if (voiceId) {
            await log(`Resolving voice channel: ${voiceId}`);
            channel = await resolveVoiceChannel(client, voiceId);
            await log('Voice channel resolved');
        } else {
            await log('Looking for existing voice connection...');
            const guilds = client.guilds.cache;
            for (const [guildId, guild] of guilds) {
                const me = guild.members.me;
                if (me?.voice.channel) {
                    channel = me.voice.channel;
                    break;
                }
            }
            if (channel) {
                await log(`Found bot in voice channel: ${channel.name}`);
            } else {
                await log('No voice channel found');
                await s.write(`],"error":${JSON.stringify({ message: "Please join to voice channel" })}}`);
                return;
            }
        }


        let requestedBy: any = undefined;
        if (authorId) {
            await log(`Fetching user: ${authorId}`);
            requestedBy = await client.users.fetch(authorId).catch(() => undefined);
            await log(requestedBy ? `User found: ${requestedBy.tag}` : 'User not found, continuing...');
        }

        let trackToPlay: any = queryStr;
        if (forcedMetadata) {
            await log(`Searching YouTube for stream source: "${queryStr}"`);
            const searchResult = await player.search(queryStr, {
                searchEngine: searchEngine as any,
                requestedBy: requestedBy
            });
            if (!searchResult.hasTracks()) {
                await log(`No YouTube stream found for "${queryStr}"`);
                await s.write(`],"error":${JSON.stringify({ message: `No stream source found for "${queryStr}"` })}}`);
                return;
            }
            const track = searchResult.tracks[0];
            track.title = forcedMetadata.title;
            track.author = forcedMetadata.author;
            track.thumbnail = forcedMetadata.thumbnail;
            (track as any).originalUrl = forcedMetadata.url;
            trackToPlay = track;
        }

        await log(`Searching track/playing: "${typeof trackToPlay === 'string' ? trackToPlay : trackToPlay.title}" (engine: ${searchEngine})`);

        let result: any;
        try {
            result = await Promise.race([
                player.play(channel, trackToPlay, {
                    searchEngine: searchEngine as any,
                    requestedBy: requestedBy,
                    nodeOptions: {
                        defaultFFmpegFilters: ["compressor"],
                        selfDeaf: isDeaf,
                        leaveOnEmpty: false,
                        leaveOnEnd: true,
                        leaveOnStop: true,
                        disableFallbackStream: true,
                        bufferingTimeout: 500,
                        volume: 50
                    },
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Play request timed out (stream extraction may have failed)')), 10000))
            ]);
        } catch (err: any) {
            const queue = player.nodes.get(channel.guild.id);
            if (queue) queue.tasksQueue.clear(true);

                        await log(`Play failed: ${err?.message || err}`);
            await s.write(`],"error":${JSON.stringify({ message: err?.message || 'Failed to play track' })}}`);
            return;
        }

        await log(`Track found: "${result.track.title}" by ${result.track.author}`);

        const track = result.track;
        const queue = player.nodes.get(channel.guild.id);


        const me = channel.guild.members.me;
        if (me) {
            me.voice.setDeaf(isDeaf).catch(() => {});
        }

        await log('Successfully playing');
        await log('Ending logs response...');

        const data = {
            status: true,
            data: {
                track: formatTrack(track),
                platform,
                isPlaying: queue?.node.isPlaying() || false,
                isPaused: queue?.node.isPaused() || false,
                queue: queue ? {
                    size: queue.tracks.size,
                    tracks: queue.tracks.toArray().slice(0, 20).map(formatTrack),
                    currentTrack: queue.currentTrack ? formatTrack(queue.currentTrack) : null,
                } : null,
            }
        };

        await s.write(`],"data":${JSON.stringify(data)}}`);
    });
});

export default app;
