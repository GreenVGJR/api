import { Hono } from 'hono';
const app = new Hono();

import { getOrCreatePlayer, destroyPlayer, hasActivePlayer, createMusicStream } from '../../functions/musicPlayer.js';

app.get('/disconnect', async (c) => {
    const token = c.req.query('token');
    const guildId = c.req.query('guildId');

    return createMusicStream(c, async (log, s) => {
        if (!token) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required param: token' })}}`);
            return;
        }

        await log('Request accepted');

        if (!hasActivePlayer(token)) {
            await log('No active player found for this token');
            await s.write(`],"error":${JSON.stringify({ message: 'No active player found' })}}`);
            return;
        }

        const { client, player } = await getOrCreatePlayer(token);


        if (guildId) {
            await log(`Disconnecting from guild: ${guildId}`);
            const queue = player.nodes.get(guildId);
            if (queue) {
                queue.delete();
                await log('Queue destroyed');
            }

            const guild = client.guilds.cache.get(guildId);
            const me = guild?.members.me;
            if (me?.voice.channel) {
                await log(`Leaving voice channel: ${me.voice.channel.name}`);
                me.voice.disconnect();
                await log('Disconnected from voice channel');
            } else {
                await log('Bot was not in a voice channel in this guild');
            }


            let hasActiveNodes = false;
            for (const [id, node] of player.nodes.cache) {
                if (id === guildId) continue;
                if (node.isPlaying() || node.tracks.size > 0) {
                    hasActiveNodes = true;
                    break;
                }
            }

            let killed = false;
            if (!hasActiveNodes) {
                await log('No other active servers, destroying discord.js client...');
                await destroyPlayer(token);
                killed = true;
                await log('Discord.js client destroyed');
            }

            await log('Ending logs response...');
            await s.write(`],"data":${JSON.stringify({
                status: true,
                data: { action: 'disconnected', guildId, context_destroyed: killed }
            })}}`);
        } else {

            await log('No guildId specified, destroying entire player...');
            await destroyPlayer(token);
            await log('Discord.js client and player destroyed');
            await log('Ending logs response...');

            await s.write(`],"data":${JSON.stringify({
                status: true,
                data: { action: 'disconnected', context_destroyed: true }
            })}}`);
        }
    });
});

export default app;
