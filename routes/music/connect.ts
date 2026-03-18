import { Hono } from 'hono';
const app = new Hono();

import {
    getOrCreatePlayer,
    resolveVoiceChannel,
    hasActivePlayer,
    set247,
    createMusicStream,
} from '../../functions/musicPlayer.js';

app.get('/connect', async (c) => {
    const token   = c.req.query('token');
    const voiceId = c.req.query('voiceId');
    const isDeaf  = c.req.query('isDeaf') !== 'false';
    const is247   = c.req.query('247') === 'true';

    return createMusicStream(c, async (log, s) => {
        if (!token || !voiceId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, voiceId' })}}`);
            return;
        }

        await log('Request accepted');

        const isNew = !hasActivePlayer(token);
        await log(isNew ? 'Creating new discord.js client...' : 'Reusing existing discord.js client');

        const { client, player: manager } = await getOrCreatePlayer(token);
        await log(isNew ? 'Discord.js client ready' : 'Client retrieved');

        await log(`Resolving voice channel: ${voiceId}`);
        const channel = await resolveVoiceChannel(client, voiceId);
        await log(`Voice channel resolved: ${channel.name}`);

        const guildId = channel.guild.id;

        // ── Already connected check ───────────────────────────────────────
        const existingPlayer = manager.players.get(guildId);
        if (existingPlayer?.voiceChannelId === voiceId && existingPlayer.connected) {
            await log('Already connected to this voice channel with an active player');
            await s.write(`],"data":${JSON.stringify({
                status: true,
                message: 'Already connected',
                data: { channelId: voiceId, guildId },
            })}}`);
            return;
        }

        if (existingPlayer?.voiceChannelId && existingPlayer.voiceChannelId !== voiceId) {
            await log(`Bot is currently in another channel: ${existingPlayer.voiceChannelId}. Moving...`);
            await existingPlayer.destroy().catch(() => { });
        }

        // ── Create & connect Lavalink player ──────────────────────────────
        await log('Creating Lavalink player and joining voice channel...');
        const guildPlayer = await manager.createPlayer({
            guildId,
            voiceChannelId: voiceId,
            selfDeaf: isDeaf,
            selfMute: false,
            volume: 50,
        });

        set247(token, guildId, is247);

        await guildPlayer.connect();
        await log('Connected to voice channel');
        await log(`Self deaf: ${isDeaf}`);
        await log('Ending logs response...');

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: {
                channelId: voiceId,
                guildId,
                selfDeaf: isDeaf,
                nodeId: guildPlayer.node?.id ?? null,
            },
        })}}`);
    });
});

export default app;