const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36';
const commonHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'Sec-Fetch-User': '?1',
    'User-Agent': userAgent
}

import { Hono } from 'hono';
import { Buffer } from 'buffer';
const app = new Hono();

import { dispatch, blobDispatch  } from '../../functions/httpRequest.js';

app.get('/ai-image/flux_schnell', async (c) => {
    const query = c.req.query('prompt');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    const CF_AID = process.env.CF_AID;
    const CF_TOKEN = process.env.CF_TOKEN;

    c.header('X-Route', 'api.cloudflare.com, fast-flux-demo.vercel.app');

    if (CF_AID && CF_TOKEN) {
        try {
            const cfResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_AID}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${CF_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "prompt": query,
                    "steps": 1,
                    "width": 512,
                    "height": 512
                })
            });

            if (cfResponse.ok) {
                const json = await cfResponse.json() as any;
                const base64Image = json?.result?.image;
                if (base64Image) {
                    const imageBuffer = Buffer.from(base64Image, 'base64');
                    return await blobDispatch(c, imageBuffer, { 'content-type': 'image/png' });
                }
            } else if (cfResponse.status === 429) {
                console.warn('Cloudflare AI rate limited (429), falling back to Vercel');
            } else {
                const errorText = await cfResponse.text();
                console.error(`Cloudflare AI error (${cfResponse.status}):`, errorText);
            }
        } catch (e) {
            console.error('Cloudflare AI fetch error:', e);
        }
    }

    return await blobDispatch(c, fetch(`https://fast-flux-demo.replicate.workers.dev/api/generate-image?text=${query}`, {
        method: "GET",
        headers: {
            ...commonHeaders
        }
    }), { 'content-type': 'image/png' });
});

export default app;