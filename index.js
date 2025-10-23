const express = require('express');
const app = express();
const path = require('path');

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const request = require('./routes/search/request');
const lyrics = require('./routes/lyrics/request');

const port = 80;
const starttime = Date.now();

// Middleware
app.use((req, res, next) => {
    res.set('Content-Type', 'application/json');
    res.set('X-Stream', 'fail');
    next();
});

app.get('/', (req, res) => {
    const listapi = {
        routes: {
            search: [
                "/search/youtube/video?q=",
                "/search/youtube/music?q=",
                "/search/soundcloud?q=",
                "/search/spotify?q=",
                "/search/applemusic?q=",
            ],
            lyrics: [
                "/lyrics/youtube?url="
            ]
        },
        _info: { 
            uptime: Date.now() - starttime,
            note: "These functions are made in reference to AMC Discord Bot"
        }
    };
    res.json(listapi);
});

app.use('/search', request);
app.use('/lyrics', lyrics);

// 404 fallback
app.use((req, res) => res.status(404).json({ error: "Content not found" }));

app.listen(port, () => console.log(`Listening on ${port}`));
