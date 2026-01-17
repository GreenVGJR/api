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

app.get('/ai-image/magicstudio', async (c) => {
    const query = c.req.query('prompt');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'ai-api.magicstudio.com');

    const formq = new FormData();
    formq.append("prompt", query);
    formq.append("output_format", "bytes");
    formq.append("request_timestamp", new Date().getTime() / 1000);
    formq.append("user_is_subscribed", "false");
    formq.append("user_profile_id", "null");
    formq.append("anonymous_user_id", require('crypto').randomUUID());
//  formq.append("client_id", "pSgX7WgjukXCBoYwDM8G8GLnRRkvAoJlqa5eAVvj95o");

    return await blobDispatch(c, async () => await fetch("https://ai-api.magicstudio.com/api/ai-art-generator", {
        method: "POST",
        headers: {
            ...commonHeaders,
            'Origin': 'https://magicstudio.com',
            'Referer': 'https://magicstudio.com/ai-art-generator'
        },
        body: formq
    }), { 'content-type': 'image/png' });
});

module.exports = app;