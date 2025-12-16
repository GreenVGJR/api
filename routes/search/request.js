"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { YTVideo, YTMusic, SCMusic, SPMusic, Shazam, Deezer, Tidal, Genius } = require('../../functions/request');
const { dispatch } = require('../../functions/httpRequest');

app.get('/youtube/video', async (c) => {
    const query = c.req.query('q');
    c.header('X-Route', 'm.youtube.com');
    return dispatch(c, YTVideo(query));
});

app.get('/youtube/music', async (c) => {
    const query = c.req.query('q');
    c.header('X-Route', 'm.youtube.com');
    return dispatch(c, YTMusic(query));
});

app.get('/soundcloud', async (c) => {
    const query = c.req.query('q');
    c.header('X-Route', 'api-v2.soundcloud.com');
    return dispatch(c, SCMusic(query));
});

app.get('/spotify', async (c) => {
    const query = c.req.query('q');
    c.header('X-Route', 'api.spotify.com');
    return dispatch(c, SPMusic(query));
});

app.get('/applemusic', async (c) => {
    const query = c.req.query('q');
    c.header('X-Route', 'itunes.apple.com');

    const task = (async () => {
        if (query) {
            return fetch(`https://itunes.apple.com/search?media=music&limit=10&country=US&term=${query}`, { method: 'GET' })
                .then(res => res.json())
                .then(d => d.results)
                .catch(() => null);
        }
        return null;
    })();

    return dispatch(c, task);
});

app.get('/shazam', async (c) => {
    const query = c.req.query('q');
    c.header('X-Route', 'www.shazam.com');
    return dispatch(c, Shazam(query));
});

app.get('/deezer', async (c) => {
    const query = c.req.query('q');
    c.header('X-Route', 'api.deezer.com');
    return dispatch(c, Deezer(query));
});

app.get('/tidal', async (c) => {
    const query = c.req.query('q');
    c.header('X-Route', 'api.tidal.com');
    return dispatch(c, Tidal(query));
});

app.get('/genius', async (c) => {
    const query = c.req.query('q');
    c.header('X-Route', 'genius.com');
    return dispatch(c, Genius(query));
});

module.exports = app;