import { Hono } from 'hono';
import { DiscordInfoSticker } from '../../functions/request';
import { dispatch } from '../../functions/httpRequest';

const app = new Hono();

app.get('/discord/infoSticker', async (c) => {
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

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!q) return c.json({ error: "Missing valid parameter: q" }, 202);

    return await dispatch(c, () => DiscordInfoSticker(token!, q));
});

export default app;
