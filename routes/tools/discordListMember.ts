import { Hono } from 'hono';
const app = new Hono();

import { DiscordListMember } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

app.get('/discord/listMember', async (c) => {
    let token: string | null = null;
    try {
        const queryToken = c.req.query('token');
        if (queryToken) {
            const checktoken = Number.isInteger(parseInt(atob(queryToken.split('.')[0])));
            if(!checktoken) throw new Error();
            token = queryToken;
        }
    }
    catch {}

    const queryGuildId = c.req.query('guildId');
    const guildId = (queryGuildId && Number.isInteger(parseInt(queryGuildId))) ? queryGuildId : null;

    const queryLimit = c.req.query('limit');
    const limit = (queryLimit && Number.isInteger(parseInt(queryLimit))) ? parseInt(queryLimit) : 10;

    const validTypes = ['user', 'bot', 'all', 'oldest', 'newest', 'no_role', 'has_role'];
    const queryType = c.req.query('type') || 'all';
    const types = queryType.split(',').map(t => t.trim());
    const invalidTypes = types.filter(t => !validTypes.includes(t));
    if (invalidTypes.length > 0) {
        return c.json({ error: `List types: ${validTypes.join(', ')}` }, 202);
    }
    const type = queryType;

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordListMember(token!, guildId!, limit, type));
});

export default app;