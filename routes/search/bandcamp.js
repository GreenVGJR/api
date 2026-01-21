"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { Bandcamp } = require('../../functions/request');
const { dispatch } = require('../../functions/httpRequest');

app.get('/bandcamp', async (c) => {
    const query = c.req.query('q');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'bandcamp.com');
    return await dispatch(c, () => Bandcamp(query));
});

module.exports = app;
