import { Hono } from 'hono';
const app = new Hono();

import { MetaAI } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

app.get('/chat/meta', async (c) => {
    return c.body(null, 503);
});

export default app;