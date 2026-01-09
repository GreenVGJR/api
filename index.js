const { setGlobalDispatcher, Agent } = require('undici');

setGlobalDispatcher(new Agent({
    connect: {
        family: 4
    }
}));

const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const { cors } = require('hono/cors');
const { etag } = require('hono/etag');
const { compress } = require('hono/compress');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = new Hono();

app.use('*', compress());

app.use('*', cors({
    credentials: true,
    exposeHeaders: ['X-Route']
}));

const robots = fs.readFileSync(path.join(__dirname, 'public/robots.txt'));
const favicon = fs.readFileSync(path.join(__dirname, 'public/favicon.ico'));
const { generate_hash } = require('./config.json');

const reqs = require('./routes/search');
const lyrics = require('./routes/lyrics');
const tools = require('./routes/tools');
const info = require('./routes/info');
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

app.use('*', async (c, next) => {
    if(generate_hash) {
    if (c.env.incoming.httpVersion === '1.0' || c.env.incoming.httpVersion === '0.9') {
        return c.body(null, 501);
    }
    const geturl = new URL(c.req.url);
    if (c.req.method !== 'GET' || c.req.header('user-agent') == '' || (geturl.host !== c.req.header('host')) || (c.req.header('sec-fetch-site') == '' && c.req.method !== 'GET')) return c.body(null, 403);
    if(c.req.header('If-None-Match') && (c.req.header('cache-control') !== 'no-cache')) return c.body(null, 304);
    }
    await next();
    if (c.error) {
        return c.body(null, 500);
    }
});

app.get('/robots.txt', etag(), (c) => {
    c.header('Cache-Control', 'max-age=3600');
    return c.text(robots, 200);
});

app.get('/favicon.ico', etag(), (c) => {
    c.header('Cache-Control', 'max-age=3600');
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
            ],
            tools: [
                "/tools/chat/gemini?prompt=&conversation=",
                "/tools/translate?q=&from=&to=",
                "/tools/ai-image/flux_demo?prompt=",
                "/tools/ai-image/magicstudio?prompt=",
            ],
            info: [
                "/info/youtube?url=",
                "/info/soundcloud?url=",
                "/info/spotify?url=",
                "/info/applemusic?url=",
            ]
        },
        unavailable_routes: [
            "/search/tiktok/video",
            "/search/tiktok/music",
        ],
    },
    {
        uptime: Date.now() - starttime,
        service: "Hono"
    }];
    c.header('Cache-Control', 'no-store, must-revalidate');
    return c.body(JSON.stringify(listapi, null, 3), 200);
});

reqs.forEach((val) => {
    app.route('/search', val);
});
lyrics.forEach((val) => {
    app.route('/lyrics', val);
});
tools.forEach((val) => {
    app.route('/tools', val);
});
info.forEach((val) => {
    app.route('/info', val);
});

app.notFound((c) => {
    c.header('Cache-Control', 'no-store, must-revalidate');
    return c.json(["No route available"], 404);
});

const server = serve({
    fetch: app.fetch,
    port: port
}, async (info) => {
    console.log(`Listening on ${port}`);
});