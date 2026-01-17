"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { infoTwitterUser } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/twitter/user', async (c) => {
    const query = c.req.query('q');
    if (query === undefined) {
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'api.x.com, syndication.twitter.com');
    return await dispatch(c, () => infoTwitterUser(query));
});

module.exports = app;