"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { YTVideo, YTMusic, SCMusic, SPMusic, Shazam, Deezer, Tidal, Genius } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/tidal', async (c) => {
    const query = c.req.query('q');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'api.tidal.com');
    return await dispatch(c, () => Tidal(query));
});

module.exports = app;