import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  Options,
  VoiceChannel,
} from "discord.js";
import {
  LavalinkManager,
  Player as LavalinkPlayer,
  Track,
} from "lavalink-client";
import { stream } from "hono/streaming";
import crypto from "crypto";
import zlib from "zlib";
import config from "../config.json" with { type: "json" };
import {
  generateChallenge,
  verifyChallenge,
  verifyChallengeHash,
  ipToNumber,
} from "./musicChallenges.ts";
// import { Number_random } from './request.ts';

/**
 * Patch a Lavalink node's connect() method to temporarily disable TLS
 * certificate verification only during the WebSocket handshake.
 * This avoids globally setting NODE_TLS_REJECT_UNAUTHORIZED which would
 * break HTTP/2 fetch and other secure connections in the process.
 */
function patchNodeTls(node: any) {
  if (!config.disableTLSMusic) return;
  if (node.__tlsPatched) return;
  node.__tlsPatched = true;
  const origConnect = node.connect.bind(node);
  node.connect = (...args: any[]) => {
    const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    try {
      return origConnect(...args);
    } finally {
      // Restore after the synchronous WebSocket constructor call.
      // The actual TLS handshake happens async but Bun/ws captures the
      // env value at construction time.
      if (prev === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
    }
  };
}

const transientFetchCodes = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EPIPE",
  "UND_ERR_SOCKET",
]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFetchErrorCode(err: any): string {
  return String(err?.code || err?.cause?.code || "");
}

function isTransientFetchError(err: any): boolean {
  const code = getFetchErrorCode(err);
  const message = String(err?.message || err || "").toLowerCase();
  return (
    transientFetchCodes.has(code) ||
    message.includes("socket connection was closed") ||
    message.includes("fetch failed")
  );
}

export async function setVoiceStatus(
  channelId: string,
  token: string,
  content: string,
  retries = 3,
) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/voice-status`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bot ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "DiscordBot (1.0.0)",
          },
          body: JSON.stringify({ status: content.slice(0, 500) }),
        },
      );

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("Retry-After")) || 5;
        console.warn(
          `Voice Status Rate Limited (Attempt ${i + 1}/${retries}). Retrying after ${retryAfter}s...`,
        );
        await sleep(retryAfter * 1000);
        continue;
      }

      if (res.ok) return;

      if (res.status >= 500 && i < retries - 1) {
        await sleep(1000 * (i + 1));
        continue;
      }

      return;
    } catch (err) {
      const canRetry = i < retries - 1 && isTransientFetchError(err);
      if (!canRetry) {
        console.error("Voice Status Fetch Error:", err);
        return;
      }

      const delay = 750 * (i + 1);
      console.warn(
        `Voice Status Fetch Retry (${i + 1}/${retries}): ${getFetchErrorCode(err) || "network error"}, retrying in ${delay}ms`,
      );
      await sleep(delay);
    }
  }
}

export async function updateVoiceStatus(
  player: LavalinkPlayer,
  token: string,
  track?: any,
) {
  const settings = getVoiceStatusSettings(token, player.guildId);
  const isActive = settings.trackStart.status;
  const template = settings.trackStart.content;
  const channelId =
    player.voiceChannelId || lastVoiceChannel.get(`${token}:${player.guildId}`);

  if (isActive === false || template === undefined || !channelId) return;

  const currentTrack = track || player.queue.current;

  if (template.trim() === "" || !currentTrack) {
    return setVoiceStatus(channelId, token, "").catch(() => {});
  }

  try {
    const content = applyTemplate(template, currentTrack);
    await setVoiceStatus(channelId, token, content);
  } catch (err) {
    console.error(
      `[VoiceStatus] Failed to update for guild ${player.guildId}:`,
      err,
    );
  }
}

// ─── Streaming Helper ────────────────────────────────────────────────────────

export async function createMusicStream(
  c: any,
  callback: (log: (msg: string) => Promise<void>, s: any) => Promise<void>,
) {
  c.header("Content-Type", "application/json");
  c.header("Cache-Control", "public, no-transform, max-age=0, must-revalidate");

  const lookExistChallengeC = c.req.header("cf-ipcountry") || "DE";
  if (["DE"].includes(lookExistChallengeC) === false) {
    const checkAccept = c.req.header("accept") === "application/json";
    let checkReferer = false;
    try {
      const referer = c.req.header("referer");
      if (referer) {
        const refUrl = new URL(referer);
        const reqUrl = new URL(c.req.url);
        checkReferer =
          refUrl.host === reqUrl.host && referer.endsWith("/playground");
      }
    } catch {}
    const ipLL = ipToNumber(c.req.header("cf-connecting-ip") || "127.0.0.1");
    const rrmc = c.req.header("x-challenge-codes") || "";
    const challengeHash = c.req.header("x-challenge") || "";
    const checkValidChallenges =
      !verifyChallengeHash(rrmc, challengeHash) ||
      !(await verifyChallenge(rrmc, ipLL));
    if (checkValidChallenges) {
      c.header("X-Player", "lavalink");
      c.header(
        "X-Warning",
        "Germany (DE) only. Outside that, you need to solve this challenge",
      );
      c.header("Content-Type", "text/event-stream");
      c.header(
        "Cache-Control",
        "public, no-cache, no-store, no-transform, max-age=0, must-revalidate",
      );
      if (!(checkAccept && checkReferer)) {
        c.header("Location", "/playground");
      }
      const challengeData = generateChallenge(ipLL);
      c.status(302);
      if (checkAccept && checkReferer) {
        const ch = challengeData.challenge;
        const parts: string[] = [];
        let i = 0;
        while (i < ch.length) {
          const len = 1 + Math.floor(Math.random() * 8);
          parts.push(ch.slice(i, i + len));
          i += len;
        }
        const payload = JSON.stringify({
          _challenge: true,
          c: parts,
          d: challengeData.difficulty,
        });
        const gzipData = zlib.gzipSync(Buffer.from(payload));
        return stream(c, async (s: any) => {
          await s.write(gzipData);
        });
      } else {
        return c.body(null);
      }
    }
  }

  c.header("X-Player", "lavalink");
  c.header("X-Enc-Route", "v4-beta");
  c.header("X-Route", "LIVE");

  return stream(c, async (s: any) => {
    let isAborted = false;
    if (s.onAbort) {
      s.onAbort(() => {
        isAborted = true;
      });
    }

    const safeWrite = async (data: string) => {
      if (isAborted) return;
      try {
        await s.write(data);
      } catch {
        isAborted = true;
      }
    };

    const startTime = Date.now();
    let logIndex = 0;

    await safeWrite('{"_logs":[');

    let logPromise = Promise.resolve();
    const log = (msg: string) => {
      logPromise = logPromise.then(async () => {
        if (isAborted) return;
        const elapsed = Date.now() - startTime;
        const entry = `[${elapsed}ms] ${msg}`;
        const prefix = logIndex > 0 ? "," : "";
        await safeWrite(`${prefix}${JSON.stringify(entry)}`);
        logIndex++;
      });
      return logPromise;
    };

    const customS = {
      write: async (data: string) => {
        await logPromise;
        await safeWrite(data);
      },
      onAbort: s.onAbort ? s.onAbort.bind(s) : undefined,
      close: s.close ? s.close.bind(s) : undefined,
    };

    try {
      await callback(log, customS);
      await logPromise;
    } catch (err: any) {
      await logPromise;
      await log(`Error: ${err?.message || "Failed to process stream"}`);
      await logPromise;
      await safeWrite(
        `],"data":${JSON.stringify({ status: false, message: err?.message || "Failed to process stream", type: { primary: "error", alt: "critical" } })}}`,
      );
    }
  });
}

// ─── Lavalink Node Config ─────────────────────────────────────────────────────

const sg = crypto.randomUUID();

let LAVALINK_NODES: any[] = [];
let LAVALINK_NODE_GROUPS: any[][] = [];

const localNode = {
  id: "vgjr_" + sg,
  host: process.env.LAVALINK_HOST || "",
  port: parseInt(process.env.LAVALINK_PORT || "2333"),
  authorization: process.env.LAVALINK_PASS || "youshallnotpass",
  secure: process.env.LAVALINK_SSL === "true",
  retryAmount: 10,
  retryDelay: 10000,
};

const serentiaNode = {
  id: "serenetia_" + sg,
  host: "lavalinkv4.serenetia.com",
  port: 443,
  authorization: "https://seretia.link/discord",
  secure: true,
  retryAmount: 10,
  retryDelay: 10000,
};

if (config.useLocalLavalink === 1) {
  LAVALINK_NODE_GROUPS = [[localNode]];
} else if (config.useLocalLavalink === 2) {
  LAVALINK_NODE_GROUPS = [[serentiaNode], [localNode]];
} else {
  LAVALINK_NODE_GROUPS = [[serentiaNode]];
}

LAVALINK_NODES = LAVALINK_NODE_GROUPS[0] || [];

function lavalinkNodeGroups() {
  return LAVALINK_NODE_GROUPS.map((group) =>
    group.filter((node) => node.host && node.host.length > 0),
  ).filter((group) => group.length > 0);
}

function lavalinkNodeLabel(nodes: any[]) {
  return nodes.map((node) => node.id).join(", ");
}

function clearLavalinkNodes(manager: LavalinkManager) {
  const nodesToKill = [...manager.nodeManager.nodes.values()];
  for (const node of nodesToKill) {
    try {
      (node as any).resetReconnectionAttempts?.();
    } catch {}
    try {
      manager.nodeManager.nodes.delete(node.id);
    } catch {}
    try {
      node.disconnect();
    } catch {}
    try {
      (node as any).socket?.close();
    } catch {}
    try {
      (node as any).ws?.close();
    } catch {}
    try {
      (node as any).socket = null;
    } catch {}
    try {
      (node as any).ws = null;
    } catch {}
  }
}

function createLavalinkNodes(manager: LavalinkManager, nodeConfigs: any[]) {
  for (const nodeConfig of nodeConfigs) {
    if (nodeConfig.host) {
      const node = manager.nodeManager.createNode(nodeConfig);
      patchNodeTls(node);
    }
  }
}

function waitForLavalinkConnection(
  manager: LavalinkManager,
  timeoutMs: number,
  connectNodes: boolean,
) {
  const nodes = [...manager.nodeManager.nodes.values()];
  if (nodes.some((node) => node.connected)) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    let settled = false;

    const onConnect = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        (manager.nodeManager as any).off("connect", onConnect);
      } catch {}
      resolve(true);
    };

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        (manager.nodeManager as any).off("connect", onConnect);
      } catch {}
      resolve(false);
    }, timeoutMs);

    manager.nodeManager.once("connect", onConnect);

    if (connectNodes) {
      for (const node of nodes) {
        if (!node.connected) {
          try {
            node.connect();
          } catch {}
        }
      }
    }
  });
}

async function connectLavalinkWithFallback(
  manager: LavalinkManager,
  timeoutMs: number,
  log?: (msg: string) => Promise<void>,
  useExistingPrimary = false,
) {
  const groups = lavalinkNodeGroups();
  if (groups.length === 0) return false;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const isExistingPrimary = i === 0 && useExistingPrimary;

    if (!isExistingPrimary) {
      clearLavalinkNodes(manager);
      createLavalinkNodes(manager, group);
    }

    const connected = await waitForLavalinkConnection(
      manager,
      timeoutMs,
      !isExistingPrimary,
    );
    if (connected) return true;

    if (i < groups.length - 1 && log) {
      await log(
        `Lavalink node group failed (${lavalinkNodeLabel(group)}). Trying fallback...`,
      );
    }
  }

  return false;
}

// ─── Player Pool ──────────────────────────────────────────────────────────────

const AUTO_DESTROY_DELAY = 1 * 60 * 1000; // 1 minute
const pendingPlayers = new Map<
  string,
  Promise<{ client: Client; player: LavalinkManager }>
>();

interface ManagedPlayer {
  client: Client;
  player: LavalinkManager; // "player" kept for API compat with routes
  ready: Promise<void>;
  startup?: Promise<void>;
  destroyTimer: ReturnType<typeof setTimeout> | null;
  reconnecting?: Promise<void> | null;
  contextCached?: boolean;
}

const g = globalThis as any;

const players: Map<string, ManagedPlayer> =
  g.__vgjr_players || (g.__vgjr_players = new Map<string, ManagedPlayer>());
const musicLogCooldowns: Map<string, number> =
  g.__vgjr_musicLogCooldowns ||
  (g.__vgjr_musicLogCooldowns = new Map<string, number>());

// Persistent 24/7 state: "token:guildId" → true/false
// Stored separately so it survives Lavalink player object recreation
const state247: Map<string, boolean> =
  g.__vgjr_state247 || (g.__vgjr_state247 = new Map<string, boolean>());

// Last known voice channel per guild: "token:guildId" → voiceChannelId
// Used as fallback when playerDestroy fires after voiceChannelId is already null
const lastVoiceChannel: Map<string, string> =
  g.__vgjr_lastVoiceChannel ||
  (g.__vgjr_lastVoiceChannel = new Map<string, string>());

// Persistent voice status settings: "token:guildId" → { trackStart: { status, content }, ... }
export const voiceStatusStore: Map<string, any> =
  g.__vgjr_voiceStatusStore ||
  (g.__vgjr_voiceStatusStore = new Map<string, any>());

export function getVoiceStatusSettings(token: string, guildId: string) {
  const key = `${token}:${guildId}`;
  return (
    voiceStatusStore.get(key) || {
      trackStart: { status: false, content: "" },
      queueEnd: { status: false, content: "" },
    }
  );
}

export function setVoiceStatusSetting(
  token: string,
  guildId: string,
  type: string,
  status: boolean,
  content: string,
) {
  const key = `${token}:${guildId}`;
  const current = getVoiceStatusSettings(token, guildId);
  if (type === "trackStart") current.trackStart = { status, content };
  else if (type === "queueEnd") current.queueEnd = { status, content };
  voiceStatusStore.set(key, current);
}

export function get247Key(token: string, guildId: string) {
  return `${token}:${guildId}`;
}
export function set247(token: string, guildId: string, value: boolean) {
  state247.set(get247Key(token, guildId), value);
}
export function get247(token: string, guildId: string): boolean {
  return state247.get(get247Key(token, guildId)) ?? false;
}
export function clear247(token: string, guildId: string) {
  state247.delete(get247Key(token, guildId));
}

function musicErrorMessage(err: any): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  const msg = err.message || err.name || String(err);
  const path = err.path ? ` (${err.path})` : "";
  return `${msg}${path}`;
}

function isKnownTransientMusicError(err: any): boolean {
  const msg = musicErrorMessage(err);
  return (
    err?.name === "TimeoutError" ||
    err?.code === 23 ||
    err?.code === "ConnectionRefused" ||
    msg.includes("The operation timed out") ||
    msg.includes("Failed to parse JSON") ||
    msg.includes("Unable to connect") ||
    msg.includes("ConnectionRefused") ||
    msg.includes("The node is not connected") ||
    msg.includes("Node is not connected") ||
    msg.includes("fetch failed") ||
    msg.includes("ECONNREFUSED")
  );
}

function warnMusicThrottled(key: string, message: string, cooldownMs = 60_000) {
  const now = Date.now();
  const last = musicLogCooldowns.get(key) || 0;
  if (now - last < cooldownMs) return;
  musicLogCooldowns.set(key, now);
  console.warn(message);
}

function safeResumePosition(player: LavalinkPlayer): number | undefined {
  const currentTrack = player.queue.current as any;
  const duration = Number(currentTrack?.info?.duration || 0);
  const position = Number(player.position || 0);

  if (!Number.isFinite(duration) || duration <= 0) return undefined;
  if (!Number.isFinite(position) || position <= 0) return undefined;

  const maxPosition = duration - 1000;
  if (maxPosition <= 0 || position >= maxPosition) return undefined;

  return Math.max(1, Math.floor(position));
}

export function hasActivePlayer(token: string): boolean {
  return players.has(token);
}

function scheduleAutoDestroy(token: string) {
  const managed = players.get(token);
  if (!managed) return;

  // Never auto-destroy if any guild under this token has 24/7 active
  for (const [, p] of managed.player.players) {
    if (get247(token, p.guildId)) {
      console.log(
        `⏭  Auto-destroy skipped — 24/7 active for guild ${p.guildId} (token: ...${token.slice(-6)})`,
      );
      return;
    }
  }
  // Also check state247 map directly (player may already be destroyed)
  for (const [key] of state247) {
    if (key.startsWith(token + ":") && state247.get(key)) {
      console.log(
        `⏭  Auto-destroy skipped — 24/7 still set in state map (token: ...${token.slice(-6)})`,
      );
      return;
    }
  }

  if (managed.destroyTimer) clearTimeout(managed.destroyTimer);

  managed.destroyTimer = setTimeout(async () => {
    const current = players.get(token);
    if (!current) return;

    // Re-check 24/7 at fire time too
    for (const [key] of state247) {
      if (key.startsWith(token + ":") && state247.get(key)) {
        console.log(
          `⏭  Auto-destroy cancelled at fire time — 24/7 active (token: ...${token.slice(-6)})`,
        );
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
      console.log(
        `🧹 Auto-destroying idle music client (token: ...${token.slice(-6)})`,
      );
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

// Handle potential library crashes from lavalink-client and discord.js.
// Hot reload can re-evaluate this module, so install global handlers once.
if (!g.__vgjr_music_process_handlers_installed) {
  g.__vgjr_music_process_handlers_installed = true;

  process.on("uncaughtException", (err) => {
    const msg = musicErrorMessage(err);
    if (msg.includes("Argument 'data.encoded' must be present")) {
      console.error(
        "Caught and suppressed a crash in lavalink-client (trackStuck event):",
        msg,
      );
      return;
    }
    if (isKnownTransientMusicError(err)) {
      warnMusicThrottled(
        "uncaught:" + msg,
        `Suppressed transient music exception: ${msg}`,
      );
      return;
    }
    // Bun throws DOMException TimeoutError when discord.js tries to close a dead WebSocket
    if (err.name === "TimeoutError" || (err as any).code === 23) {
      console.warn("Suppressed WebSocket TimeoutError during cleanup:", msg);
      return;
    }
    console.error("Uncaught Exception:", err);
  });

  process.on("unhandledRejection", (reason: any) => {
    // Suppress known non-fatal WebSocket/network errors from discord.js/lavalink internals
    const msg = musicErrorMessage(reason);
    if (
      isKnownTransientMusicError(reason) ||
      reason?.name === "TimeoutError" ||
      (reason as any)?.code === 23 ||
      msg.includes("The operation timed out") ||
      msg.includes("WebSocket was closed") ||
      msg.includes("Cannot send data") ||
      msg.includes("writableStreamDefaultWriterRelease")
    ) {
      warnMusicThrottled(
        "unhandled:" + msg,
        `Suppressed transient music rejection: ${msg}`,
      );
      return;
    }
    console.error("Unhandled Rejection:", reason);
  });
}

export async function getOrCreatePlayer(
  token: string,
  log?: (msg: string) => Promise<void>,
): Promise<{ client: Client; player: LavalinkManager }> {
  const existing = players.get(token);
  if (existing) {
    if (existing.startup) {
      await existing.startup;
    } else {
      await existing.ready;
    }
    cancelAutoDestroy(token);

    // Safety: Ensure manager has nodes (in case they were lost during a previous cleanup or error)
    if (
      existing.player.nodeManager.nodes.size === 0 &&
      LAVALINK_NODES.length > 0
    ) {
      if (log) await log(`Recovering lost Lavalink node configurations...`);
      for (const nodeConfig of LAVALINK_NODES) {
        if (nodeConfig.host) {
          const node = existing.player.nodeManager.createNode(nodeConfig);
          patchNodeTls(node);
        }
      }
    }

    // Sanity check: Ensure at least one node is connected
    const allNodes = [...existing.player.nodeManager.nodes.values()];
    const connectedCount = allNodes.filter((n) => n.connected).length;

    if (connectedCount === 0 && allNodes.length > 0) {
      if (existing.reconnecting) {
        if (log)
          await log(
            `A reconnection attempt is already in progress, waiting...`,
          );
        await existing.reconnecting;
      } else {
        existing.reconnecting = (async () => {
          if (log)
            await log(`All Lavalink nodes are disconnected. Reconnecting...`);
          await connectLavalinkWithFallback(existing.player, 8000, log);
        })();

        try {
          await existing.reconnecting;
        } finally {
          existing.reconnecting = null;
        }
      }

      const finalConnectedCount = [
        ...existing.player.nodeManager.nodes.values(),
      ].filter((n) => n.connected).length;
      if (finalConnectedCount === 0) {
        await destroyPlayer(token);
        throw new Error(
          "Lavalink reconnection failed. The music client has been reset for a fresh start. Please ensure your Lavalink server is running and try again.",
        );
      }
      if (log)
        await log(
          `Successfully reconnected ${finalConnectedCount} Lavalink node(s).`,
        );
    }

    if (!existing.contextCached) ensureContextCached(existing);
    return { client: existing.client, player: existing.player };
  }

  if (pendingPlayers.has(token)) {
    if (log) await log(`Waiting for background client initialization...`);
    const result = await pendingPlayers.get(token)!;

    // After waiting for the pending client, ensure the context is cached
    const managed = players.get(token);
    if (managed && !managed.contextCached) {
      ensureContextCached(managed);
    }
    return result;
  }

  let initResolve: (val: { client: Client; player: LavalinkManager }) => void;
  let initReject: (err: any) => void;
  const initPromise = new Promise<{ client: Client; player: LavalinkManager }>(
    (res, rej) => {
      initResolve = res;
      initReject = rej;
    },
  );

  pendingPlayers.set(token, initPromise);

  (async () => {
    try {
      if (log) await log("Creating Lavalink player...");

      const client: Client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
        presence: { status: "invisible" },
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
            keepOverLimit: (member: any): boolean =>
              member.id === member.client.user?.id,
          },
        }),
      });

      // Placeholder until the client is ready (id filled in on clientReady)
      const manager = new LavalinkManager({
        nodes: LAVALINK_NODES.filter((n) => n.host && n.host.length > 0),
        sendToShard: (guildId, payload) => {
          try {
            const shard = client.guilds.cache.get(guildId)?.shard;
            if (shard?.status === 0) shard.send(payload); // 0 = READY
          } catch {
            /* shard gone, ignore */
          }
        },
        client: { id: "pending", username: "pending" },
        autoSkip: true,
        playerOptions: {
          defaultSearchPlatform: "ytmsearch",
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
            },
          },
        },
        queueOptions: {
          maxPreviousTracks: 100,
        },
      });

      // Patch all nodes for scoped TLS bypass before init() connects them
      for (const node of manager.nodeManager.nodes.values()) {
        patchNodeTls(node);
      }

      // Forward Discord gateway events to Lavalink
      client.on("raw", (d: any) => manager.sendRawData(d));

      // ─ Shared 24/7 Reconnect ───────────────
      const reconnecting247 = new Set<string>(); // dedup concurrent calls per guild

      const reconnect247 = async (
        guildId: string,
        voiceChannelId: string,
        label: string,
      ) => {
        // Bail if this token's client was already destroyed
        if (!players.has(token)) {
          console.log(
            `24/7 reconnect skipped — client already destroyed (token: ...${token.slice(-6)})`,
          );
          return;
        }
        // Dedup: skip if a reconnect is already in-flight for this guild
        if (reconnecting247.has(guildId)) {
          console.log(
            `24/7 reconnect already in-flight for guild ${guildId}, skipping`,
          );
          return;
        }
        reconnecting247.add(guildId);
        console.log(
          `24/7 reconnect for guild ${guildId} → VC ${voiceChannelId} (${label})`,
        );
        await new Promise((r) => setTimeout(r, 1500));
        try {
          if (!players.has(token) || client.ws.status !== 0) {
            console.log(
              `24/7 reconnect aborted — client not ready (token: ...${token.slice(-6)})`,
            );
            return;
          }
          let p = manager.players.get(guildId);
          if (!p) {
            p = await manager.createPlayer({
              guildId,
              voiceChannelId,
              selfDeaf: true,
              selfMute: false,
            });
          }
          if (!p.connected) {
            p.voiceChannelId = voiceChannelId;
            await p.connect();
          }
          set247(token, guildId, true);
          lastVoiceChannel.set(`${token}:${guildId}`, voiceChannelId);
          console.log(
            `24/7 reconnected to VC ${voiceChannelId} for guild ${guildId}`,
          );

          const settings = getVoiceStatusSettings(token, guildId);
          const currentTrack = p.queue.current;
          const useTrackStart = !!currentTrack;
          const setting = useTrackStart
            ? settings.trackStart
            : settings.queueEnd;
          const trackToUse =
            currentTrack || p.queue.previous[p.queue.previous.length - 1];

          if (
            setting.status &&
            setting.content &&
            setting.content.trim() !== ""
          ) {
            const content = trackToUse
              ? applyTemplate(setting.content, trackToUse)
              : setting.content;
            setVoiceStatus(voiceChannelId, token, content).catch(() => {});
          }
        } catch (err: any) {
          const msg = musicErrorMessage(err);
          if (isKnownTransientMusicError(err)) {
            warnMusicThrottled(
              `247-reconnect:${guildId}:${msg}`,
              `24/7 reconnect skipped for guild ${guildId}: ${msg}`,
              30_000,
            );
          } else {
            console.error(`24/7 reconnect failed for guild ${guildId}: ${msg}`);
          }
        } finally {
          reconnecting247.delete(guildId);
        }
      };

      // ─ Manager Events ───────────────────
      manager.on("trackStart", (p, track) => {
        updateVoiceStatus(p, token, track).catch(() => {});
        cancelAutoDestroy(token);
        if (p.get("autoplay") && track) fillAutoplay(p, track);
      });

      manager.on("queueEnd", (p) => {
        const settings = getVoiceStatusSettings(token, p.guildId);
        const isActive = settings.queueEnd.status;
        const template = settings.queueEnd.content;
        if (isActive !== false && template && template.trim() !== "") {
          const lastTrack = p.queue.previous[p.queue.previous.length - 1];
          const content = lastTrack
            ? applyTemplate(template, lastTrack)
            : template;
          if (p.voiceChannelId)
            setVoiceStatus(p.voiceChannelId, token, content).catch(() => {});
        } else {
          if (p.voiceChannelId)
            setVoiceStatus(p.voiceChannelId, token, "").catch(() => {});
        }
        if (get247(token, p.guildId)) {
          console.log(
            `Queue empty for guild ${p.guildId}, 24/7 mode — staying in VC`,
          );
          reconnect247(p.guildId, p.voiceChannelId!, "queueEnd");
          return;
        }
        if (p.connected && p.voiceChannelId) {
          const voiceChannelId = p.voiceChannelId;
          console.log(
            `Queue empty for guild ${p.guildId}, disconnecting from VC ${voiceChannelId} (24/7 off)`,
          );
          setVoiceStatus(voiceChannelId, token, "").catch(() => {});
          voiceStatusStore.delete(`${token}:${p.guildId}`);
          lastVoiceChannel.delete(`${token}:${p.guildId}`);
          p.destroy().catch((err: any) => {
            console.error(
              `Failed to destroy Lavalink player after queueEnd for guild ${p.guildId}:`,
              err,
            );
          });
        }
        console.log(
          `Queue empty for guild ${p.guildId}, scheduling auto-destroy (token: ...${token.slice(-6)})`,
        );
        scheduleAutoDestroy(token);
      });

      manager.on("playerDestroy", (p) => {
        // voiceChannelId may already be null by the time this fires, fall back to last known
        const voiceChannelId =
          p.voiceChannelId ?? lastVoiceChannel.get(`${token}:${p.guildId}`);
        if (get247(token, p.guildId)) {
          // Do not update voice status here. We keep the current status (trackStart or queueEnd)
          // so it persists smoothly through the reconnection.
          if (voiceChannelId) {
            console.log(
              `Player destroyed for guild ${p.guildId} in 24/7 mode — reconnecting`,
            );
            reconnect247(p.guildId, voiceChannelId, "playerDestroy");
          } else {
            console.log(
              `Player destroyed for guild ${p.guildId} in 24/7 mode — no voiceChannelId to reconnect`,
            );
          }
          return;
        }

        // Not 24/7 - Clear status and reset configs
        if (voiceChannelId)
          setVoiceStatus(voiceChannelId, token, "").catch(() => {});
        voiceStatusStore.delete(`${token}:${p.guildId}`);

        lastVoiceChannel.delete(`${token}:${p.guildId}`);
        console.log(`Lavalink player destroyed for guild ${p.guildId}`);
        scheduleAutoDestroy(token);
      });

      manager.nodeManager.on("error", (node, err) => {
        const hasConnected = [...manager.nodeManager.nodes.values()].some(
          (n) => n.connected,
        );
        if (!hasConnected) {
          warnMusicThrottled(
            `node-error:${node.id}:${musicErrorMessage(err)}`,
            `[Lavalink Node Error] ${node.id}: ${musicErrorMessage(err)}`,
            30_000,
          );
        }
      });

      manager.nodeManager.on("connect", (node) => {
        console.log(`Lavalink node connected: ${node.id}`);

        // Stop other nodes from retrying if we already have a connected node
        for (const n of manager.nodeManager.nodes.values()) {
          if (n.id !== node.id && !n.connected) {
            try {
              n.disconnect();
            } catch {}
          }
        }
        // Auto-resume: Find any players that were on this node and should be playing
        for (const player of manager.players.values()) {
          if (player.node && player.node.id === node.id) {
            // If the player was in a voice channel, we must re-connect to send the voice state
            // to the new Lavalink session. Otherwise, Lavalink will have the track but no
            // voice server details to stream to.
            if (player.voiceChannelId) {
              player
                .connect()
                .then(async () => {
                  // Wait for voice state updates to reach the node before playing
                  await new Promise((r) => setTimeout(r, 2500));

                  if (player.queue.current) {
                    if (!player.node?.connected) {
                      warnMusicThrottled(
                        `resume-node:${player.guildId}`,
                        `Auto-resume skipped for guild ${player.guildId}: Lavalink node is not connected`,
                        30_000,
                      );
                      return;
                    }

                    const position = safeResumePosition(player);
                    console.log(
                      `Auto-resuming playback for guild ${player.guildId}${position ? ` at ${position}ms` : ""}`,
                    );
                    let playPromise: Promise<any>;
                    try {
                      playPromise =
                        position === undefined
                          ? player.play()
                          : player.play({ position });
                    } catch (err: any) {
                      const msg = musicErrorMessage(err);
                      if (
                        isKnownTransientMusicError(err) ||
                        msg.includes("PlayerOption#position")
                      ) {
                        warnMusicThrottled(
                          `resume:${player.guildId}:${msg}`,
                          `Auto-resume skipped for guild ${player.guildId}: ${msg}`,
                          30_000,
                        );
                        return;
                      }
                      console.error(
                        `Failed to auto-resume for guild ${player.guildId}:`,
                        msg,
                      );
                      return;
                    }
                    playPromise.catch((err: any) => {
                      const msg = musicErrorMessage(err);
                      if (
                        isKnownTransientMusicError(err) ||
                        msg.includes("PlayerOption#position")
                      ) {
                        warnMusicThrottled(
                          `resume:${player.guildId}:${msg}`,
                          `Auto-resume skipped for guild ${player.guildId}: ${msg}`,
                          30_000,
                        );
                        return;
                      }
                      console.error(
                        `Failed to auto-resume for guild ${player.guildId}:`,
                        msg,
                      );
                    });
                  }
                })
                .catch((err) => {
                  const msg = musicErrorMessage(err);
                  if (isKnownTransientMusicError(err)) {
                    warnMusicThrottled(
                      `voice-reconnect:${player.guildId}:${msg}`,
                      `Voice reconnect skipped for guild ${player.guildId}: ${msg}`,
                      30_000,
                    );
                    return;
                  }
                  console.error(
                    `Failed to re-connect voice for guild ${player.guildId}:`,
                    msg,
                  );
                });
            }
          }
        }
      });

      manager.nodeManager.on("disconnect", (node) => {
        const hasConnected = [...manager.nodeManager.nodes.values()].some(
          (n) => n.connected,
        );
        if (!hasConnected) {
          warnMusicThrottled(
            `node-disconnect:${node.id}`,
            `[Lavalink] Node disconnected: ${node.id}`,
            30_000,
          );
        }
      });

      // ─ Discord Events ───────────────────
      client.on("voiceStateUpdate", (oldState: any, newState: any) => {
        if (oldState.member?.id !== client.user?.id) return;
        // Track last known VC whenever bot joins/moves
        if (newState.channelId) {
          lastVoiceChannel.set(
            `${token}:${newState.guild.id}`,
            newState.channelId,
          );
        }
        if (oldState.channel && !newState.channel) {
          const is247 = get247(token, oldState.guild.id);

          if (is247) {
            // Do not update voice status here. We keep the current status (trackStart or queueEnd)
            // so it persists smoothly through the reconnection.
            reconnect247(
              oldState.guild.id,
              oldState.channelId!,
              "voiceStateUpdate",
            );
            return;
          }

          // Not 24/7 - Clear status and reset configs
          setVoiceStatus(oldState.channelId!, token, "").catch(() => {});
          voiceStatusStore.delete(`${token}:${oldState.guild.id}`);

          console.log(
            `Bot removed from voice channel "${oldState.channel.name}", scheduling auto-destroy (token: ...${token.slice(-6)})`,
          );
          scheduleAutoDestroy(token);
        }
      });

      client.on("shardDisconnect", () => {
        console.log(
          `Client shard disconnected, destroying player (token: ...${token.slice(-6)})`,
        );
        destroyPlayer(token).catch(() => {
          /* already cleaning up */
        });
      });

      // ─ Login & Init ───────────────────

      let startupResolve: () => void;
      let startupReject: (err: any) => void;
      const startupPromise = new Promise<void>((res, rej) => {
        startupResolve = res;
        startupReject = rej;
      });

      const managed: ManagedPlayer = {
        client,
        player: manager,
        ready: Promise.resolve(),
        startup: startupPromise,
        destroyTimer: null,
      };
      players.set(token, managed);

      try {
        // Login to Discord
        await client.login(token);

        // Wait for clientReady
        const readyClient: any = await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Timed out waiting for Discord ready")),
            15_000,
          );
          client.once("clientReady", (rc: any) => {
            clearTimeout(timeout);
            resolve(rc);
          });
          client.once("error", (err: any) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
        console.log(`Music client ready: ${readyClient.user.tag}`);

        // Init Lavalink manager (this starts node connections in the background)
        await manager.init({
          id: readyClient.user.id,
          username: readyClient.user.username,
        });

        // Wait for the primary node group; mode 2 then falls back to local only.
        const nodeConnected = await connectLavalinkWithFallback(
          manager,
          30_000,
          log,
          true,
        );

        if (!nodeConnected) {
          throw new Error("Timed out waiting for Lavalink node connection");
        }

        // Verify at least one node is actually connected and usable
        const connectedNodes = [
          ...managed.player.nodeManager.nodes.values(),
        ].filter((n) => n.connected);
        if (connectedNodes.length === 0) {
          throw new Error("No Lavalink nodes available after connection");
        }

        ensureContextCached(managed);
        startupResolve!();
        initResolve!({ client, player: manager });
      } catch (err) {
        players.delete(token);

        // Kill all node connections — remove from map FIRST so the
        // library's close() handler doesn't re-trigger reconnect()
        const nodesToKill = [...manager.nodeManager.nodes.values()];
        for (const node of nodesToKill) {
          try {
            (node as any).resetReconnectionAttempts?.();
          } catch {}
          try {
            manager.nodeManager.nodes.delete(node.id);
          } catch {}
          try {
            node.disconnect();
          } catch {}
        }

        try {
          client.destroy();
        } catch {}
        startupReject!(err);
        initReject!(err);
      }
    } catch (outerErr) {
      initReject!(outerErr);
    }
  })();

  try {
    const result = await initPromise;
    pendingPlayers.delete(token);
    return result;
  } catch (e) {
    pendingPlayers.delete(token);
    throw e;
  }
}

export async function destroyPlayer(token: string): Promise<boolean> {
  const managed = players.get(token);
  if (!managed) return false;

  // Remove from map first to prevent 24/7 reconnect from re-creating
  players.delete(token);

  // Clean up last known voice channels and voice status settings for this token
  for (const [key] of lastVoiceChannel) {
    if (key.startsWith(token + ":")) lastVoiceChannel.delete(key);
  }
  for (const [key] of voiceStatusStore) {
    if (key.startsWith(token + ":")) voiceStatusStore.delete(key);
  }

  if (managed.destroyTimer) {
    clearTimeout(managed.destroyTimer);
    managed.destroyTimer = null;
  }

  // Clear voice status for all active players before destroying the client
  try {
    const statusClears: Promise<void>[] = [];
    for (const p of managed.player.players.values()) {
      const voiceChannelId =
        p.voiceChannelId || lastVoiceChannel.get(`${token}:${p.guildId}`);
      if (voiceChannelId) {
        statusClears.push(setVoiceStatus(voiceChannelId, token, ""));
      }
    }
    if (statusClears.length > 0) {
      await Promise.all(statusClears).catch(() => {});
    }
  } catch (err) {
    console.error("Error clearing voice status during destroy:", err);
  }

  try {
    const nodesToKill = [...managed.player.nodeManager.nodes.values()];
    for (const node of nodesToKill) {
      try {
        (node as any).resetReconnectionAttempts?.();
      } catch {}
      try {
        managed.player.nodeManager.nodes.delete(node.id);
      } catch {}
      try {
        node.disconnect();
      } catch {}
    }
    managed.client.destroy();
  } catch {}

  pendingPlayers.delete(token);
  return true;
}

async function ensureContextCached(managed: ManagedPlayer) {
  if (managed.contextCached) return;
  managed.contextCached = true;

  (async () => {
    try {
      const guilds = await managed.client.guilds.fetch();
      await Promise.allSettled(
        guilds.map(async (g) => {
          try {
            const guild = await g.fetch();
            await guild.channels.fetch();
          } catch {}
        }),
      );
    } catch (err) {
      console.error("Context caching failed:", err);
    }
  })();
}

export function checkVoicePermissions(channel: any, botUser: any) {
  const permissions = channel.permissionsFor(botUser);
  if (!permissions?.has(PermissionsBitField.Flags.Connect)) {
    throw new Error(
      `I do not have permission to connect to the voice channel: ${channel.name}`,
    );
  }
  if (!permissions?.has(PermissionsBitField.Flags.Speak)) {
    throw new Error(
      `I do not have permission to speak in the voice channel: ${channel.name}`,
    );
  }
}

export async function resolveVoiceChannel(client: Client, voiceId: string) {
  let channel: any = client.channels.cache.get(voiceId);
  if (!channel) {
    channel = await client.channels.fetch(voiceId).catch(() => null);
  }
  if (
    !channel ||
    (channel.type !== ChannelType.GuildVoice &&
      channel.type !== ChannelType.GuildStageVoice)
  ) {
    throw new Error("Invalid voice channel ID or not a voice channel");
  }

  checkVoicePermissions(channel, client.user!);

  return channel;
}

export function getQueue(
  manager: LavalinkManager,
  guildId: string,
): LavalinkPlayer | null {
  return manager.players.get(guildId) ?? null;
}

export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatTrack(
  track: Track | any,
  client?: any,
  guildPlayer?: any,
) {
  const totalPlaylistTrack = (track as any)?.playlist?.tracks?.reduce(
    (acc: number, track: any) => acc + (track?.duration ?? 0),
    0,
  );
  const requester = track.requester || null;
  const requestedId = requester
    ? String((requester as any).id ?? requester)
    : null;
  const cachedRequester = requestedId
    ? client?.users?.cache?.get(requestedId)
    : null;
  const requesterData: any =
    typeof requester === "object" ? { ...requester } : { id: requestedId };
  if (cachedRequester) {
    requesterData.id = cachedRequester.id;
    requesterData.username = cachedRequester.username;
    requesterData.globalName = cachedRequester.globalName;
    requesterData.tag = cachedRequester.tag;
    requesterData.avatar = cachedRequester.avatar;
    requesterData.bot = cachedRequester.bot;
  } else if (requestedId && requesterData.username == null) {
    requesterData.username = "Discord User";
  }
  delete requesterData.guildId;
  delete requesterData.voiceChannelId;

  let voiceInfo: { isInVC: boolean; _warning?: string } | null = null;
  if (requestedId && !isNaN(Number(requestedId))) {
    const guild = client?.guilds?.cache?.get(guildPlayer?.guildId);
    const voiceState = guild?.voiceStates?.cache?.get(requestedId);
    const channel = client?.channels?.cache?.get(
      guildPlayer?.voiceChannelId,
    ) as VoiceChannel | null;

    if (voiceState) {
      voiceInfo = {
        isInVC: voiceState.channelId === guildPlayer?.voiceChannelId,
      };
    } else if (channel?.members?.has(requestedId)) {
      const isInVC = channel.members.has(requestedId);
      voiceInfo = { isInVC };
    } else {
      voiceInfo = {
        isInVC: false,
        _warning: "This information is not available at moment",
      };
    }
  }
  return {
    id: track.info.identifier,
    title: track.info.title,
    author: track.info.author,
    url: track.info.uri,
    source: (track.info as any).sourceName || "",
    actualSource:
      (track.info as any).actualSourceName ||
      (track.info as any).sourceName ||
      "",
    thumbnail: track.info.artworkUrl ?? "",
    duration: formatDuration(track.info.duration),
    durationMS: String(track.info.duration),
    isSeekable: track.info.isSeekable,
    isStream: track.info.isStream,
    requestedBy: requestedId,
    requester: requester ? { ...requesterData, ...(voiceInfo ?? {}) } : null,
    playlist: (track as any).playlist
      ? {
          name: (track as any).playlist.name,
          size: (track as any).playlist.tracks?.length,
          // ig this might result slow response
          elapsedTime: {
            label: formatDuration(totalPlaylistTrack),
            value: String(totalPlaylistTrack),
          },
        }
      : null,
  };
}

function applyTemplate(template: string, track: any): string {
  const data = formatTrack(track);
  return template.replace(/{([\w.]+)}/g, (match, path) => {
    const parts = path.split(".");
    const value = parts.reduce((obj: any, key: string) => obj?.[key], data);
    return value !== undefined ? String(value) : match;
  });
}

/** Maps platform names → Lavalink search prefixes. */
export const PLATFORM_SEARCH: Record<string, string> = {
  soundcloud: "scsearch",
  spotify: "spsearch",
  applemusic: "amsearch",
  youtube: "ytsearch",
  youtubemusic: "ytmsearch",
  deezer: "dzsearch",
  tidal: "tdsearch",
};

export async function autoInit(): Promise<void> {
  const raw = process.env.DISCORD_TOKENS || "";
  const tokens = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    console.log("autoInit: No DISCORD_TOKENS set, skipping pre-warm");
    return;
  }

  console.log(`autoInit: Pre-warming ${tokens.length} Discord client(s)...`);

  await Promise.allSettled(
    tokens.map(async (token) => {
      try {
        await getOrCreatePlayer(token);
      } catch (err: any) {
        console.error(
          `❌ autoInit: Failed for token ...${token.slice(-6)}: ${err.message}`,
        );
      }
    }),
  );
}

function requesterFromUser(user: any) {
  if (!user?.id) return null;
  return {
    id: user.id,
    username: user.username,
    globalName: user.globalName,
    tag: user.tag,
    avatar: user.avatar,
    bot: user.bot,
  };
}

function clientRequesterForPlayer(player: LavalinkPlayer) {
  const manager = (player as any).LavalinkManager;
  const managed = [...players.values()].find(
    (entry) => entry.player === manager,
  );
  const requester = requesterFromUser(managed?.client.user);
  if (requester) return requester;

  const clientInfo = manager?.options?.client;
  if (!clientInfo?.id) return null;
  return {
    id: clientInfo.id,
    username: clientInfo.username,
    bot: true,
  };
}

export async function fillAutoplay(player: LavalinkPlayer, baseTrack?: Track) {
  if (!player.get("autoplay")) return;

  if (player.get("isFillingAutoplay")) return;
  player.set("isFillingAutoplay", true);

  try {
    let currentAutoplayCount = player.queue.tracks.filter(
      (t) => (t.requester as any)?.isAutoplay,
    ).length;
    let attempts = 0;
    const TARGET = 50;

    while (currentAutoplayCount < TARGET && attempts < 3) {
      attempts++;

      const track =
        player.queue.tracks[player.queue.tracks.length - 1] ||
        player.queue.current ||
        baseTrack;
      if (!track) break;

      const previousTracks = player.queue.previous.map(
        (t) => t.info.identifier,
      );
      const queueTracks = player.queue.tracks.map((t) => t.info.identifier);

      const source = track.info.sourceName;
      let searchStr = `ytmsearch:${track.info.author} ${track.info.title}`;

      if (source === "spotify") {
        searchStr = `sprec:${track.info.identifier}`;
      } else if (source === "applemusic") {
        searchStr = `amrec:${track.info.identifier}`;
      } else if (source === "deezer") {
        searchStr = `dzrec:${track.info.identifier}`;
      } else if (source === "youtube" || source === "youtubemusic") {
        searchStr = `ytmsearch:${track.info.author} ${track.info.title}`;
      }

      if (!player.node?.connected) {
        try {
          await player.moveNode();
        } catch {
          break;
        }
      }

      const res = await player.search(
        { query: searchStr },
        (track.requester as any)?.isAutoplay ? undefined : track.requester,
      );
      if (!res.tracks?.length) break;

      const needed = TARGET - currentAutoplayCount;
      const toAdd = res.tracks
        .filter((t) => {
          const id = t.info.identifier;
          if (!id) return false;
          const isDuplicate =
            previousTracks.includes(id) || queueTracks.includes(id);
          const titleA = t.info.title.toLowerCase();
          const titleB = track.info.title.toLowerCase();
          const isSimilarTitle =
            titleA.includes(titleB) || titleB.includes(titleA);
          return !isDuplicate && !isSimilarTitle;
        })
        .slice(0, needed);

      if (toAdd.length === 0) break;

      for (const t of toAdd) {
        t.requester = {
          ...((track.requester as any) ||
            clientRequesterForPlayer(player) ||
            {}),
          isAutoplay: true,
        };
        await player.queue.add(t);
      }

      currentAutoplayCount = player.queue.tracks.filter(
        (t) => (t.requester as any)?.isAutoplay,
      ).length;
      if (!player.playing && !player.paused) {
        if (!player.node?.connected) break;
        await player.play();
      }
    }
  } catch (err) {
    const msg = musicErrorMessage(err);
    if (isKnownTransientMusicError(err)) {
      warnMusicThrottled(
        `autoplay:${player.guildId}:${msg}`,
        `Autoplay skipped for guild ${player.guildId}: ${msg}`,
        60_000,
      );
    } else {
      console.error(`Autoplay failed for guild ${player.guildId}:`, msg);
    }
  } finally {
    player.set("isFillingAutoplay", false);
  }
}
