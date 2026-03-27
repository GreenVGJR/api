import { Hono } from 'hono';
const app = new Hono();

import {
    getOrCreatePlayer,
    hasActivePlayer,
    createMusicStream,
} from '../../functions/musicPlayer.js';

app.get('/stats', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted for node stats');
        const token = c.req.query('token');

        if (!token) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        await log('Retrieving player stats...');
        const { player: manager, client } = await getOrCreatePlayer(token, log);

        // Calculate node stats
        const nodes = Array.from(manager.nodeManager.nodes.values()).map(node => {
            return {
                id: node.id,
                status: node.connected ? 'connected' : 'disconnected',
                stats: node.stats || null,
            };
        });

        // Calculate global player statistics for this client instance
        const totalPlayers = manager.players.size;
        let playingPlayers = 0;
        manager.players.forEach(p => {
            if (p.playing) playingPlayers++;
        });

        await log('Stats retrieved successfully');

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: {
                botInfo: {
                    user: client.user?.tag,
                    id: client.user?.id,
                    wsPing: client.ws.ping,
                    guilds: client.guilds.cache.size,
                },
                lavalink: {
                    totalPlayers,
                    playingPlayers,
                    nodes,
                }
            },
        })}}`);
    });
});

export default app;
