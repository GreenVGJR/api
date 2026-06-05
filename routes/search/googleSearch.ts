import { Hono } from 'hono';
const app = new Hono();

import { googleSearch } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

app.get('/google', async (c) => {
    const query = c.req.query('q');

    if (query === undefined) {
        return c.json({ "error": "Missing parameter required" }, 202);
    }
    else if (query === '') {
        return c.json({ "error": "Nothing to do" }, 202);
    }
    c.header('X-Route', 'cse.google.com, www.google.com');
    c.header('X-Warning', 'You are using experimental endpoint. Expect errors');
    return await dispatch(c, () => googleSearch(query));
});

export default app;
