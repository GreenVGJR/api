import { Hono } from 'hono';
const app = new Hono();

import { Flickr } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

app.get('/flickr', async (c) => {
    const query = c.req.query('q');
    if (query === undefined) {
        return c.json({ "error": "Missing parameter required" }, 202);
    }
    else if (query === '') {
        return c.json({ "error": "Nothing to do" }, 202);
    }
    c.header('X-Route', 'api.flickr.com');
    return await dispatch(c, () => Flickr(query));
});

export default app;
