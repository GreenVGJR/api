const { setGlobalDispatcher, Agent } = require('undici');

setGlobalDispatcher(new Agent({
    connect: {
        family: 4
    }
}));

const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const fs = require('fs');

const app = new Hono();

// Routes
// Note: Ensure these files export a Hono instance via module.exports
const robots = fs.readFileSync('./public/robots.txt');
const favicon = fs.readFileSync('./public/favicon.ico');

const reqs = require('./routes/search/request');
const lyrics = require('./routes/lyrics/request');
const { soundcloudKey, spotifyKey, tidalKeys, deezerKeys, setKeys } = require('./functions/request');

(async () => {

    const [sc, sp, tidal, deezer] = await Promise.all([
        soundcloudKey(),
        spotifyKey(),
        tidalKeys(),
        deezerKeys()
    ]);
    setKeys(sc, sp, tidal, deezer);

})();

const port = 3000;
const starttime = Date.now();

// Middleware
app.use('*', async (c, next) => {
    c.header('X-Stream', c.req.path === '/' ? '0' : '1');
    c.header('Access-Control-Allow-Origin', '*');
    await next();
});

app.get('/robots.txt', (c) => {
    return c.text(robots, 200);
});

app.get('/favicon.ico', (c) => {
    c.header('Content-Type', 'image/x-icon');
    return c.body(favicon);
});

app.get('/', (c) => {
    const listapi = [{
        routes: {
            search: [
                "/search/youtube/video?q=",
                "/search/youtube/music?q=",
                "/search/soundcloud?q=",
                "/search/spotify?q=",
                "/search/applemusic?q=",
                "/search/shazam?q=",
                "/search/deezer?q=",
                "/search/tidal?q=",
                "/search/genius?q="
            ],
            lyrics: [
                "/lyrics/youtube?q=",
                "/lyrics/deezer?q="
            ]
        },
        unavailable_routes: [
            "/info/youtube",
            "/info/soundcloud",
            "/info/spotify",
            "/info/applemusic",
            "/search/bing/web",
            "/tools/chat/gemini",
            "/tools/translate",
            "/search/tiktok/video?q=",
            "/search/tiktok/music?q=",

        ],
    },
    {
        uptime: Date.now() - starttime,
        service: "Hono",
        support_stream: true,
        proxied: true
    }];
    return c.body(JSON.stringify(listapi, null, 3), 200);
});

// Routes
// In Hono, use .route() to mount sub-applications
app.route('/search', reqs);
app.route('/lyrics', lyrics);

app.notFound((c) => {
    return c.body(null, 200);
});

serve({
    fetch: app.fetch,
    port: port
}, async (info) => {
    // Initialize keys on startup
    console.log(`Listening on ${port}`);
});