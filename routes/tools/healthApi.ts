import { Hono } from 'hono';
const app = new Hono();

import { dispatch } from '../../functions/httpRequest.js';

app.get('/health', async (c) => {
    return c.text('OK', 200);
});

export default app;