import { Hono } from 'hono';
const app = new Hono();

import { DiscordInfoMessages } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

app.get('/discord/infoMessages', async (c) => {
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

    const queryChannelId = c.req.query('channelId');
    const channelId = (queryChannelId && Number.isInteger(parseInt(queryChannelId))) ? queryChannelId : null;

    const sort = c.req.query('sort') === 'asc' ? 'asc' : 'desc';

    const queryLimit = c.req.query('limit');
    const limit = (queryLimit && Number.isInteger(parseInt(queryLimit))) ? parseInt(queryLimit) : undefined;

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!channelId) return c.json({ error: "Missing valid parameter: channelId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordInfoMessages(token!, channelId!, sort, limit));
});

export default app;