const { setGlobalDispatcher, Agent } = require('undici');

setGlobalDispatcher(new Agent({
    connect: {
        family: 4
    }
}));

const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const { cors } = require('hono/cors');
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

const crypto = require('crypto');
const robots = fs.readFileSync(path.join(__dirname, 'public/robots.txt'));
const favicon = fs.readFileSync(path.join(__dirname, 'public/favicon.ico'));
const { generate_hash, buildId: buildIdConfig } = require('./config.json');

const BUILD_ID = buildIdConfig === true 
    ? crypto.randomBytes(7).toString('base64url')
    : (typeof buildIdConfig === 'string' ? buildIdConfig : null);

const reqs = require('./routes/search');
const lyrics = require('./routes/lyrics');
const tools = require('./routes/tools');
const info = require('./routes/info');

app.use('*', cors({
    credentials: true,
    exposeHeaders: ['X-Route']
}));

if (BUILD_ID) {
    const apiPrefixes = ['search', 'lyrics', 'tools', 'info'];
    const excludedPaths = ['favicon.ico', 'robots.txt'];
    
    app.use('*', async (c, next) => {
        const url = new URL(c.req.url);
        const pathname = url.pathname;
        const pathParts = pathname.split('/').filter(Boolean);
        
        if (pathParts.length >= 1) {
            const firstSegment = pathParts[0];
            
            if (excludedPaths.includes(firstSegment)) {
                await next();
                return;
            }
            
            if (apiPrefixes.includes(firstSegment)) {
                await next();
                return;
            }
            
            if (firstSegment !== BUILD_ID) {
                return c.json({error: "Signature mismatch"}, 403);
            }
        }
        
        await next();
    });
}

app.get('/favicon.ico', (c) => {
    c.header('Content-Type', 'image/x-icon');
    return c.body(favicon);
});

app.get('/robots.txt', (c) => {
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
                "/search/threads/users?q=",
                "/search/pexels?q=",
                "/search/tiktok/video?q=",
                "/search/tiktok/music?q=",
                "/search/tiktok/users?q=",
                "/search/reddit/media?q=",
                "/search/roblox/games?q="
            ],
            lyrics: [
                "/lyrics/youtube?q=",
                "/lyrics/deezer?q="
            ],
            tools: {
                ai: [
                    "/tools/chat/gemini?prompt=&conversation="
                ],
                discord: {
                    server: [
                    "/tools/discord/modifyServer?token=&guildId=&reason=&guildName=&guildDescription=&guildVerifyLevel=&guildIcon=&guildSplash=&guildBanner=",
                    ],
                    webhook: [
                    "/tools/discord/webhook/create?token=&channelId=&name=&avatar=",
                    [
                        "/tools/discord/webhook/info?token=&webhookId=",
                        "/tools/discord/webhook/info?webhookToken=&webhookId=",
                    ],
                    [
                    "/tools/discord/webhook/delete?token=&webhookId=",
                    "/tools/discord/webhook/delete?webhookToken=&webhookId=",
                    ]
                    ]
                },
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
                "/info/twitter/user?q=",
                "/info/twitter/tweet?url="
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
    return c.json(listapi, 200);
});

app.use('*', compress());

const routeBase = BUILD_ID ? `/${BUILD_ID}` : '';
const apiPrefixes = ['/search', '/lyrics', '/tools', '/info'];

reqs.forEach((val) => {
    app.route(`${routeBase}/search`, val);
});
lyrics.forEach((val) => {
    app.route(`${routeBase}/lyrics`, val);
});
tools.forEach((val) => {
    app.route(`${routeBase}/tools`, val);
});
info.forEach((val) => {
    app.route(`${routeBase}/info`, val);
});

if (BUILD_ID) {
    app.use('*', async (c, next) => {
        const url = new URL(c.req.url);
        const pathname = url.pathname;
        
        if (apiPrefixes.some(prefix => pathname.startsWith(prefix))) {
            const redirectUrl = new URL(c.req.url);
            redirectUrl.pathname = `/${BUILD_ID}${pathname}`;
            return c.redirect(redirectUrl.toString(), 302);
        }
        
        await next();
    });
}

app.use('*', async (c, next) => {
    if(BUILD_ID) {
    const url = new URL(c.req.url);
    const pathname = url.pathname;
    const checkElement = pathname.split('/').slice(1);
    if(checkElement[0] !== BUILD_ID) {
        return c.json({error: "Signature mismatch"}, 403);
        }
    }
    const checkexists = c.notFound();

    if(checkexists) {
        return c.json({error: "Route not available"}, 404);
    }
    await next();
});