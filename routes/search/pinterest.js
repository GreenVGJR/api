"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { pinterest } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/pinterest', async (c) => {
    const query = c.req.query('q');
    if(!query) return c.json(["Missing parameter required"], 202);
    c.header('X-Route', 'www.pinterest.com');
    return await dispatch(c, () => pinterest(query));
});

module.exports = app;