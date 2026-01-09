"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { infoYoutube } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/youtube', async (c) => {
    const query = c.req.query('url');
    if (!query) return c.json(["Missing parameter required"], 202);
    c.header('X-Route', 'm.youtube.com');
    return await dispatch(c, () => infoYoutube(query));
});

module.exports = app;