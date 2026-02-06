import { Hono } from 'hono';
const app = new Hono();

import { MetaAI } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

app.get('/chat/meta', async (c) => {
    const query = c.req.query('prompt');
    const refresh = c.req.query('refresh') === 'true';
    if (query === undefined) { 
        return c.json({ "error": "Missing parameter required" }, 202);
    } else if (query === '') {
        return c.json({ "error": "Nothing to do" }, 202);
    }
    c.header('X-Route', 'meta.ai');
    return await dispatch(c, () => MetaAI(query, refresh));
});

export default app;