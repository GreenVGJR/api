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

    const queryType = c.req.query('type') as any;
    const type = ['user', 'bot', 'all'].includes(queryType) ? queryType : 'all';

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordListMember(token!, guildId!, limit, type));
});

export default app;