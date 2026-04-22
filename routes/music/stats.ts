import { Hono } from 'hono';
const app = new Hono();

import {
    getOrCreatePlayer,
    hasActivePlayer,
    createMusicStream,
} from '../../functions/musicPlayer.js';

app.get('/stats', async (c) => {
    return await createMusicStream(c, async (log, s) => {
        const token = c.req.query('token');

        if (!token) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        await log('Retrieving player stats...');
        const { player: manager, client } = await getOrCreatePlayer(token, log);

        const nodes = Array.from(manager.nodeManager.nodes.values()).map(node => {
            return {
                ...node.stats, ...node.info
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
                    ...client.user,
                    wsPing: client.ws.ping,
                    guildSize: client.guilds.cache.size,
                },
                lavalink: {
                    totalPlayers,
                    playingPlayers,
                    nodes: nodes
                }
            },
        })}}`);
    });
});

export default app;
