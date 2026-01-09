"use strict";

const { Hono } = require('hono');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');
const app = new Hono();
const { YTMusic, YTLyrics } = require('../../functions/request');

app.get('/youtube', async (c) => {
    const query = c.req.query('q');
    if(!query) return c.json(["Missing parameter required"], 202);
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
                if (tes && tes[0]) {
                    q = "https://youtu.be/" + tes[0].flexColumns[0].musicResponsiveListItemFlexColumnRenderer.text.runs[0].navigationEndpoint.watchEndpoint.videoId;
                }
            }
            const a = await YTLyrics(q);
            return a;
        } catch {
            return null;
        }
    };

    return await dispatch(c, task);
});

module.exports = app;