import { Hono } from 'hono';
const app = new Hono();

import {
    getOrCreatePlayer,
    resolveVoiceChannel,
    hasActivePlayer,
    set247,
    get247,
    createMusicStream,
} from '../../functions/musicPlayer.js';

app.get('/connect', async (c) => {
    const token = c.req.query('token');
    let voiceId = c.req.query('voiceId');
    const reqGuildId = c.req.query('guildId');
    const authorId = c.req.query('authorId');
    const isDeaf = c.req.query('isDeaf') !== 'false';
    const req247 = c.req.query('247');
    const force = c.req.query('force') === 'true';

    return createMusicStream(c, async (log, s) => {
        if (!token || (!voiceId && !authorId)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, voiceId (or authorId)' })}}`);
            return;
        }


        const isNew = !hasActivePlayer(token);
        await log(isNew ? 'Creating new discord.js client...' : 'Reusing existing discord.js client');

        const { client, player: manager } = await getOrCreatePlayer(token, log);
        await log(isNew ? 'Discord.js client ready' : 'Client retrieved');

        if (!voiceId && authorId && reqGuildId) {
            await log(`Looking for author's voice connection (${authorId}) in guild ${reqGuildId}...`);
            const guild = client.guilds.cache.get(reqGuildId as string);
            if (guild) {
                const voiceState = guild.voiceStates.cache.get(authorId as string);
                if (voiceState?.channel) {
                    voiceId = voiceState.channel.id;
                }
            }
        }

        if (!voiceId) {
            await log('No voice channel found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Please join a voice channel' })}}`);
            return;
        }

        const vId = voiceId as string;

        await log(`Resolving voice channel: ${vId}`);
        const channel = await resolveVoiceChannel(client, vId);
        await log(`Voice channel resolved: ${channel.name}`);

        const guildId = channel.guild.id;

        // ── Already connected check ───────────────────────────────────────
        const existingPlayer = manager.players.get(guildId);
        if (!force && existingPlayer && existingPlayer.voiceChannelId === vId && existingPlayer.connected) {
            await log('Already connected to this voice channel with an active player');
            await s.write(`],"data":${JSON.stringify({
                status: false,
                message: 'Already connected',
                data: { channelId: vId, guildId },
            })}}`);
            return;
        }

        // ── Create or Reuse Lavalink player ───────────────────────────────
        let guildPlayer = existingPlayer;
        const needsMove = !!guildPlayer && (force || guildPlayer.voiceChannelId !== vId);

        if (!guildPlayer) {
            await log('Creating new Lavalink player and joining voice channel...');
            guildPlayer = await manager.createPlayer({
                guildId,
                voiceChannelId: vId,
                selfDeaf: isDeaf,
                selfMute: false
            });
            await guildPlayer.connect();
        } else if (needsMove) {
            await log(force ? 'Force reconnecting...' : `Bot is currently in another channel: ${guildPlayer.voiceChannelId}. Moving to ${vId}...`);
            guildPlayer.voiceChannelId = vId;
            const shard = client.guilds.cache.get(guildId)?.shard;
            if (shard) {
                shard.send({
                    op: 4,
                    d: {
                        guild_id: guildId,
                        channel_id: vId,
                        self_mute: false,
                        self_deaf: isDeaf,
                    },
                });
            }
        } else if (!guildPlayer.connected) {
            await guildPlayer.connect();
        }

        let is247 = get247(token!, guildId);
        if (req247 !== undefined) {
            is247 = req247 === 'true';
            set247(token!, guildId, is247);
        }

        await log('Connected to voice channel');
        await log(`Self deaf: ${isDeaf}`);

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: {
                channelId: vId,
                guildId,
                selfDeaf: isDeaf,
                nodeId: guildPlayer.node?.id ?? null,
            },
        })}}`);
    });
});

export default app;