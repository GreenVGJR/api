import { Hono } from 'hono';
const app = new Hono();

import { googleImgSearch } from '../../functions/request.js';
import { dispatch, blobDispatch } from '../../functions/httpRequest.js';

app.get('/googleImage', async (c) => {
    const query = c.req.query('q');
    const sort = c.req.query('sort') || 'relevance';
    if (sort !== 'relevance' && sort !== 'latest') {
        return c.json({ "error": "Only 'relevance' or 'latest' are supported" }, 202);
    }

    if (query === undefined) {
        return c.json({ "error": "Missing parameter required" }, 202);
    }
    else if (query === '') {
        return c.json({ "error": "Nothing to do" }, 202);
    }
    c.header('X-Route', 'www.googleapis.com, www.google.com');
    c.header('X-Warning', 'You are using experimental endpoint. Expect errors');
    return await dispatch(c, () => googleImgSearch(query, sort));
});

export default app;