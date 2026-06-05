import { Hono } from 'hono';
const app = new Hono();

import { Tumblr } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

app.get('/tumblr', async (c) => {
    const query = c.req.query('q');
    if (query === undefined) {
        return c.json({ "error": "Missing parameter required" }, 202);
    }
    else if (query === '') {
        return c.json({ "error": "Nothing to do" }, 202);
    }
    c.header('X-Route', 'api.tumblr.com');
    return await dispatch(c, () => Tumblr(query));
});

export default app;
