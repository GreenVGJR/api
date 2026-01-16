"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { robloxGames } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/roblox/games', async (c) => {
    const query = c.req.query('q');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'apis.roblox.com, games.roblox.com');
    return await dispatch(c, () => robloxGames(query));
});

module.exports = app;