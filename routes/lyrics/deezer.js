"use strict";

const { Hono } = require('hono');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');
const app = new Hono();
const { deezerLyrics } = require('../../functions/request');

app.get('/deezer', async (c) => {
    return c.json({ error: "Temporary unavailable due to copyright issue" }, 403);
    const query = c.req.query('q');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'pipe.deezer.com');
    return await dispatch(c, () => deezerLyrics(query));
});

module.exports = app;