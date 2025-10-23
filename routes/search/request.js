const express = require('express');
const ro = express.Router();

const { YTVideo, YTMusic, SCMusic, SPMusic } = require('../../functions/request');

ro.get('/youtube/video', async (req, res) => {
    let a = null;
    const query = req.query.q;
    try {
    a = await YTVideo(query);
    }
    catch {}
    res.write(JSON.stringify(a));
    res.end();
});

ro.get('/youtube/music', async (req, res) => {
    let a = null;
    const query = req.query.q;
    try {
    a = await YTMusic(query);
    }
    catch {}
    res.write(JSON.stringify(a));
    res.end();
});

ro.get('/soundcloud', async (req, res) => {
    let a = null;
    const query = req.query.q;
    try {
    a = await SCMusic(query);
    }
    catch {}
    res.write(JSON.stringify(a));
    res.end();
});

ro.get('/spotify', async (req, res) => {
    let a = null;
    const query = req.query.q;
    a = await SPMusic(query);
    res.write(JSON.stringify(a));
    res.end();
});

ro.get('/applemusic', async (req, res) => {
    let a = null;
    const query = req.query.q;
    try {
        if(query) {
        a = await fetch(`https://itunes.apple.com/search?media=music&limit=10&country=US&term=${query}`, { method: 'GET' })
        .then(c => c.json())
        .then(d => d.results)
        .catch();
        }
    }
    catch {}
    res.write(JSON.stringify(a));
    res.end();
});

module.exports = ro;