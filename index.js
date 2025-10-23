const express = require('express');
const app = express();

// Routes
const request = require('./routes/search/request');
const lyrics = require('./routes/lyrics/request');

let robots;
robots = robots || require('fs').readFileSync('./robots.txt', 'utf8');

let iconico;
iconico = iconico || require('fs').readFileSync('./logo.ico');

const port = 3000;
const starttime = Date.now();

app.use((req, res, next) => {
    if(req.path === '/robots.txt') {
        res.writeHead(200, {
            'Content-Type': 'text/plain'
        });
        return res.end(robots);
    }
    if(req.path === '/favicon.ico') {
        res.writeHead(200, {
            'Content-Type': 'image/x-icon'
        });
        return res.end(iconico);
    }
    if(req.header('Sec-Fetch-Site') === 'same-origin') return res.status(412).end();
    res.writeHead(200, {
        'Content-Type': 'application/json',
        'X-Stream': 1
    });
    res.write('');
    next();
});

app.get('/', (req, res) => {
    const listapi = JSON.stringify({
    "routes": {
    "search": [
        "/search/youtube/video?q=",
        "/search/youtube/music?q=",
        "/search/soundcloud?q=",
        "/search/spotify?q=",
        "/search/applemusic?q=",
    ],
    "lyrics": [
        "/lyrics/youtube?url="
    ]},
    "_info": {
        "uptime": Date.now() - starttime
    }
    });
    res.write(listapi);
    res.end();
});

app.use('/search', request);
app.use('/lyrics', lyrics);

app.use((req, res) => {
    res.end('{"error":"Content not found"}');
});