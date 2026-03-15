import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import { Player, QueryType, GuildQueue, Track } from 'discord-player';

import { request } from 'undici';
import crypto from 'crypto';

import { YoutubeiExtractor } from 'discord-player-youtubei';
import { SpotifyExtractor } from 'discord-player-spotify';
import { SoundcloudExtractor } from 'discord-player-soundcloud';
import { AppleMusicExtractor } from 'discord-player-applemusic';
import { stream } from 'hono/streaming';

export function createMusicStream(c: any, callback: (log: (msg: string) => Promise<void>, s: any) => Promise<void>) {
    const oo = String(Date.now() / 3600000).split('.')[0];
    const signature = crypto.createHash("md5").update(JSON.stringify(c.req.header())).digest("hex");

    c.header('Content-Type', 'application/json');
    c.header('Cache-Control', 'no-cache, no-transform, no-store, max-age=0');

    c.header('X-PO-Client-Id', crypto.createHash("md5").update(oo).digest("hex"));
    c.header('X-PO-Client', signature);
    c.header('X-Enc-Route', 'v1-beta');
    c.header('X-Route', 'LIVE');

        return stream(c, async (s: any) => {
        const startTime = Date.now();
        let logIndex = 0;

        await s.write('{"_logs":[');

        const log = async (msg: string) => {
            const elapsed = Date.now() - startTime;
            const entry = `[${elapsed}ms] ${msg}`;
            const prefix = logIndex > 0 ? ',' : '';
            try { await s.write(`${prefix}${JSON.stringify(entry)}`); } catch { }
            logIndex++;
        };

        try {
            await callback(log, s);
        } catch (err: any) {
            await log(`Error: ${err?.message || 'Failed to process stream'}`);
            try { await s.write(`],"error":${JSON.stringify({ message: err?.message || 'Failed to process stream' })}}`); } catch {}
        }
    });
}


(BigInt.prototype as any).toJSON = function () {
    return String(this);
};


const ytClients: Record<string, any> = {
    VISIONOS: {
        targetDomain: "m.youtube.com",
        clientName: 101,
        clientVersion: "0.1",
        deviceMake: "Apple",
        deviceModel: "RealityDevice14,1",
        osName: "visionOS",
        osVersion: "1.3.21O771"
    },
    ANDROID: {
        targetDomain: "m.youtube.com",
        clientName: 3,
        clientVersion: "20.40.45",
        userAgent: "com.google.android.youtube/21.02.35 (Linux; U; Android 11) gzip",
        osName: "Android",
        osVersion: "11"
    },
    ANDROID_REEL: {
        targetDomain: "youtubei.googleapis.com",
        clientName: 3,
        clientVersion: "20.40.45",
        androidSdkVersion: 30,
        userAgent: "com.google.android.youtube/21.02.35 (Linux; U; Android 11) gzip",
        osName: "Android",
        osVersion: "11"
    },
    ANDROID_VR: {
        targetDomain: "m.youtube.com",
        clientName: 28,
        clientVersion: "1.00.0",
        deviceMake: "Oculus",
        deviceModel: "Quest 3",
        androidSdkVersion: 30,
        userAgent: "com.google.android.apps.youtube.vr.oculus/1.00.0 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
        osName: "Android",
        osVersion: "12L"
    },
    IOS: {
        targetDomain: "m.youtube.com",
        clientName: 5,
        clientVersion: "20.40.45",
        deviceMake: "Apple",
        deviceModel: "iPhone16,2",
        userAgent: "com.google.ios.youtube/21.02.35 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
        osName: "iPhone",
        osVersion: "18.3.2.22D82"
    },
    IOS_REEL: {
        targetDomain: "youtubei.googleapis.com",
        clientName: 5,
        clientVersion: "20.40.45",
        deviceMake: "Apple",
        deviceModel: "iPhone16,2",
        userAgent: "com.google.ios.youtube/21.02.35 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
        osName: "iPhone",
        osVersion: "18.3.2.22D82"
    }
};


const defaultUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
const targetClientName = (process.env.YT_CLIENT || 'ANDROID').toUpperCase();
const ytcookies = process.env.YOUTUBE_COOKIES || '';
const streamTypeYT = parseInt(process.env.YT_STREAM_TYPE || '0');

const useClient = ytClients[targetClientName];
if (!useClient) {
    const available = Object.keys(ytClients).join(', ');
    console.warn(`YouTube client "${targetClientName}" does not exist. Available: ${available}. Defaulting to ANDROID_VR.`);
}

const activeClient = useClient || ytClients.ANDROID_VR;
const hostdomain = activeClient.targetDomain;
const APIuserAgent = activeClient.userAgent || defaultUserAgent;

const isReelClient = ['ANDROID_REEL', 'IOS_REEL'].includes(targetClientName);
const buildQuery = isReelClient
    ? 'reel/reel_item_watch?prettyPrint=false&alt=json&fields=playerResponse(playabilityStatus,streamingData(hlsManifestUrl,formats(url),adaptiveFormats(itag,url,contentLength)),videoDetails(isLiveContent))'
    : 'player?prettyPrint=false&alt=json&fields=playabilityStatus,streamingData(hlsManifestUrl,formats(url),adaptiveFormats(itag,url,contentLength)),videoDetails(isLiveContent)';

const lk = { context: { client: { clientName: activeClient.clientName, clientVersion: activeClient.clientVersion } } };

let actuallk = { ...activeClient } as any;
delete actuallk.targetDomain;
actuallk.hl = "en";
actuallk.gl = "US";

let visitorData = "";
const templist: Array<{ id: string; url: string; ref: number }> = [];


(async () => {
    try {
        if (ytcookies) {
            const embedText = await fetch("https://www.youtube.com/embed?html5=1", {
                method: "GET",
                headers: { "User-Agent": defaultUserAgent, "Cookie": ytcookies }
            }).then(a => a.text());
            visitorData = embedText.split('"visitorData":"')[1]?.split('"')[0] || "";
            actuallk.visitorData = visitorData;
        }
    } catch { }

    if (!visitorData) {
        try {
            const resp = await request(`https://${hostdomain}/youtubei/v1/player?prettyPrint=false&fields=responseContext.visitorData`, {
                method: "POST",
                body: JSON.stringify(lk),
                headers: {
                    "Origin": `https://${hostdomain}`,
                    "Content-Type": "application/json",
                    "User-Agent": APIuserAgent
                }
            });
            const data = await resp.body.json() as any;
            visitorData = data?.responseContext?.visitorData || "";
            actuallk.visitorData = visitorData;
        } catch { }
    }
})();

function generateSAPISIDHash() {
    if (!ytcookies) return null;
    const sapisid = ytcookies.match(/(?:^|;\s*)SAPISID=([^;]*)/)?.[1];
    const secure1psid = ytcookies.match(/(?:^|;\s*)__Secure-1PAPISID=([^;]*)/)?.[1];
    const secure3psid = ytcookies.match(/(?:^|;\s*)__Secure-3PAPISID=([^;]*)/)?.[1];
    if (!sapisid) return null;

    const t = Math.floor(Date.now() / 1000).toString();
    const origin = `https://${hostdomain}`;

    const hash1 = crypto.createHash('sha1').update(`${t} ${sapisid} ${origin}`).digest('hex');
    const hash2 = crypto.createHash('sha1').update(`${t} ${secure1psid} ${origin}`).digest('hex');
    const hash3 = crypto.createHash('sha1').update(`${t} ${secure3psid} ${origin}`).digest('hex');

    return `SAPISIDHASH ${t}_${hash1}_u SAPISID1PHASH ${t}_${hash2}_u SAPISID3PHASH ${t}_${hash3}_u`;
}

export async function fallbackYTStream(trackUrl: string): Promise<string> {
    const cached = templist.find(l => l.id === trackUrl);
    if (cached && Date.now() <= cached.ref) return cached.url;

    const videoId = trackUrl.includes('watch?v=')
        ? trackUrl.split('watch?v=')[1]?.split('&')[0]
        : trackUrl.match(/(?:youtu\.be\/|\/v\/|embed\/|shorts\/)([^?&/]+)/)?.[1] || trackUrl;

    if (!videoId) throw new Error('Could not extract video ID');

    const buildRoute = isReelClient
        ? {
            playerRequest: { videoId, contentCheckOk: true, racyCheckOk: true },
            disablePlayerResponse: false,
            context: { client: { ...actuallk } }
        }
        : {
            videoId,
            context: {
                client: { ...actuallk },
                request: { useSsl: true, internalExperimentFlags: [], consistencyTokenJars: [] }
            },
            playbackContext: {
                contentPlaybackContext: {
                    splay: true,
                    html5Preference: "HTML5_PREF_WANTS",
                    lactMilliseconds: "-1",
                    signatureTimestamp: "0"
                }
            },
            racyCheckOk: true,
            contentCheckOk: true
        };

    const authHeader = generateSAPISIDHash();
    const headers: Record<string, any> = {
        "Accept-Language": "en",
        "Content-Type": "application/json",
        "X-Goog-Visitor-Id": visitorData,
        "Origin": `https://${hostdomain}`,
        "X-Origin": `https://${hostdomain}`,
        "X-Youtube-Client-Name": activeClient.clientName,
        "X-Youtube-Client-Version": activeClient.clientVersion,
        "User-Agent": APIuserAgent,
    };

    if (ytcookies && authHeader) {
        headers["Authorization"] = authHeader;
        headers["Cookie"] = ytcookies;
        headers["X-Youtube-Bootstrap-Logged-In"] = "true";
        headers["Alt-Used"] = hostdomain;
    }

    const resp = await request(`https://${hostdomain}/youtubei/v1/${buildQuery}`, {
        method: "POST",
        body: JSON.stringify(buildRoute),
        headers
    });

    let a = await resp.body.json() as any;
    a = a?.playerResponse || a;

    if (a?.playabilityStatus?.status !== 'OK') {
        throw new Error(`YouTube playability: ${a?.playabilityStatus?.status || 'UNKNOWN'}`);
    }

    const cpn = crypto.randomBytes(12).toString('base64url');
    let finalurl: string;

    if ((a?.videoDetails?.isLiveContent || streamTypeYT === 2) && a?.streamingData?.hlsManifestUrl) {
        if (targetClientName === 'VISIONOS') {
            const hlsText = await request(a.streamingData.hlsManifestUrl + "?cver=" + activeClient.clientVersion + "&cpn=" + cpn, { method: "GET" }).then(r => r.body.text());
            finalurl = hlsText.split('GROUP-ID="234"')[0].split('URI="')[2]?.split('"')[0] || a.streamingData.hlsManifestUrl;
        } else {
            finalurl = a.streamingData.hlsManifestUrl + "?cver=" + activeClient.clientVersion + "&cpn=" + cpn;
        }
    } else if (a.streamingData?.formats?.[0]?.url && targetClientName === 'ANDROID') {
        finalurl = a.streamingData.formats[0].url + "&alr=no&cver=" + activeClient.clientVersion + "&cpn=" + cpn;
    } else {
        const fr = a.streamingData?.adaptiveFormats?.find((c: any) => [251, 140, 599].includes(c.itag));
        if (!fr?.url) throw new Error('No suitable audio format found');
        finalurl = fr.url + "&ratebypass=true&rn=0&alr=no&cver=" + activeClient.clientVersion + "&range=0-" + fr.contentLength + "&cpn=" + cpn;
    }

    templist.push({ id: trackUrl, url: finalurl, ref: Date.now() + 60000 });

    if (templist.length > 100) templist.splice(0, templist.length - 50);

    return finalurl;
}


const PLATFORM_MAP: Record<string, string> = {
    youtube: QueryType.YOUTUBE_SEARCH,
    youtubemusic: QueryType.YOUTUBE,
    youtubeplaylist: QueryType.YOUTUBE_PLAYLIST,
    soundcloud: QueryType.SOUNDCLOUD_SEARCH,
    spotify: QueryType.SPOTIFY_SEARCH,
    applemusic: QueryType.APPLE_MUSIC_SEARCH,
    auto: QueryType.AUTO,
};


const AUTO_DESTROY_DELAY = 2 * 60 * 1000; 

interface ManagedPlayer {
    client: Client;
    player: Player;
    ready: Promise<void>;
    destroyTimer: ReturnType<typeof setTimeout> | null;
}

const players = new Map<string, ManagedPlayer>();

export function hasActivePlayer(token: string): boolean {
    return players.has(token);
}





function scheduleAutoDestroy(token: string) {
    const managed = players.get(token);
    if (!managed) return;


    if (managed.destroyTimer) {
        clearTimeout(managed.destroyTimer);
        managed.destroyTimer = null;
    }

    managed.destroyTimer = setTimeout(() => {
        const current = players.get(token);
        if (!current) return;


        let hasActivity = false;

        for (const [, node] of current.player.nodes.cache) {
            if (node.isPlaying() || node.tracks.size > 0) {
                hasActivity = true;
                break;
            }
        }

        if (!hasActivity) {

            for (const [, guild] of current.client.guilds.cache) {
                if (guild.members.me?.voice.channel) {
                    hasActivity = true;
                    break;
                }
            }
        }

        if (!hasActivity) {
            console.log(`🧹 Auto-destroying idle music client (token: ...${token.slice(-6)})`);
            current.player.destroy();
            current.client.destroy();
            players.delete(token);
        }
    }, AUTO_DESTROY_DELAY);
}


function cancelAutoDestroy(token: string) {
    const managed = players.get(token);
    if (!managed?.destroyTimer) return;
    clearTimeout(managed.destroyTimer);
    managed.destroyTimer = null;
}

export async function getOrCreatePlayer(token: string): Promise<{ client: Client; player: Player }> {
    const existing = players.get(token);
    if (existing) {
        await existing.ready;
        cancelAutoDestroy(token);
        return { client: existing.client, player: existing.player };
    }

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates,
        ],
        presence: {
            status: 'invisible'
        }
    });

    const player = new Player(client);


    player.events.on('error', (queue, error) => {
        console.error(`[Queue Error] ${error.message}`);

        queue.tasksQueue.clear(true);
    });
    player.events.on('playerError', (queue, error) => {
        console.error(`[Player Error] ${error.message}`);

        queue.tasksQueue.clear(true);
    });

    player.events.on('playerSkip', (queue, track, reason, description) => {
        console.warn(`[Player Skip] "${track.title}" skipped (${reason}): ${description}`);

        queue.tasksQueue.clear(true);
    });
    player.on('error', (message) => console.error(`[Player Object Error] ${message}`));
    player.on('debug', (message) => {
        if (message.includes('error') || message.includes('failed')) {
            console.log(`[Player Debug] ${message}`);
        }
    });




    player.events.on('playerStart', () => {
        cancelAutoDestroy(token);
    });


    player.events.on('emptyQueue', () => {
        console.log(`📭 Queue empty, scheduling auto-destroy (token: ...${token.slice(-6)})`);
        scheduleAutoDestroy(token);
    });


    player.events.on('emptyChannel', () => {
        console.log(`👻 Voice channel empty, scheduling auto-destroy (token: ...${token.slice(-6)})`);
        scheduleAutoDestroy(token);
    });


    player.events.on('disconnect', () => {
        console.log(`🔌 Player disconnected from voice, scheduling auto-destroy (token: ...${token.slice(-6)})`);
        scheduleAutoDestroy(token);
    });


    client.on('voiceStateUpdate', (oldState, newState) => {

        if (oldState.member?.id !== client.user?.id) return;


        if (oldState.channel && !newState.channel) {
            console.log(`👢 Bot removed from voice channel "${oldState.channel.name}", scheduling auto-destroy (token: ...${token.slice(-6)})`);

            const queue = player.nodes.get(oldState.guild.id);
            if (queue) queue.delete();
            scheduleAutoDestroy(token);
        }
    });


    client.on('shardDisconnect', () => {
        console.log(`⚡ Client shard disconnected, destroying player (token: ...${token.slice(-6)})`);
        destroyPlayer(token);
    });


    const readyPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Discord client login timeout')), 30000);
        client.once('clientReady', () => {
            clearTimeout(timeout);
            console.log(`🎵 Music client ready: ${client.user?.tag}`);
            resolve();
        });
        client.once('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });


    const fullReady = (async () => {

        await Promise.all([
            client.login(token),
            player.extractors.register(YoutubeiExtractor, {
                disablePlayer: true,
                generateWithPoToken: false,
                streamOptions: {
                    useClient: "ANDROID"
                },
                // @ts-ignore - custom stream override
                createStream: async (q: any) => {
                    try { 
                        const streamUrl = await fallbackYTStream(q.url);
                        return streamUrl;
                    } catch (err: any) {
                        console.error(`[YouTube Stream] Error: ${err.message}`);
                        return undefined;
                    }
                }
            }),
            player.extractors.register(SpotifyExtractor, {}),
            player.extractors.register(SoundcloudExtractor, {}),
            player.extractors.register(AppleMusicExtractor, {}),
        ]);

        await readyPromise;
    })();

    const managed: ManagedPlayer = { client, player, ready: fullReady, destroyTimer: null };
    players.set(token, managed);

    try {
        await fullReady;
    } catch (err) {
        players.delete(token);
        client.destroy();
        throw err;
    }

    return { client, player };
}

export async function destroyPlayer(token: string): Promise<boolean> {
    const managed = players.get(token);
    if (!managed) return false;


    if (managed.destroyTimer) {
        clearTimeout(managed.destroyTimer);
        managed.destroyTimer = null;
    }

    managed.player.destroy();
    managed.client.destroy();
    players.delete(token);
    return true;
}


export async function resolveVoiceChannel(client: Client, voiceId: string) {
    const channel = await client.channels.fetch(voiceId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildVoice) {
        throw new Error('Invalid voice channel ID or not a voice channel');
    }
    return channel;
}


export function getQueue(player: Player, guildId: string): GuildQueue | null {
    return player.nodes.get(guildId) || null;
}


export function formatTrack(track: any) {
    return {
        id: String(track.id),
        title: track.title,
        author: track.author,
        url: track.originalUrl || track.url,
        thumbnail: track.thumbnail,
        duration: track.duration,
        durationMS: track.durationMS,
        requestedBy: track.requestedBy ? String(track.requestedBy.id) : null,
        playlist: track.playlist ? {
            title: track.playlist.title,
            url: track.playlist.url
        } : null
    };
}

export { PLATFORM_MAP, QueryType };
