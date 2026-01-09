"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { YTVideo } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/youtube/video', async (c) => {
    const query = c.req.query('q');
    if(!query) return c.json(["Missing parameter required"], 202);
    c.header('X-Route', 'm.youtube.com');
    return await dispatch(c, () => YTVideo(query));
});

module.exports = app;