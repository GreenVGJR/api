"use strict";

const { Hono } = require('hono');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');
const app = new Hono();
const { YTMusic, YTLyrics } = require('../../functions/request');

app.get('/youtube', async (c) => {
    return c.json({ error: "Temporary unavailable due to copyright issue" }, 403);
    const query = c.req.query('q');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'm.youtube.com');

    const task = async () => {
        let q = query;
        let isUrl = false;
        try {
            new URL(q);
            isUrl = true;
        } catch { }

        try {
            if (!isUrl) {
                const tes = await YTMusic(q);
                const item = tes?.data?.innerTube?.[0];
                const videoId = item?.navigationEndpoint?.watchEndpoint?.videoId || 
                                item?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;
                
                if (videoId) {
                    q = "https://youtu.be/" + videoId;
                }
            }
            const a = await YTLyrics(q);
            return a;
        } catch (e) {
            return null;
        }
    };

    return await dispatch(c, task);
});

module.exports = app;