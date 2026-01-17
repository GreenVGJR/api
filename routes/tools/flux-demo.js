"use strict";

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

const { Hono } = require('hono');
const app = new Hono();

const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/ai-image/flux_demo', async (c) => {
    const query = c.req.query('prompt');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'fast-flux-demo.vercel.app');

    return await blobDispatch(c, async () => await fetch(`https://fast-flux-demo.vercel.app/api/generate-image?text=${query}`, {
        method: "GET",
        headers: {
            ...commonHeaders
        }
    }), { 'content-type': 'image/png' });
});

module.exports = app;