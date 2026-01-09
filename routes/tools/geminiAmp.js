"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { Gemini } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/chat/gemini', async (c) => {
    const query = c.req.query('prompt');
    if(!query) return c.json(["Missing parameter required"], 202);
    const conversation = c.req.query('conversation');
    c.header('X-Route', 'gemini.google.com');
    return await dispatch(c, () => Gemini(query, conversation));
});

module.exports = app;