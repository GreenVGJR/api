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

const app = new Hono({ strict: false });

const port = 3000;
const starttime = Date.now();

if(typeof Bun !== "object") {
const server = serve({
    fetch: app.fetch,
    port: port
}, async (info) => {
    console.log(`Listening on ${port}`);
});
}
else {
    Bun.serve({
    fetch: app.fetch,
    port: port
})
console.log(`Listening on ${port}`);
}

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

app.use('*', async (c, next) => {
    const check2 = c.req.header('Priority');
    if(c.req.raw.headers.has('Priority') && check2.startsWith('u=') === false) {
        return c.text('', 403);
    }
    await next();
});

app.get('/favicon.ico', etag(), (c) => {
    c.header('Cache-Control', 'max-age=3600');
    c.header('Content-Type', 'image/x-icon');
    return c.body(favicon);
});

app.get('/robots.txt', etag(), (c) => {
    c.header('Cache-Control', 'max-age=3600');
    return c.text(robots, 200);
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
                "/search/genius?q=",
                "/search/pinterest?q=",
                "/search/istockphoto?q=",
                "/search/unsplash?q=",
                "/search/pixiv?q=",
                "/search/discord/discovery/apps?q=",
                "/search/discord/discovery/servers?q=",
                "/search/bilibili?q=",
                "/search/jiosaavn?q=",
                "/search/twitch?q=",
                "/search/instagram/users?q=",
                "/search/threads/users?q="
            ],
            lyrics: [
                "/lyrics/youtube?q=",
                "/lyrics/deezer?q="
            ],
            tools: {
                ai: [
                    "/tools/chat/gemini?prompt=&conversation="
                ],
                discord: [
                    "/tools/discord/modifyServer?token=&guildId=&reason=&guildName=&guildDescription=&guildVerifyLevel=&guildIcon=&guildSplash=&guildBanner="
                ],
                generate_image: [
                    "/tools/ai-image/flux_demo?prompt=",
                    "/tools/ai-image/magicstudio?prompt="
                ],
                misc: [
                    "/tools/translate?q=&from=&to="
                ]
            },
            info: [
                "/info/youtube?url=",
                "/info/soundcloud?url=",
                "/info/spotify?url=",
                "/info/applemusic?url=",
            ]
        }
    },
    {
        uptime: Date.now() - starttime,
        service: "Hono",
        runtime: typeof Bun !== "object" ? "Node.js" : "Bun",
        proxied: false,
        fluid: true
    }];
    c.header('Cache-Control', 'no-store, must-revalidate');
    return c.json(listapi, 200);
});

app.use('*', async (c, next) => {
    let geturl;
    try {
    geturl = new URL(c.req.url);
    }
    catch {
        return c.body(null, 403);
    }
    if (!['GET', 'HEAD'].includes(c.req.method) || c.req.header('user-agent') == '' || (geturl.host !== c.req.header('host')) || c.req.raw.headers.has('sec-fetch-site') ? !['none', 'cross-site', 'same-origin', 'same-site'].includes(c.req.header('sec-fetch-site')) : false || c.req.raw.headers.has('origin') ? geturl.origin !== c.req.header('origin') : false) return c.text('', 403);
    if(generate_hash) {
    if(c.req.header('If-None-Match') && (c.req.header('cache-control') !== 'no-cache')) return c.body(null, 304);
    }
    await next();
    if (c.error) {
        return c.body(null, 500);
    }
});

app.use('*', compress());

app.use('*', cors({
    credentials: true,
    exposeHeaders: ['X-Route']
}));

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

app.use('*', async (c, next) => {
    const checkexists = c.notFound();

    if(checkexists) {
        c.header('Cache-Control', 'no-store, must-revalidate');
        return c.json({error: "Route not available"}, 404);
    }
    await next();
});