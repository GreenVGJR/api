import { Hono } from 'hono';
const app = new Hono();

import { DiscordInfoInvite } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

app.get('/discord/infoInvite', async (c) => {
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

    const q = c.req.query('q') || '';
    const queryGuildId = c.req.query('guildId');
    const guildId = (queryGuildId && Number.isInteger(parseInt(queryGuildId))) ? queryGuildId : undefined;

    if (!q && !guildId) return c.json({ error: "Missing valid parameter: q or guildId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordInfoInvite(token, q, guildId));
});

export default app;
