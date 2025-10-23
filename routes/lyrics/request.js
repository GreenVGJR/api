const express = require('express');
const ro = express.Router();

const { YTLyrics } = require('../../functions/request');

ro.get('/youtube', async (req, res) => {
    let a = null;
    const query = req.query.url;
    try {
    a = await YTLyrics(query);
    }
    catch {}
    res.json(a);
    res.end();
});

module.exports = ro;