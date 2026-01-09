"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { YTVideo, YTMusic, SCMusic, SPMusic, Shazam, Deezer, Tidal, Genius } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/tidal', async (c) => {
    const query = c.req.query('q');
    if(!query) return c.json(["Missing parameter required"], 202);
    c.header('X-Route', 'api.tidal.com');
    return await dispatch(c, () => Tidal(query));
});

module.exports = app;