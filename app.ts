import { fileURLToPath } from 'url';
import { Hono, Context, Next } from 'hono';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { stream } from 'hono/streaming';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import config from './config.json' with { type: 'json' };
import os from 'os';

const honoVersion = (() => { try { return JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'node_modules/hono/package.json'), 'utf-8')).version; } catch { return '?'; } })();

import reqs from './routes/search/index.js';
import lyrics from './routes/lyrics/index.js';
import tools from './routes/tools/index.js';
import info from './routes/info/index.js';
import profile from './routes/profile/index.js';
import download from './routes/download/index.js';
import music from './routes/music/index.js';

const API_ROUTES = {
    search: [
        "/search/youtube/video?q=&mix=",
        "/search/youtube/music?q=&mix=",
        "/search/youtube/channel?q=",
        "/search/youtube/playlist?q=",
        "/search/crunchyroll?q=",
        "/search/soundcloud?q=",
        "/search/spotify?q=",
        "/search/applemusic?q=",
        "/search/shazam?q=",
        "/search/deezer?q=",
        "/search/tidal?q=",
        "/search/tidal/v2?q=",
        "/search/genius?q=",
        "/search/audiomack?q=&type=",
        "/search/pinterest?q=",
        "/search/google?q=",
        "/search/googleImage?q=&sort=",
        "/search/googleImage/cse?q=",
        "/search/duckduckgo?q=",
        "/search/safebooru?q=",
        "/search/konachan?q=",
        "/search/imdb?q=",
        "/search/tumblr?q=",
        "/search/imgflip?q=",
        "/search/flickr?q=",
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
        "/search/giphy/v2?q=&type=",
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
        "/lyrics/shazam?q=",
        "/lyrics/tidal?q=",
        "/lyrics/spotify?q="
    ],
    tools: {
        ai: {
            chat: [
                "/tools/chat/gemini?prompt=&conversation=",
                "/tools/chat/meta?prompt=&conversation=",
                "/tools/chat/grok?prompt=",
                "/tools/chat/gpt?prompt=&conversation="
            ],
            image_generation: [
                "/tools/ai-image/flux_schnell?prompt=",
                "/tools/ai-image/magicstudio?prompt=",
            ],
        },
        misc: [
            "/tools/translate?q=&from=&to=",
            "/tools/timezone?q=",
            "/tools/emoji?q=&limit=",
            "/tools/emoji/kitchen?q1=&q2=&imageOnly="
        ],
        db: [
            "/tools/db/get?q=&hash=",
            "/tools/db/getAll?q=&hash=",
            "/tools/db/delete?q=&hash=",
            "/tools/db/set?name=&value=&hash="
        ],
        discord: {
            stream: [
                "/tools/discord/stream?token=&channelId=&messageId=&url=&name=&clone=&onEmbed=&fallbackEmbed="
            ],
            tiktok: [
                "/tools/discord/tiktokFeed?token=&channelId=&messageId=&region_code="
            ],
            server: [
                "/tools/discord/modifyServer?token=&guildId=&reason=&guildName=&guildDescription=&guildVerifyLevel=&guildIcon=&guildSplash=&guildBanner=",
                "/tools/discord/infoServer?token=&guildId=",
            ],
            member: [
                "/tools/discord/modifyMemberServer?token=&guildId=&nickname=&avatar=&banner=&bio=&reason=",
                "/tools/discord/infoMember?token=&userId=&guildId=",
                "/tools/discord/listMember?token=&guildId=&limit=&type=&permission=",
            ],
            channel: [
                "/tools/discord/listChannel?token=&guildId=&limit=&type=",
                "/tools/discord/infoChannel?token=&channelId=&guildId=",
            ],
            role: [
                "/tools/discord/listRoles?token=&guildId=&limit=&type=&permission=",
                "/tools/discord/infoRole?token=&roleId=&guildId=",
            ],
            invite: [
                "/tools/discord/infoInvite?q=&token=&guildId=",
                "/tools/discord/listInvite?token=&guildId=&limit=&type=&authorId="
            ],
            sticker: [
                "/tools/discord/infoSticker?token=&q="
            ],
            webhook: [
                { create: ["/tools/discord/webhook/create?token=&channelId=&name=&avatar="] },
                { info: ["/tools/discord/webhook/info?token=&webhookId=&webhookToken=&webhookUrl="] },
                { delete: ["/tools/discord/webhook/delete?token=&webhookId=&webhookToken=&webhookUrl="] },
                { send: ["/tools/discord/webhook/send?webhookId=&webhookToken=&webhookUrl=&content=&username=&avatar="] },
                { list: ["/tools/discord/webhook/list?token=&channelId="] },
                { listGuild: ["/tools/discord/listWebhooks?token=&guildId=&type="] }
            ],
            message: [
                "/tools/discord/infoMessage?token=&channelId=&messageId=",
                "/tools/discord/infoMessages?token=&channelId=&sort=&limit="
            ],
            voice: [
                "/tools/discord/voice/deafen?token=&guildId=&userId=",
                "/tools/discord/voice/undeafen?token=&guildId=&userId=",
                "/tools/discord/voice/mute?token=&guildId=&userId=",
                "/tools/discord/voice/unmute?token=&guildId=&userId=",
                "/tools/discord/voice/kick?token=&guildId=&userId=",
                "/tools/discord/voice/move?token=&guildId=&userId=&toChannelId=",
                "/tools/discord/voice/muteall?token=&guildId=&channelId=&authorId=",
                "/tools/discord/voice/unmuteall?token=&guildId=&channelId=&authorId=",
                "/tools/discord/voice/deafall?token=&guildId=&channelId=&authorId=",
                "/tools/discord/voice/undeafall?token=&guildId=&channelId=&authorId=",
                "/tools/discord/voice/kickall?token=&guildId=&channelId=&authorId=",
                "/tools/discord/voice/moveall?token=&guildId=&channelId=&toChannelId=&authorId=",
                "/tools/discord/voice/list?token=&guildId=&channelId=",
                "/tools/discord/voice/setStatus?token=&channelId=&content="
            ]
        },
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
        "/music/play?token=&q=&platform=&voiceId=&guildId=&authorId=&isDeaf=&247=&fallback=",
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
        "/music/stats?token=",
        "/music/filter?token=&guildId=&filter=",
        "/music/voiceStatus?token=&guildId=&type=&status=&content=",
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

setGlobalDispatcher(new Agent({
    connections: 100,           // Max concurrent connections
    keepAliveTimeout: 60_000,   // Keep them alive for 60s
    pipelining: 1,              // Number of requests per connection
}));

const { generate_hash, buildId: buildIdConfig, restrictLocal } = config;

const app = new Hono({ strict: false });

app.use('*', (c: Context, next: Next) => {
    return compress({ encoding: 'gzip', threshold: 0 })(c, next);
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
    if (restrictLocal) {
        const host = c.req.header('host');
        const h = host?.split(':')[0];
        const isLocal = h === 'localhost' || h === '127.0.0.1' || h === '[::1]' ||
            h?.startsWith('192.168.') || h?.startsWith('10.') || h?.startsWith('172.');
        const isAllowed = host === 'api.vgjr.top' || host === 'vgjr.vercel.app';

        if (!isAllowed && !isLocal) {
            const isMozilla = c.req.header('user-agent')?.startsWith('Mozilla/5.0');
            if (!isMozilla || (c.req.header('Accept') === 'application/json')) return c.text('Forbidden', 403);
            const url = new URL(c.req.url);
            url.host = 'api.vgjr.top';
            url.protocol = 'https:';
            if (url.pathname === '/') url.pathname = '/playground';

            c.header('Refresh', `0; url=${url.toString()}`);
            return c.body('', 200, { 'Content-Type': 'application/json' });
        }
    }
    if (getCookie(c, 'cf_clearance')) {
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
            } catch { }
        }
    }

    await next();
});



const starttime = (globalThis as any).__vgjr_starttime || Date.now();


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
const cfJs = fs.readFileSync(path.join(__dirname, 'html/cf.js'), 'utf-8');


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
    origin: (origin) => origin,
    credentials: true,
    exposeHeaders: ['X-Route'],
    allowMethods: ['GET', 'OPTIONS'],
    allowHeaders: ['*'],
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
    c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    c.header('Content-Type', 'image/x-icon');
    return c.body(favicon);
});

app.get('/robots.txt', (c: Context) => {
    c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    c.header('Content-Type', 'text/plain');
    return c.text(robots, 200);
});

app.get('/tools/health', (c: Context) => {
    c.header('Cache-Control', 'public, max-age=60');
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
    const host = (c.req.header('host') || '').toLowerCase();

    c.header('Content-Type', 'text/html');
    c.header('Cache-Control', 'public, no-transform, max-age=3600, stale-while-revalidate=86400');

    return stream(c, async (s) => {
        await s.write(''); // Initial flush

        const secFetchDest = c.req.header('Sec-Fetch-Dest');
        if (secFetchDest && secFetchDest !== 'document') return;

        await s.write(playgroundTemplate);
    });
});

app.get('/playground/main.js', (c: Context) => stream(c, async (s) => {
    c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    c.header('Content-Type', 'application/javascript');

    const host = (c.req.header('host') || '').toLowerCase();
    const isLocal = isLocalRequest(host);
    const apiBaseUrl = isLocal ? `http://${host}` : 'https://api.vgjr.top';

    const stateJs = `window.API_BASE_URL = "${apiBaseUrl}"; window.SERVER_STARTTIME = ${starttime}; window.SERVER_ENDPOINTS = "${btoa(JSON.stringify(PLAYGROUND_ENDPOINTS))}";`;
    const finalJs = mainJs.replace('{{SSR_STATE}}', stateJs);

    await s.write(finalJs);
}));

app.get('/playground/cf.js', (c: Context) => stream(c, async (s) => {
    c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    c.header('Content-Type', 'application/javascript');
    await s.write(cfJs);
}));

app.get('/playground/main.css', (c: Context) => stream(c, async (s) => {
    c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    c.header('Content-Type', 'text/css');
    await s.write(mainCss);
}));

app.get('/', (c: Context) => stream(c, async (l) => {
    const isMozilla = c.req.header('user-agent')?.startsWith('Mozilla/5.0');
    c.header('X-Net', isMozilla ? 'true' : 'false');
    const renderJson = c.req.query('json') !== undefined || c.req.header('accept')?.includes('application/json');
    const typeRender = renderJson ? 'application/json' : 'text/plain';
    c.header('Content-Type', typeRender);
    c.header('Cache-Control', 'public, max-age=0, must-revalidate');
    if (!renderJson) c.header('Location', '/playground');

    c.status(renderJson ? 200 : 302);
    await l.write('');

    const seconds = Math.floor((Date.now() - starttime) / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const uptime = [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
    const os_seconds = Math.floor(os.uptime());
    const os_h = Math.floor(os_seconds / 3600);
    const os_m = Math.floor((os_seconds % 3600) / 60);
    const os_s = os_seconds % 60;
    const os_uptime = [os_h, os_m, os_s].map(v => v.toString().padStart(2, '0')).join(':');

    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    const cpu = `${(cpuUsage * 100).toFixed(1)}%`;
    const usedRam = Math.round((os.totalmem() - os.freemem()) / (1024 * 1024));
    const totalRam = Math.round(os.totalmem() / (1024 * 1024));
    const ram = `${usedRam.toLocaleString()}MB / ${totalRam.toLocaleString()}MB`;
    let clientHeaders = c.req.header();
    delete clientHeaders?.['x-client-secret'];

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
        os_uptime: os_uptime,
        service: `Hono v${honoVersion}`,
        runtime: "Bun v" + (Bun as any).version,
        stats: {
            cpu: cpu,
            ram: ram,
            restart_count: String((globalThis as any).__vgjr_refresh_count || 0),
            last_restart: String((globalThis as any).__vgjr_last_reload || 0)
        }
    },
    {
        routes: API_ROUTES,
        _visitor: clientHeaders
    }];

    await l.write(renderJson ? JSON.stringify(listapi) : JSON.stringify(listapi, null, 2));
}));

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
        return c.body(null, 404);
    }
    await next();
});

export default app;
