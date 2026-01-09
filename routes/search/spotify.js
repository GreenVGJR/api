"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { SPMusic } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/spotify', async (c) => {
    const query = c.req.query('q');
    if(!query) return c.json(["Missing parameter required"], 202);
    c.header('X-Route', 'api.spotify.com');
    return await dispatch(c, () => SPMusic(query));
});

module.exports = app;