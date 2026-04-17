import { Client, GatewayIntentBits, ChannelType, PermissionsBitField, Options } from 'discord.js';
import { LavalinkManager, Player as LavalinkPlayer, Track } from 'lavalink-client';
import { stream } from 'hono/streaming';
import crypto from 'crypto';
import config from '../config.json' with { type: 'json' };
import { pullInfo, verifyChallenge } from './musicChallenges.ts';

// ─── Voice Status API Helper ───────────────────────────────────────────────

export async function setVoiceStatus(channelId: string, token: string, content: string, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/voice-status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bot ${token}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'DiscordBot (1.0.0)'
                },
                body: JSON.stringify({ status: content.slice(0, 500) })
            });

            if (res.status === 429) {
                const retryAfter = Number(res.headers.get('Retry-After')) || 5;
                console.warn(`Voice Status Rate Limited (Attempt ${i + 1}/${retries}). Retrying after ${retryAfter}s...`);
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                continue;
            }

            if (res.ok) return;

            // Log other errors but maybe retry if it's a 5xx
            if (res.status >= 500 && i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            return; // Give up on 4xx other than 429
        } catch (err) {
            console.error("Voice Status Fetch Error:", err);
            if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}



export async function updateVoiceStatus(player: LavalinkPlayer, token: string, track?: any) {
    const settings = getVoiceStatusSettings(token, player.guildId);
    const isActive = settings.trackStart.status;
    const template = settings.trackStart.content;
    const channelId = player.voiceChannelId || lastVoiceChannel.get(`${token}:${player.guildId}`);

    if (isActive === false || template === undefined || !channelId) return;

    const currentTrack = track || player.queue.current;

    if (template.trim() === "" || !currentTrack) {
        return setVoiceStatus(channelId, token, "").catch(() => { });
    }

    try {
        const content = applyTemplate(template, currentTrack);
        await setVoiceStatus(channelId, token, content);
    } catch (err) {
        console.error(`[VoiceStatus] Failed to update for guild ${player.guildId}:`, err);
    }
}

// ─── Streaming Helper ────────────────────────────────────────────────────────

export function createMusicStream(
    c: any,
    callback: (log: (msg: string) => Promise<void>, s: any) => Promise<void>
) {

    c.header('Content-Type', 'application/json');
    c.header('Cache-Control', 'public, no-cache, no-transform, no-store, max-age=0');
    c.header('X-Enc-Route', 'v3');
    c.header('X-Route', 'LIVE');
    c.header('X-Player', "lavalink");

    const lookExistChallengeC = c.req.header('cf-ipcountry') || "DE";
    const ipLL = c.req.header('cf-connecting-ip') || "127.0.0.1";
    if (["DE"].includes(lookExistChallengeC) === false && !verifyChallenge(c.req.header('x-challenge-codes'), ipLL)) {
        return c.json(pullInfo(ipLL), 403);
    }

    return stream(c, async (s: any) => {
        const startTime = Date.now();
        let logIndex = 0;

        await s.write('{"_logs":[');

        let logPromise = Promise.resolve();
        const log = (msg: string) => {
            logPromise = logPromise.then(async () => {
                const elapsed = Date.now() - startTime;
                const entry = `[${elapsed}ms] ${msg}`;
                const prefix = logIndex > 0 ? ',' : '';
                try { await s.write(`${prefix}${JSON.stringify(entry)}`); } catch { }
                logIndex++;
            });
            return logPromise;
        };

        try {
            await callback(log, s);
        } catch (err: any) {
            await log(`Error: ${err?.message || 'Failed to process stream'}`);
            try {
                await s.write(`],"data":${JSON.stringify({ status: false, message: err?.message || 'Failed to process stream' })}}`);
            } catch { }
        }
    });
}

// ─── Lavalink Node Config ─────────────────────────────────────────────────────

const sg = crypto.randomUUID();

let LAVALINK_NODE: any;

if (config.useLocalLavalink) {
    LAVALINK_NODE = {
        id: sg,
        host: process.env.LAVALINK_HOST || '',
        port: parseInt(process.env.LAVALINK_PORT || '2333'),
        authorization: process.env.LAVALINK_PASS || 'youshallnotpass',
        secure: process.env.LAVALINK_SSL === 'true',
        retryAmount: 50,
        retryDelay: 3000,
    };
}
else {
    LAVALINK_NODE = {
        id: sg,
        host: 'lavalinkv4.serenetia.com',
        port: 443,
        authorization: 'https://seretia.link/discord',
        secure: true,
        retryAmount: 50,
        retryDelay: 3000,
    };
}

// ─── Player Pool ──────────────────────────────────────────────────────────────

const AUTO_DESTROY_DELAY = 1 * 60 * 1000; // 1 minute

interface ManagedPlayer {
    client: Client;
    player: LavalinkManager; // "player" kept for API compat with routes
    ready: Promise<void>;
    destroyTimer: ReturnType<typeof setTimeout> | null;
    contextCached?: boolean;
}

const players = new Map<string, ManagedPlayer>();

// Persistent 24/7 state: "token:guildId" → true/false
// Stored separately so it survives Lavalink player object recreation
const state247 = new Map<string, boolean>();

// Last known voice channel per guild: "token:guildId" → voiceChannelId
// Used as fallback when playerDestroy fires after voiceChannelId is already null
const lastVoiceChannel = new Map<string, string>();

// Persistent voice status settings: "token:guildId" → { trackStart: { status, content }, ... }
export const voiceStatusStore = new Map<string, any>();

export function getVoiceStatusSettings(token: string, guildId: string) {
    const key = `${token}:${guildId}`;
    return voiceStatusStore.get(key) || {
        trackStart: { status: false, content: "" },
        queueEnd: { status: false, content: "" }
    };
}

export function setVoiceStatusSetting(token: string, guildId: string, type: string, status: boolean, content: string) {
    const key = `${token}:${guildId}`;
    const current = getVoiceStatusSettings(token, guildId);
    if (type === 'trackStart') current.trackStart = { status, content };
    else if (type === 'queueEnd') current.queueEnd = { status, content };
    voiceStatusStore.set(key, current);
}

export function get247Key(token: string, guildId: string) { return `${token}:${guildId}`; }
export function set247(token: string, guildId: string, value: boolean) { state247.set(get247Key(token, guildId), value); }
export function get247(token: string, guildId: string): boolean { return state247.get(get247Key(token, guildId)) ?? false; }
export function clear247(token: string, guildId: string) { state247.delete(get247Key(token, guildId)); }

export function hasActivePlayer(token: string): boolean {
    return players.has(token);
}

function scheduleAutoDestroy(token: string) {
    const managed = players.get(token);
    if (!managed) return;

    // Never auto-destroy if any guild under this token has 24/7 active
    for (const [, p] of managed.player.players) {
        if (get247(token, p.guildId)) {
            console.log(`⏭  Auto-destroy skipped — 24/7 active for guild ${p.guildId} (token: ...${token.slice(-6)})`);
            return;
        }
    }
    // Also check state247 map directly (player may already be destroyed)
    for (const [key] of state247) {
        if (key.startsWith(token + ':') && state247.get(key)) {
            console.log(`⏭  Auto-destroy skipped — 24/7 still set in state map (token: ...${token.slice(-6)})`);
            return;
        }
    }

    if (managed.destroyTimer) clearTimeout(managed.destroyTimer);

    managed.destroyTimer = setTimeout(async () => {
        const current = players.get(token);
        if (!current) return;

        // Re-check 24/7 at fire time too
        for (const [key] of state247) {
            if (key.startsWith(token + ':') && state247.get(key)) {
                console.log(`⏭  Auto-destroy cancelled at fire time — 24/7 active (token: ...${token.slice(-6)})`);
                return;
            }
        }

        let hasActivity = false;
        for (const [, p] of current.player.players) {
            if (p.playing || p.paused || p.queue.tracks.length > 0) {
                hasActivity = true;
                break;
            }
        }

        if (!hasActivity) {
            console.log(`🧹 Auto-destroying idle music client (token: ...${token.slice(-6)})`);
            await destroyPlayer(token);
        }
    }, AUTO_DESTROY_DELAY);
}

function cancelAutoDestroy(token: string) {
    const managed = players.get(token);
    if (!managed?.destroyTimer) return;
    clearTimeout(managed.destroyTimer);
    managed.destroyTimer = null;
}

// Handle potential library crashes from lavalink-client and discord.js
process.on('uncaughtException', (err) => {
    if (err.message.includes("Argument 'data.encoded' must be present")) {
        console.error('Caught and suppressed a crash in lavalink-client (trackStuck event):', err.message);
        return;
    }
    // Bun throws DOMException TimeoutError when discord.js tries to close a dead WebSocket
    if (err.name === 'TimeoutError' || (err as any).code === 23) {
        console.warn('Suppressed WebSocket TimeoutError during cleanup:', err.message);
        return;
    }
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason: any) => {
    // Suppress known non-fatal WebSocket/network errors from discord.js internals
    const msg = reason?.message || String(reason);
    if (
        reason?.name === 'TimeoutError' ||
        (reason as any)?.code === 23 ||
        msg.includes('The operation timed out') ||
        msg.includes('WebSocket was closed') ||
        msg.includes('Cannot send data')
    ) {
        console.warn('Suppressed unhandled rejection (WebSocket cleanup):', msg);
        return;
    }
    console.error('Unhandled Rejection:', reason);
});

export async function getOrCreatePlayer(token: string, log?: (msg: string) => Promise<void>): Promise<{ client: Client; player: LavalinkManager }> {
    const existing = players.get(token);
    if (existing) {
        await existing.ready;
        cancelAutoDestroy(token);

        // Sanity check: Ensure nodes are connected
        const disconnectedNodes = [...existing.player.nodeManager.nodes.values()].filter(n => !n.connected);
        if (disconnectedNodes.length > 0) {
            if (log) await log(`Reconnecting ${disconnectedNodes.length} disconnected Lavalink node(s)...`);
            await Promise.allSettled(disconnectedNodes.map(node => {
                return new Promise<void>((resolve) => {
                    const onConnect = () => {
                        (node as any).removeListener('connect', onConnect);
                        (node as any).removeListener('error', onError);
                        clearTimeout(timeout);
                        resolve();
                    };
                    const onError = () => {
                        (node as any).removeListener('connect', onConnect);
                        (node as any).removeListener('error', onError);
                        clearTimeout(timeout);
                        resolve(); // Resolve anyway to not hang
                    };
                    const timeout = setTimeout(onError, 5000);
                    (node as any).once('connect', onConnect);
                    (node as any).once('error', onError);
                    node.connect();
                });
            }));
        }

        if (!existing.contextCached) ensureContextCached(existing, log);
        return { client: existing.client, player: existing.player };
    }

    const client: Client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates,
        ],
        presence: { status: 'invisible' },
        // Speed up loading by disabling caches we don't use
        makeCache: Options.cacheWithLimits({
            ...Options.DefaultMakeCacheSettings,
            MessageManager: 0,
            ThreadManager: 0,
            PresenceManager: 0,
            ReactionManager: 0,
            GuildEmojiManager: 0,
            GuildStickerManager: 0,
            GuildScheduledEventManager: 0,
            ApplicationCommandManager: 0,
            BaseGuildEmojiManager: 0,
            GuildInviteManager: 0,
            // Keep a tiny member cache for the bot itself
            GuildMemberManager: {
                maxSize: 50,
                keepOverLimit: (member: any): boolean => member.id === member.client.user?.id,
            },
        }),
    });

    // Placeholder until the client is ready (id filled in on clientReady)
    const manager = new LavalinkManager({
        nodes: [LAVALINK_NODE].filter(n => n.host && n.host.length > 0),
        sendToShard: (guildId, payload) => {
            try {
                const shard = client.guilds.cache.get(guildId)?.shard;
                if (shard?.status === 0) shard.send(payload); // 0 = READY
            } catch { /* shard gone, ignore */ }
        },
        client: { id: 'pending', username: 'pending' },
        autoSkip: true,
        playerOptions: {
            defaultSearchPlatform: 'ytmsearch',
            onDisconnect: {
                autoReconnect: false, // We handle this ourselves in the node connect event
                destroyPlayer: false,
            },
            onEmptyQueue: {
                // undefined = never auto-destroy — we handle this entirely
                // ourselves in the queueEnd event so 24/7 mode works.
                destroyAfterMs: undefined,
                autoPlayFunction: async (player, lastPlayedTrack) => {
                    await fillAutoplay(player, lastPlayedTrack);
                }
            },
        },
        queueOptions: {
            maxPreviousTracks: 100,
        },
    });

    // Forward Discord gateway events to Lavalink
    client.on('raw', (d: any) => manager.sendRawData(d));

    // ─ Shared 24/7 Reconnect ───────────────
    const reconnecting247 = new Set<string>(); // dedup concurrent calls per guild

    const reconnect247 = async (guildId: string, voiceChannelId: string, label: string) => {
        // Bail if this token's client was already destroyed
        if (!players.has(token)) {
            console.log(`24/7 reconnect skipped — client already destroyed (token: ...${token.slice(-6)})`);
            return;
        }
        // Dedup: skip if a reconnect is already in-flight for this guild
        if (reconnecting247.has(guildId)) {
            console.log(`24/7 reconnect already in-flight for guild ${guildId}, skipping`);
            return;
        }
        reconnecting247.add(guildId);
        console.log(`24/7 reconnect for guild ${guildId} → VC ${voiceChannelId} (${label})`);
        await new Promise(r => setTimeout(r, 1500));
        try {
            // Guard: client must still be alive and its shard ready
            if (!players.has(token) || client.ws.status !== 0) {
                console.log(`24/7 reconnect aborted — client not ready (token: ...${token.slice(-6)})`);
                return;
            }
            let p = manager.players.get(guildId);
            if (!p) {
                p = await manager.createPlayer({
                    guildId,
                    voiceChannelId,
                    selfDeaf: true,
                    selfMute: false
                });
            }
            if (!p.connected) {
                p.voiceChannelId = voiceChannelId;
                await p.connect();
            }
            set247(token, guildId, true);
            lastVoiceChannel.set(`${token}:${guildId}`, voiceChannelId);
            console.log(`24/7 reconnected to VC ${voiceChannelId} for guild ${guildId}`);

            // Re-apply voice status in case it was cleared or reset during the transition
            const settings = getVoiceStatusSettings(token, guildId);
            const currentTrack = p.queue.current;
            const useTrackStart = !!currentTrack;
            const setting = useTrackStart ? settings.trackStart : settings.queueEnd;
            const trackToUse = currentTrack || p.queue.previous[p.queue.previous.length - 1];

            if (setting.status && setting.content && setting.content.trim() !== "") {
                const content = trackToUse ? applyTemplate(setting.content, trackToUse) : setting.content;
                setVoiceStatus(voiceChannelId, token, content).catch(() => { });
            }
        } catch (err: any) {
            console.error(`24/7 reconnect failed for guild ${guildId}: ${err.message}`);
        } finally {
            reconnecting247.delete(guildId);
        }
    };

    // ─ Manager Events ───────────────────
    manager.on('trackStart', (p, track) => {
        updateVoiceStatus(p, token, track).catch(() => { });
        cancelAutoDestroy(token);
        if (p.get('autoplay') && track) fillAutoplay(p, track);
    });



    manager.on('queueEnd', (p) => {
        const settings = getVoiceStatusSettings(token, p.guildId);
        const isActive = settings.queueEnd.status;
        const template = settings.queueEnd.content;
        if (isActive !== false && template && template.trim() !== "") {
            const lastTrack = p.queue.previous[p.queue.previous.length - 1];
            const content = lastTrack ? applyTemplate(template, lastTrack) : template;
            if (p.voiceChannelId) setVoiceStatus(p.voiceChannelId, token, content).catch(() => { });
        } else {
            if (p.voiceChannelId) setVoiceStatus(p.voiceChannelId, token, "").catch(() => { });
        }
        if (get247(token, p.guildId)) {
            console.log(`Queue empty for guild ${p.guildId}, 24/7 mode — staying in VC`);
            reconnect247(p.guildId, p.voiceChannelId!, 'queueEnd');
            return;
        }
        console.log(`Queue empty for guild ${p.guildId}, scheduling auto-destroy (token: ...${token.slice(-6)})`);
        scheduleAutoDestroy(token);
    });

    manager.on('playerDestroy', (p) => {
        // voiceChannelId may already be null by the time this fires, fall back to last known
        const voiceChannelId = p.voiceChannelId ?? lastVoiceChannel.get(`${token}:${p.guildId}`);
        const settings = getVoiceStatusSettings(token, p.guildId);

        if (get247(token, p.guildId)) {
            // Do not update voice status here. We keep the current status (trackStart or queueEnd)
            // so it persists smoothly through the reconnection.
            if (voiceChannelId) {
                console.log(`Player destroyed for guild ${p.guildId} in 24/7 mode — reconnecting`);
                reconnect247(p.guildId, voiceChannelId, 'playerDestroy');
            } else {
                console.log(`Player destroyed for guild ${p.guildId} in 24/7 mode — no voiceChannelId to reconnect`);
            }
            return;
        }

        // Not 24/7 - Clear status and reset configs
        if (voiceChannelId) setVoiceStatus(voiceChannelId, token, "").catch(() => { });
        voiceStatusStore.delete(`${token}:${p.guildId}`);

        lastVoiceChannel.delete(`${token}:${p.guildId}`);
        console.log(`Lavalink player destroyed for guild ${p.guildId}`);
        scheduleAutoDestroy(token);
    });

    manager.nodeManager.on('error', (node, err) => {
        console.error(`[Lavalink Node Error] ${node.id}: ${(err as Error).message}`);
    });

    manager.nodeManager.on('connect', (node) => {
        console.log(`Lavalink node connected: ${node.id}`);
        // Auto-resume: Find any players that were on this node and should be playing
        for (const player of manager.players.values()) {
            if (player.node && player.node.id === node.id) {
                // If the player was in a voice channel, we must re-connect to send the voice state 
                // to the new Lavalink session. Otherwise, Lavalink will have the track but no 
                // voice server details to stream to.
                if (player.voiceChannelId) {
                    player.connect().then(async () => {
                        // Wait for voice state updates to reach the node before playing
                        await new Promise(r => setTimeout(r, 2500));

                        if (player.queue.current) {
                            console.log(`Auto-resuming playback for guild ${player.guildId} at ${player.position}ms`);
                            player.play({ position: player.position }).catch((err: any) => {
                                console.error(`Failed to auto-resume for guild ${player.guildId}:`, err.message);
                            });
                        }
                    }).catch(err => {
                        console.error(`Failed to re-connect voice for guild ${player.guildId}:`, err.message);
                    });
                }
            }
        }
    });

    manager.nodeManager.on('disconnect', (node) => {
        console.warn(`[Lavalink] Node disconnected: ${node.id}`);
    });

    // ─ Discord Events ───────────────────
    client.on('voiceStateUpdate', (oldState: any, newState: any) => {
        if (oldState.member?.id !== client.user?.id) return;
        // Track last known VC whenever bot joins/moves
        if (newState.channelId) {
            lastVoiceChannel.set(`${token}:${newState.guild.id}`, newState.channelId);
        }
        if (oldState.channel && !newState.channel) {
            const settings = getVoiceStatusSettings(token, oldState.guild.id);
            const is247 = get247(token, oldState.guild.id);

            if (is247) {
                // Do not update voice status here. We keep the current status (trackStart or queueEnd)
                // so it persists smoothly through the reconnection.
                reconnect247(oldState.guild.id, oldState.channelId!, 'voiceStateUpdate');
                return;
            }

            // Not 24/7 - Clear status and reset configs
            setVoiceStatus(oldState.channelId!, token, "").catch(() => { });
            voiceStatusStore.delete(`${token}:${oldState.guild.id}`);

            console.log(`Bot removed from voice channel "${oldState.channel.name}", scheduling auto-destroy (token: ...${token.slice(-6)})`);
            scheduleAutoDestroy(token);
        }
    });

    client.on('shardDisconnect', () => {
        console.log(`Client shard disconnected, destroying player (token: ...${token.slice(-6)})`);
        destroyPlayer(token).catch(() => { /* already cleaning up */ });
    });

    // ─ Login & Init ───────────────────
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const readyPromise = new Promise<void>((resolve, reject) => {
        // Give the Discord login + node handshake up to 30 s total
        timeout = setTimeout(
            () => reject(new Error('Timed out waiting for Discord login and Lavalink node connection')),
            30_000
        );

        client.once('clientReady', async (readyClient: any) => {
            console.log(`Music client ready: ${readyClient.user.tag}`);
            try {
                // init() triggers node connections but does NOT wait for the
                // WebSocket handshake to complete — we must wait for 'connect'
                await manager.init({ id: readyClient.user.id, username: readyClient.user.username });

                // Resolve only once at least one Lavalink node is ready
                manager.nodeManager.once('connect', async () => {
                    if (timeout) clearTimeout(timeout);
                    console.log(`Lavalink node connected (token: ...${token.slice(-6)})`);
                    resolve();
                });

                manager.nodeManager.once('error', (_node, err) => {
                    if (timeout) clearTimeout(timeout);
                    reject(err as Error);
                });
            } catch (err) {
                if (timeout) clearTimeout(timeout);
                reject(err);
            }
        });

        client.once('error', (err: any) => {
            if (timeout) clearTimeout(timeout);
            reject(err);
        });
    });

    const managed: ManagedPlayer = { client, player: manager, ready: readyPromise, destroyTimer: null };
    players.set(token, managed);

    try {
        await client.login(token);
        await readyPromise;

        // Verify at least one node is actually connected and usable
        const connectedNodes = [...managed.player.nodeManager.nodes.values()].filter(n => n.connected);
        if (connectedNodes.length === 0) {
            players.delete(token);
            try { client.destroy(); } catch { /* WebSocket may already be dead */ }
            throw new Error('No Lavalink nodes available after connection');
        }

        ensureContextCached(managed, log);
    } catch (err) {
        if (timeout) clearTimeout(timeout);
        players.delete(token);
        client.destroy();
        throw err;
    }

    return { client, player: manager };
}

export async function destroyPlayer(token: string): Promise<boolean> {
    const managed = players.get(token);
    if (!managed) return false;

    // Remove from map first to prevent 24/7 reconnect from re-creating
    players.delete(token);

    // Clean up last known voice channels and voice status settings for this token
    for (const [key] of lastVoiceChannel) {
        if (key.startsWith(token + ':')) lastVoiceChannel.delete(key);
    }
    for (const [key] of voiceStatusStore) {
        if (key.startsWith(token + ':')) voiceStatusStore.delete(key);
    }

    if (managed.destroyTimer) {
        clearTimeout(managed.destroyTimer);
        managed.destroyTimer = null;
    }

    // Clear voice status for all active players before destroying the client
    try {
        const statusClears: Promise<void>[] = [];
        for (const p of managed.player.players.values()) {
            const voiceChannelId = p.voiceChannelId || lastVoiceChannel.get(`${token}:${p.guildId}`);
            if (voiceChannelId) {
                statusClears.push(setVoiceStatus(voiceChannelId, token, ""));
            }
        }
        if (statusClears.length > 0) {
            await Promise.all(statusClears).catch(() => { });
        }
    } catch (err) {
        console.error("Error clearing voice status during destroy:", err);
    }

    try { managed.client.destroy(); } catch { /* WebSocket may already be dead */ }
    return true;
}

async function ensureContextCached(managed: ManagedPlayer, log?: (msg: string) => Promise<void>) {
    if (managed.contextCached) return;
    managed.contextCached = true;

    // Fire and forget — caller doesn't wait for this
    (async () => {
        try {
            // Only fetch guilds and basic channel info, skipping heavy roles and members
            const guilds = await managed.client.guilds.fetch();
            await Promise.allSettled(
                guilds.map(async (g) => {
                    try {
                        const guild = await g.fetch();
                        await guild.channels.fetch();
                    } catch { }
                })
            );
        } catch (err) {
            console.error('Context caching failed:', err);
        }
    })();
}

// ── Utilities ────────────────────────

export function checkVoicePermissions(channel: any, botUser: any) {
    const permissions = channel.permissionsFor(botUser);
    if (!permissions?.has(PermissionsBitField.Flags.Connect)) {
        throw new Error(`I do not have permission to connect to the voice channel: ${channel.name}`);
    }
    if (!permissions?.has(PermissionsBitField.Flags.Speak)) {
        throw new Error(`I do not have permission to speak in the voice channel: ${channel.name}`);
    }
}

export async function resolveVoiceChannel(client: Client, voiceId: string) {
    const channel = await client.channels.fetch(voiceId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildVoice) {
        throw new Error('Invalid voice channel ID or not a voice channel');
    }

    checkVoicePermissions(channel, client.user!);

    return channel;
}

/** Returns the per-guild Lavalink player (equivalent to the old GuildQueue). */
export function getQueue(manager: LavalinkManager, guildId: string): LavalinkPlayer | null {
    return manager.players.get(guildId) ?? null;
}

export function formatDuration(ms: number): string {
    if (!ms || ms <= 0) return '0:00';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
}

export function formatTrack(track: Track | any) {
    const totalPlaylistTrack = (track as any)?.playlist?.tracks?.reduce((acc: number, track: any) => acc + (track?.duration ?? 0), 0);
    return {
        id: track.info.identifier,
        title: track.info.title,
        author: track.info.author,
        url: track.info.uri,
        source: (track.info as any).sourceName || '',
        thumbnail: track.info.artworkUrl ?? '',
        duration: formatDuration(track.info.duration),
        durationMS: String(track.info.duration),
        isSeekable: track.info.isSeekable,
        isStream: track.info.isStream,
        requestedBy: track.requester
            ? String((track.requester as any).id ?? track.requester)
            : null,
        requester: track.requester || null,
        playlist: (track as any).playlist ? {
            name: (track as any).playlist.name,
            size: (track as any).playlist.tracks?.length,
            // ig this might result slow response
            elapsedTime: {
                label: formatDuration(totalPlaylistTrack),
                value: String(totalPlaylistTrack)
            }
        } : null,
    };
}

function applyTemplate(template: string, track: any): string {
    const data = formatTrack(track);
    return template.replace(/{([\w.]+)}/g, (match, path) => {
        const parts = path.split('.');
        const value = parts.reduce((obj: any, key: string) => obj?.[key], data);
        return value !== undefined ? String(value) : match;
    });
}

/** Maps platform names → Lavalink search prefixes. */
export const PLATFORM_SEARCH: Record<string, string> = {
    soundcloud: 'scsearch',
    spotify: 'spsearch',
    applemusic: 'amsearch',
    youtube: 'ytsearch',
    youtubemusic: 'ytmsearch',
    deezer: 'dzsearch',
    tidal: 'tdsearch',
};

// ── Auto-Init ────────────────────────
// Reads DISCORD_TOKENS (comma-separated) from env and pre-warms each client so
// the Lavalink node connection is ready before the first request arrives.
//
// Set in your .env / pm2 ecosystem:
//   DISCORD_TOKENS=Bot1Token,Bot2Token
//
export async function autoInit(): Promise<void> {
    const raw = process.env.DISCORD_TOKENS || '';
    const tokens = raw.split(',').map(t => t.trim()).filter(Boolean);

    if (tokens.length === 0) {
        console.log('autoInit: No DISCORD_TOKENS set, skipping pre-warm');
        return;
    }

    console.log(`autoInit: Pre-warming ${tokens.length} Discord client(s)...`);

    await Promise.allSettled(
        tokens.map(async (token) => {
            try {
                await getOrCreatePlayer(token);
            } catch (err: any) {
                console.error(`❌ autoInit: Failed for token ...${token.slice(-6)}: ${err.message}`);
            }
        })
    );
}

/**
 * Fills the queue with recommended tracks if autoplay is enabled.
 * Keeps at least 50 recommended tracks in the queue.
 */
export async function fillAutoplay(player: LavalinkPlayer, baseTrack?: Track) {
    if (!player.get('autoplay')) return;

    // Safety: don't start multiple fills at once
    if (player.get('isFillingAutoplay')) return;
    player.set('isFillingAutoplay', true);

    try {
        let currentAutoplayCount = player.queue.tracks.filter(t => (t.requester as any)?.isAutoplay).length;
        let attempts = 0;
        const TARGET = 50;

        while (currentAutoplayCount < TARGET && attempts < 3) {
            attempts++;
            // Use the last track currently in the queue pool as the seed to keep progression going forward
            const track = player.queue.tracks[player.queue.tracks.length - 1] || player.queue.current || baseTrack;
            if (!track) break;

            const previousTracks = player.queue.previous.map(t => t.info.identifier);
            const queueTracks = player.queue.tracks.map(t => t.info.identifier);

            const source = track.info.sourceName;
            let searchStr = `ytmsearch:${track.info.author} ${track.info.title}`;

            if (source === 'spotify') {
                searchStr = `sprec:${track.info.identifier}`;
            } else if (source === 'applemusic') {
                searchStr = `amrec:${track.info.identifier}`;
            } else if (source === 'deezer') {
                searchStr = `dzrec:${track.info.identifier}`;
            } else if (source === 'youtube' || source === 'youtubemusic') {
                searchStr = `ytmsearch:${track.info.author} ${track.info.title}`;
            }

            const res = await player.search({ query: searchStr }, (track.requester as any)?.isAutoplay ? undefined : track.requester);
            if (!res.tracks?.length) break;

            const needed = TARGET - currentAutoplayCount;
            const toAdd = res.tracks
                .filter(t => {
                    const id = t.info.identifier;
                    if (!id) return false;
                    const isDuplicate = previousTracks.includes(id) || queueTracks.includes(id);
                    const titleA = t.info.title.toLowerCase();
                    const titleB = track.info.title.toLowerCase();
                    const isSimilarTitle = titleA.includes(titleB) || titleB.includes(titleA);
                    return !isDuplicate && !isSimilarTitle;
                })
                .slice(0, needed);

            if (toAdd.length === 0) break;

            for (const t of toAdd) {
                t.requester = track.requester ? { ...(track.requester as any), isAutoplay: true } : { id: 'api', username: 'API', isAutoplay: true };
                await player.queue.add(t);
            }

            currentAutoplayCount = player.queue.tracks.filter(t => (t.requester as any)?.isAutoplay).length;
            if (!player.playing && !player.paused) await player.play();
        }
    } catch (err) {
        console.error('Autoplay error:', err);
    } finally {
        player.set('isFillingAutoplay', false);
    }
}