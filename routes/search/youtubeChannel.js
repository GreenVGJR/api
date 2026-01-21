"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { YTChannel } = require('../../functions/request');
const { dispatch } = require('../../functions/httpRequest');

app.get('/youtube/channel', async (c) => {
    const query = c.req.query('q');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'm.youtube.com, www.youtube.com');
    return await dispatch(c, () => YTChannel(query));
});

module.exports = app;
