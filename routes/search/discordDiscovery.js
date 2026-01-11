"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { DiscordServers } = require('../../functions/request');
const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/discord/discovery', async (c) => {
    const query = c.req.query('q');
    if(!query) return c.json(["Missing parameter required"], 202);
    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordServers(query));
});

module.exports = app;