"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { Bilibili } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/bilibili', async (c) => {
    const query = c.req.query('q');
    if(!query) return c.json(["Missing parameter required"], 202);
    c.header('X-Route', 'api.bilibili.tv');
    return await dispatch(c, () => Bilibili(query));
});

module.exports = app;