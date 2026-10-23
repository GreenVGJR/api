import crypto from "crypto";
import { commonHeaders } from "./request.js";
import { chatConversations } from "./database.js";

export const CHAT_MODELS = {
	zai: "@cf/zai-org/glm-4.7-flash",
	gpt: "@cf/openai/gpt-oss-120b",
	gemma: "@cf/google/gemma-4-26b-a4b-it",
	nemotron: "@cf/nvidia/nemotron-3-120b-a12b",
	qwen: "@cf/qwen/qwen3.8-27b",
} as const;

export type ChatModel = keyof typeof CHAT_MODELS;
export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatUsage = {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	costUsd: number;
	costPartial: boolean;
	generationMs: number;
	responseCount: number;
};

export type ChatResult = {
	_warning: string;
	modelId: string;
	conversation: string;
	response: string;
	reasoning?: string;
	finishReason?: string;
	data: ChatUsage;
};

export type ChatFailure = { error: string };

type ChatCompletion = Omit<ChatResult, "conversation">;

export const CHAT_WARNING = "This endpoint may not working as expect due to anti-bot protection";

export const DEFAULT_CHAT_SYSTEM = "You are a helpful assistant. Do not repeat the user's question. Use only the provided conversation history for context; do not invent prior turns. If the answer isn't known, say so plainly. Respond in English unless user specific. Do not call tools.";

export const CHAT_LIMITS = {
	prompt: 6000,
	conversation: 6000,
	turns: 20,
	// The playground demo stores at most 10 user messages per room/conversation.
	roomUserTurns: 10,
	url: 8000,
} as const;

function buildDefaultPlaygroundWs() {
	const room = `playground-${crypto.randomBytes(12).toString("hex")}`;
	const params = new URLSearchParams({
		_pk: crypto.randomUUID(),
		generativeUIMode: "off",
		builtInMcpApp: "false",
	});
	return `wss://playground.ai.cloudflare.com/agents/playground/${room}?${params.toString()}`;
}

let baseWsUrl = buildDefaultPlaygroundWs();

function playgroundUrl(model: ChatModel) {
	const url = new URL(baseWsUrl);
	url.searchParams.set("model", CHAT_MODELS[model]);
	url.searchParams.set("system", DEFAULT_CHAT_SYSTEM);
	url.searchParams.set("generativeUIMode", "off");
	url.searchParams.set("builtInMcpApp", "false");
	return url.toString();
}

const PLAYGROUND_ORIGIN = "https://playground.ai.cloudflare.com";
const CONNECT_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 90_000;
const IDLE_CLOSE_MS = 60_000;
const MIN_REQUEST_GAP_MS = 1_000;
const STATE_SWITCH_GRACE_MS = 500;
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX_ENTRIES = 200;

const CONVERSATION_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

type StoredConversation = { v: 1; t: ChatTurn[] };

type PendingRequest = {
	id: string;
	model: ChatModel;
	text: string;
	reasoning: string;
	finishReason: string;
	usage: Record<string, unknown> | null;
	timer: ReturnType<typeof setTimeout>;
	resolve: (result: ChatCompletion) => void;
	reject: (error: Error) => void;
};

type ReadyWaiter = { resolve: () => void; reject: (error: Error) => void };

let socket: WebSocket | null = null;
let socketState: "closed" | "connecting" | "ready" = "closed";
let socketModel: ChatModel | null = null;
let latestState: Record<string, unknown> | null = null;
let switching = false;
let switchResolve: ((ok: boolean) => void) | null = null;
let switchTimer: ReturnType<typeof setTimeout> | null = null;
let mcpSeen = false;
let stateSeen = false;
let readyPromise: Promise<void> | null = null;
let readyWaiter: ReadyWaiter | null = null;
let connectTimer: ReturnType<typeof setTimeout> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let pending: PendingRequest | null = null;
let lastUsage: Record<string, unknown> | null = null;
let usageBaseline: Record<string, unknown> | null = null;
let activeConversationId: string | null = null;
let roomUserMessages = 0;
let lastRequestAt = 0;

let queueTail: Promise<unknown> = Promise.resolve();

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function enqueue<T>(task: () => Promise<T>): Promise<T> {
	const result = queueTail.then(task, task);
	queueTail = result.then(
		() => undefined,
		() => undefined,
	);
	return result;
}

const cache = new Map<string, { expires: number; result: ChatResult }>();

function cacheGet(key: string): ChatResult | null {
	const hit = cache.get(key);
	if (!hit) return null;
	if (hit.expires <= Date.now() || !hit.result.response) {
		cache.delete(key);
		return null;
	}
	cache.delete(key);
	cache.set(key, hit);
	return hit.result;
}

function cacheSet(key: string, result: ChatResult) {
	if (cache.size >= CACHE_MAX_ENTRIES) {
		const oldest = cache.keys().next().value;
		if (oldest !== undefined) cache.delete(oldest);
	}
	cache.set(key, { expires: Date.now() + CACHE_TTL_MS, result });
}

function clearConnectTimer() {
	if (connectTimer) {
		clearTimeout(connectTimer);
		connectTimer = null;
	}
}

function clearIdleTimer() {
	if (idleTimer) {
		clearTimeout(idleTimer);
		idleTimer = null;
	}
}

function scheduleIdleClose() {
	clearIdleTimer();
	idleTimer = setTimeout(() => {
		idleTimer = null;
		if (!pending && socket) closeSocket("Playground socket idle");
	}, IDLE_CLOSE_MS);
}

function closeSocket(reason: string) {
	clearConnectTimer();
	clearIdleTimer();

	const ws = socket;
	socket = null;
	socketState = "closed";
	socketModel = null;
	mcpSeen = false;
	stateSeen = false;
	readyPromise = null;
	latestState = null;
	lastUsage = null;
	usageBaseline = null;
	switching = false;
	if (switchTimer) {
		clearTimeout(switchTimer);
		switchTimer = null;
	}
	const resolveSwitch = switchResolve;
	switchResolve = null;
	resolveSwitch?.(false);

	const waiter = readyWaiter;
	readyWaiter = null;
	waiter?.reject(new Error(reason));

	const current = pending;
	pending = null;
	if (current) {
		clearTimeout(current.timer);
		current.reject(new Error(reason));
	}

	if (ws) {
		try {
			ws.close();
		} catch {
			// already closed
		}
	}
}

function failPending(error: Error) {
	const current = pending;
	if (!current) return;
	pending = null;
	clearTimeout(current.timer);
	current.reject(error);
	closeSocket(error.message);
}

// Each playground room keeps at most 10 user messages, so long conversations
// rotate to a fresh room and seed it with the stored history as one message.
function rotateRoom() {
	baseWsUrl = buildDefaultPlaygroundWs();
	roomUserMessages = 0;
}

function prepareRoom(conversationId: string) {
	if (activeConversationId !== conversationId) {
		rotateRoom();
		activeConversationId = conversationId;
		if (socket) closeSocket("Playground conversation switch");
		return;
	}
	if (roomUserMessages >= CHAT_LIMITS.roomUserTurns) {
		rotateRoom();
		if (socket) closeSocket("Playground room exhausted");
	}
}

function buildTranscript(turns: ChatTurn[], prompt: string) {
	const lines = turns.map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`);
	return `Conversation so far:\n${lines.join("\n")}\n\nNew message:\n${prompt}`;
}

function markSocketReady() {
	if (socketState !== "connecting" || !stateSeen || !mcpSeen) return;
	socketState = "ready";
	clearConnectTimer();
	readyPromise = null;
	const waiter = readyWaiter;
	readyWaiter = null;
	waiter?.resolve();
}

function toNumber(value: unknown) {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// The playground reports usage cumulatively for the whole session, so per-request
// numbers are the difference against the snapshot taken before the request started.
function buildUsage(current: Record<string, unknown> | null, baseline: Record<string, unknown> | null): ChatUsage {
	const now = current ?? {};
	const before = baseline ?? {};
	const delta = (key: string) => {
		const value = toNumber(now[key]);
		const previous = toNumber(before[key]);
		return value >= previous ? value - previous : value;
	};
	return {
		inputTokens: delta("inputTokens"),
		outputTokens: delta("outputTokens"),
		totalTokens: delta("totalTokens"),
		costUsd: Math.round(delta("costUsd") * 1e12) / 1e12,
		costPartial: now.costPartial === true,
		generationMs: toNumber(now.generationMs),
		responseCount: toNumber(now.responseCount),
	};
}

function handleMessage(raw: string) {
	let message: any;
	try {
		message = JSON.parse(raw);
	} catch {
		return;
	}
	if (!message || typeof message !== "object") return;

	if (message.type === "cf_agent_mcp_servers") {
		mcpSeen = true;
		markSocketReady();
		return;
	}

	if (message.type === "cf_agent_state") {
		if (message.state && typeof message.state === "object") {
			latestState = message.state as Record<string, unknown>;
			const usage = (message.state as Record<string, unknown>).usage;
			if (usage && typeof usage === "object") {
				lastUsage = usage as Record<string, unknown>;
				if (pending) pending.usage = usage as Record<string, unknown>;
			}
		}
		if (socketState === "connecting" && socketModel && message.state?.model === CHAT_MODELS[socketModel]) {
			stateSeen = true;
			markSocketReady();
		}
		return;
	}

	if (message.type === "cf_agent_state_error") {
		if (switching) {
			switching = false;
			if (switchTimer) {
				clearTimeout(switchTimer);
				switchTimer = null;
			}
			const resolve = switchResolve;
			switchResolve = null;
			resolve?.(false);
		}
		return;
	}

	if (message.type !== "cf_agent_use_chat_response") return;

	const current = pending;
	if (!current || typeof message.id !== "string" || message.id !== current.id) return;

	if (message.done === true) {
		pending = null;
		clearTimeout(current.timer);
		scheduleIdleClose();

		const reasoning = current.reasoning.trim();
		const responseText = current.text.trim();
		current.resolve({
			_warning: CHAT_WARNING,
			modelId: CHAT_MODELS[current.model],
			response: responseText,
			...(reasoning ? { reasoning } : {}),
			finishReason: current.finishReason || "stop",
			data: buildUsage(current.usage ?? lastUsage, usageBaseline),
		});
		return;
	}

	if (typeof message.body !== "string" || message.body === "") return;

	let body: any;
	try {
		body = JSON.parse(message.body);
	} catch {
		return;
	}
	if (!body || typeof body !== "object") return;

	switch (body.type) {
		case "text-delta":
			if (typeof body.delta === "string") current.text += body.delta;
			break;
		case "reasoning-delta":
			if (typeof body.delta === "string") current.reasoning += body.delta;
			break;
		case "finish":
			if (typeof body.messageMetadata?.finishReason === "string") {
				current.finishReason = body.messageMetadata.finishReason;
			}
			break;
		case "error":
			failPending(new Error(typeof body.errorText === "string" ? body.errorText : "Playground stream error"));
			break;
		default: {
			// Demo limits arrive as {"message": "...", "details": "..."} with no type.
			const upstreamError = typeof body.message === "string" ? body.message : typeof body.details === "string" ? body.details : "";
			if (!body.type && upstreamError.trim() !== "") {
				if (/limited to \d+ messages/i.test(upstreamError)) rotateRoom();
				failPending(new Error(upstreamError));
			}
			// tool-* and start/end frames are intentionally ignored; the model is told not to call tools.
			break;
		}
	}
}

function ensureSocket(model: ChatModel): Promise<void> {
	clearIdleTimer();
	if (socket && socketState === "ready") return Promise.resolve();
	if (readyPromise) return readyPromise;
	if (socket) closeSocket("Playground connection reset");

	const ws = new WebSocket(playgroundUrl(model), {
		headers: {
			Origin: PLAYGROUND_ORIGIN,
			"User-Agent": commonHeaders["User-Agent"],
		},
	});
	socket = ws;
	socketModel = model;
	socketState = "connecting";
	latestState = null;
	mcpSeen = false;
	stateSeen = false;

	readyPromise = new Promise<void>((resolve, reject) => {
		readyWaiter = { resolve, reject };
		connectTimer = setTimeout(() => {
			closeSocket(`Playground did not apply model ${CHAT_MODELS[model]}`);
		}, CONNECT_TIMEOUT_MS);
	});
	readyPromise.catch(() => {});

	ws.addEventListener("message", (event) => {
		if (ws !== socket || typeof event.data !== "string") return;
		handleMessage(event.data);
	});

	ws.addEventListener("error", () => {
		if (ws !== socket) return;
		closeSocket("Playground connection failed");
	});

	ws.addEventListener("close", () => {
		if (ws !== socket) return;
		closeSocket("Playground connection closed");
	});

	return readyPromise;
}

function switchSocketModel(model: ChatModel): Promise<boolean> {
	const ws = socket;
	if (!ws || socketState !== "ready" || !latestState) return Promise.resolve(false);
	const nextModel = CHAT_MODELS[model];
	if (latestState.model === nextModel) {
		socketModel = model;
		return Promise.resolve(true);
	}
	if (switching) return Promise.resolve(false);

	return new Promise<boolean>((resolve) => {
		switching = true;
		switchResolve = resolve;
		switchTimer = setTimeout(() => {
			switching = false;
			switchTimer = null;
			switchResolve = null;
			if (latestState) latestState = { ...latestState, model: nextModel };
			socketModel = model;
			resolve(true);
		}, STATE_SWITCH_GRACE_MS);

		try {
			ws.send(
				JSON.stringify({
					type: "cf_agent_state",
					state: {
						...latestState,
						model: nextModel,
						system: DEFAULT_CHAT_SYSTEM,
					},
				}),
			);
		} catch {
			switching = false;
			if (switchTimer) {
				clearTimeout(switchTimer);
				switchTimer = null;
			}
			switchResolve = null;
			resolve(false);
		}
	});
}

async function ensureModel(model: ChatModel): Promise<void> {
	await ensureSocket(model);
	if (socketModel === model) return;
	if (await switchSocketModel(model)) return;
	closeSocket("Playground model switch");
	await ensureSocket(model);
}

async function runOnce(model: ChatModel, conversationId: string, prompt: string, turns: ChatTurn[], userMessageId: string): Promise<ChatCompletion> {
	prepareRoom(conversationId);
	const seed = roomUserMessages === 0 && turns.length > 0;
	const content = seed ? buildTranscript(turns, prompt) : prompt;

	await ensureModel(model);

	const ws = socket;
	if (!ws || socketState !== "ready") throw new Error("Playground connection is not ready");

	const wait = lastRequestAt + MIN_REQUEST_GAP_MS - Date.now();
	if (wait > 0) await sleep(wait);
	lastRequestAt = Date.now();

	const id = `chat_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
	const wireMessages = [
		{
			id: userMessageId,
			role: "user",
			parts: [{ type: "text", text: content }],
		},
	];

	usageBaseline = lastUsage;

	return await new Promise<ChatCompletion>((resolve, reject) => {
		const timer = setTimeout(() => {
			failPending(new Error("Upstream timed out"));
		}, REQUEST_TIMEOUT_MS);
		pending = {
			id,
			model,
			text: "",
			reasoning: "",
			finishReason: "",
			usage: null,
			timer,
			resolve,
			reject,
		};

		try {
			ws.send(
				JSON.stringify({
					type: "cf_agent_use_chat_request",
					id,
					init: {
						method: "POST",
						body: JSON.stringify({
							messages: wireMessages,
							trigger: "submit-message",
						}),
					},
				}),
			);
			roomUserMessages++;
		} catch (error) {
			failPending(error instanceof Error ? error : new Error("Failed to send playground request"));
		}
	});
}

function isRetryable(message: string) {
	return message === "Playground connection failed" || message === "Playground connection closed" || message === "Playground connection is not ready" || /limited to \d+ messages/i.test(message);
}

function trimConversationTurns(turns: ChatTurn[]): ChatTurn[] {
	let start = Math.max(0, turns.length - CHAT_LIMITS.turns);
	const minStart = Math.max(0, turns.length - 2);
	let total = 0;
	for (let i = start; i < turns.length; i++) total += turns[i].content.length;
	while (start < minStart && total > CHAT_LIMITS.conversation) {
		total -= turns[start].content.length;
		start++;
	}
	return turns.slice(start);
}

function normalizeConversationTurns(entries: unknown[]): { turns: ChatTurn[] } | { error: string } {
	const turns: ChatTurn[] = [];
	for (const entry of entries) {
		if (!entry || typeof entry !== "object") return { error: "Invalid conversation data" };
		const record = entry as Record<string, unknown>;
		const role = record.role;
		const content = record.content;
		if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
			return { error: "Invalid conversation data" };
		}
		if (content.trim() === "") continue;
		turns.push({ role, content });
	}
	return { turns: trimConversationTurns(turns) };
}

export type LoadedConversation = { id: string; turns: ChatTurn[] };

export function loadChatConversation(raw?: string): { conversation: LoadedConversation } | { error: string } {
	if (!chatConversations.ready()) return { error: "Database key (DB_KEY) is not set in environment" };

	if (raw === undefined || raw === "") {
		return {
			conversation: {
				id: crypto.randomBytes(18).toString("base64url"),
				turns: [],
			},
		};
	}
	if (!CONVERSATION_ID_RE.test(raw)) return { error: "Invalid conversation id" };

	const stored = chatConversations.get(raw);
	if (stored === null) return { error: "Conversation not found or expired" };
	if ("error" in stored) return { error: stored.error };

	let parsed: unknown;
	try {
		parsed = JSON.parse(stored.value);
	} catch {
		return { error: "Invalid conversation data" };
	}
	if (!parsed || typeof parsed !== "object") return { error: "Invalid conversation data" };
	const payload = parsed as { v?: unknown; t?: unknown };
	if (payload.v !== 1 || !Array.isArray(payload.t)) return { error: "Invalid conversation data" };

	const normalized = normalizeConversationTurns(payload.t);
	if ("error" in normalized) return { error: "Invalid conversation data" };
	while (normalized.turns.length > 0 && normalized.turns[normalized.turns.length - 1].role === "user") {
		normalized.turns.pop();
	}
	return { conversation: { id: raw, turns: normalized.turns } };
}

function saveChatConversation(id: string, turns: ChatTurn[]): { success: true } | { error: string } {
	const payload: StoredConversation = { v: 1, t: trimConversationTurns(turns) };
	const stored = chatConversations.set(id, JSON.stringify(payload));
	if ("error" in stored) return { error: stored.error };
	return { success: true };
}

export async function cfChat(model: ChatModel, prompt: string, conversationId: string, turns: ChatTurn[]): Promise<ChatResult | ChatFailure> {
	if (!CHAT_MODELS[model]) return { error: "Unknown chat model" };
	if (prompt.trim() === "") return { error: "Nothing to do" };
	if (prompt.length > CHAT_LIMITS.prompt) {
		return { error: `Prompt too long (max ${CHAT_LIMITS.prompt} characters)` };
	}

	const messages: ChatTurn[] = [...turns, { role: "user", content: prompt }];
	const cacheKey = `${model}\u0000${conversationId}\u0000${JSON.stringify(messages.map((turn) => [turn.role, turn.content]))}`;
	const cached = cacheGet(cacheKey);
	if (cached) return cached;

	const userMessageId = `m_${crypto.randomBytes(8).toString("hex")}`;

	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const completion = await enqueue(() => runOnce(model, conversationId, prompt, turns, userMessageId));
			if (!completion.response) {
				return {
					error: "Upstream failed, Cloudflare might block this request",
				};
			}

			const completedTurns: ChatTurn[] = [...messages, { role: "assistant", content: completion.response }];
			const saved = saveChatConversation(conversationId, completedTurns);
			if ("error" in saved) return { error: `Failed to save conversation: ${saved.error}` };

			const result: ChatResult = {
				...completion,
				conversation: conversationId,
			};
			cacheSet(cacheKey, result);
			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (attempt === 0 && isRetryable(message)) {
				await sleep(500);
				continue;
			}
			return { error: message };
		}
	}

	return { error: "Upstream request failed" };
}
