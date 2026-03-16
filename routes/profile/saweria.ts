import { Hono } from 'hono';
const app = new Hono();

import { SaweriaProfile } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

app.get('/saweria', async (c) => {
    const query = c.req.query('q');
    if(query === undefined) { 
        return c.json({"error":"Missing parameter required"}, 202);
    }
    else if(query === '') {
        return c.json({"error":"Nothing to do"}, 202);
    }

    c.header('X-Route', 'saweria.co');
    c.header('X-Ech-Target', 'cloudflare-ech');
    // @ts-ignore
    return await dispatch(c, () => SaweriaProfile(query));
});

export default app;
