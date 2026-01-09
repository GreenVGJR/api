"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { Shazam } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/shazam', async (c) => {
    const query = c.req.query('q');
    if(!query) return c.json(["Missing parameter required"], 202);
    c.header('X-Route', 'www.shazam.com');
    return await dispatch(c, () => Shazam(query));
});

module.exports = app;