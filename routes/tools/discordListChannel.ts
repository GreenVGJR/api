import { Hono } from 'hono';
const app = new Hono();

import { DiscordListChannel } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

app.get('/discord/listChannel', async (c) => {
    let token: string | null = null;
    try {
        const queryToken = c.req.query('token');
        if (queryToken) {
            const checktoken = Number.isInteger(parseInt(atob(queryToken.split('.')[0])));
            if(!checktoken) throw new Error();
            token = queryToken;
        }
    }
    catch {
        return c.json({ data: "Invalid token format", status: false }, 202);
    }

    const queryGuildId = c.req.query('guildId');
    const guildId = (queryGuildId && Number.isInteger(parseInt(queryGuildId))) ? queryGuildId : null;

    const queryLimit = c.req.query('limit');
    const limit = (queryLimit && Number.isInteger(parseInt(queryLimit))) ? parseInt(queryLimit) : -1;

    const validTypes = ['text', 'voice', 'category', 'announcement', 'announcement_thread', 'public_thread', 'private_thread', 'stage', 'directory', 'forum', 'media', 'threads', 'all'];
    const queryType = c.req.query('type') || 'all';
    const types = queryType.split(',').map(t => t.trim());
    const invalidTypes = types.filter(t => !validTypes.includes(t));
    if (invalidTypes.length > 0) {
        return c.json({ data: `List types: ${validTypes.join(', ')}`, status: false }, 202);
    }
    const type = queryType;
    
    if (!token) return c.json({ data: "Missing valid parameter: token", status: false }, 202);
    if (!guildId) return c.json({ data: "Missing valid parameter: guildId", status: false }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordListChannel(token!, guildId!, limit, type));
});

export default app;
