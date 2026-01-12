"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { GettyImage } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/istockphoto', async (c) => {
    const query = c.req.query('q');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'www.istockphoto.com');
    return await dispatch(c, () => GettyImage(query));
});

module.exports = app;