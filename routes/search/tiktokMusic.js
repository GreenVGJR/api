"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { TiktokMusic } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/tiktok/music', async (c) => {
    const query = c.req.query('q');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'api-boot.tiktokv.com');
    return await dispatch(c, () => TiktokMusic(query));
});

module.exports = app;