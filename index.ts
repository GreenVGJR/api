import { setGlobalDispatcher, Agent } from 'undici';
import { fileURLToPath } from 'url';
import { Hono, Context, Next } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { stream } from 'hono/streaming';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import config from './config.json';

// @ts-ignore
import reqs_raw from './routes/search/index';
// @ts-ignore
import lyrics_raw from './routes/lyrics/index';
// @ts-ignore
import tools_raw from './routes/tools/index';
// @ts-ignore
import info_raw from './routes/info/index';

const reqs: any[] = reqs_raw;
const lyrics: any[] = lyrics_raw;
const tools: any[] = tools_raw;
const info: any[] = info_raw;

setGlobalDispatcher(new Agent({
    connect: {
        family: 4
    }
}));


const app = new Hono({ strict: false });

const port = 3000;
const starttime = Date.now();

if(typeof Bun !== "object") {
    serve({
        fetch: app.fetch,
        port: port
        // @ts-ignore
    }, async (info) => {
        console.log(`Listening on ${port}`);
    });
}
// For Bun, we rely on the `export default app` at the end of the file.
// Bun automatically serves any object with a `fetch` method exported as default.


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const robots = fs.readFileSync(path.join(__dirname, 'public/robots.txt'), 'utf-8');
const favicon = fs.readFileSync(path.join(__dirname, 'public/favicon.ico'));
const { generate_hash, buildId: buildIdConfig } = config;

const BUILD_ID = buildIdConfig === true 
    ? crypto.randomBytes(7).toString('base64url')
    : (typeof buildIdConfig === 'string' ? buildIdConfig : null);

app.use('*', compress());

app.use('*', cors({
    credentials: true,
    origin: '*',
    exposeHeaders: ['X-Route']
}));

if (BUILD_ID) {
    const apiPrefixes = ['search', 'lyrics', 'tools', 'info'];
    const excludedPaths = ['favicon.ico', 'robots.txt'];
    
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
                return c.json({error: "Signature mismatch"}, 403);
            }
        }
        
        await next();
    });
}

app.get('/favicon.ico', (c: Context) => {
    c.header('Content-Type', 'image/x-icon');
    return c.body(favicon);
});

app.get('/robots.txt', (c: Context) => {
    return c.text(robots, 200);
});

app.get('/', (c: Context) => {
    const isMozilla = c.req.header('user-agent')?.startsWith('Mozilla/5.0');
    const renderJson = c.req.query('json') !== undefined;
    const typeRender = renderJson ? 'application/json' : 'text/plain';
    c.header('Content-Type', typeRender);
    c.header('X-Net', isMozilla ? 'true' : 'false');

    return stream(c, async (stream) => {
        await stream.write('');
        const listapi = [{
                domRendering: typeRender,
                uptime: new Date(Date.now() - starttime).toISOString().slice(11,19),
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
                    "/search/reddit/media?q=",
                    "/search/roblox/games?q=",
                    "/search/roblox/audio?q=",
                    "/search/bandcamp?q=",
                    "/search/capcut/templates?q="
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
                            "/tools/discord/webhook/info?webhookUrl="
                        ],
                        [
                        "/tools/discord/webhook/delete?token=&webhookId=",
                        "/tools/discord/webhook/delete?webhookToken=&webhookId=",
                        "/tools/discord/webhook/delete?webhookUrl="
                        ],
                        [
                        "/tools/discord/webhook/send?webhookId=&webhookToken=&content=&username=&avatar=",
                        "/tools/discord/webhook/send?webhookUrl=&content=&username=&avatar="
                        ]
                        ]
                    },
                    image_generation: [
                        "/tools/ai-image/flux_demo?prompt=",
                        "/tools/ai-image/magicstudio?prompt="
                    ],
                    misc: [
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
                    "/info/threads/user?q="
                ]
            }
        }];

        stream.onAbort(() => {
            return;
        });

        await stream.write(JSON.stringify(listapi, null, 2));
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
        return c.text('Not Found', 404);
    }
    await next();
});

export default app;
