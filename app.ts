import { fileURLToPath } from 'url';
import { Hono, Context, Next } from 'hono';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { stream } from 'hono/streaming';
import { getCookie } from 'hono/cookie';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import config from './config.json' with { type: 'json' };
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const startupDataPromise = Promise.all([
    import('./routes/search/index.js'),
    import('./routes/lyrics/index.js'),
    import('./routes/tools/index.js'),
    import('./routes/info/index.js'),
    import('./routes/profile/index.js'),
    import('./routes/download/index.js'),
    import('./routes/music/index.js'),
    fs.readFile(path.join(__dirname, 'node_modules/hono/package.json'), 'utf-8').catch(() => ''),
    fs.readFile(path.join(__dirname, 'public/robots.txt'), 'utf-8'),
    fs.readFile(path.join(__dirname, 'public/favicon.ico')),
    fs.readFile(path.join(__dirname, 'html/playground.html'), 'utf-8'),
    fs.readFile(path.join(__dirname, 'html/main.js'), 'utf-8'),
    fs.readFile(path.join(__dirname, 'html/cf.js'), 'utf-8'),
    fs.readFile(path.join(__dirname, 'html/sw.js'), 'utf-8'),
    fs.readFile(path.join(__dirname, 'html/backChallenge.html'), 'utf-8'),
    fs.readFile(path.join(__dirname, 'html/main.css'), 'utf-8'),
] as const);

const API_ROUTES = {
    search: [
        ["/search/google?q=", "string"],
        ["/search/googleImage?q=&sort=", "string", "enum:relevance,latest"],
        ["/search/googleImage/cse?q=", "string"],
        ["/search/duckduckgo?q=", "string"],
        ["/search/duckduckgo/image?q=", "string"],
        ["/search/duckduckgo/video?q=", "string"],
        ["/search/youtube/video?q=&mix=", "string", "boolean"],
        ["/search/youtube/music?q=&mix=", "string", "boolean"],
        ["/search/youtube/channel?q=", "string"],
        ["/search/youtube/playlist?q=", "string"],
        ["/search/soundcloud?q=", "string"],
        ["/search/spotify?q=", "string"],
        ["/search/applemusic?q=", "string"],
        ["/search/shazam?q=", "string"],
        ["/search/deezer?q=", "string"],
        ["/search/jiosaavn?q=", "string"],
        ["/search/tidal?q=", "string"],
        ["/search/tidal/v2?q=", "string"],
        ["/search/genius?q=", "string"],
        ["/search/audiomack?q=&type=", "string", "enum:songs,albums,playlists,artists"],
        ["/search/bandcamp?q=", "string"],
        ["/search/crunchyroll?q=", "string"],
        ["/search/imdb?q=", "string"],
        ["/search/pinterest?q=", "string"],
        ["/search/safebooru?q=", "string"],
        ["/search/konachan?q=", "string"],
        ["/search/tumblr?q=", "string"],
        ["/search/imgflip?q=", "string"],
        ["/search/imgur/posts?q=", "string"],
        ["/search/flickr?q=", "string"],
        ["/search/istockphoto?q=", "string"],
        ["/search/vectorstock?q=", "string"],
        ["/search/stockcake?q=", "string"],
        ["/search/pixabay?q=", "string"],
        ["/search/unsplash?q=", "string"],
        ["/search/pexels?q=", "string"],
        ["/search/pixiv?q=", "string"],
        ["/search/otodb?q=", "string"],
        ["/search/bilibili?q=", "string"],
        ["/search/twitch?q=", "string"],
        ["/search/discord/discovery/apps?q=", "string"],
        ["/search/discord/discovery/servers?q=", "string"],
        ["/search/capcut/templates?q=", "string"],
        ["/search/tiktok/feed"],
        ["/search/tiktok/video?q=", "string"],
        ["/search/tiktok/music?q=", "string"],
        ["/search/tiktok/users?q=", "string"],
        ["/search/reddit/media?q=", "string"],
        ["/search/roblox/games?q=", "string"],
        ["/search/roblox/audio?q=", "string"],
        ["/search/tenor?q=&type=", "string", "enum:all,sticker,meme"],
        ["/search/giphy?q=&type=", "string", "enum:gif,sticker,clip"],
        ["/search/giphy/v2?q=&type=", "string", "enum:gif,sticker,clip"],
        ["/search/klipy?q=&type=", "string", "enum:gif,sticker,clip,emoji,ai_gif"],
        ["/search/patreon?q=", "string"],
        ["/search/trakteer?q=", "string"],
        ["/search/threads/users?q=", "string"],
    ],
    profile: [
        ["/profile/guns?q=", "string"],
        ["/profile/drift?q=", "string"],
        ["/profile/haunt?q=", "string"],
        ["/profile/rage?q=", "string"],
        ["/profile/saweria?q=", "string"],
        ["/profile/trakteer?q=", "string"],
        ["/profile/sociabuzz?q=", "string"],
        ["/profile/patreon?q=", "string"]
    ],
    lyrics: [
        ["/lyrics/youtube?q=", "string"],
        ["/lyrics/deezer?q=", "string"],
        ["/lyrics/shazam?q=", "string"],
        ["/lyrics/tidal?q=", "string"],
        ["/lyrics/spotify?q=", "string"]
    ],
    tools: {
        ai: {
            chat: [
                ["/tools/chat/gemini?prompt=&conversation=", "string", "string"],
                ["/tools/chat/gpt?prompt=&conversation=", "string", "string"]
            ],
            image_generation: [
                ["/tools/ai-image/flux_schnell?prompt=", "string"],
                ["/tools/ai-image/magicstudio?prompt=", "string"],
            ],
        },
        misc: [
            ["/tools/translate?q=&from=&to=", "string", "string", "string"],
            ["/tools/timezone?q=", "string"],
            ["/tools/emoji?q=&limit=", "string", "number"],
            ["/tools/emoji/kitchen?q1=&q2=&imageOnly=", "string", "string", "boolean"],
            ["/tools/md5?q=", "string"]
        ],
        db: [
            ["/tools/db/get?q=&hash=", "string", "string"],
            ["/tools/db/getAll?q=&hash=", "string", "string"],
            ["/tools/db/delete?q=&hash=", "string", "string"],
            ["/tools/db/set?name=&value=&hash=", "string", "string", "string"]
        ],
        discord: {
            stream: [
                ["/tools/discord/stream?token=&channelId=&messageId=&url=&name=&clone=&onEmbed=&fallbackEmbed=", "string", "number", "number", "url", "string", "boolean", "boolean", "boolean"]
            ],
            tiktok: [
                ["/tools/discord/tiktokFeed?token=&channelId=&messageId=&region_code=", "string", "number", "number", "string"]
            ],
            server: [
                ["/tools/discord/modifyServer?token=&guildId=&reason=&guildName=&guildDescription=&guildVerifyLevel=&guildIcon=&guildSplash=&guildBanner=", "string", "number", "string", "string", "string", "number", "url", "url", "url"],
                ["/tools/discord/infoServer?token=&guildId=", "string", "number"],
                ["/tools/discord/infoAutomod?token=&guildId=", "string", "number"],
                ["/tools/discord/setAutomod?token=&guildId=&ruleId=&name=&eventType=&triggerType=&enabled=&keywordFilter=&regexPatterns=&presets=&allowList=&mentionTotalLimit=&mentionRaidProtection=&actions=&actionType=&alertChannelId=&timeoutSeconds=&customMessage=&exemptRoles=&exemptChannels=&reason=&payload=", "string", "number", "number", "string", "enum:MESSAGE_SEND,GUILD_MEMBER_JOIN_OR_UPDATE", "enum:KEYWORD,SPAM,KEYWORD_PRESET,MENTION_SPAM,MEMBER_PROFILE", "boolean", "string", "string", "enum:PROFANITY,SEXUAL_CONTENT,SLURS", "string", "number", "boolean", "json", "enum:BLOCK_MESSAGE,SEND_ALERT_MESSAGE,TIMEOUT,BLOCK_MEMBER_INTERACTION", "number", "number", "string", "string", "string", "string", "json"],
            ],
            member: [
                ["/tools/discord/modifyMemberServer?token=&guildId=&nickname=&avatar=&banner=&bio=&reason=", "string", "number", "string", "url", "url", "string", "string"],
                ["/tools/discord/infoMember?token=&userId=&guildId=", "string", "number", "number"],
                ["/tools/discord/listMember?token=&guildId=&limit=&type=&permission=", "string", "number", "number", "enum:user,bot,all,oldest,newest,no_role,has_role,banned", "string"],
                ["/tools/discord/listMember/role?token=&guildId=&roleId=&type=&permission=", "string", "number", "number", "enum:user,bot,all,oldest,newest,oldest_position,newest_position", "string"],
            ],
            channel: [
                ["/tools/discord/listChannel?token=&guildId=&limit=&type=", "string", "number", "number", "enum:text,voice,category,announcement,announcement_thread,public_thread,private_thread,stage,directory,forum,media,threads,all"],
                ["/tools/discord/infoChannel?token=&channelId=&guildId=", "string", "number", "number"],
            ],
            role: [
                ["/tools/discord/listRoles?token=&guildId=&limit=&type=&permission=", "string", "number", "number", "enum:all,oldest,newest", "string"],
                ["/tools/discord/infoRole?token=&roleId=&guildId=", "string", "number", "number"],
            ],
            invite: [
                ["/tools/discord/infoInvite?q=&token=&guildId=", "string", "string", "number"],
                ["/tools/discord/listInvite?token=&guildId=&limit=&type=&authorId=", "string", "number", "number", "enum:user,bot,all,oldest,newest,temporary,permanent,has_expire", "number"]
            ],
            sticker: [
                ["/tools/discord/infoSticker?token=&q=", "string", "string"],
                ["/tools/discord/sticker/create?token=&guildId=&url=&name=&description=&tags=&reason=", "string", "number", "url", "string", "string", "string", "string"]
            ],
            webhook: [
                { create: [["/tools/discord/webhook/create?token=&channelId=&name=&avatar=", "string", "number", "string", "url"]] },
                { info: [["/tools/discord/webhook/info?token=&webhookId=&webhookToken=&webhookUrl=", "string", "number", "string", "url"]] },
                { delete: [["/tools/discord/webhook/delete?token=&webhookId=&webhookToken=&webhookUrl=", "string", "number", "string", "url"]] },
                { send: [["/tools/discord/webhook/send?webhookId=&webhookToken=&webhookUrl=&content=&username=&avatar=", "number", "string", "url", "string", "string", "url"]] },
                { list: [["/tools/discord/webhook/list?token=&channelId=", "string", "number"]] },
                { listGuild: [["/tools/discord/listWebhooks?token=&guildId=&type=", "string", "number", "enum:all,oldest,newest"]] }
            ],
            message: [
                ["/tools/discord/infoMessage?token=&channelId=&messageId=", "string", "number", "number"],
                ["/tools/discord/infoMessages?token=&channelId=&sort=&limit=", "string", "number", "enum:asc,desc", "number"]
            ],
            voice: [
                ["/tools/discord/voice/deafen?token=&guildId=&userId=", "string", "number", "number"],
                ["/tools/discord/voice/undeafen?token=&guildId=&userId=", "string", "number", "number"],
                ["/tools/discord/voice/mute?token=&guildId=&userId=", "string", "number", "number"],
                ["/tools/discord/voice/unmute?token=&guildId=&userId=", "string", "number", "number"],
                ["/tools/discord/voice/kick?token=&guildId=&userId=", "string", "number", "number"],
                ["/tools/discord/voice/move?token=&guildId=&userId=&toChannelId=", "string", "number", "number", "number"],
                ["/tools/discord/voice/muteall?token=&guildId=&channelId=&authorId=", "string", "number", "number", "number"],
                ["/tools/discord/voice/unmuteall?token=&guildId=&channelId=&authorId=", "string", "number", "number", "number"],
                ["/tools/discord/voice/deafall?token=&guildId=&channelId=&authorId=", "string", "number", "number", "number"],
                ["/tools/discord/voice/undeafall?token=&guildId=&channelId=&authorId=", "string", "number", "number", "number"],
                ["/tools/discord/voice/kickall?token=&guildId=&channelId=&authorId=", "string", "number", "number", "number"],
                ["/tools/discord/voice/moveall?token=&guildId=&channelId=&toChannelId=&authorId=", "string", "number", "number", "number", "number"],
                ["/tools/discord/voice/list?token=&guildId=&channelId=", "string", "number", "number"],
                ["/tools/discord/voice/setStatus?token=&channelId=&content=", "string", "number", "string"]
            ]
        },
    },
    info: [
        ["/info/youtube/video?url=", "url"],
        ["/info/youtube/channel?url=", "url"],
        ["/info/soundcloud?url=", "url"],
        ["/info/spotify?url=", "url"],
        ["/info/applemusic?url=", "url"],
        ["/info/twitter/user?q=", "string"],
        ["/info/twitter/tweet?url=", "url"],
        ["/info/reddit/subreddit?q=", "string"],
        ["/info/reddit/post?url=", "url"],
        ["/info/instagram/user?q=", "string"],
        ["/info/threads/user?q=", "string"],
        ["/info/tenor?url=", "url"],
        ["/info/giphy?url=", "url"],
        ["/info/tiktok/video?q=", "string"],
        ["/info/weather?q=", "string"],
        ["/info/pinterest?url=", "url"],
        ["/info/klipy?url=", "url"]
    ],
    download: [],
    music: [
        ["/music/connect?token=&voiceId=&guildId=&authorId=&isDeaf=&247=&force=", "string", "number", "number", "number", "boolean", "boolean", "boolean"],
        ["/music/disconnect?token=&guildId=", "string", "number"],
        ["/music/play?token=&q=&platform=&voiceId=&guildId=&authorId=&isDeaf=&247=&fallback=", "string", "string", "enum:youtube,youtubemusic,soundcloud,spotify,applemusic,deezer,tidal", "number", "number", "number", "boolean", "boolean", "boolean"],
        ["/music/pause?token=&guildId=", "string", "number"],
        ["/music/resume?token=&guildId=", "string", "number"],
        ["/music/skip?token=&guildId=&index=", "string", "number", "number"],
        ["/music/stop?token=&guildId=", "string", "number"],
        ["/music/seek?token=&guildId=&time=", "string", "number", "string"],
        ["/music/volume?token=&guildId=&value=", "string", "number", "number"],
        ["/music/loop?token=&guildId=&mode=", "string", "number", "enum:off,track,queue,autoplay,toggle,0,1,2,3"],
        ["/music/shuffle?token=&guildId=", "string", "number"],
        ["/music/remove?token=&guildId=&index=", "string", "number", "number"],
        ["/music/clear?token=&guildId=", "string", "number"],
        ["/music/jump?token=&guildId=&index=", "string", "number", "number"],
        ["/music/move?token=&guildId=&from=&to=", "string", "number", "number", "number"],
        ["/music/back?token=&guildId=", "string", "number"],
        ["/music/247?token=&guildId=&value=", "string", "number", "boolean"],
        ["/music/where?token=&guildId=&authorId=", "string", "number", "number"],
        ["/music/nowplaying?token=&guildId=", "string", "number"],
        ["/music/nowplaying/lyrics?token=&guildId=", "string", "number"],
        ["/music/queue?token=&guildId=&limit=&offset=", "string", "number", "number", "number"],
        ["/music/stats?token=", "string"],
        ["/music/filter?token=&guildId=&filter=", "string", "number", "enum:nightcore,vaporwave,speed,slow,chipmunk,deep,bassboost,bassboostlow,bassboosthigh,soft,trebleboost,rock,pop,electronic,classical,vocal,vocalonly,fullsound,gaming,8d,karaoke,tremolo,pulse,vibrato,wobble,lowpass,muffled,rotation,spin,distortion,channelmix,mono,wide,surround,left,right,reset"],
        ["/music/voiceStatus?token=&guildId=&type=&status=&content=", "string", "number", "enum:trackStart,queueEnd", "boolean", "string"],
    ]
};

function routeToEndpoint(route: string, types: string[] = []) {
    const parts = route.split('?');
    return {
        path: parts[0],
        query: parts.length > 1 ? '?' + parts[1] : '',
        types
    };
}

function flattenRoutes(obj: any): any[] {
    let flatResults: any[] = [];
    if (Array.isArray(obj)) {
        if (typeof obj[0] === 'string') {
            return [routeToEndpoint(obj[0], obj.slice(1).filter((type: any) => typeof type === 'string'))];
        }

        return obj.map(item => {
            if (typeof item === 'string') {
                return routeToEndpoint(item);
            } else if (Array.isArray(item) && typeof item[0] === 'string') {
                return routeToEndpoint(item[0], item.slice(1).filter((type: any) => typeof type === 'string'));
            } else if (typeof item === 'object' && item !== null) {
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
    download: flattenRoutes(API_ROUTES.download),
    music: flattenRoutes(API_ROUTES.music)
};

import { setGlobalDispatcher, Agent } from 'undici';

setGlobalDispatcher(new Agent({
    connections: 100,           
    keepAliveTimeout: 60_000,   
    pipelining: 1,              
}));

const { buildId: buildIdConfig, restrictLocal } = config;

const app = new Hono({ strict: false });

app.use('*', compress({ encoding: 'gzip' }));

app.use('*', async (c: Context, next: Next) => {
    if (restrictLocal) {
        const host = c.req.header('host');
        const isLocal = isLocalRequest(host);
        const isAllowed = host === 'api.vgjr.top';

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
                    parsed.hostname === '[::1]'
                ) {
                    return c.json({ error: "Query not allowed" });
                }
            } catch { }
        }
    }

    await next();
});

const starttime = (globalThis as any).__vgjr_starttime || Date.now();

const [
    reqsModule,
    lyricsModule,
    toolsModule,
    infoModule,
    profileModule,
    downloadModule,
    musicModule,
    honoPackageJson,
    robots,
    favicon,
    playgroundTemplateSource,
    mainJs,
    cfJs,
    playgroundSwJs,
    backChallengeTemplateSource,
    rawCss,
] = await startupDataPromise;

const reqs = reqsModule.default;
const lyrics = lyricsModule.default;
const tools = toolsModule.default;
const info = infoModule.default;
const profile = profileModule.default;
const download = downloadModule.default;
const music = musicModule.default;
const honoVersion = (() => { try { return JSON.parse(honoPackageJson).version; } catch { return '?'; } })();

const playgroundTemplate = playgroundTemplateSource
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();

const mainCss = rawCss
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .trim();

const BUILD_ID = buildIdConfig === true
    ? crypto.randomBytes(7).toString('base64url')
    : (typeof buildIdConfig === 'string' ? buildIdConfig : null);
const backChallengeHtml = backChallengeTemplateSource.trim();
const BACK_CHALLENGE_COOKIE = '_ftm';
const BACK_CHALLENGE_MAX_AGE = 10;
const BACK_CHALLENGE_PREFIXES = ['/search', '/profile', '/lyrics', '/tools', '/info', '/download', '/music'];

function getBackChallengeValue(c: Context): string {
    return crypto.createHash('md5').update(c.req.header('cf-connecting-ip') || '').digest('hex');
}

function getBackChallengeHtml(challengeValue: string, url: URL): string {
    return backChallengeHtml
        .replace('{{BACK_CHALLENGE_COOKIE}}', JSON.stringify(BACK_CHALLENGE_COOKIE))
        .replace('{{BACK_CHALLENGE_VALUE}}', JSON.stringify(challengeValue))
        .replace('{{BACK_CHALLENGE_MAX_AGE}}', String(BACK_CHALLENGE_MAX_AGE))
        .replace('{{BACK_CHALLENGE_SECURE}}', url.protocol === 'https:' ? 'true' : 'false');
}

function isBackChallengePath(pathname: string): boolean {
    let pathToCheck = pathname;
    if (BUILD_ID && pathToCheck.startsWith(`/${BUILD_ID}/`)) {
        pathToCheck = pathToCheck.slice(BUILD_ID.length + 1);
    }

    return BACK_CHALLENGE_PREFIXES.some((prefix) => pathToCheck === prefix || pathToCheck.startsWith(`${prefix}/`));
}

function isBrowserBackChallengeRequest(c: Context): boolean {
    const userAgent = c.req.header('user-agent') || '';
    const fetchMode = c.req.header('sec-fetch-mode');
    const accept = c.req.header('accept') || '';

    return c.req.method === 'GET'
        && userAgent.startsWith('Mozilla/5.0')
        && !userAgent.includes('Discordbot')
        && fetchMode !== 'same-origin'
        && (fetchMode === 'navigate' || accept.includes('text/html'));
}

function hostHeaderName(host: string | undefined): string {
    if (!host) return '';
    try { host = decodeURIComponent(host); } catch { }
    if (host.startsWith('[')) {
        const end = host.indexOf(']');
        if (end !== -1) return host.slice(0, end + 1).toLowerCase();
    }
    return host.split(':')[0].toLowerCase();
}

function isLocalRequest(host: string | undefined): boolean {
    const h = hostHeaderName(host);
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
    const excludedPaths = ['favicon.ico', 'robots.txt', 'playground', 'terms', 'privacy'];

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

app.use('*', async (c: Context, next: Next) => {
    const url = new URL(c.req.url);
    if (!isBackChallengePath(url.pathname)) {
        await next();
        return;
    }

    const challengeValue = getBackChallengeValue(c);
    if (getCookie(c, BACK_CHALLENGE_COOKIE) === challengeValue || !isBrowserBackChallengeRequest(c)) {
        await next();
        return;
    }

    c.header('Cache-Control', 'no-store');
    return c.html(getBackChallengeHtml(challengeValue, url));
});

app.get('/favicon.ico', (c: Context) => {
    c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    c.header('Content-Type', 'image/x-icon');
    return c.body(favicon);
});

app.get('/robots.txt', (c: Context) => {
    c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return c.text(robots, 200);
});

app.get('/tools/health', (c: Context) => {
    c.header('Cache-Control', 'public, max-age=60');
    return c.text('OK', 200);
});

app.get('/err/451', (c: Context) => {
    c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return c.body(null, 451);
});

app.get('/playground', (c: Context) => {
    c.header('Content-Type', 'text/html');
    c.header('Cache-Control', 'public, no-transform, max-age=3600, stale-while-revalidate=86400');

    return stream(c, async (s) => {
        await s.write(''); // Initial flush

        await s.write(playgroundTemplate);
    });
});

app.get('/playground/main.js', (c: Context) => stream(c, async (s) => {
    c.header('Cache-Control', 'public, no-transform, max-age=3600, stale-while-revalidate=86400');
    c.header('Content-Type', 'application/javascript');

    const host = (c.req.header('host') || '').toLowerCase();
    const isLocal = isLocalRequest(host);
    const apiBaseUrl = isLocal ? `http://${host}` : 'https://api.vgjr.top';

    const stateJs = `window.API_BASE_URL = "${apiBaseUrl}"; window.SERVER_STARTTIME = ${starttime}; window.SERVER_ENDPOINTS = ${JSON.stringify(PLAYGROUND_ENDPOINTS)};`;
    const finalJs = mainJs.replace('{{SSR_STATE}}', stateJs);

    await s.write(finalJs);
}));

app.get('/playground/cf.js', (c: Context) => stream(c, async (s) => {
    c.header('Cache-Control', 'public, no-transform, max-age=3600, stale-while-revalidate=86400');
    c.header('Content-Type', 'application/javascript');
    await s.write(cfJs);
}));

app.get('/playground/sw.js', (c: Context) => stream(c, async (s) => {
    c.header('Cache-Control', 'no-cache');
    c.header('Content-Type', 'application/javascript');
    c.header('Service-Worker-Allowed', '/');

    await s.write(playgroundSwJs.replace('__PLAYGROUND_CACHE_NAME__', JSON.stringify(`vgjr-playground-${starttime}`)));
}));

app.get('/playground/main.css', (c: Context) => stream(c, async (s) => {
    c.header('Cache-Control', 'public, no-transform, max-age=3600, stale-while-revalidate=86400');
    c.header('Content-Type', 'text/css');
    await s.write(mainCss);
}));

['/terms', '/privacy'].forEach((route) => {
    app.get(route, (c: Context) => {
        c.header('Content-Type', 'text/html');
        c.header('Cache-Control', 'public, no-transform, max-age=3600, stale-while-revalidate=86400');

        return stream(c, async (s) => {
            await s.write('');

            await s.write(playgroundTemplate);
        });
    });
});

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
