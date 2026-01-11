"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { Pixiv } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/pixiv', async (c) => {
    const query = c.req.query('q');
    if(!query) return c.json(["Missing parameter required"], 202);
    c.header('X-Route', 'www.pixiv.net');
    return await dispatch(c, () => Pixiv(query));
});

module.exports = app;