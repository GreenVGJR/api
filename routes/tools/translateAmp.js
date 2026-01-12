"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { Translate } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/translate', async (c) => {
    const query = c.req.query('q');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    const from = c.req.query('from');
    const to = c.req.query('to');
    c.header('X-Route', 'translate.google.com');
    return await dispatch(c, () => Translate(query, from, to));
});

module.exports = app;