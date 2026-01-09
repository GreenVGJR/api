"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { Translate } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/translate', async (c) => {
    const query = c.req.query('q');
    if(!query) return c.json(["Missing parameter required"], 202);
    const from = c.req.query('from');
    const to = c.req.query('to');
    c.header('X-Route', 'translate.google.com');
    return await dispatch(c, () => Translate(query, from, to));
});

module.exports = app;