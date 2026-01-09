"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { Deezer } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/deezer', async (c) => {
    const query = c.req.query('q');
    if(!query) return c.json(["Missing parameter required"], 202);
    c.header('X-Route', 'api.deezer.com');
    return await dispatch(c, () => Deezer(query));
});

module.exports = app;