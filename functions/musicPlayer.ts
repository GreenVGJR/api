import { Client, GatewayIntentBits, ChannelType, PermissionsBitField } from 'discord.js';
import { LavalinkManager, Player as LavalinkPlayer, Track } from 'lavalink-client';
import { stream } from 'hono/streaming';
import crypto from 'crypto';
import config from '../config.json' with { type: 'json' };

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
            try {
                await s.write(`],"data":${JSON.stringify({ status: false, message: err?.message || 'Failed to process stream' })}}`);
            } catch { }
        }
    });
}

// ─── Lavalink Node Config ─────────────────────────────────────────────────────

const sg = crypto.randomUUID();

let LAVALINK_NODE: any;

if(config.useLocalLavalink) {
    LAVALINK_NODE = {
        id: sg,
        host: process.env.LAVALINK_HOST || '',
        port: parseInt(process.env.LAVALINK_PORT || '2333'),
        authorization: process.env.LAVALINK_PASS || 'youshallnotpass',
        secure: process.env.LAVALINK_SSL === 'true',
    };
}
else {
    LAVALINK_NODE = {
        id: sg,
        host: 'lavalinkv4.serenetia.com',
        port: 443,
        authorization: 'https://seretia.link/discord',
        secure: true,
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
            console.log(`⏭️  Auto-destroy skipped — 24/7 active for guild ${p.guildId} (token: ...${token.slice(-6)})`);
            return;
        }
    }
    // Also check state247 map directly (player may already be destroyed)
    for (const [key] of state247) {
        if (key.startsWith(token + ':') && state247.get(key)) {
            console.log(`⏭️  Auto-destroy skipped — 24/7 still set in state map (token: ...${token.slice(-6)})`);
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
                console.log(`⏭️  Auto-destroy cancelled at fire time — 24/7 active (token: ...${token.slice(-6)})`);
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

export async function getOrCreatePlayer(token: string, log?: (msg: string) => Promise<void>): Promise<{ client: Client; player: LavalinkManager }> {
    const existing = players.get(token);
    if (existing) {
        await existing.ready;
        cancelAutoDestroy(token);
        if (!existing.contextCached) ensureContextCached(existing, log);
        return { client: existing.client, player: existing.player };
    }

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMembers,
        ],
        presence: { status: 'invisible' },
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
                autoReconnect: false,
                destroyPlayer: true,
            },
            onEmptyQueue: {
                // undefined = never auto-destroy — we handle this entirely
                // ourselves in the queueEnd event so 24/7 mode works.
                destroyAfterMs: undefined,
            },
        },
        queueOptions: {
            maxPreviousTracks: 25,
        },
    });

    // Forward Discord gateway events to Lavalink
    client.on('raw', d => manager.sendRawData(d));

    // ── Shared 24/7 Reconnect ──────────────────────────────────────────────
    const reconnecting247 = new Set<string>(); // dedup concurrent calls per guild

    const reconnect247 = async (guildId: string, voiceChannelId: string, label: string) => {
        // Bail if this token's client was already destroyed
        if (!players.has(token)) {
            console.log(`⚠️  24/7 reconnect skipped — client already destroyed (token: ...${token.slice(-6)})`);
            return;
        }
        // Dedup: skip if a reconnect is already in-flight for this guild
        if (reconnecting247.has(guildId)) {
            console.log(`⚠️  24/7 reconnect already in-flight for guild ${guildId}, skipping`);
            return;
        }
        reconnecting247.add(guildId);
        console.log(`🔁 24/7 reconnect for guild ${guildId} → VC ${voiceChannelId} (${label})`);
        await new Promise(r => setTimeout(r, 1500));
        try {
            // Guard: client must still be alive and its shard ready
            if (!players.has(token) || client.ws.status !== 0) {
                console.log(`⚠️  24/7 reconnect aborted — client not ready (token: ...${token.slice(-6)})`);
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
            console.log(`✅ 24/7 reconnected to VC ${voiceChannelId} for guild ${guildId}`);
        } catch (err: any) {
            console.error(`❌ 24/7 reconnect failed for guild ${guildId}: ${err.message}`);
        } finally {
            reconnecting247.delete(guildId);
        }
    };

    // ── Manager Events ─────────────────────────────────────────────────────
    manager.on('trackStart', () => {
        cancelAutoDestroy(token);
    });

    manager.on('queueEnd', (p) => {
        if (get247(token, p.guildId)) {
            console.log(`📭 Queue empty for guild ${p.guildId}, 24/7 mode — staying in VC`);
            reconnect247(p.guildId, p.voiceChannelId!, 'queueEnd');
            return;
        }
        console.log(`📭 Queue empty for guild ${p.guildId}, scheduling auto-destroy (token: ...${token.slice(-6)})`);
        scheduleAutoDestroy(token);
    });

    manager.on('playerDestroy', (p) => {
        // voiceChannelId may already be null by the time this fires, fall back to last known
        const voiceChannelId = p.voiceChannelId ?? lastVoiceChannel.get(`${token}:${p.guildId}`);
        if (get247(token, p.guildId)) {
            if (voiceChannelId) {
                console.log(`🔌 Player destroyed for guild ${p.guildId} in 24/7 mode — reconnecting`);
                reconnect247(p.guildId, voiceChannelId, 'playerDestroy');
            } else {
                console.log(`🔌 Player destroyed for guild ${p.guildId} in 24/7 mode — no voiceChannelId to reconnect`);
            }
            return;
        }
        lastVoiceChannel.delete(`${token}:${p.guildId}`);
        console.log(`🔌 Lavalink player destroyed for guild ${p.guildId}`);
        scheduleAutoDestroy(token);
    });

    manager.nodeManager.on('error', (node, err) => {
        console.error(`[Lavalink Node Error] ${node.id}: ${(err as Error).message}`);
    });

    manager.nodeManager.on('disconnect', (node) => {
        console.warn(`[Lavalink] Node disconnected: ${node.id}`);
    });

    // ── Discord Events ─────────────────────────────────────────────────────
    client.on('voiceStateUpdate', (oldState, newState) => {
        if (oldState.member?.id !== client.user?.id) return;
        // Track last known VC whenever bot joins/moves
        if (newState.channelId) {
            lastVoiceChannel.set(`${token}:${newState.guild.id}`, newState.channelId);
        }
        if (oldState.channel && !newState.channel) {
            if (get247(token, oldState.guild.id)) {
                reconnect247(oldState.guild.id, oldState.channelId!, 'voiceStateUpdate');
                return;
            }
            console.log(`👢 Bot removed from voice channel "${oldState.channel.name}", scheduling auto-destroy (token: ...${token.slice(-6)})`);
            scheduleAutoDestroy(token);
        }
    });

    client.on('shardDisconnect', () => {
        console.log(`⚡ Client shard disconnected, destroying player (token: ...${token.slice(-6)})`);
        destroyPlayer(token);
    });

    // ── Login & Init ───────────────────────────────────────────────────────
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const readyPromise = new Promise<void>((resolve, reject) => {
        // Give the Discord login + node handshake up to 30 s total
        timeout = setTimeout(
            () => reject(new Error('Timed out waiting for Discord login and Lavalink node connection')),
            30_000
        );

        client.once('clientReady', async (readyClient) => {
            console.log(`🎵 Music client ready: ${readyClient.user.tag}`);
            try {
                // init() triggers node connections but does NOT wait for the
                // WebSocket handshake to complete — we must wait for 'connect'
                await manager.init({ id: readyClient.user.id, username: readyClient.user.username });

                // Resolve only once at least one Lavalink node is ready
                manager.nodeManager.once('connect', async () => {
                    if (timeout) clearTimeout(timeout);
                    console.log(`🔗 Lavalink node connected (token: ...${token.slice(-6)})`);
                    // Brief wait for the node to fully register as usable
                    await new Promise(r => setTimeout(r, 500));
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

        client.once('error', err => {
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
            client.destroy();
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

    // Clean up last known voice channels for this token
    for (const [key] of lastVoiceChannel) {
        if (key.startsWith(token + ':')) lastVoiceChannel.delete(key);
    }

    if (managed.destroyTimer) {
        clearTimeout(managed.destroyTimer);
        managed.destroyTimer = null;
    }

    /*
    // Destroy all guild players
    for (const [, p] of managed.player.players) {
        await p.destroy().catch(() => { });
    }
    */

    managed.client.destroy();
    return true;
}

async function ensureContextCached(managed: ManagedPlayer, log?: (msg: string) => Promise<void>) {
    if (managed.contextCached) return;
    managed.contextCached = true;

    const msg = 'Caching discord context for better performance (in background)';
    if (log) log(msg).catch(() => {}); // fire-and-forget log

    // Fire and forget — caller doesn't wait for this
    (async () => {
        try {
            const guilds = await managed.client.guilds.fetch();
            await Promise.all(
                guilds.map(async (g) => {
                    try {
                        const guild = await g.fetch();
                        await Promise.allSettled([
                            guild.channels.fetch(),
                            guild.roles.fetch(),
                            guild.members.fetch(),
                        ]);
                    } catch {
                        /* skip guild if fetch fails */
                    }
                })
            );
        } catch (err) {
            console.error('Context caching failed:', err);
        }
    })();
}

// ─── Utilities ────────────────────────────────────────────────────────────────

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

export function formatTrack(track: Track) {
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

// ─── Auto-Init ────────────────────────────────────────────────────────────────
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
        console.log('ℹ️  autoInit: No DISCORD_TOKENS set, skipping pre-warm');
        return;
    }

    console.log(`🚀 autoInit: Pre-warming ${tokens.length} Discord client(s)...`);

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