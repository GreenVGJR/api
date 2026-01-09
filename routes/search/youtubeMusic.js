"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { YTMusic } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/youtube/music', async (c) => {
    const query = c.req.query('q');
    if(!query) return c.json(["Missing parameter required"], 202);
    c.header('X-Route', 'm.youtube.com');
    return await dispatch(c, () => YTMusic(query));
});

module.exports = app;