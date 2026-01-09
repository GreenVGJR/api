"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { infoSoundcloud } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/soundcloud', async (c) => {
    const query = c.req.query('url');
    if (!query) return c.json(["Missing parameter required"], 202);
    c.header('X-Route', 'api-v2.soundcloud.com');
    return await dispatch(c, () => infoSoundcloud(query));
});

module.exports = app;