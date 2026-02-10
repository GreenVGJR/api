import { fileURLToPath } from 'url';
import { Hono, Context, Next } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { stream } from 'hono/streaming';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import config from './config.json' with { type: 'json' };
import os from 'os';


// @ts-ignore
import reqs_raw from './routes/search/index.js';
// @ts-ignore
import lyrics_raw from './routes/lyrics/index.js';
// @ts-ignore
import tools_raw from './routes/tools/index.js';
// @ts-ignore
import info_raw from './routes/info/index.js';

const reqs: any[] = reqs_raw;
const lyrics: any[] = lyrics_raw;
const tools: any[] = tools_raw;
const info: any[] = info_raw;

import { setGlobalDispatcher, Agent, buildConnector } from 'undici';
import tls from 'tls';

// Custom cipher list to mimic browser fingerprint (reorder ciphers)
const defaultCiphers = tls.DEFAULT_CIPHERS.split(':');
const shuffledCiphers = [
    defaultCiphers[1],
    defaultCiphers[2],
    defaultCiphers[0],
    ...defaultCiphers.slice(3)
].join(':');

// For specific TLS fingerprinting, you might want exact browser ciphers:
const chromeCiphers = [
    'TLS_AES_128_GCM_SHA256',
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'ECDHE-ECDSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-ECDSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-ECDSA-CHACHA20-POLY1305',
    'ECDHE-RSA-CHACHA20-POLY1305',
    'ECDHE-RSA-AES128-SHA',
    'ECDHE-RSA-AES256-SHA',
    'AES128-GCM-SHA256',
    'AES256-GCM-SHA384',
    'AES128-SHA',
    'AES256-SHA'
].join(':');

// Create custom connector with TLS fingerprint control
const connector = buildConnector({
    family: 4,
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2',
    ciphers: chromeCiphers,        // Controls JA3 cipher component
    ALPNProtocols: ['h2', 'http/1.1'],  // Controls JA3 ALPN extension
    maxCachedSessions: 0,          // Disable session caching for unique fingerprints
    noDelay: true,
    keepAlive: true
});

setGlobalDispatcher(new Agent({
    connections: 100,
    pipelining: 100,
    allowH2: true,
    connect: connector,            // Pass connector function here
    headersTimeout: 60000,
    bodyTimeout: 60000,
    connectTimeout: 60000,
    keepAliveTimeout: 60000
}));


const app = new Hono({ strict: false });

app.use('*', async (c: Context, next: Next) => {
    const host = c.req.header('host');
    const h = host?.split(':')[0];
    const isLocal = h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || 
                    h?.startsWith('192.168.') || h?.startsWith('10.') || h?.startsWith('172.');
    const isAllowed = host === 'api.vgjr.top' || host === 'vgjr.vercel.app';

    if (!isAllowed && !isLocal) {
        const url = new URL(c.req.url);
        url.host = 'api.vgjr.top';
        c.header('Refresh', `0; url=${url.toString()}/playground`);
        return c.text(`Redirecting...`);
    }
    await next();
});

const port = 3000;
const starttime = Date.now();

if (typeof Bun !== "object") {
    serve({
        fetch: app.fetch,
        port: port,
        hostname: "0.0.0.0"
    }, (info) => {
        console.log(`\n🚀 Server is running!`);
        console.log(`🏠 Local:    http://localhost:${port}/playground`);
        
        const nets = os.networkInterfaces();
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]!) {
                if (net.family === 'IPv4' && !net.internal) {
                    console.log(`📱 Network:  http://${net.address}:${port}/playground`);
                }
            }
        }
    });
} else {
    // Top-level log for Bun
    console.log(`\n🚀 Bun Server is running!`);
    console.log(`🏠 Local:    http://localhost:${port}/playground`);
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]!) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`📱 Network:  http://${net.address}:${port}/playground`);
            }
        }
    }
}


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const robots = fs.readFileSync(path.join(__dirname, 'public/robots.txt'), 'utf-8');
const favicon = fs.readFileSync(path.join(__dirname, 'public/favicon.ico'));
const playgroundTemplate = fs.readFileSync(path.join(__dirname, 'html/playground.html'), 'utf-8')
    .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/>\s+</g, '><') // Remove space between tags
    .trim();

// Load JS (serve as-is, no minification to avoid syntax errors)
const mainJs = fs.readFileSync(path.join(__dirname, 'html/main.js'), 'utf-8');

// Minify CSS
const rawCss = fs.readFileSync(path.join(__dirname, 'html/main.css'), 'utf-8');
const mainCss = rawCss
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .trim();
const { generate_hash, buildId: buildIdConfig } = config;

const BUILD_ID = buildIdConfig === true
    ? crypto.randomBytes(7).toString('base64url')
    : (typeof buildIdConfig === 'string' ? buildIdConfig : null);

// Helper function to check if request is from local network
function isLocalRequest(host: string | undefined): boolean {
    if (!host) return false;
    const h = host.split(':')[0];
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' ||
           h.startsWith('192.168.') || h.startsWith('10.') || h.startsWith('172.');
}

app.use('*', compress());

app.use('*', cors({
    credentials: true,
    origin: '*',
    exposeHeaders: ['X-Route']
}));

if (BUILD_ID) {
    const apiPrefixes = ['search', 'lyrics', 'tools', 'info'];
    const excludedPaths = ['favicon.ico', 'robots.txt', 'playground'];

    app.use('*', async (c: Context, next: Next) => {
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
                return c.json({ error: "Signature mismatch" }, 403);
            }
        }

        await next();
    });
}

app.get('/favicon.ico', (c: Context) => {
    if(c.req.header('Cache-Control') !== 'no-cache') return c.body(null, 304);
    c.header('Content-Type', 'image/x-icon');
    return c.body(favicon);
});

app.get('/robots.txt', (c: Context) => {
    return c.text(robots, 200);
});

app.get('/playground', (c: Context) => {
    const isMozilla = c.req.header('user-agent')?.startsWith('Mozilla/5.0');
    if(!isMozilla || (c.req.header('Accept') === 'application/json')) return c.text('Forbidden', 403);
    const host = c.req.header('host');
    const isLocal = isLocalRequest(host);
    const apiBaseUrl = isLocal ? `http://${host}` : 'https://api.vgjr.top';
    const html = playgroundTemplate.replace('{{API_BASE_URL}}', apiBaseUrl);
    c.header('Cache-Control', 'no-cache, must-revalidate, proxy-revalidate');
    return c.html(html);
});

app.get('/playground/main.js', (c: Context) => {
    const isMozilla = c.req.header('user-agent')?.startsWith('Mozilla/5.0');
    if(!isMozilla || (c.req.header('Accept') === 'application/json')) return c.text('Forbidden', 403);
    const secFetchDest = c.req.header('Sec-Fetch-Dest');
    c.header('Cache-Control', 'no-cache, must-revalidate, proxy-revalidate');
    if(secFetchDest && secFetchDest !== 'script') return c.newResponse(null, 400);
    return c.body(mainJs, 200, { 'Content-Type': 'application/javascript' });
});

app.get('/playground/main.css', (c: Context) => {
    const isMozilla = c.req.header('user-agent')?.startsWith('Mozilla/5.0');
    if(!isMozilla || (c.req.header('Accept') === 'application/json')) return c.text('Forbidden', 403);
    const secFetchDest = c.req.header('Sec-Fetch-Dest');
    c.header('Cache-Control', 'no-cache, must-revalidate, proxy-revalidate');
    if(secFetchDest && secFetchDest !== 'style') return c.newResponse(null, 400);
    return c.body(mainCss, 200, { 'Content-Type': 'text/css' });
});

app.get('/', (c: Context) => {
    const isMozilla = c.req.header('user-agent')?.startsWith('Mozilla/5.0');
    c.header('X-Net', isMozilla ? 'true' : 'false');
    if (!isMozilla) return c.body(null, 403);
    const renderJson = c.req.query('json') !== undefined || c.req.header('accept')?.includes('application/json');
    const typeRender = renderJson ? 'application/json' : 'text/plain';
    c.header('Content-Type', typeRender);
    c.header('Cache-Control', 'no-cache, must-revalidate, proxy-revalidate');

    return stream(c, async (stream) => {
        await stream.write('');
        const listapi = [{
            domRendering: typeRender,
            uptime: new Date(Date.now() - starttime).toISOString().slice(11, 19),
            service: "Hono",
            runtime: typeof Bun !== "object" ? "Node.js" : "Bun",
            fluid: true
        },
        {
            routes: {
                search: [
                    "/search/youtube/video?q=",
                    "/search/youtube/music?q=",
                    "/search/youtube/channel?q=",
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
                    "/search/tiktok/feed?region_code=",
                    "/search/reddit/media?q=",
                    "/search/roblox/games?q=",
                    "/search/roblox/audio?q=",
                    "/search/bandcamp?q=",
                    "/search/capcut/templates?q=",
                    "/search/tenor?q=&type=",
                    "/search/giphy?q=&type="
                ],
                lyrics: [
                    "/lyrics/youtube?q=",
                    "/lyrics/deezer?q="
                ],
                tools: {
                    ai: [
                        "/tools/chat/gemini?prompt=&conversation=",
                        "/tools/chat/meta?prompt="
                    ],
                    discord: {
                        stream: [
                            "/tools/discord/stream?token=&channelId=&messageId=&url=&name=&clone=&onEmbed="
                        ],
                        tiktok: [
                            "/tools/discord/tiktokFeed?token=&channelId=&messageId=&region_code="
                        ],
                        server: [
                            "/tools/discord/modifyServer?token=&guildId=&reason=&guildName=&guildDescription=&guildVerifyLevel=&guildIcon=&guildSplash=&guildBanner=",
                        ],
                        webhook: [{
                            create: [
                                "/tools/discord/webhook/create?token=&channelId=&name=&avatar="
                            ]
                        },
                        {
                            info: [
                                "/tools/discord/webhook/info?token=&webhookId=&webhookToken=&webhookUrl="
                            ]
                        },
                        {
                            delete: [
                                "/tools/discord/webhook/delete?token=&webhookId=&webhookToken=&webhookUrl="
                            ]
                        },
                        {
                            send: [
                                "/tools/discord/webhook/send?webhookId=&webhookToken=&webhookUrl=&content=&username=&avatar="
                            ]
                        },
                        {
                            list: [
                                "/tools/discord/webhook/list?token=&channelId="
                            ]
                        }
                        ]
                    },
                    image_generation: [
                        "/tools/ai-image/flux_demo?prompt=",
                        "/tools/ai-image/magicstudio?prompt=",
                        "/tools/ai-image/bing?prompt=",
                    ],
                    misc: [
                        "/tools/health",
                        "/tools/translate?q=&from=&to="
                    ]
                },
                info: [
                    "/info/youtube/video?url=",
                    "/info/youtube/channel?url=",
                    "/info/soundcloud?url=",
                    "/info/spotify?url=",
                    "/info/applemusic?url=",
                    "/info/twitter/user?q=",
                    "/info/twitter/tweet?url=",
                    "/info/reddit/subreddit?q=",
                    "/info/instagram/user?q=",
                    "/info/threads/user?q=",
                    "/info/tenor?url=",
                    "/info/giphy?url="
                ]
            }
        }];

        stream.onAbort(() => {
            return;
        });

        await stream.write(renderJson ? JSON.stringify(listapi) : JSON.stringify(listapi, null, 2));
    });
});

const routeBase = BUILD_ID ? `/${BUILD_ID}` : '';
const apiPrefixesRoute = ['/search', '/lyrics', '/tools', '/info'];

reqs.forEach((val: any) => {
    app.route(`${routeBase}/search`, val);
});
lyrics.forEach((val: any) => {
    app.route(`${routeBase}/lyrics`, val);
});
tools.forEach((val: any) => {
    app.route(`${routeBase}/tools`, val);
});
info.forEach((val: any) => {
    app.route(`${routeBase}/info`, val);
});

if (BUILD_ID) {
    app.use('*', async (c: Context, next: Next) => {
        const url = new URL(c.req.url);
        const pathname = url.pathname;

        if (apiPrefixesRoute.some(prefix => pathname.startsWith(prefix))) {
            const redirectUrl = new URL(c.req.url);
            redirectUrl.pathname = `/${BUILD_ID}${pathname}`;
            return c.redirect(redirectUrl.toString(), 302);
        }

        await next();
    });
}

app.use('*', async (c: Context, next: Next) => {
    if (BUILD_ID) {
        const url = new URL(c.req.url);
        const pathname = url.pathname;
        const checkElement = pathname.split('/').slice(1);
        if (checkElement[0] !== BUILD_ID) {
            return c.json({ error: "Signature mismatch" }, 403);
        }
    }
    const checkexists = c.notFound();

    if (checkexists) {
        return c.text('Not Found', 404);
    }
    await next();
});

export default {
    port: 3000,
    hostname: "0.0.0.0",
    fetch: app.fetch,
    idleTimeout: 60
};
