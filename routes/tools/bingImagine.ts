import { Hono } from 'hono';
const app = new Hono();

import { dispatch, blobDispatch } from '../../functions/httpRequest.js';
import { BingImageResult, BingImagine } from '../../functions/request.js';

app.get('/ai-image/bing', async (c) => {
    return c.body(null, 503);
























});

export default app;