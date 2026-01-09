"use strict";

const { Hono } = require('hono');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');
const app = new Hono();
const { deezerLyrics } = require('../../functions/request');

app.get('/deezer', async (c) => {
    const query = c.req.query('q');
    if(!query) return c.json(["Missing parameter required"], 202);
    c.header('X-Route', 'pipe.deezer.com');
    return await dispatch(c, () => deezerLyrics(query));
});

module.exports = app;