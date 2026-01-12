"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { Pixiv } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/pixiv', async (c) => {
    const query = c.req.query('q');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'www.pixiv.net');
    return await dispatch(c, () => Pixiv(query));
});

module.exports = app;