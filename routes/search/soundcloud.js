"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { SCMusic } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/soundcloud', async (c) => {
    const query = c.req.query('q');
    if(!query) return c.json(["Missing parameter required"], 202);
    c.header('X-Route', 'api-v2.soundcloud.com');
    return await dispatch(c, () => SCMusic(query));
});

module.exports = app;