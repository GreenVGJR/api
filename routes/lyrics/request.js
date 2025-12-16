"use strict";

const { Hono } = require('hono');
const { dispatch } = require('../../functions/httpRequest');
const app = new Hono();
const { YTMusic, YTLyrics, deezerLyrics } = require('../../functions/request');

app.get('/youtube', async (c) => {
    const query = c.req.query('q');
    c.header('X-Route', 'm.youtube.com');

    const task = (async () => {
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
    })();

    return dispatch(c, task);
});

app.get('/deezer', async (c) => {
    const query = c.req.query('q');
    c.header('X-Route', 'pipe.deezer.com');
    return dispatch(c, deezerLyrics(query));
});

module.exports = app;