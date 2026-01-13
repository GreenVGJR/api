"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { YTVideo } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/youtube/video', async (c) => {
    const query = c.req.query('q');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'm.youtube.com, www.youtube.com');
    return await dispatch(c, () => YTVideo(query));
});

module.exports = app;