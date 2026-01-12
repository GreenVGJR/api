"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { Gemini } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/chat/gemini', async (c) => {
    const query = c.req.query('prompt');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    const conversation = c.req.query('conversation');
    c.header('X-Route', 'gemini.google.com');
    return await dispatch(c, () => Gemini(query, conversation));
});

module.exports = app;