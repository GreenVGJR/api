import { Hono } from 'hono';
const app = new Hono();

import { infoTenor } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

app.get('/tenor', async (c) => {
    const query = c.req.query('url');
    if (query === undefined) {
        return c.json({"error":"Missing parameter required"}, 202);
    }
    else if(query === '') {
        return c.json({"error":"Nothing to do"}, 202);
    }
    c.header('X-Route', 'tenor.com');
    return await dispatch(c, () => infoTenor(query));
});

export default app;
