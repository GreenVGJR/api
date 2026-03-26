import 'dotenv/config';
import { fileURLToPath } from 'url';
import { Hono, Context, Next } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { stream } from 'hono/streaming';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import config from './config.json' with { type: 'json' };
import os from 'os';

import reqs from './routes/search/index.js';
import lyrics from './routes/lyrics/index.js';
import tools from './routes/tools/index.js';
import info from './routes/info/index.js';
import profile from './routes/profile/index.js';
import download from './routes/download/index.js';
import music from './routes/music/index.js';
import { autoInit } from './functions/musicPlayer.js';

autoInit().catch(() => {});

const API_ROUTES = {
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
        "/search/imdb?q=",
        "/search/imgflip?q=",
        "/search/istockphoto?q=",
        "/search/imgur/posts?q=",
        "/search/unsplash?q=",
        "/search/pixiv?q=",
        "/search/otodb?q=",
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
        "/search/giphy?q=&type=",
        "/search/klipy?q=&type=",
        "/search/patreon?q=",
        "/search/trakteer?q="
    ],
    profile: [
        "/profile/guns?q=",
        "/profile/drift?q=",
        "/profile/haunt?q=",
        "/profile/rage?q=",
        "/profile/saweria?q=",
        "/profile/trakteer?q=",
        "/profile/sociabuzz?q=",
        "/profile/patreon?q="
    ],
    lyrics: [
        "/lyrics/youtube?q=",
        "/lyrics/deezer?q=",
        "/lyrics/shazam?q="
    ],
    tools: {
        ai: {
        chat: [
            "/tools/chat/gemini?prompt=&conversation=",
            "/tools/chat/meta?prompt=",
            "/tools/chat/grok?prompt=",
            "/tools/chat/sonar?prompt="
        ],
        image_generation: [
            "/tools/ai-image/flux_schnell?prompt=",
            "/tools/ai-image/magicstudio?prompt=",
            ],
        },
        discord: {
            stream: [
                "/tools/discord/stream?token=&channelId=&messageId=&url=&name=&clone=&onEmbed=&fallbackEmbed="
            ],
            tiktok: [
                "/tools/discord/tiktokFeed?token=&channelId=&messageId=&region_code="
            ],
            server: [
                "/tools/discord/modifyServer?token=&guildId=&reason=&guildName=&guildDescription=&guildVerifyLevel=&guildIcon=&guildSplash=&guildBanner=",
            ],
            member: [
                "/tools/discord/modifyMemberServer?token=&guildId=&nickname=&avatar=&banner=&bio=&reason=",
                "/tools/discord/infoMember?token=&userId=&guildId=",
                "/tools/discord/listMember?token=&guildId=&limit=&type=",
            ],
            webhook: [
                { create: ["/tools/discord/webhook/create?token=&channelId=&name=&avatar="] },
                { info: ["/tools/discord/webhook/info?token=&webhookId=&webhookToken=&webhookUrl="] },
                { delete: ["/tools/discord/webhook/delete?token=&webhookId=&webhookToken=&webhookUrl="] },
                { send: ["/tools/discord/webhook/send?webhookId=&webhookToken=&webhookUrl=&content=&username=&avatar="] },
                { list: ["/tools/discord/webhook/list?token=&channelId="] }
            ],
            message: [
                "/tools/discord/infoMessages?token=&channelId=&sort=&limit="
            ]
        },
        misc: [
            "/tools/translate?q=&from=&to=",
            "/tools/timezone?q=",
            "/tools/ffmpeg/interpolate?videoUrl=&multi="
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
        "/info/giphy?url=",
        "/info/tiktok/video?q=",
        "/info/weather?q=",
        "/info/pinterest?url=",
        "/info/klipy?url="
    ],
    download: [],
    music: [
    "/music/connect?token=&voiceId=&guildId=&authorId=&isDeaf=&247=&force=",
    "/music/disconnect?token=&guildId=",
    "/music/play?token=&q=&platform=&voiceId=&guildId=&authorId=&isDeaf=&247=",
    "/music/pause?token=&guildId=",
    "/music/resume?token=&guildId=",
    "/music/skip?token=&guildId=&index=",
    "/music/stop?token=&guildId=",
    "/music/seek?token=&guildId=&time=",
    "/music/volume?token=&guildId=&value=",
    "/music/loop?token=&guildId=&mode=",
    "/music/shuffle?token=&guildId=",
    "/music/remove?token=&guildId=&index=",
    "/music/clear?token=&guildId=",
    "/music/jump?token=&guildId=&index=",
    "/music/move?token=&guildId=&from=&to=",
    "/music/back?token=&guildId=",
    "/music/247?token=&guildId=&value=",
    "/music/where?token=&guildId=&authorId=",
    "/music/nowplaying?token=&guildId=",
    "/music/nowplaying/lyrics?token=&guildId=",
    "/music/queue?token=&guildId=&limit=&offset=",
    ]
};

function flattenRoutes(obj: any): any[] {
    let flatResults: any[] = [];
    if (Array.isArray(obj)) {
        return obj.map(item => {
            if (typeof item === 'string') {
                const parts = item.split('?');
                return {
                    path: parts[0],
                    query: parts.length > 1 ? '?' + parts[1] : ''
                };
            } else if (typeof item === 'object') {
                return flattenRoutes(item);
            }
            return null;
        }).flat().filter(Boolean);
    } else if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
             const childResults = flattenRoutes(obj[key]);
             flatResults = flatResults.concat(childResults);
        }
    }
    return flatResults;
}

const PLAYGROUND_ENDPOINTS = {
    search: flattenRoutes(API_ROUTES.search),
    lyrics: flattenRoutes(API_ROUTES.lyrics),
    tools: flattenRoutes(API_ROUTES.tools),
    info: flattenRoutes(API_ROUTES.info),
    profile: flattenRoutes(API_ROUTES.profile),
    music: flattenRoutes(API_ROUTES.music)
};

import { setGlobalDispatcher, Agent, buildConnector } from 'undici';
import tls from 'tls';


const defaultCiphers = tls.DEFAULT_CIPHERS.split(':');
const shuffledCiphers = [
    defaultCiphers[1],
    defaultCiphers[2],
    defaultCiphers[0],
    ...defaultCiphers.slice(3)
].join(':');


const firefoxCiphers = [
    'TLS_AES_128_GCM_SHA256',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_256_GCM_SHA384',
    'ECDHE-ECDSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-ECDSA-CHACHA20-POLY1305',
    'ECDHE-RSA-CHACHA20-POLY1305',
    'ECDHE-ECDSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-ECDSA-AES256-SHA',
    'ECDHE-ECDSA-AES128-SHA',
    'ECDHE-RSA-AES128-SHA',
    'ECDHE-RSA-AES256-SHA',
    'AES128-GCM-SHA256',
    'AES256-GCM-SHA384',
    'AES128-SHA',
    'AES256-SHA'
].join(':');


const connector = buildConnector({
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2',
    ciphers: firefoxCiphers,        
    ALPNProtocols: ['h2', 'http/1.1'],  
    maxCachedSessions: 10,          
    noDelay: true,
    keepAlive: true
});

setGlobalDispatcher(new Agent({
    allowH2: true,
    connect: connector,            
    headersTimeout: 60000,
    bodyTimeout: 60000,
    connectTimeout: 60000,
    keepAliveTimeout: 60000
}));

const { generate_hash, buildId: buildIdConfig, restrictLocal } = config;


const app = new Hono({ strict: false });

app.use('*', (c: Context, next: Next) => {
    if (c.req.header('user-agent')?.startsWith('Mozilla/5.0')) {
        return compress({ encoding: 'gzip', threshold: 0 })(c, next);
    }
    return compress()(c, next);
});

const challengeHtml = (verifyUrl: string) => `
<!DOCTYPE html>
<html style="background:#000">
<head>
    <title>Please wait</title>
</head>
<body style="background:#000;margin:0">
    <script>
    (function() {
    if (document.readyState !== 'loading') {
        executeChallenge();
    } else {
        document.addEventListener('DOMContentLoaded', executeChallenge);
    }
    function executeChallenge() {
        fetch('${verifyUrl}', { method: 'POST' }).then((r) => r.ok ? window.location.href = window.location.pathname : null).catch();
    }
    })();
    </script>
</body>
</html>
`;
const testhtml = `<!DOCTYPE html><html lang="en"><script>null</script><body>Please wait</body></html>`;

app.use('*', async (c: Context, next: Next) => {
    if(restrictLocal) {
        const host = c.req.header('host');
        const h = host?.split(':')[0];
        const isLocal = h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || 
                        h?.startsWith('192.168.') || h?.startsWith('10.') || h?.startsWith('172.');
        const isAllowed = host === 'api.vgjr.top' || host === 'vgjr.vercel.app';

        if (!isAllowed && !isLocal) {
            const isMozilla = c.req.header('user-agent')?.startsWith('Mozilla/5.0');
            if(!isMozilla || (c.req.header('Accept') === 'application/json')) return c.text('Forbidden', 403);
            const url = new URL(c.req.url);
            url.host = 'api.vgjr.top';
            url.protocol = 'https:';
            if (url.pathname === '/') url.pathname = '/playground';

            c.header('Refresh', `0; url=${url.toString()}`);
            return c.body('', 200, { 'Content-Type': 'application/json' });
        }
    }
    if(getCookie(c, 'cf_clearance')) {
        const expiry = 'Thu, 01 Jan 1970 00:00:00 GMT';
        const domain = '.vgjr.top';
        c.header('Set-Cookie', `cf_clearance=; Max-Age=0; Expires=${expiry}; Domain=${domain}; Path=/; Secure; HttpOnly; SameSite=None; Partitioned;`, { append: true });
        c.header('Set-Cookie', `cf_clearance=; Max-Age=0; Expires=${expiry}; Path=/; Secure; HttpOnly; SameSite=None; Partitioned;`, { append: true });
    }

    const currentUrl = new URL(c.req.url);
    const currentHost = currentUrl.host;
    const currentHostname = currentUrl.hostname;
    const queries = c.req.query();
    for (const key in queries) {
        const val = queries[key];
        if (val && (val.startsWith('http://') || val.startsWith('https://'))) {
            try {
                const parsed = new URL(val);
                if (
                    parsed.host === currentHost || 
                    parsed.hostname === currentHostname ||
                    parsed.hostname === 'api.vgjr.top' || 
                    parsed.hostname === 'localhost' || 
                    parsed.hostname === '127.0.0.1' ||
                    parsed.hostname === '[::1]' ||
                    parsed.hostname === 'vgjr.vercel.app'
                ) {
                    return c.json({ error: "Query not allowed" });
                }
            } catch {}
        }
    }

    await next();
});



const port = 3000;
const starttime = Date.now();

if (typeof Bun !== "object") {
    serve({
        fetch: app.fetch,
        port: port,
        hostname: "127.0.0.1"
    }, (info) => {
        console.log(`\n🚀 Server is running!`);
        console.log(`🏠 Local:    http://localhost:${port}/playground`);
    });
} else {

    console.log(`\n🚀 Bun Server is running!`);
    console.log(`🏠 Local:    http://localhost:${port}/playground`);
}


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const robots = fs.readFileSync(path.join(__dirname, 'public/robots.txt'), 'utf-8');
const favicon = fs.readFileSync(path.join(__dirname, 'public/favicon.ico'));
const playgroundTemplate = fs.readFileSync(path.join(__dirname, 'html/playground.html'), 'utf-8')
    .replace(/<!--[\s\S]*?-->/g, '') 
    .replace(/\s+/g, ' ') 
    .replace(/>\s+</g, '><') 
    .trim();


const mainJs = fs.readFileSync(path.join(__dirname, 'html/main.js'), 'utf-8');


const rawCss = fs.readFileSync(path.join(__dirname, 'html/main.css'), 'utf-8');
const mainCss = rawCss
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .trim();

const BUILD_ID = buildIdConfig === true
    ? crypto.randomBytes(7).toString('base64url')
    : (typeof buildIdConfig === 'string' ? buildIdConfig : null);


function encryptPayload(data: string, secret: string): string {
    try {
        const key = crypto.createHash('sha256').update(secret).digest();
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return Buffer.concat([iv, encrypted, tag]).toString('base64url');
    } catch { return ""; }
}

function decryptPayload(payload: string, secret: string): string {
    try {
        const data = Buffer.from(payload, 'base64url');
        if (data.length < 28) return ""; 
        const key = crypto.createHash('sha256').update(secret).digest();
        const iv = data.subarray(0, 12);
        const tag = data.subarray(data.length - 16);
        const encrypted = data.subarray(12, data.length - 16);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch { return ""; }
}


function isLocalRequest(host: string | undefined): boolean {
    if (!host) return false;
    const h = host.split(':')[0];
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' ||
           h.startsWith('192.168.') || h.startsWith('10.') || h.startsWith('172.');
}

app.use('*', cors({
    credentials: true,
    origin: '*',
    exposeHeaders: ['X-Route']
}));

if (BUILD_ID) {
    const apiPrefixes = ['search', 'lyrics', 'tools', 'info', 'music'];
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
    c.header('Cache-Control', 'public, max-age=60');
    c.header('Content-Type', 'image/x-icon');
    return c.body(favicon);
});

app.get('/robots.txt', (c: Context) => {
    c.header('Cache-Control', 'public, max-age=60');
    return c.text(robots, 200);
});

app.get('/tools/health', (c: Context) => {
    c.header('Cache-Control', 'public, max-age=60, immutable');
    return c.text('OK', 200);
});

/*
app.post('/playground.verify/aaol/:headers/2/:random', (c: Context) => {
    try {
        if(c.req.header('Accept') === 'application/json') {
            return c.text('Forbidden', 403);
        }
        c.header('Cache-Control', 'public, max-age=86400, no-transform, must-revalidate');
        return c.body(null, 200);
    } catch (e) {
        return c.body(null, 403);
    }
});
*/

app.get('/playground', (c: Context) => {
    if(c.req.header('Accept') === 'application/json') {
        return c.text('Forbidden', 403);
    }

    const host = (c.req.header('host') || '').toLowerCase();

    c.header('Content-Type', 'text/html');
    c.header('Vary', 'Referer');
    c.header('Cache-Control', 'public, max-age=86400, no-transform, must-revalidate');

    return stream(c, async (s) => {
        await s.write(''); // Initial flush
        
        const isLocal = isLocalRequest(host);
        const apiBaseUrl = isLocal ? `http://${host}` : 'https://api.vgjr.top';
        const secFetchDest = c.req.header('Sec-Fetch-Dest');
        if(secFetchDest && secFetchDest !== 'document') return;

        let html = playgroundTemplate
            .replace('{{SSR_STATE}}', () => `<script>window.API_BASE_URL = "${apiBaseUrl}"; window.SERVER_ENDPOINTS = ${JSON.stringify(PLAYGROUND_ENDPOINTS)};</script>`);

        await s.write(html);
    });
});

app.get('/playground/main.js', (c: Context) => stream(c, async (s) => {
    const host = (c.req.header('host') || '').toLowerCase();
    const referer = c.req.header('referer') || '';
    const refPath = referer.split('?')[0].replace(/\/$/, '');
    
    c.header('Cache-Control', 'public, max-age=86400, no-transform, must-revalidate');
    c.header('Content-Type', 'application/javascript');
    await s.write('');
    
    const secFetchDest = c.req.header('Sec-Fetch-Dest');
    if(secFetchDest && secFetchDest !== 'script') return;

    await s.write(mainJs);
}));

app.get('/playground/main.css', (c: Context) => stream(c, async (s) => {
    const host = (c.req.header('host') || '').toLowerCase();
    const referer = c.req.header('referer') || '';
    const refPath = referer.split('?')[0].replace(/\/$/, '');
    
    c.header('Cache-Control', 'public, max-age=86400, no-transform, must-revalidate');
    c.header('Content-Type', 'text/css');
    await s.write('');
    
    const secFetchDest = c.req.header('Sec-Fetch-Dest');
    if(secFetchDest && secFetchDest !== 'style') return;
    
    await s.write(mainCss);
}));

app.get('/', (c: Context) => {
    const isMozilla = c.req.header('user-agent')?.startsWith('Mozilla/5.0');
    c.header('X-Net', isMozilla ? 'true' : 'false');
    const renderJson = c.req.query('json') !== undefined || c.req.header('accept')?.includes('application/json');
    const typeRender = renderJson ? 'application/json' : 'text/plain';
    c.header('Content-Type', typeRender);
    c.header('Cache-Control', 'public, max-age=0, must-revalidate');

    return stream(c, async (stream) => {
        await stream.write('');
        const seconds = Math.floor((Date.now() - starttime) / 1000);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const uptime = [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');

        const listapi = [{
            source: [{
                title: "Source Code",
                url: "https://github.com/GreenVGJR/api"
            },
            {
                title: "Playground",
                url: "https://api.vgjr.top/playground"
            }],
            domRendering: typeRender,
            uptime: uptime,
            service: "Hono",
            runtime: typeof Bun !== "object" ? "Node.js" : "Bun",
            fallback_runtime: typeof Bun === "object" ? "Node.js" : "Bun",
        },
        {
            routes: API_ROUTES
        }];

        stream.onAbort(() => {
            return;
        });

        await stream.write(renderJson ? JSON.stringify(listapi) : JSON.stringify(listapi, null, 2));
    });
});

const routeBase = BUILD_ID ? `/${BUILD_ID}` : '';
const apiPrefixesRoute = ['/search', '/lyrics', '/tools', '/info', '/profile', '/music'];

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
profile.forEach((val: any) => {
    app.route(`${routeBase}/profile`, val);
});
download.forEach((val: any) => {
    app.route(`${routeBase}/download`, val);
});
music.forEach((val: any) => {
    app.route(`${routeBase}/music`, val);
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
    port: port,
    hostname: "127.0.0.1",
    fetch: app.fetch,
    idleTimeout: 0
};