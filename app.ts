import { fileURLToPath } from "url";
import { Hono, Context, Next } from "hono";
import { cors } from "hono/cors";
import { stream } from "hono/streaming";
import { getCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import zlib from "zlib";
import config from "./config.json" with { type: "json" };
import os from "os";
import { getLastRequestedLogs } from "./functions/telemetry.js";
import { rateLimit } from "./functions/httpRequest.js";
import { commonHeaders } from "./functions/request.js";
import { BACK_CHALLENGE_COOKIE, getBackChallengeValue, cookieChallengeIsValid } from "./functions/backChallenge.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const autoGenBuild: any = crypto.randomBytes(16).toString("base64url");
export const autoGenBuildPara: any = crypto.randomBytes(64).toString("base64url");

const startupDataPromise = Promise.all([import("./routes/search/index.js"), import("./routes/lyrics/index.js"), import("./routes/tools/index.js"), import("./routes/info/index.js"), import("./routes/profile/index.js"), import("./routes/download/index.js"), import("./routes/music/index.js"), fs.readFile(path.join(__dirname, "node_modules/hono/package.json"), "utf-8").catch(() => ""), fs.readFile(path.join(__dirname, "public/robots.txt"), "utf-8"), fs.readFile(path.join(__dirname, "public/favicon.ico")), fs.readFile(path.join(__dirname, "html/playground.html"), "utf-8"), fs.readFile(path.join(__dirname, "html/main.js"), "utf-8"), fs.readFile(path.join(__dirname, "html/cf.js"), "utf-8"), fs.readFile(path.join(__dirname, "html/backChallenge.html"), "utf-8"), fs.readFile(path.join(__dirname, "html/challenge.html"), "utf-8"), fs.readFile(path.join(__dirname, "html/main.css"), "utf-8"), fs.readFile(path.join(__dirname, "amc/index.html"), "utf-8")] as const);

const API_ROUTES = {
	search: [["/search/duckduckgo?q=", "string"], ["/search/duckduckgo/image?q=", "string"], ["/search/duckduckgo/video?q=", "string"], ["/search/youtube/video?q=&mix=", "string", "boolean"], ["/search/youtube/music?q=&mix=", "string", "boolean"], ["/search/youtube/channel?q=", "string"], ["/search/youtube/playlist?q=", "string"], ["/search/soundcloud?q=", "string"], ["/search/spotify?q=", "string"], ["/search/applemusic?q=", "string"], ["/search/appstore?q=&type=", "string", "enum:iphone,ipad,mac,vision,watch,tv"], ["/search/radio?q=", "string"], ["/search/shazam?q=", "string"], ["/search/deezer?q=", "string"], ["/search/jiosaavn?q=", "string"], ["/search/tidal?q=", "string"], ["/search/tidal/v2?q=", "string"], ["/search/genius?q=", "string"], ["/search/audiomack?q=&type=", "string", "enum:songs,albums,playlists,artists"], ["/search/bandcamp?q=", "string"], ["/search/crunchyroll?q=", "string"], ["/search/imdb?q=", "string"], ["/search/pinterest?q=", "string"], ["/search/google?q=", "string"], ["/search/googleImage?q=&sort=", "string", "enum:relevance,latest"], ["/search/googleImage/cse?q=", "string"], ["/search/safebooru?q=", "string"], ["/search/konachan?q=", "string"], ["/search/tumblr?q=", "string"], ["/search/imgflip?q=", "string"], ["/search/imgur/posts?q=", "string"], ["/search/flickr?q=", "string"], ["/search/istockphoto?q=", "string"], ["/search/vectorstock?q=", "string"], ["/search/stockcake?q=", "string"], ["/search/pixabay?q=", "string"], ["/search/unsplash?q=", "string"], ["/search/pexels?q=", "string"], ["/search/pixiv?q=", "string"], ["/search/otodb?q=", "string"], ["/search/bilibili?q=", "string"], ["/search/twitch?q=", "string"], ["/search/discord/discovery/apps?q=", "string"], ["/search/discord/discovery/servers?q=", "string"], ["/search/capcut/templates?q=", "string"], ["/search/tiktok/feed"], ["/search/tiktok/video?q=", "string"], ["/search/tiktok/music?q=", "string"], ["/search/tiktok/users?q=", "string"], ["/search/reddit/media?q=", "string"], ["/search/roblox/games?q=", "string"], ["/search/roblox/audio?q=", "string"], ["/search/tenor?q=&type=", "string", "enum:all,sticker,meme"], ["/search/giphy?q=&type=", "string", "enum:gif,sticker,clip"], ["/search/giphy/v2?q=&type=", "string", "enum:gif,sticker,clip"], ["/search/klipy?q=&type=", "string", "enum:gif,sticker,clip,emoji,ai_gif"], ["/search/patreon?q=", "string"], ["/search/trakteer?q=", "string"], ["/search/threads/users?q=", "string"]],
	profile: [
		["/profile/guns?q=", "string"],
		["/profile/drift?q=", "string"],
		["/profile/haunt?q=", "string"],
		["/profile/rage?q=", "string"],
		["/profile/snapchat?q=", "string"],
		["/profile/twitter?q=", "string"],
		["/profile/instagram?q=", "string"],
		["/profile/threads?q=", "string"],
		["/profile/saweria?q=", "string"],
		["/profile/trakteer?q=", "string"],
		["/profile/sociabuzz?q=", "string"],
		["/profile/patreon?q=", "string"],
	],
	lyrics: [
		["/lyrics/youtube?q=", "string"],
		["/lyrics/spotify?q=", "string"],
		["/lyrics/shazam?q=", "string"],
		["/lyrics/tidal?q=", "string"],
		["/lyrics/deezer?q=", "string"],
	],
	tools: {
		ai: {
			chat: [
				["/tools/chat/gemma?prompt=", "string"],
				["/tools/chat/gemini?prompt=&conversation=", "string", "string"],
				["/tools/chat/gemini/web?prompt=&conversation=", "string", "string"],
				["/tools/chat/gpt?prompt=&conversation=", "string", "string"],
			],
			image_generation: [
				["/tools/ai-image/magicstudio?prompt=", "string"],
				["/tools/ai-image/flux_schnell?prompt=", "string"],
				["/tools/ai-image/flux_klein?prompt=", "string"],
			],
		},
		misc: [
			["/tools/translate?q=&from=&to=", "string", "string", "string"],
			["/tools/timezone?q=", "string"],
			["/tools/emoji?q=&limit=", "string", "number"],
			["/tools/emoji/kitchen?q1=&q2=&imageOnly=", "string", "string", "boolean"],
			["/tools/md5?q=", "string"],
			["/tools/country?q=", "string"],
			["/tools/mealRecipe?q=", "string"],
			["/tools/holidays?q=&year=", "string", "number"],
			["/tools/tts?q=&lang=", "string", "string"],
			["/tools/cloud-tts?q=&lang=", "string", "string"],
		],
		db: [
			["/tools/db/get?q=&hash=", "string", "string"],
			["/tools/db/getAll?q=&hash=", "string", "string"],
			["/tools/db/delete?q=&hash=", "string", "string"],
			["/tools/db/set?name=&value=&hash=", "string", "string", "string"],
		],
	},
	discord_tools: {
		stream: [["/tools/discord/stream?token=&channelId=&messageId=&url=&name=&clone=&onEmbed=&fallbackEmbed=", "string", "number", "number", "url", "string", "boolean", "boolean", "boolean"]],
		tts: [["/tools/discord/tts?token=&channelId=&quality=&q=&file_name=&messageId=&clone=&lang=", "string", "number", "enum:low,high", "string", "string", "number", "boolean", "string"]],
		tiktok: [["/tools/discord/tiktokFeed?token=&channelId=&messageId=&region_code=", "string", "number", "number", "string"]],
		server: [
			["/tools/discord/modifyServer?token=&guildId=&reason=&guildName=&guildDescription=&guildVerifyLevel=&guildIcon=&guildSplash=&guildBanner=", "string", "number", "string", "string", "string", "number", "url", "url", "url"],
			["/tools/discord/infoServer?token=&guildId=", "string", "number"],
			["/tools/discord/infoApp?token=&botId=", "string", "number"],
			["/tools/discord/infoAutomod?token=&guildId=&ruleId=", "string", "number", "number"],
			["/tools/discord/setAutomod?token=&guildId=&ruleId=&name=&eventType=&triggerType=&enabled=&keywordFilter=&regexPatterns=&presets=&allowList=&mentionTotalLimit=&mentionRaidProtection=&actions=&actionType=&alertChannelId=&timeoutSeconds=&customMessage=&exemptRoles=&exemptChannels=&reason=&payload=", "string", "number", "number", "string", "enum:MESSAGE_SEND,GUILD_MEMBER_JOIN_OR_UPDATE", "enum:KEYWORD,SPAM,KEYWORD_PRESET,MENTION_SPAM,MEMBER_PROFILE", "boolean", "json", "json", "enum_multi:PROFANITY,SEXUAL_CONTENT,SLURS", "string", "number", "boolean", "json", "enum_multi:BLOCK_MESSAGE,SEND_ALERT_MESSAGE,TIMEOUT,BLOCK_MEMBER_INTERACTION", "number", "number", "string", "string", "string", "string", "json"],
			["/tools/discord/deleteAutomod?token=&guildId=&ruleId=", "string", "number", "number"],
		],
		member: [
			["/tools/discord/modifyMemberServer?token=&guildId=&nickname=&avatar=&banner=&bio=&reason=", "string", "number", "string", "url", "url", "string", "string"],
			["/tools/discord/infoMember?token=&userId=&guildId=", "string", "number", "number"],
			["/tools/discord/listMember?token=&guildId=&limit=&type=&permission=", "string", "number", "number", "enum_multi:user,bot,all,oldest,newest,no_role,has_role,banned", "string"],
			["/tools/discord/listMember/role?token=&guildId=&roleId=&type=&permission=", "string", "number", "number", "enum_multi:user,bot,all,oldest,newest,oldest_position,newest_position", "string"],
			["/tools/discord/listMember/tags?token=&guildId=&type=&limit=&self=", "string", "number", "enum_multi:all,oldest,newest,oldest_guild,newest_guild", "number", "boolean"],
		],
		channel: [
			["/tools/discord/listChannel?token=&guildId=&limit=&type=", "string", "number", "number", "enum_multi:text,voice,category,announcement,announcement_thread,public_thread,private_thread,stage,directory,forum,media,threads,all"],
			["/tools/discord/infoChannel?token=&channelId=&guildId=", "string", "number", "number"],
		],
		role: [
			["/tools/discord/listRoles?token=&guildId=&limit=&type=&permission=", "string", "number", "number", "enum:all,oldest,newest", "string"],
			["/tools/discord/infoRole?token=&roleId=&guildId=", "string", "number", "number"],
		],
		invite: [
			["/tools/discord/infoInvite?q=&token=&guildId=", "string", "string", "number"],
			["/tools/discord/listInvite?token=&guildId=&limit=&type=&authorId=", "string", "number", "number", "enum_multi:user,bot,all,oldest,newest,temporary,permanent,has_expire", "number"],
		],
		sticker: [
			["/tools/discord/infoSticker?token=&q=", "string", "string"],
			["/tools/discord/deleteSticker?token=&guildId=&stickerId=", "string", "number", "number"],
			["/tools/discord/sticker/create?token=&guildId=&url=&name=&description=&tags=&reason=", "string", "number", "url", "string", "string", "string", "string"],
		],
		webhook: [
			{
				create: [["/tools/discord/webhook/create?token=&channelId=&name=&avatar=", "string", "number", "string", "url"]],
			},
			{
				info: [["/tools/discord/webhook/info?token=&webhookId=&webhookToken=&webhookUrl=", "string", "number", "string", "url"]],
			},
			{
				delete: [["/tools/discord/webhook/delete?token=&webhookId=&webhookToken=&webhookUrl=", "string", "number", "string", "url"]],
			},
			{
				send: [["/tools/discord/webhook/send?webhookId=&webhookToken=&webhookUrl=&content=&username=&avatar=", "number", "string", "url", "string", "string", "url"]],
			},
			{
				list: [["/tools/discord/webhook/list?token=&channelId=", "string", "number"]],
			},
			{
				listGuild: [["/tools/discord/listWebhooks?token=&guildId=&type=", "string", "number", "enum:all,oldest,newest"]],
			},
		],
		message: [
			["/tools/discord/infoMessage?token=&channelId=&messageId=", "string", "number", "number"],
			["/tools/discord/infoMessages?token=&channelId=&sort=&limit=", "string", "number", "enum:asc,desc", "number"],
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
			["/tools/discord/voice/setStatus?token=&channelId=&content=", "string", "number", "string"],
		],
	},
	info: [
		["/info/weather?q=", "string"],
		["/info/youtube/video?url=", "url"],
		["/info/youtube/channel?url=", "url"],
		["/info/soundcloud?url=", "url"],
		["/info/spotify?url=", "url"],
		["/info/applemusic?url=", "url"],
		["/info/twitter/tweet?url=", "url"],
		["/info/reddit/subreddit?q=", "string"],
		["/info/reddit/post?url=", "url"],
		["/info/tiktok/video?q=", "string"],
		["/info/tenor?url=", "url"],
		["/info/giphy?url=", "url"],
		["/info/klipy?url=", "url"],
		["/info/pinterest?url=", "url"],
	],
	download: [
		["/download/tiktok/video?url=", "url"],
		["/download/pinterest?url=", "url"],
	],
	music: [
		["/music/connect?token=&voiceId=&guildId=&authorId=&isDeaf=&247=&force=", "string", "number", "number", "number", "boolean", "boolean", "boolean"],
		["/music/disconnect?token=&guildId=", "string", "number"],
		["/music/play?token=&q=&platform=&voiceId=&guildId=&authorId=&isDeaf=&247=&fallback=", "string", "string", "enum:youtube,youtubemusic,soundcloud,spotify,applemusic,deezer,tidal", "number", "number", "number", "boolean", "boolean", "boolean"],
		["/music/radio?token=&stationId=&voiceId=&guildId=&authorId=&isDeaf=&247=", "string", "string", "number", "number", "number", "boolean", "boolean"],
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
	],
};

const { buildId: buildIdConfig, restrictLocal, playgroundChallenge, endpointChallenge, targetDomain } = config;

const app = new Hono({ strict: false });

app.use("*", async (c: Context, next: Next) => {
	if (restrictLocal) {
		const host = c.req.header("host");
		const isLocal = isLocalRequest(host);
		const isAllowed = host === targetDomain;

		if (!isAllowed && !isLocal) {
			const isMozilla = c.req.header("user-agent")?.startsWith("Mozilla/5.0");
			if (!isMozilla || c.req.header("Accept") === "application/json") return c.text("Forbidden", 403);
			const url = new URL(c.req.url);
			url.host = targetDomain;
			url.protocol = "https:";
			if (url.pathname === "/") url.pathname = "/playground";

			c.header("Refresh", `0; url=${url.toString()}`);
			return c.body("", 200, { "Content-Type": "application/json" });
		}
	}
	if (getCookie(c, "cf_clearance")) {
		const expiry = "Thu, 01 Jan 1970 00:00:00 GMT";
		const domain = ".vgjr.top";
		c.header("Set-Cookie", `cf_clearance=; Max-Age=0; Expires=${expiry}; Domain=${domain}; Path=/; Secure; HttpOnly; SameSite=None; Partitioned;`, { append: true });
		c.header("Set-Cookie", `cf_clearance=; Max-Age=0; Expires=${expiry}; Path=/; Secure; HttpOnly; SameSite=None; Partitioned;`, { append: true });
	}

	const currentUrl = new URL(c.req.url);
	const currentHost = currentUrl.host;
	const currentHostname = currentUrl.hostname;
	const queries = c.req.query();
	for (const key in queries) {
		const val = queries[key];
		if (val && (val.startsWith("http://") || val.startsWith("https://"))) {
			try {
				const parsed = new URL(val);
				if (parsed.host === currentHost || parsed.hostname === currentHostname || parsed.hostname === targetDomain || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]") {
					return c.json({ error: "Query not allowed" });
				}
			} catch {}
		}
	}

	c.header("Cache-Control", "public, max-age=5, must-revalidate");
	await next();
});

const starttime = (globalThis as any).__vgjr_starttime || Date.now();

const [reqsModule, lyricsModule, toolsModule, infoModule, profileModule, downloadModule, musicModule, honoPackageJson, robots, favicon, playgroundTemplateSource, mainJs, cfJs, backChallengeTemplateSource, challengeTemplateSource, rawCss, amcTemplateSource] = await startupDataPromise;

const reqs = reqsModule.default;
const lyrics = lyricsModule.default;
const tools = toolsModule.default;
const info = infoModule.default;
const profile = profileModule.default;
const download = downloadModule.default;
const music = musicModule.default;
const honoVersion = (() => {
	try {
		return JSON.parse(honoPackageJson).version;
	} catch {
		return "?";
	}
})();

const mainCss = rawCss
	.replace(/\/\*[\s\S]*?\*\//g, "")
	.replace(/\s+/g, " ")
	.replace(/\s*([{}:;,])\s*/g, "$1")
	.trim();

const amcTemplate = amcTemplateSource
	.replace(/<!--[\s\S]*?-->/g, "")
	.replace(/\s+/g, " ")
	.replace(/>\s+</g, "><")
	.trim();

const playgroundTemplate = playgroundTemplateSource
	.replace(/<!--[\s\S]*?-->/g, "")
	.replace(/\s+/g, " ")
	.replace(/>\s+</g, "><")
	.trim();

const BUILD_ID = buildIdConfig === true ? crypto.randomBytes(7).toString("base64url") : typeof buildIdConfig === "string" ? buildIdConfig : null;
const backChallengeHtml = backChallengeTemplateSource.trim();
const challengeHtml = challengeTemplateSource.trim();

function getBackChallengeJwtKey(): string {
	const key = process.env.MD_KEY;
	if (!key) throw new Error("Missing required environment variable: MD_KEY");
	return key;
}

const BACK_CHALLENGE_PREFIXES = ["/search", "/profile", "/lyrics", "/tools", "/info", "/download", "/music"];

function generateCanvasParams(): string {
	const text = crypto.randomBytes(4).toString("hex");
	const bg = "#" + crypto.randomBytes(3).toString("hex");
	const fg = "#" + crypto.randomBytes(3).toString("hex");
	const fontSize = 18 + crypto.randomInt(15);
	const json = JSON.stringify([200, 50, text, fontSize, "sans-serif", bg, fg]);
	return Buffer.from(json).toString("base64url");
}

async function createBackChallengeJwt(maxAge: number): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	return sign(
		{
			sub: "back-challenge",
			iat: now,
			exp: now + maxAge,
			n: crypto.randomBytes(8).toString("base64url"),
		},
		getBackChallengeJwtKey(),
	);
}

function encodeBackChallengePayload(payload: Buffer, userAgent: string, jwtToken: string): string {
	const userAgentKey = crypto.createHash("sha512").update(userAgent).digest();
	const jwtKey = crypto.createHash("sha512").update(jwtToken).digest();
	const result = Buffer.alloc(payload.length);
	for (let i = 0; i < payload.length; i++) {
		result[i] = payload[i] ^ userAgentKey[i % userAgentKey.length] ^ jwtKey[i % jwtKey.length];
	}
	return result.toString("base64");
}

async function getBackChallengeHtml(challengeValue: string, url: URL, userAgent: string): Promise<Buffer> {
	const randomMaxAge = Math.floor(Math.random() * (30 - 10 + 1)) + 10;
	const randomDifficulty = Math.floor(Math.random() * (12 - 10 + 1)) + 10;

	const valueArray = (challengeValue.match(/.{2}/g) || []).map((chunk) => btoa("\u0000" + chunk));
	const gzipBuffer = zlib.gzipSync(Buffer.from(JSON.stringify(valueArray)));
	const jwtToken = await createBackChallengeJwt(randomMaxAge);
	const encodedPayload = encodeBackChallengePayload(gzipBuffer, userAgent, jwtToken);
	const canvasParams = generateCanvasParams();
	const destructVars = [
		{ key: "c", val: JSON.stringify(BACK_CHALLENGE_COOKIE) },
		{ key: "m", val: String(randomMaxAge) },
		{ key: "s", val: url.protocol === "https:" ? "true" : "false" },
		{ key: "d", val: String(randomDifficulty) },
		{ key: "p", val: JSON.stringify(encodedPayload) },
		{ key: "j", val: JSON.stringify(jwtToken) },
		{ key: "x", val: JSON.stringify(canvasParams) },
	];

	for (let i = destructVars.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[destructVars[i], destructVars[j]] = [destructVars[j], destructVars[i]];
	}

	const keys = destructVars.map((v) => v.key).join(",");
	const vals = destructVars.map((v) => v.val).join(",");
	const destructuringString = `[${keys}]=[${vals}]`;

	const template = backChallengeHtml.replace("{{BACK_CHALLENGE_DESTRUCTURING}}", destructuringString);
	return Buffer.from(template);
}

function isBackChallengePath(pathname: string): boolean {
	let pathToCheck = pathname;
	if (BUILD_ID && pathToCheck.startsWith(`/${BUILD_ID}/`)) {
		pathToCheck = pathToCheck.slice(BUILD_ID.length + 1);
	}

	return BACK_CHALLENGE_PREFIXES.some((prefix) => pathToCheck === prefix || pathToCheck.startsWith(`${prefix}/`));
}

function isBrowserBackChallengeRequest(c: Context): boolean {
	const userAgent = c.req.header("user-agent") || "";
	const fetchMode = c.req.header("sec-fetch-mode");

	return c.req.method === "GET" && userAgent.startsWith("Mozilla/5.0") && !userAgent.includes("Discordbot") && fetchMode !== "same-origin" && fetchMode === "navigate" && endpointChallenge === true;
}

function hostHeaderName(host: string | undefined): string {
	if (!host) return "";
	try {
		host = decodeURIComponent(host);
	} catch {}
	if (host.startsWith("[")) {
		const end = host.indexOf("]");
		if (end !== -1) return host.slice(0, end + 1).toLowerCase();
	}
	return host.split(":")[0].toLowerCase();
}

function isLocalRequest(host: string | undefined): boolean {
	const h = hostHeaderName(host);
	return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.startsWith("192.168.") || h.startsWith("10.") || h.startsWith("172.");
}

app.use("*", async (c: Context, next: Next) => {
	if (c.req.path.startsWith("/amc")) {
		await next();
		return;
	}
	return cors({
		origin: (origin) => origin,
		exposeHeaders: ["X-Route"],
		allowMethods: ["GET", "OPTIONS"],
		allowHeaders: ["*"],
	})(c, next);
});

if (BUILD_ID) {
	const apiPrefixes = ["search", "lyrics", "tools", "info", "music"];
	const excludedPaths = ["favicon.ico", "robots.txt", "playground", "terms", "privacy"];

	app.use("*", async (c: Context, next: Next) => {
		const url = new URL(c.req.url);
		const pathname = url.pathname;
		const pathParts = pathname.split("/").filter(Boolean);

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

app.use("*", async (c: Context, next: Next) => {
	const url = new URL(c.req.url);
	if (!isBackChallengePath(url.pathname)) {
		await next();
		return;
	}

	const challengeValue = getBackChallengeValue(c);
	const cookieValue = getCookie(c, BACK_CHALLENGE_COOKIE);
	const isValid = cookieChallengeIsValid(c, cookieValue);
	if (isValid || !isBrowserBackChallengeRequest(c)) {
		await next();
		return;
	}

	const htmlBuffer = await getBackChallengeHtml(challengeValue, url, c.req.header("user-agent") || "");
	const gzipData = zlib.gzipSync(htmlBuffer, {
		level: zlib.constants.Z_BEST_SPEED,
	});
	const deflateData = zlib.deflateSync(gzipData, {
		level: zlib.constants.Z_BEST_SPEED,
	});
	const brData = zlib.brotliCompressSync(deflateData, {
		params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 0 },
	});
	const zstdData = Bun.zstdCompressSync(brData, { level: 1 });

	c.header("Content-Encoding", "gzip, deflate, br, zstd");
	c.header("Content-Type", "text/html");
	c.header("Cache-Control", "public, no-store, max-age=0, no-transform");
	c.header("X-Message", "Verifying your browser first before processing");
	c.status(307);
	return c.body(Buffer.from(zstdData));
});

app.get("/favicon.ico", (c: Context) => {
	c.header("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
	c.header("Content-Type", "image/x-icon");
	return c.body(favicon);
});

app.get("/robots.txt", (c: Context) => {
	c.header("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
	return c.text(robots, 200);
});

app.get("/logs", async (c: Context) => {
	c.header("Refresh", "3");
	c.header("Cache-Control", "public, max-age=2, must-revalidate");
	c.header("Content-Type", "text/plain");

	return stream(c, async (s) => {
		await s.write(""); // Initial flush

		const timezone = c.req.header("cf-timezone") || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
		let resolvedTimezone = timezone;
		try {
			new Intl.DateTimeFormat("en-US", { timeZone: resolvedTimezone }).format(new Date());
		} catch {
			resolvedTimezone = "UTC";
		}

		const requested = getLastRequestedLogs().map((entry) => ({
			localTimestamp: new Date(entry.timestamp).toLocaleString("en-US", { timeZone: resolvedTimezone }),
			...entry,
		}));

		await s.write(
			JSON.stringify(
				{
					_message: "Refreshing every 3 seconds.",
					limit: 30,
					timezone: resolvedTimezone,
					requested,
				},
				null,
				1,
			),
		);
	});
});

function setPlaygroundAssetCache(c: Context) {
	c.header("Cache-Control", "public, no-transform, max-age=3600, stale-while-revalidate=86400");
}

const PLAYGROUND_CHALLENGE = crypto.randomBytes(32).toString("hex");

const CHALLENGE_ROUTES = ["/playground", "/terms", "/privacy"];

app.on(["GET"], CHALLENGE_ROUTES, async (c: Context) => {
	const fm = c.req.query("fm");
	setPlaygroundAssetCache(c);
	c.header("Content-Type", "text/html");
	c.header("Content-Encoding", "gzip");
	if ((typeof fm === "string" && fm === PLAYGROUND_CHALLENGE) || playgroundChallenge === false) {
		c.header("Link", "</playground/main.css>; as=style; rel=preload, </playground/loadRich.js>; as=script; rel=preload, </playground/main.js>; as=script; rel=preload, </playground/cf.js>; as=script; rel=preload");

		return stream(c, async (s) => {
			await s.write("");
			await s.write(zlib.gzipSync(playgroundTemplate));
		});
	}

	if (fm) {
		c.status(403);
		return c.body(null);
	}

	c.header("Refresh", `0; url=${c.req.path}?fm=${PLAYGROUND_CHALLENGE}&l=1`);
	c.status(200);
	return c.body(zlib.gzipSync(challengeHtml));
});

["/amc/terms", "/amc/privacy"].forEach((route) => {
	app.get(route, (c: Context) => {
		c.header("Content-Type", "text/html");
		c.header("Content-Encoding", "gzip");
		setPlaygroundAssetCache(c);

		return stream(c, async (s) => {
			await s.write(""); // Initial flush

			await s.write(zlib.gzipSync(amcTemplate));
		});
	});
});

const servePlaygroundMainJs = (c: Context) =>
	stream(c, async (s) => {
		setPlaygroundAssetCache(c);
		c.header("Content-Type", "application/javascript");
		c.header("Content-Encoding", "gzip");

		const host = (c.req.header("host") || "").toLowerCase();
		const isLocal = isLocalRequest(host);
		const apiBaseUrl = isLocal ? `http://${host}` : `https://${targetDomain}`;

		const stateJs = `window.API_BASE_URL = "${apiBaseUrl}";`;
		const finalJs = mainJs.replace("{{SSR_STATE}}", stateJs);

		await s.write(zlib.gzipSync(finalJs));
	});

app.get("/playground/main.js", servePlaygroundMainJs);

const servePlaygroundCfJs = (c: Context) =>
	stream(c, async (s) => {
		setPlaygroundAssetCache(c);
		c.header("Content-Type", "application/javascript");
		c.header("Content-Encoding", "gzip");
		await s.write(zlib.gzipSync(cfJs));
	});

app.get("/playground/cf.js", servePlaygroundCfJs);

const servePlaygroundMainCss = (c: Context) =>
	stream(c, async (s) => {
		setPlaygroundAssetCache(c);
		c.header("Content-Type", "text/css");
		c.header("Content-Encoding", "gzip");
		await s.write(zlib.gzipSync(mainCss));
	});

app.get("/playground/main.css", servePlaygroundMainCss);

app.get("/", (c: Context) =>
	stream(c, async (l) => {
		const isMozilla = c.req.header("user-agent")?.startsWith("Mozilla/5.0");
		c.header("X-Net", isMozilla ? "true" : "false");
		const renderJson = c.req.query("json") !== undefined || c.req.header("accept")?.includes("application/json");
		const typeRender = renderJson ? "application/json" : "text/plain";
		c.header("Content-Type", typeRender);
		c.header("Cache-Control", "public, no-store, max-age=1, must-revalidate");
		if (!renderJson) c.header("Location", "/playground");

		c.status(renderJson ? 200 : 302);
		await l.write("");

		const seconds = Math.floor((Date.now() - starttime) / 1000);
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		const uptime = [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
		const os_seconds = Math.floor(os.uptime());
		const os_h = Math.floor(os_seconds / 3600);
		const os_m = Math.floor((os_seconds % 3600) / 60);
		const os_s = os_seconds % 60;
		const os_uptime = [os_h, os_m, os_s].map((v) => v.toString().padStart(2, "0")).join(":");

		const cpuUsage = os.loadavg()[0] / os.cpus().length;
		const cpu = `${(cpuUsage * 100).toFixed(1)}%`;
		const usedRam = Math.round((os.totalmem() - os.freemem()) / (1024 * 1024));
		const totalRam = Math.round(os.totalmem() / (1024 * 1024));
		const ram = `${usedRam.toLocaleString()}MB / ${totalRam.toLocaleString()}MB`;
		let clientHeaders = c.req.header();
		delete clientHeaders?.["x-client-secret"];

		const listapi = [
			{
				source: [
					{
						title: "Support Me",
						url: "https://ko-fi.com/greenvgjr",
					},
					{
						title: "Source Code",
						url: "https://github.com/GreenVGJR/api",
					},
					{
						title: "Playground",
						url: `https://${targetDomain}/playground`,
					},
				],
				domRendering: typeRender,
				uptime: uptime,
				os_uptime: os_uptime,
				service: `Hono v${honoVersion}`,
				runtime: "Bun v" + (Bun as any).version,
				stats: {
					cpu: cpu,
					ram: ram,
					restart_count: String((globalThis as any).__vgjr_refresh_count || 0),
					last_restart: String((globalThis as any).__vgjr_last_reload || 0),
				},
			},
			{
				_visitor: clientHeaders,
				_build: [autoGenBuildPara, autoGenBuild],
			},
		];

		await l.write(renderJson ? JSON.stringify(listapi) : JSON.stringify(listapi, null, 2));
	}),
);

app.get("/playground/loadRich.js", (c: Context) => {
	c.header("Content-Type", "application/javascript");
	setPlaygroundAssetCache(c);
	return c.body(`window.API_ROUTES = ${JSON.stringify(API_ROUTES)};`);
});

const routeBase = BUILD_ID ? `/${BUILD_ID}` : "";
const apiPrefixesRoute = ["/search", "/lyrics", "/tools", "/info", "/profile", "/music"];

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

// ── Radio Stream Proxy ────────────────────────────────────────────────────────
// Lavalink sometimes chokes on non-compliant HTTP responses from radio streams.
// This proxy fetches the stream on Lavalink's behalf so the bot controls the HTTP layer.
import { radioStreamUrls } from "./functions/radioProxy.js";

app.get("/radio-proxy/:guildId", async (c) => {
	// Only allow localhost (Lavalink runs on the same machine)
	const host = c.req.header("host");
	if (!isLocalRequest(host)) {
		return c.json({ error: "Forbidden" }, 403);
	}

	const guildId = c.req.param("guildId");
	const key = guildId;
	const targetUrl = radioStreamUrls.get(key);

	if (!targetUrl) {
		return c.json({ error: "No active radio stream for this guild" }, 404);
	}

	const abort = new AbortController();

	c.req.raw.signal?.addEventListener("abort", () => abort.abort());

	let res: Response;
	try {
		res = await fetch(targetUrl, {
			headers: commonHeaders,
			signal: abort.signal,
		});
	} catch (err: any) {
		if (abort.signal.aborted) return new Response(null, { status: 499 });
		return c.json({ error: `Failed to fetch stream: ${err?.message}` }, 502);
	}

	if (!res.ok || !res.body) {
		return c.json({ error: `Upstream returned ${res.status}` }, 502);
	}

	const contentType = res.headers.get("content-type") || "audio/mpeg";

	return new Response(res.body, {
		status: res.status,
		headers: {
			"Content-Type": contentType,
			"Cache-Control": "no-cache, no-store",
			"Transfer-Encoding": "chunked",
		},
	});
});

if (BUILD_ID) {
	app.use("*", async (c: Context, next: Next) => {
		const url = new URL(c.req.url);
		const pathname = url.pathname;

		if (apiPrefixesRoute.some((prefix) => pathname.startsWith(prefix))) {
			const redirectUrl = new URL(c.req.url);
			redirectUrl.pathname = `/${BUILD_ID}${pathname}`;
			return c.redirect(redirectUrl.toString(), 302);
		}

		await next();
	});
}

app.use("*", async (c: Context, next: Next) => {
	if (BUILD_ID) {
		const url = new URL(c.req.url);
		const pathname = url.pathname;
		const checkElement = pathname.split("/").slice(1);
		if (checkElement[0] !== BUILD_ID) {
			return c.json({ error: "Signature mismatch" }, 403);
		}
	}
	const checkexists = c.notFound();

	if (checkexists) {
		await rateLimit();
		c.header("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
		return c.body(null, 404);
	}
	await next();
});

export default app;
