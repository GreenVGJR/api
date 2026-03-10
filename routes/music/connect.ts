import { Hono } from 'hono';
const app = new Hono();

import { getOrCreatePlayer, resolveVoiceChannel, hasActivePlayer, createMusicStream } from '../../functions/musicPlayer.js';

app.get('/connect', async (c) => {
    const token = c.req.query('token');
    const voiceId = c.req.query('voiceId');
    const isDeaf = c.req.query('isDeaf') !== 'false'; 

    return createMusicStream(c, async (log, s) => {
        if (!token || !voiceId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, voiceId' })}}`);
            return;
        }

        await log('Request accepted');

        const isNew = !hasActivePlayer(token);
        await log(isNew ? 'Creating new discord.js client...' : 'Reusing existing discord.js client');

        const { client, player } = await getOrCreatePlayer(token);
        await log(isNew ? 'Discord.js client ready' : 'Client retrieved');

        await log(`Resolving voice channel: ${voiceId}`);
        const channel = await resolveVoiceChannel(client, voiceId);
        await log(`Voice channel resolved: ${channel.name}`);

        const me = channel.guild.members.me;
        if (me?.voice.channelId === voiceId) {
            const existingQueue = player.nodes.get(channel.guild.id);
            if (existingQueue) {
                await log('Already connected to this voice channel with an active queue');
                await s.write(`],"data":${JSON.stringify({
                    status: true,
                    message: "Already connected",
                    data: { channelId: voiceId, guildId: channel.guild.id }
                })}}`);
                return;
            }
            await log('Already in voice channel, but no active queue found. Initializing queue...');
        } else if (me?.voice.channelId) {
            await log(`Bot is currently in another channel: ${me.voice.channelId}. Moving...`);
        }

        await log('Joining voice channel...');
        const connection = await player.voiceUtils.join(channel, {
            deaf: isDeaf,
        });
        await log('Connected to voice channel');

        player.nodes.create(channel.guild.id, {
            defaultFFmpegFilters: ["compressor"],
            selfDeaf: isDeaf,
            leaveOnEmpty: false,
            leaveOnEnd: true,
            leaveOnStop: true,
            disableFallbackStream: true,
            bufferingTimeout: 500,
            volume: 50
        });

        if (me) {
            me.voice.setDeaf(isDeaf).catch(() => {});
            setTimeout(() => {
                me.voice.setDeaf(isDeaf).catch(() => {});
            }, 1500);
        }
        await log(`Self deaf: ${isDeaf}`);
        await log('Ending logs response...');

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: connection.joinConfig
        })}}`);
    });
});

export default app;
