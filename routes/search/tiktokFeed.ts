import { Hono } from 'hono';
const app = new Hono();

import { TiktokFeed } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

app.get('/tiktok/feed', async (c) => {
    const cursor = 0;
    const region_code = c.req.query('region_code') || '';
    c.header('X-Route', 'www.tiktok.com');
    
    return await dispatch(c, () => TiktokFeed(cursor, region_code));
});

export default app;
