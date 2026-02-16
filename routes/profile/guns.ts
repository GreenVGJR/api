import { Hono } from 'hono';
const app = new Hono();

import { DriftProfile } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

app.get('/guns', async (c) => {
    return c.text('Forbidden', 403);
    const query = c.req.query('q');
    if(query === undefined) { 
        return c.json({"error":"Missing parameter required"}, 202);
    }
    else if(query === '') {
        return c.json({"error":"Nothing to do"}, 202);
    }

    c.header('X-Route', 'guns.lol');
    // @ts-ignore
    return await dispatch(c, () => DriftProfile(query));
});

export default app;
