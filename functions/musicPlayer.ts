import { Client, GatewayIntentBits, ChannelType, PermissionsBitField, VoiceChannel } from "discord.js";
import { LavalinkManager, Player as LavalinkPlayer, Track } from "lavalink-client";
import { stream } from "hono/streaming";

import zlib from "zlib";
import config from "../config.json" with { type: "json" };
import { generateChallenge, verifyChallenge, verifyChallengeHash, ipToNumber } from "./musicChallenges.ts";
import { recordRequestLog } from "./telemetry.js";
import { radioStreamUrls } from "./radioProxy.js";
import { discordFetch } from "./request.js";

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
			if (prev === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
			else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
		}
	};
}

/** Patch a node to suppress DOMException from invalid WebSocket close code 500 (lavalink-client bug). */
function patchNodeClose(node: any) {
	if (node.__closePatched) return;
	node.__closePatched = true;
	const origError = node.error.bind(node);
	node.error = (error: any) => {
		try {
			origError(error);
		} catch {}
	};
}

const transientFetchCodes = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EPIPE", "UND_ERR_SOCKET"]);

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Tracks the first Lavalink node that successfully connected during startup fallback. */
let bootstrapNodeId: string | null = null;
export function getBootstrapNodeId(): string | null {
	return bootstrapNodeId;
}

function getFetchErrorCode(err: any): string {
	return String(err?.code || err?.cause?.code || "");
}

function isTransientFetchError(err: any): boolean {
	const code = getFetchErrorCode(err);
	const message = String(err?.message || err || "").toLowerCase();
	return transientFetchCodes.has(code) || message.includes("socket connection was closed") || message.includes("fetch failed");
}

export async function setVoiceStatus(channelId: string, token: string, content: string, retries = 3) {
	for (let i = 0; i < retries; i++) {
		try {
			const res = await discordFetch(`https://discord.com/api/v10/channels/${channelId}/voice-status`, {
				method: "PUT",
				headers: {
					Authorization: `Bot ${token}`,
					"Content-Type": "application/json",
					"User-Agent": "DiscordBot (1.0.0)",
				},
				body: JSON.stringify({ status: content.slice(0, 500) }),
			});

			if (res.status === 429) {
				const retryAfter = Number(res.headers.get("Retry-After")) || 5;
				console.warn(`Voice Status Rate Limited (Attempt ${i + 1}/${retries}). Retrying after ${retryAfter}s...`);
				await sleep(retryAfter * 1000);
				continue;
			}

			if (res.ok) {
				// Proactively wait if bucket is exhausted (prevents next 429)
				const remaining = Number(res.headers.get("X-RateLimit-Remaining"));
				if (remaining === 0) {
					const resetAfter = Number(res.headers.get("X-RateLimit-Reset-After"));
					if (resetAfter > 0) {
						console.warn(`Voice Status rate limit bucket exhausted, waiting ${resetAfter}s for reset`);
						await sleep(resetAfter * 1000);
					}
				}
				return;
			}

			if (res.status >= 500 && i < retries - 1) {
				const retryAfter = Number(res.headers.get("Retry-After"));
				const delay = retryAfter > 0 ? retryAfter * 1000 : 1000 * (i + 1);
				console.warn(`Voice Status Server Error ${res.status} (Attempt ${i + 1}/${retries}), retrying in ${delay}ms`);
				await sleep(delay);
				continue;
			}

			return;
		} catch (err) {
			const canRetry = i < retries - 1 && isTransientFetchError(err);
			if (!canRetry) {
				console.error("Voice Status Fetch Error:", err);
				return;
			}

			const delay = 1000 * (i + 1);
			console.warn(`Voice Status Fetch Retry (${i + 1}/${retries}): ${getFetchErrorCode(err) || "network error"}, retrying in ${delay}ms`);
			await sleep(delay);
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
		return setVoiceStatus(channelId, token, "").catch(() => {});
	}

	try {
		const content = applyTemplate(template, currentTrack);
		await setVoiceStatus(channelId, token, content);
	} catch (err) {
		console.error(`[VoiceStatus] Failed to update for guild ${player.guildId}:`, err);
	}
}

// ─── Streaming Helper ────────────────────────────────────────────────────────

export async function createMusicStream(c: any, callback: (log: (msg: string) => Promise<void>, s: any) => Promise<void>) {
	c.header("Content-Type", "application/json");
	c.header("Cache-Control", "public, no-transform, max-age=0, must-revalidate");

	// temp allowed for all countries
	// c.req.header("cf-ipcountry")
	const lookExistChallengeC = "DE";
	if (["DE"].includes(lookExistChallengeC) === false) {
		const checkAccept = c.req.header("accept") === "application/json";
		let checkReferer = false;
		try {
			const referer = c.req.header("referer");
			if (referer) {
				const refUrl = new URL(referer);
				const reqUrl = new URL(c.req.url);
				checkReferer = refUrl.host === reqUrl.host && referer.endsWith("/playground");
			}
		} catch {}
		const ipLL = ipToNumber(c.req.header("cf-connecting-ip") || "127.0.0.1");
		const rrmc = c.req.header("x-challenge-codes") || "";
		const challengeHash = c.req.header("x-challenge") || "";
		const checkValidChallenges = !verifyChallengeHash(rrmc, challengeHash) || !(await verifyChallenge(rrmc, ipLL));
		if (checkValidChallenges) {
			c.header("X-Player", "lavalink");
			c.header("X-Warning", "Germany (DE) only. Outside that, you need to solve this challenge");
			c.header("Content-Type", "text/event-stream");
			c.header("Cache-Control", "public, no-cache, no-store, no-transform, max-age=0, must-revalidate");
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
				const gzipData = zlib.deflateSync(Buffer.from(payload));
				return stream(c, async (s: any) => {
					await s.write(gzipData);
				});
			} else {
				return c.body(null);
			}
		}
	}

	c.header("X-Player", "lavalink");
	c.header("X-Enc-Route", "v4");
	c.header("X-Route", "LIVE");

	return stream(c, async (s: any) => {
		let isAborted = false;
		let loggedSuccessfulRequest = false;
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
				if (!loggedSuccessfulRequest && data.includes('"status":true')) {
					loggedSuccessfulRequest = true;
					recordRequestLog(c, 200);
				}
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
			await safeWrite(`],"data":${JSON.stringify({ status: false, message: err?.message || "Failed to process stream", type: { primary: "error", alt: "critical" } })}}`);
		}
	});
}

// ─── Lavalink Node Config ─────────────────────────────────────────────────────

let LAVALINK_NODES: any[] = [];

function parseLavalinkHostEntry(entry: string): any | null {
	const parts = entry.split(":");
	if (parts.length < 5) return null;
	const id = parts[0];
	const host = parts[1] || "";
	if (!host) return null;
	const port = parseInt(parts[2]);
	if (isNaN(port)) return null;
	const authorization = parts.length >= 4 ? parts.slice(3, parts[parts.length - 1] === "true" || parts[parts.length - 1] === "false" ? -1 : undefined).join(":") : "";
	const secure = parts[parts.length - 1] === "true";

	return { id, host, port, authorization, secure, retryAmount: 1, retryDelay: 300000, requestSignalTimeoutMS: 30000 };
}

function parseLavalinkNodesFromEnv(): any[] {
	const raw = process.env.LAVALINK_HOST || "";
	if (!raw) return [];

	let hosts: string[];
	try {
		hosts = JSON.parse(raw);
		if (!Array.isArray(hosts)) hosts = [];
	} catch {
		hosts = [raw];
	}
	return hosts
		.filter((h: any) => typeof h === "string" && h.length > 0)
		.map(parseLavalinkHostEntry)
		.filter((n: any) => n !== null);
}

export const localNode: { id: string | null; host: string; port: number; authorization: string; secure: boolean } = {
	id: null,
	host: "",
	port: 2333,
	authorization: "youshallnotpass",
	secure: false,
};

const allNodes = parseLavalinkNodesFromEnv();
for (const n of allNodes) {
	if (n.host === "localhost" || n.host === "127.0.0.1" || n.host === "::1") {
		localNode.id = n.id;
		localNode.host = n.host;
		localNode.port = n.port;
		localNode.authorization = n.authorization;
		localNode.secure = n.secure;
		break;
	}
}

LAVALINK_NODES = allNodes;

function lavalinkNodeList(): any[] {
	return LAVALINK_NODES.filter((n) => n.host && n.host.length > 0);
}

/**
 * Returns node configs ordered by preference.
 * preferLocal=true  → local (vgjr) node first, then remote nodes.
 * preferLocal=false → remote nodes first, then local (vgjr) node last.
 */
function orderedNodeList(preferLocal: boolean): any[] {
	const nodes = lavalinkNodeList();
	if (!localNode.id) return nodes;
	const local = nodes.filter((n) => n.id === localNode.id);
	const remote = nodes.filter((n) => n.id !== localNode.id);
	return preferLocal ? [...local, ...remote] : [...remote, ...local];
}

export function getLavalinkNodeIds(preferLocal = false): string[] {
	return orderedNodeList(preferLocal).map((n: any) => n.id);
}

function createLavalinkNodes(manager: LavalinkManager, nodeConfigs: any[]) {
	for (const nodeConfig of nodeConfigs) {
		if (nodeConfig.host && !manager.nodeManager.nodes.has(nodeConfig.id)) {
			const node = manager.nodeManager.createNode(nodeConfig);
			patchNodeTls(node);
			patchNodeClose(node);
		}
	}
}

/** Wait for a SPECIFIC node (by id) to connect, without touching/deleting other registered nodes. */
// Concurrent requests can independently ask to connect the same node (e.g. bootstrap +
// an endpoint's explicit node pick racing each other). Without a lock each caller would
// call node.connect() again, opening a duplicate WebSocket to the same Lavalink server —
// which then logs multiple disconnects on shutdown. This dedupes in-flight connect attempts.
const nodeConnectLocks = new WeakMap<any, Promise<boolean>>();

function waitForSpecificNodeConnection(manager: LavalinkManager, nodeId: string, timeoutMs: number, connectNode: boolean) {
	const node = manager.nodeManager.nodes.get(nodeId);
	if (node?.connected) return Promise.resolve(true);
	if (!node) return Promise.resolve(false);

	const existingLock = nodeConnectLocks.get(node);
	if (existingLock) return existingLock;

	const promise = new Promise<boolean>((resolve) => {
		let settled = false;

		const onConnect = (n: any) => {
			if (n?.id !== nodeId) return;
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

		manager.nodeManager.on("connect", onConnect);

		// Only call connect() if the node has no active socket at all. A node can already be
		// mid-handshake (e.g. manager.init() started connecting every node in the background);
		// calling connect() again on top of that races with the in-flight WebSocket and can
		// null out `node.socket` mid-open, crashing the library with
		// "TypeError: null is not an object (evaluating 'this.socket.on')".
		const sock: any = (node as any).socket;
		const alreadyHandshaking = !!sock && typeof sock.readyState === "number" && (sock.readyState === 0 || sock.readyState === 1);
		if (connectNode && !node.connected && !alreadyHandshaking) {
			try {
				node.connect();
			} catch {}
		}
	}).finally(() => {
		nodeConnectLocks.delete(node);
	});

	nodeConnectLocks.set(node, promise);
	return promise;
}

/**
 * Ensures a specific Lavalink node (by id) is registered and connected.
 * Registers it if missing, connects it if not connected, and waits up to timeoutMs.
 * Leaves all other registered nodes untouched (does not delete/disconnect them),
 * so fallback between nodes keeps working.
 */
export async function ensureNodeConnected(manager: LavalinkManager, nodeId: string, log?: (msg: string) => Promise<void>, timeoutMs = 8000): Promise<any | null> {
	let node = manager.nodeManager.nodes.get(nodeId);
	if (node?.connected) return node;

	if (!node) {
		const nodeConfig = LAVALINK_NODES.find((n) => n.id === nodeId);
		if (!nodeConfig) {
			if (log) await log(`Lavalink node config not found: "${nodeId}"`);
			return null;
		}
		node = manager.nodeManager.createNode(nodeConfig);
		patchNodeTls(node);
		patchNodeClose(node);
	}

	if (log) await log(`Connecting Lavalink node "${nodeId}"...`);
	const connected = await waitForSpecificNodeConnection(manager, nodeId, timeoutMs, true);
	if (!connected) {
		if (log) await log(`Lavalink node "${nodeId}" failed to connect`);
		return null;
	}
	if (log) await log(`Lavalink node "${nodeId}" connected`);
	return manager.nodeManager.nodes.get(nodeId) ?? null;
}

async function connectLavalinkWithFallback(manager: LavalinkManager, timeoutMs: number, log?: (msg: string) => Promise<void>, preferLocal = true, connectNodes = true) {
	const nodes = orderedNodeList(preferLocal);
	if (nodes.length === 0) return false;

	const nodeList = nodes.map((n: any) => n.id).join(", ");
	if (log) await log(`Connecting to Lavalink node(s): ${nodeList}`);

	// Register all configured nodes up front (without deleting any that already exist),
	// so nodes that aren't tried first remain available for later fallback/moveNode calls.
	createLavalinkNodes(manager, nodes);

	for (const nodeConfig of nodes) {
		const node = manager.nodeManager.nodes.get(nodeConfig.id);
		if (node?.connected) {
			if (log) await log(`Already connected to Lavalink node "${nodeConfig.id}"`);
			if (!bootstrapNodeId) bootstrapNodeId = nodeConfig.id;
			return true;
		}

		if (log) await log(`Trying Lavalink node "${nodeConfig.id}"...`);
		const connected = await waitForSpecificNodeConnection(manager, nodeConfig.id, timeoutMs, connectNodes);
		if (connected) {
			// Stability check: wait briefly to see if the node stays connected
			await new Promise((r) => setTimeout(r, 500));
			const stableNode = manager.nodeManager.nodes.get(nodeConfig.id);
			if (stableNode?.connected) {
				if (log) await log(`Connected to Lavalink node "${nodeConfig.id}"`);
				if (!bootstrapNodeId) bootstrapNodeId = nodeConfig.id;
				return true;
			}
			if (log) await log(`Lavalink node "${nodeConfig.id}" dropped immediately — trying next`);
		} else {
			if (log) await log(`Lavalink node "${nodeConfig.id}" failed to connect`);
		}
	}

	return false;
}

/**
 * Ensure the local Lavalink node is registered, connected, and ready.
 * Used by the radio endpoint to force playback through the local node.
 * Returns the connected node, or null if the local node is unavailable.
 */
export async function ensureLocalNode(manager: LavalinkManager, log?: (msg: string) => Promise<void>): Promise<any | null> {
	if (!localNode.id) {
		if (log) await log("No localhost Lavalink node is configured in LAVALINK_HOST");
		return null;
	}
	return ensureNodeConnected(manager, localNode.id, log, 8000);
}

// ─── Player Pool ──────────────────────────────────────────────────────────────

const AUTO_DESTROY_DELAY = 1 * 60 * 1000; // 1 minute
const pendingPlayers = new Map<string, Promise<{ client: Client; player: LavalinkManager }>>();

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

const players: Map<string, ManagedPlayer> = g.__vgjr_players || (g.__vgjr_players = new Map<string, ManagedPlayer>());
const musicLogCooldowns: Map<string, number> = g.__vgjr_musicLogCooldowns || (g.__vgjr_musicLogCooldowns = new Map<string, number>());

// Persistent 24/7 state: "token:guildId" → true/false
// Stored separately so it survives Lavalink player object recreation
const state247: Map<string, boolean> = g.__vgjr_state247 || (g.__vgjr_state247 = new Map<string, boolean>());

// Last known voice channel per guild: "token:guildId" → voiceChannelId
// Used as fallback when playerDestroy fires after voiceChannelId is already null
const lastVoiceChannel: Map<string, string> = g.__vgjr_lastVoiceChannel || (g.__vgjr_lastVoiceChannel = new Map<string, string>());

// Persistent voice status settings: "token:guildId" → { trackStart: { status, content }, ... }
export const voiceStatusStore: Map<string, any> = g.__vgjr_voiceStatusStore || (g.__vgjr_voiceStatusStore = new Map<string, any>());

export function getVoiceStatusSettings(token: string, guildId: string) {
	const key = `${token}:${guildId}`;
	return (
		voiceStatusStore.get(key) || {
			trackStart: { status: false, content: "" },
			queueEnd: { status: false, content: "" },
		}
	);
}

export function setVoiceStatusSetting(token: string, guildId: string, type: string, status: boolean, content: string) {
	const key = `${token}:${guildId}`;
	const current = getVoiceStatusSettings(token, guildId);
	if (type === "trackStart") current.trackStart = { status, content };
	else if (type === "queueEnd") current.queueEnd = { status, content };
	voiceStatusStore.set(key, current);
}

// Persistent message status settings: "token:guildId" → { trackStart: { status, channelId, content }, ... }
export const messageStatusStore: Map<string, any> = new Map();

export function getMessageStatusSettings(token: string, guildId: string) {
	const key = `${token}:${guildId}`;
	return (
		messageStatusStore.get(key) || {
			trackStart: { status: false, channelId: "", content: "" },
			queueEnd: { status: false, channelId: "", content: "" },
		}
	);
}

export function setMessageStatusSetting(token: string, guildId: string, type: string, status: boolean, channelId: string, content: string) {
	const key = `${token}:${guildId}`;
	const current = getMessageStatusSettings(token, guildId);
	if (type === "trackStart") current.trackStart = { status, channelId, content };
	else if (type === "queueEnd") current.queueEnd = { status, channelId, content };
	messageStatusStore.set(key, current);
}

async function sendMessageStatus(client: any, token: string, guildId: string, type: string, track?: any) {
	try {
		const settings = getMessageStatusSettings(token, guildId);
		const setting = type === "trackStart" ? settings.trackStart : settings.queueEnd;
		if (!setting.status || !setting.channelId || !setting.content) return;

		let resolved = setting.content;
		if (track && setting.content.includes("{")) {
			resolved = applyTemplate(setting.content, track);
		}

		let payload: any;
		try {
			payload = JSON.parse(resolved);
			if (typeof payload !== "object" || payload === null) throw new Error("not an object");

			if (payload.embeds && Array.isArray(payload.embeds)) {
				payload.embeds = payload.embeds.map((e: any) => {
					if (e.footer && (!e.footer.icon_url || e.footer.icon_url === "null" || e.footer.icon_url === "undefined")) {
						delete e.footer.icon_url;
					}
					if (e.footer && !e.footer.text) delete e.footer;
					if (e.author && (!e.author.icon_url || e.author.icon_url === "null" || e.author.icon_url === "undefined")) {
						delete e.author.icon_url;
					}
					if (e.author && !e.author.name) delete e.author;
					if (e.thumbnail && (!e.thumbnail.url || e.thumbnail.url === "null" || e.thumbnail.url === "undefined")) {
						delete e.thumbnail;
					}
					if (e.image && (!e.image.url || e.image.url === "null" || e.image.url === "undefined")) {
						delete e.image;
					}
					return e;
				});
			}
		} catch {
			payload = { content: resolved };
		}

		payload.content = (payload.content || "").slice(0, 2000);

		const channel = await client.channels.fetch(setting.channelId);
		if (channel && typeof channel.send === "function") {
			await channel.send(payload);
		}
	} catch (err: any) {
		const errMsg = err?.message || "";
		if (["invalid form body", "unknown channel"].includes(errMsg.toLowerCase())) {
			const current = getMessageStatusSettings(token, guildId);
			if (type === "trackStart") current.trackStart = { status: false, channelId: "", content: "" };
			else if (type === "queueEnd") current.queueEnd = { status: false, channelId: "", content: "" };
			messageStatusStore.set(`${token}:${guildId}`, current);
			console.error(`[MessageStatus] Invalid body — disabled ${type} config for guild ${guildId}`);
		} else {
			console.error(`[MessageStatus] Failed to send ${type} message for guild ${guildId}:`, err);
		}
	}
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
	return err?.name === "TimeoutError" || err?.code === 23 || err?.code === "ConnectionRefused" || msg.includes("The operation timed out") || msg.includes("Unable to connect") || msg.includes("ConnectionRefused") || msg.includes("The node is not connected") || msg.includes("Node is not connected") || msg.includes("fetch failed") || msg.includes("ECONNREFUSED");
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

/**
 * Returns true if the player for the given guild is a radio player (has `__isRadio` flag).
 */
export async function isRadioActive(token: string, guildId: string, log?: (msg: string) => Promise<void>): Promise<boolean> {
	if (!hasActivePlayer(token)) return false;
	const { player: manager } = await getOrCreatePlayer(token, log);
	const gp = manager.players.get(guildId);
	return !!gp?.get?.("__isRadio");
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
		if (key.startsWith(token + ":") && state247.get(key)) {
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
			if (key.startsWith(token + ":") && state247.get(key)) {
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

// Handle potential library crashes from lavalink-client and discord.js.
// Hot reload can re-evaluate this module, so install global handlers once.
if (!g.__vgjr_music_process_handlers_installed) {
	g.__vgjr_music_process_handlers_installed = true;

	process.on("uncaughtException", (err) => {
		const msg = musicErrorMessage(err);
		if (msg.includes("Argument 'data.encoded' must be present")) {
			console.error("Caught and suppressed a crash in lavalink-client (trackStuck event):", msg);
			return;
		}
		if (isKnownTransientMusicError(err)) {
			warnMusicThrottled("uncaught:" + msg, `Suppressed transient music exception: ${msg}`);
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
		if (isKnownTransientMusicError(reason) || reason?.name === "TimeoutError" || (reason as any)?.code === 23 || msg.includes("The operation timed out") || msg.includes("WebSocket was closed") || msg.includes("Cannot send data") || msg.includes("writableStreamDefaultWriterRelease")) {
			warnMusicThrottled("unhandled:" + msg, `Suppressed transient music rejection: ${msg}`);
			return;
		}
		console.error("Unhandled Rejection:", reason);
	});
}

export async function getOrCreatePlayer(token: string, log?: (msg: string) => Promise<void>, preferLocal = true): Promise<{ client: Client; player: LavalinkManager }> {
	const existing = players.get(token);
	if (existing) {
		if (existing.startup) {
			await existing.startup;
		} else {
			await existing.ready;
		}
		cancelAutoDestroy(token);

		// Safety: Ensure manager has nodes (in case they were lost during a previous cleanup or error)
		if (existing.player.nodeManager.nodes.size === 0 && LAVALINK_NODES.length > 0) {
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
				if (log) await log(`A reconnection attempt is already in progress, waiting...`);
				await existing.reconnecting;
			} else {
				existing.reconnecting = (async () => {
					if (log) await log(`All Lavalink nodes are disconnected. Reconnecting...`);
					await connectLavalinkWithFallback(existing.player, 8000, log, preferLocal);
				})();

				try {
					await existing.reconnecting;
				} finally {
					existing.reconnecting = null;
				}
			}

			const finalConnectedCount = [...existing.player.nodeManager.nodes.values()].filter((n) => n.connected).length;
			if (finalConnectedCount === 0) {
				await destroyPlayer(token);
				throw new Error("Lavalink reconnection failed. The music client has been reset for a fresh start. Please ensure your Lavalink server is running and try again.");
			}
			if (log) await log(`Successfully reconnected ${finalConnectedCount} Lavalink node(s).`);
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
	const initPromise = new Promise<{ client: Client; player: LavalinkManager }>((res, rej) => {
		initResolve = res;
		initReject = rej;
	});

	pendingPlayers.set(token, initPromise);

	(async () => {
		try {
			if (log) await log("Creating Lavalink player...");

			const client: Client = new Client({
				intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
				presence: { status: "invisible" },
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

			// Patch all nodes for scoped TLS bypass and close suppression before init() connects them
			for (const node of manager.nodeManager.nodes.values()) {
				patchNodeTls(node);
				patchNodeClose(node);
			}

			// Forward Discord gateway events to Lavalink
			client.on("raw", (d: any) => manager.sendRawData(d));

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
				await new Promise((r) => setTimeout(r, 1500));
				try {
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
							selfMute: false,
						});
					}
					if (!p.connected) {
						p.voiceChannelId = voiceChannelId;
						await p.connect();
					}
					set247(token, guildId, true);
					lastVoiceChannel.set(`${token}:${guildId}`, voiceChannelId);
					console.log(`24/7 reconnected to VC ${voiceChannelId} for guild ${guildId}`);

					const settings = getVoiceStatusSettings(token, guildId);
					const currentTrack = p.queue.current;
					const useTrackStart = !!currentTrack;
					const setting = useTrackStart ? settings.trackStart : settings.queueEnd;
					const trackToUse = currentTrack || p.queue.previous[p.queue.previous.length - 1];

					if (setting.status && setting.content && setting.content.trim() !== "") {
						const content = trackToUse ? applyTemplate(setting.content, trackToUse) : setting.content;
						setVoiceStatus(voiceChannelId, token, content).catch(() => {});
					}
				} catch (err: any) {
					const msg = musicErrorMessage(err);
					if (isKnownTransientMusicError(err)) {
						warnMusicThrottled(`247-reconnect:${guildId}:${msg}`, `24/7 reconnect skipped for guild ${guildId}: ${msg}`, 30_000);
					} else {
						console.error(`24/7 reconnect failed for guild ${guildId}: ${msg}`);
					}
				} finally {
					reconnecting247.delete(guildId);
				}
			};

			// Re-establish voice connections + resume playback for all players after a
			// gateway shard resumes. The Lavalink manager/node stays intact across a
			// Discord disconnect, but the voice server state is lost and must be re-sent.
			const reconnectAllVoiceAfterShardResume = async () => {
				if (!players.has(token)) return;
				// Give the gateway a moment to re-sync guild/voice caches before reconnecting
				await new Promise((r) => setTimeout(r, 1500));
				if (!players.has(token) || client.ws.status !== 0) {
					console.log(`Shard resume voice reconnect aborted — client not ready (token: ...${token.slice(-6)})`);
					return;
				}
				for (const p of manager.players.values()) {
					const guildId = p.guildId;
					const voiceChannelId = p.voiceChannelId ?? lastVoiceChannel.get(`${token}:${guildId}`);
					if (!voiceChannelId) continue;

					if (get247(token, guildId)) {
						reconnect247(guildId, voiceChannelId, "shardResume");
						continue;
					}

					if (!p.connected) {
						try {
							p.voiceChannelId = voiceChannelId;
							await p.connect();
							// Wait for voice state updates to reach the node before playing
							await new Promise((r) => setTimeout(r, 2500));
							if (p.queue.current && p.node?.connected) {
								const position = safeResumePosition(p);
								console.log(`Resuming playback after shard resume for guild ${guildId}${position ? ` at ${position}ms` : ""}`);
								const playPromise = position === undefined ? p.play() : p.play({ position });
								playPromise.catch((err: any) => {
									const msg = musicErrorMessage(err);
									if (!isKnownTransientMusicError(err) && !msg.includes("PlayerOption#position")) {
										console.error(`Failed to resume after shard resume for guild ${guildId}: ${msg}`);
									}
								});
							}
						} catch (err: any) {
							const msg = musicErrorMessage(err);
							if (!isKnownTransientMusicError(err)) {
								console.error(`Failed to re-establish voice after shard resume for guild ${guildId}: ${msg}`);
							}
						}
					}
				}
			};

			// ─ Manager Events ───────────────────
			manager.on("trackStart", (p, track) => {
				updateVoiceStatus(p, token, track).catch(() => {});
				sendMessageStatus(client, token, p.guildId, "trackStart", track).catch(() => {});
				cancelAutoDestroy(token);
				if (p.get("autoplay") && track) fillAutoplay(p, track);
			});

			manager.on("queueEnd", (p) => {
				const settings = getVoiceStatusSettings(token, p.guildId);
				const isActive = settings.queueEnd.status;
				const template = settings.queueEnd.content;
				const lastTrack = p.queue.previous[p.queue.previous.length - 1];
				if (isActive !== false && template && template.trim() !== "") {
					const content = lastTrack ? applyTemplate(template, lastTrack) : template;
					if (p.voiceChannelId) setVoiceStatus(p.voiceChannelId, token, content).catch(() => {});
				} else {
					if (p.voiceChannelId) setVoiceStatus(p.voiceChannelId, token, "").catch(() => {});
				}
				sendMessageStatus(client, token, p.guildId, "queueEnd", lastTrack).catch(() => {});
				if (get247(token, p.guildId)) {
					console.log(`Queue empty for guild ${p.guildId}, 24/7 mode — staying in VC`);
					reconnect247(p.guildId, p.voiceChannelId!, "queueEnd");
					return;
				}
				if (p.connected && p.voiceChannelId) {
					const voiceChannelId = p.voiceChannelId;
					console.log(`Queue empty for guild ${p.guildId}, disconnecting from VC ${voiceChannelId} (24/7 off)`);
					setVoiceStatus(voiceChannelId, token, "").catch(() => {});
					voiceStatusStore.delete(`${token}:${p.guildId}`);
					lastVoiceChannel.delete(`${token}:${p.guildId}`);
					p.destroy().catch((err: any) => {
						console.error(`Failed to destroy Lavalink player after queueEnd for guild ${p.guildId}:`, err);
					});
				}
				console.log(`Queue empty for guild ${p.guildId}, scheduling auto-destroy (token: ...${token.slice(-6)})`);
				scheduleAutoDestroy(token);
			});

			manager.on("playerDestroy", (p) => {
				// voiceChannelId may already be null by the time this fires, fall back to last known
				const voiceChannelId = p.voiceChannelId ?? lastVoiceChannel.get(`${token}:${p.guildId}`);
				if (get247(token, p.guildId)) {
					// Do not update voice status here. We keep the current status (trackStart or queueEnd)
					// so it persists smoothly through the reconnection.
					if (voiceChannelId) {
						console.log(`Player destroyed for guild ${p.guildId} in 24/7 mode — reconnecting`);
						reconnect247(p.guildId, voiceChannelId, "playerDestroy");
					} else {
						console.log(`Player destroyed for guild ${p.guildId} in 24/7 mode — no voiceChannelId to reconnect`);
					}
					return;
				}

				// Not 24/7 - Clear status and reset configs
				if (voiceChannelId) setVoiceStatus(voiceChannelId, token, "").catch(() => {});
				voiceStatusStore.delete(`${token}:${p.guildId}`);

				lastVoiceChannel.delete(`${token}:${p.guildId}`);
				radioStreamUrls.delete(p.guildId);
				console.log(`Lavalink player destroyed for guild ${p.guildId}`);
				scheduleAutoDestroy(token);
			});

			// Track which nodes have failed since the last successful connection, so we
			// only surface a console error once every configured node has been exhausted
			// (avoids spamming a warning per-node while others are still trying).
			const failedNodeIds = new Set<string>();

			manager.nodeManager.on("error", (node, err) => {
				const hasConnected = [...manager.nodeManager.nodes.values()].some((n) => n.connected);
				if (hasConnected) return;
				failedNodeIds.add(node.id);
				const total = manager.nodeManager.nodes.size;
				if (failedNodeIds.size >= total) {
					warnMusicThrottled(`node-error-final`, `[Lavalink] All Lavalink nodes failed to connect. Last error on "${node.id}": ${musicErrorMessage(err)}`, 30_000);
				}
			});

			// Track which node ids have dropped, so the "connect" handler below can tell
			// a genuine reconnect (needs auto-resume) apart from a brand-new node connecting
			// for the first time (e.g. right after a player was just created — nothing to resume).
			const droppedNodeIds = new Set<string>();
			const lastConnectLog = new Map<string, number>();

			manager.nodeManager.on("connect", (node) => {
				if (!players.has(token)) {
					try {
						(node as any).destroy?.("Zombie client destroyed", true);
					} catch {}
					return;
				}

				failedNodeIds.clear();

				const now = Date.now();
				const lastLog = lastConnectLog.get(node.id) ?? 0;
				const isReconnect = droppedNodeIds.has(node.id);
				droppedNodeIds.delete(node.id);

				if (!isReconnect) {
					console.log(`Lavalink node connected: ${node.id}`);
					lastConnectLog.set(node.id, now);
				} else if (now - lastLog > 300_000) {
					console.log(`Lavalink node reconnected: ${node.id}`);
					lastConnectLog.set(node.id, now);
				}

				if (!isReconnect) return; // first-time connect — nothing was playing before, skip auto-resume

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
											warnMusicThrottled(`resume-node:${player.guildId}`, `Auto-resume skipped for guild ${player.guildId}: Lavalink node is not connected`, 30_000);
											return;
										}

										const position = safeResumePosition(player);
										console.log(`Auto-resuming playback for guild ${player.guildId}${position ? ` at ${position}ms` : ""}`);
										let playPromise: Promise<any>;
										try {
											playPromise = position === undefined ? player.play() : player.play({ position });
										} catch (err: any) {
											const msg = musicErrorMessage(err);
											if (isKnownTransientMusicError(err) || msg.includes("PlayerOption#position")) {
												warnMusicThrottled(`resume:${player.guildId}:${msg}`, `Auto-resume skipped for guild ${player.guildId}: ${msg}`, 30_000);
												return;
											}
											console.error(`Failed to auto-resume for guild ${player.guildId}:`, msg);
											return;
										}
										playPromise.catch((err: any) => {
											const msg = musicErrorMessage(err);
											if (isKnownTransientMusicError(err) || msg.includes("PlayerOption#position")) {
												warnMusicThrottled(`resume:${player.guildId}:${msg}`, `Auto-resume skipped for guild ${player.guildId}: ${msg}`, 30_000);
												return;
											}
											console.error(`Failed to auto-resume for guild ${player.guildId}:`, msg);
										});
									}
								})
								.catch((err) => {
									const msg = musicErrorMessage(err);
									if (isKnownTransientMusicError(err)) {
										warnMusicThrottled(`voice-reconnect:${player.guildId}:${msg}`, `Voice reconnect skipped for guild ${player.guildId}: ${msg}`, 30_000);
										return;
									}
									console.error(`Failed to re-connect voice for guild ${player.guildId}:`, msg);
								});
						}
					}
				}
			});

			manager.nodeManager.on("disconnect", (node) => {
				droppedNodeIds.add(node.id);

				// Auto-switch: move any players stranded on this disconnected node to another connected node
				const connectedNodes = [...manager.nodeManager.nodes.values()].filter((n) => n.connected && n.id !== node.id);
				if (connectedNodes.length > 0) {
					const fallbackNode = connectedNodes[0];
					for (const player of manager.players.values()) {
						if (player.node && player.node.id === node.id) {
							try {
								player.node = fallbackNode;
								warnMusicThrottled(`node-switch:${player.guildId}`, `Switched guild ${player.guildId} from "${node.id}" to "${fallbackNode.id}"`, 10_000);
							} catch {}
						}
					}
				}

				const hasConnected = [...manager.nodeManager.nodes.values()].some((n) => n.connected);
				if (hasConnected) return;
				failedNodeIds.add(node.id);
				const total = manager.nodeManager.nodes.size;
				if (failedNodeIds.size >= total) {
					warnMusicThrottled(`node-disconnect-final`, `[Lavalink] All Lavalink nodes disconnected (last: "${node.id}")`, 30_000);
				}
			});

			// ─ Discord Events ───────────────────
			client.on("voiceStateUpdate", (oldState: any, newState: any) => {
				if (oldState.member?.id !== client.user?.id) return;
				// Track last known VC whenever bot joins/moves
				if (newState.channelId) {
					lastVoiceChannel.set(`${token}:${newState.guild.id}`, newState.channelId);
				}
				if (oldState.channel && !newState.channel) {
					const is247 = get247(token, oldState.guild.id);

					if (is247) {
						// Do not update voice status here. We keep the current status (trackStart or queueEnd)
						// so it persists smoothly through the reconnection.
						reconnect247(oldState.guild.id, oldState.channelId!, "voiceStateUpdate");
						return;
					}

					// Not 24/7 - Clear status and reset configs
					setVoiceStatus(oldState.channelId!, token, "").catch(() => {});
					voiceStatusStore.delete(`${token}:${oldState.guild.id}`);

					console.log(`Bot removed from voice channel "${oldState.channel.name}", scheduling auto-destroy (token: ...${token.slice(-6)})`);
					scheduleAutoDestroy(token);
				}
			});

			client.on("shardDisconnect", (closeEvent: any, id: number) => {
				console.log(`Client shard ${id} disconnected — keeping player alive, waiting for auto-reconnect (token: ...${token.slice(-6)})`);
				cancelAutoDestroy(token);
			});

			client.on("shardResume", (id: number) => {
				console.log(`Client shard ${id} resumed — re-establishing voice connections (token: ...${token.slice(-6)})`);
				reconnectAllVoiceAfterShardResume().catch((err: any) => {
					console.error(`Failed to re-establish voice after shard resume (token: ...${token.slice(-6)}):`, musicErrorMessage(err));
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
					const timeout = setTimeout(() => reject(new Error("Timed out waiting for Discord ready")), 15_000);
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
				// connectNodes=false: manager.init() above already kicked off connections for
				// every registered node in the background — calling node.connect() again here
				// races with that in-flight handshake and corrupts the node's socket state.
				const nodeConnected = await connectLavalinkWithFallback(manager, config.nodeConnectTimeout ?? 4000, log, preferLocal, false);

				if (!nodeConnected) {
					throw new Error("Timed out waiting for Lavalink node connection");
				}

				// Verify at least one node is actually connected and usable
				const connectedNodes = [...managed.player.nodeManager.nodes.values()].filter((n) => n.connected);
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
	for (const [key] of messageStatusStore) {
		if (key.startsWith(token + ":")) messageStatusStore.delete(key);
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
		await managed.client.destroy().catch(() => {});
	} catch {}

	pendingPlayers.delete(token);
	return true;
}

export async function destroyAllPlayers(): Promise<void> {
	const tokens = [...players.keys()];
	await Promise.allSettled(tokens.map((t) => destroyPlayer(t)));
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
		throw new Error(`I do not have permission to connect to the voice channel: ${channel.name}`);
	}
	if (!permissions?.has(PermissionsBitField.Flags.Speak)) {
		throw new Error(`I do not have permission to speak in the voice channel: ${channel.name}`);
	}
}

export async function resolveVoiceChannel(client: Client, voiceId: string) {
	let channel: any = client.channels.cache.get(voiceId);
	if (!channel) {
		channel = await client.channels.fetch(voiceId, { force: true }).catch(() => null);
	}
	if (!channel || (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice)) {
		throw new Error("Invalid voice channel ID or not a voice channel");
	}

	checkVoicePermissions(channel, client.user!);

	return channel;
}

export function getQueue(manager: LavalinkManager, guildId: string): LavalinkPlayer | null {
	return manager.players.get(guildId) ?? null;
}

export function formatDuration(ms: number): string {
	if (!ms || ms <= 0) return "0:00";
	const s = Math.floor(ms / 1000);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
	return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatTrack(track: Track | any, client?: any, guildPlayer?: any, activeFilters?: string[], is247?: boolean, onQueue?: boolean) {
	const totalPlaylistTrack = (track as any)?.playlist?.tracks?.reduce((acc: number, track: any) => acc + (track?.duration ?? 0), 0);
	const requester = track.requester || null;
	const requestedId = requester ? String((requester as any).id ?? requester) : null;
	const cachedRequester = requestedId ? client?.users?.cache?.get(requestedId) : null;
	const requesterData: any = typeof requester === "object" ? { ...requester } : { id: requestedId };
	if (cachedRequester) {
		requesterData.id = cachedRequester.id;
		requesterData.username = cachedRequester.username;
		requesterData.globalName = cachedRequester.globalName;
		requesterData.tag = cachedRequester.tag;
		requesterData.avatar = cachedRequester.displayAvatarURL({ extension: "png", size: 1024 });
		requesterData.bot = cachedRequester.bot;
	} else if (requestedId && requesterData.avatar && typeof requesterData.avatar === "string" && !requesterData.avatar.startsWith("http")) {
		const hash = requesterData.avatar;
		const ext = hash.startsWith("a_") ? "gif" : "png";
		requesterData.avatar = `https://cdn.discordapp.com/avatars/${requestedId}/${hash}.${ext}?size=1024`;
	} else if (requestedId && requesterData.username == null) {
		requesterData.username = "Discord User";
	}
	delete requesterData.guildId;
	delete requesterData.voiceChannelId;

	let voiceInfo: { isInVC: boolean; _warning?: string } | null = null;
	if (requestedId && !isNaN(Number(requestedId))) {
		const guild = client?.guilds?.cache?.get(guildPlayer?.guildId);
		const voiceState = guild?.voiceStates?.cache?.get(requestedId);
		const channel = client?.channels?.cache?.get(guildPlayer?.voiceChannelId) as VoiceChannel | null;

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
			};
		}
	}

	const filters = activeFilters ?? [];
	const totalQueueDuration = guildPlayer?.queue?.tracks?.reduce((acc: number, t: any) => acc + (t?.info?.duration ?? 0), 0) ?? 0;

	const result: { data: any } = {
		data: {
			nodeId: guildPlayer?.node?.id ?? null,
			client: guildPlayer?.options ? { ...guildPlayer.options, node: guildPlayer.node?.id || guildPlayer.options.node } : null,
			id: track.info.identifier,
			title: track.info.title,
			author: track.info.author,
			url: track.info.uri,
			source: (track.info as any).sourceName || "",
			actualSource: (track.info as any).actualSourceName || (track.info as any).sourceName || "",
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
						elapsedTime: {
							label: formatDuration(totalPlaylistTrack),
							value: String(totalPlaylistTrack),
						},
					}
				: null,
			is247: is247 ?? false,
			playing: guildPlayer?.playing ?? false,
			paused: guildPlayer?.paused ?? false,
			volume: guildPlayer?.volume ?? 100,
			loop: guildPlayer?.get?.("autoplay") ? "autoplay" : (guildPlayer?.repeatMode ?? "off"),
			filters: {
				array: filters,
				string: filters.length > 0 ? filters.join(", ") : "",
			},
			queueSize: guildPlayer?.queue?.tracks?.length ?? 0,
			queueElapsedTime: {
				label: formatDuration(totalQueueDuration),
				value: String(totalQueueDuration),
			},
			progress: {
				current: {
					label: formatDuration(guildPlayer?.position ?? 0),
					value: String(guildPlayer?.position ?? 0),
				},
				total: {
					label: formatDuration(track.info.duration),
					value: String(track.info.duration),
				},
			},
		},
	};

	if (onQueue) {
		const { is247: _a, playing: _b, paused: _c, volume: _d, loop: _e, filters: _f, queueSize: _g, queueElapsedTime: _h, progress: _i, ...rest } = result.data;
		result.data = rest;
	}

	return result;
}

export function applyTemplate(template: string, track: any): string {
	const data = formatTrack(track).data;
	return template.replace(/{([\w.]+)}/g, (match, path) => {
		if (path === "currentTimestamp") return new Date().toISOString();
		const parts = path.split(".");
		const value = parts.reduce((obj: any, key: string) => obj?.[key], data);
		if (value === undefined) return "";
		if (typeof value === "boolean") return value ? "✅" : "❌";
		return String(value);
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
				console.error(`❌ autoInit: Failed for token ...${token.slice(-6)}: ${err.message}`);
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
	const managed = [...players.values()].find((entry) => entry.player === manager);
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
		let currentAutoplayCount = player.queue.tracks.filter((t) => (t.requester as any)?.isAutoplay).length;
		const TARGET = 20;
		const REFETCH_THRESHOLD = 10;

		if (currentAutoplayCount < REFETCH_THRESHOLD) {
			let attempts = 0;

			while (currentAutoplayCount < TARGET && attempts < 3) {
				attempts++;

				const track = player.queue.tracks[player.queue.tracks.length - 1] || player.queue.current || baseTrack;
				if (!track) break;

				const previousTracks = player.queue.previous.map((t) => t.info.identifier);
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

				const res = await player.search({ query: searchStr }, (track.requester as any)?.isAutoplay ? undefined : track.requester);
				if (!res.tracks?.length) break;

				const needed = TARGET - currentAutoplayCount;
				const toAdd = res.tracks
					.filter((t) => {
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
					t.requester = {
						...((track.requester as any) || clientRequesterForPlayer(player) || {}),
						isAutoplay: true,
					};
					await player.queue.add(t);
				}

				currentAutoplayCount = player.queue.tracks.filter((t) => (t.requester as any)?.isAutoplay).length;
				if (!player.playing && !player.paused) {
					if (!player.node?.connected) break;
					await player.play();
				}
			}
		}
	} catch (err) {
		const msg = musicErrorMessage(err);
		if (isKnownTransientMusicError(err)) {
			warnMusicThrottled(`autoplay:${player.guildId}:${msg}`, `Autoplay skipped for guild ${player.guildId}: ${msg}`, 60_000);
		} else {
			console.error(`Autoplay failed for guild ${player.guildId}:`, msg);
		}
	} finally {
		player.set("isFillingAutoplay", false);
	}
}
