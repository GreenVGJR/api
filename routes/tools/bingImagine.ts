import { Hono } from 'hono';
const app = new Hono();

import { dispatch, blobDispatch } from '../../functions/httpRequest.js';
import { BingImageResult, BingImagine } from '../../functions/request.js';

app.get('/ai-image/bing', async (c) => {
    return c.body(null, 503);
    /*
    const query = c.req.query('prompt');
    if (!query) {
        return c.json({ "error": "Missing parameter required" }, 202);
    }
    
    const words = query.trim().split(/\s+/);
    if (words.length > 3) {
        return c.json({ "error": "Bad request" }, 202);
    }

    const result = await BingImagine(query);
    const imageUrl = result?.data?.[0]?.url;

    if (!imageUrl) {
        return c.json({ "error": "No image generated" }, 202);
    }

    return await blobDispatch(c, async () => await fetch(imageUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
        }
    }), { 'content-type': 'image/png' });
    */
});

export default app;