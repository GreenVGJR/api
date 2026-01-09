"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { dispatch, blobDispatch } = require('../../functions/httpRequest');

app.get('/applemusic', async (c) => {
    const query = c.req.query('q');
    if(!query) return c.json(["Missing parameter required"], 202);
    c.header('X-Route', 'itunes.apple.com');

    const task = async () => {
        if (query) {
            return fetch(`https://itunes.apple.com/search?media=music&limit=10&country=US&term=${query}`, { method: 'GET' })
                .then(res => res.json())
                .then(d => d.results)
                .catch(() => null);
        }
        return null;
    };

    return await dispatch(c, task);
});

module.exports = app;