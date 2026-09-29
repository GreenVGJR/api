// still unstable

import { join } from "path";
import readline from "readline";
import { Readable } from "stream";

export interface SelectorConfig {
	selector: string;
	xpath?: boolean;
	all?: boolean;
}

export interface ScraplingOptions {
	url: string;
	fetcherType?: "basic" | "stealthy" | "dynamic";
	method?: "GET" | "POST" | "PUT" | "DELETE";
	headers?: Record<string, string>;
	cookies?: Record<string, string>;
	proxy?: string | { server: string; username?: string; password?: string };
	headless?: boolean;
	networkIdle?: boolean;
	timeout?: number;
	timeoutMs?: number;
	retries?: number;
	solveCloudflare?: boolean;
	googleSearch?: boolean;
	waitSelector?: string;
	waitSelectorState?: "attached" | "detached" | "visible" | "hidden";
	waitMs?: number;
	body?: string;
	selectors?: Record<string, string | SelectorConfig>;
	extractMarkdown?: boolean;
	extractText?: boolean;
	extractHtml?: boolean;
}

export interface ScraplingResult<T = Record<string, any>> {
	success: boolean;
	status?: number;
	url?: string;
	headers?: Record<string, string>;
	cookies?: Record<string, string>;
	data?: T;
	markdown?: string;
	text?: string;
	html?: string;
	error?: string;
}

let persistentProc: any = null;
let rl: readline.Interface | null = null;
let requestCounter = 0;
let requestQueue: Promise<any> = Promise.resolve();

// Requests are keyed by id instead of a single pending slot: a request that times
// out may still produce a response later, and that stale line must never be
// handed to whichever request is in flight by then.
interface PendingRequest {
	resolve: (value: any) => void;
	reject: (reason: any) => void;
	timer: ReturnType<typeof setTimeout> | null;
}

const pendingRequests = new Map<string, PendingRequest>();

function settleRequest(id: string, fn: (pending: PendingRequest) => void) {
	const pending = pendingRequests.get(id);
	if (!pending) return false;
	pendingRequests.delete(id);
	if (pending.timer) clearTimeout(pending.timer);
	fn(pending);
	return true;
}

function rejectAllPending(reason: any) {
	for (const [id] of pendingRequests) {
		settleRequest(id, (pending) => pending.reject(reason));
	}
}

function initSubprocess() {
	const projectRoot = process.cwd();
	const pythonPath = join(projectRoot, ".venv", process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "python.exe" : "python");
	const bridgePath = join(projectRoot, "functions", "scrapling_bridge.py");

	persistentProc = Bun.spawn({
		cmd: [pythonPath, bridgePath],
		stdin: "pipe",
		stdout: "pipe",
		stderr: "pipe",
	});

	rl = readline.createInterface({
		input: Readable.fromWeb(persistentProc.stdout as any),
		crlfDelay: Infinity,
	});

	rl.on("line", (line) => {
		if (!line || !line.trim()) return;

		let parsed: any;
		try {
			parsed = JSON.parse(line);
		} catch {
			return; // not a bridge payload
		}

		const id = parsed?.request_id;
		if (typeof id !== "string") return;

		// Unknown id = timed-out/abandoned request, drop the stale response.
		settleRequest(id, (pending) => pending.resolve(parsed));
	});

	const logStderr = async () => {
		try {
			const reader = persistentProc.stderr.getReader();
			const decoder = new TextDecoder();
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				const text = decoder.decode(value);
				process.stderr.write(text);
			}
		} catch (err) {}
	};
	logStderr();

	persistentProc.exited.then((exitCode: number) => {
		persistentProc = null;
		rl = null;
		rejectAllPending(new Error(`Python bridge process exited unexpectedly with code ${exitCode}.`));
	});
}

async function executeRequest(options: ScraplingOptions): Promise<any> {
	if (!persistentProc) {
		initSubprocess();
	}

	const requestId = `${++requestCounter}`;

	const payload = {
		request_id: requestId,
		url: options.url,
		fetcher_type: options.fetcherType || "stealthy",
		method: options.method || "GET",
		headers: options.headers,
		cookies: options.cookies,
		proxy: options.proxy,
		headless: options.headless !== false,
		network_idle: options.networkIdle || false,
		timeout: options.timeout || 30000,
		retries: options.retries ?? 3,
		solve_cloudflare: options.solveCloudflare !== false,
		wait_selector: options.waitSelector,
		wait_selector_state: options.waitSelectorState,
		wait_ms: options.waitMs,
		body: options.body,
		selectors: options.selectors || {},
		extract_markdown: options.extractMarkdown || false,
		extract_text: options.extractText || false,
		extract_html: options.extractHtml || false,
		google_search: options.googleSearch !== false,
	};

	return new Promise((resolve, reject) => {
		const pending: PendingRequest = { resolve, reject, timer: null };

		if (options.timeoutMs && options.timeoutMs > 0) {
			pending.timer = setTimeout(() => {
				settleRequest(requestId, (p) => p.reject(new Error(`browserRequest timed out after ${options.timeoutMs}ms: ${options.url}`)));
			}, options.timeoutMs);
		}

		pendingRequests.set(requestId, pending);

		try {
			const payloadBytes = new TextEncoder().encode(JSON.stringify(payload) + "\n");
			persistentProc.stdin.write(payloadBytes);
			persistentProc.stdin.flush();
		} catch (err) {
			settleRequest(requestId, (p) => p.reject(err));
		}
	});
}

export async function browserRequest<T = Record<string, any>>(options: ScraplingOptions): Promise<ScraplingResult<T>> {
	return new Promise((resolve, reject) => {
		requestQueue = requestQueue.then(async () => {
			try {
				const res = await executeRequest(options);
				resolve(res);
			} catch (err) {
				reject(err);
			}
		});
	});
}

export function closeBrowser() {
	if (persistentProc) {
		try {
			persistentProc.kill();
		} catch {}
		persistentProc = null;
		rl = null;
	}
}

process.on("exit", closeBrowser);
process.on("SIGINT", () => {
	closeBrowser();
	process.exit(0);
});
process.on("SIGTERM", () => {
	closeBrowser();
	process.exit(0);
});

export default browserRequest;
