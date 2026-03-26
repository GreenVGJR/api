import { Hono } from 'hono';
const app = new Hono();

import { SociaBuzzProfile } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

app.get('/sociabuzz', async (c) => {
    const query = c.req.query('q');
    if(query === undefined) { 
        return c.json({"error":"Missing parameter required"}, 202);
    }
    else if(query === '') {
        return c.json({"error":"Nothing to do"}, 202);
    }

    c.header('X-Route', 'sociabuzz.com');
    c.header('X-Ech-Target', 'cloudflare-ech');
    // @ts-ignore
    return await dispatch(c, () => SociaBuzzProfile(query));
});

export default app;
