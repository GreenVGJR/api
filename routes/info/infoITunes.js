"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { infoITunes } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/applemusic', async (c) => {
    const query = c.req.query('url');
    if (!query) return c.json(["Missing parameter required"], 202);
    c.header('X-Route', 'music.apple.com');
    return await dispatch(c, () => infoITunes(query));
});

module.exports = app;