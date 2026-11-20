import { join } from "path";
import readline from "readline";
import { Readable } from "stream";

export interface TranslateImageResult {
	ok: boolean;
	error?: string;
	[key: string]: any;
}

interface PendingRequest {
	resolve: (value: any) => void;
	reject: (reason: any) => void;
	timer: ReturnType<typeof setTimeout> | null;
}

let persistentProc: any = null;
let rl: readline.Interface | null = null;
let requestCounter = 0;
let requestQueue: Promise<any> = Promise.resolve();
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
	const bridgePath = join(projectRoot, "functions", "translateImageBridge.py");

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
			return;
		}
		const id = parsed?.request_id;
		if (typeof id !== "string") return;
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
		} catch {}
	};
	logStderr();

	persistentProc.exited.then((exitCode: number) => {
		persistentProc = null;
		rl = null;
		rejectAllPending(new Error(`Translate image bridge exited unexpectedly with code ${exitCode}.`));
	});
}

function sendRequest(payload: Record<string, any>, timeoutMs = 120000): Promise<any> {
	if (!persistentProc) initSubprocess();

	const requestId = `${++requestCounter}`;
	const full = { ...payload, request_id: requestId };

	return new Promise((resolve, reject) => {
		const pending: PendingRequest = { resolve, reject, timer: null };
		pending.timer = setTimeout(() => {
			settleRequest(requestId, (p) => p.reject(new Error(`translateImage bridge timed out after ${timeoutMs}ms`)));
		}, timeoutMs);
		pendingRequests.set(requestId, pending);

		try {
			persistentProc.stdin.write(new TextEncoder().encode(JSON.stringify(full) + "\n"));
			persistentProc.stdin.flush();
		} catch (err) {
			settleRequest(requestId, (p) => p.reject(err));
		}
	});
}

export async function translateImage(imageB64: string, mime: string, from: string, to: string): Promise<TranslateImageResult> {
	return new Promise((resolve, reject) => {
		requestQueue = requestQueue.then(async () => {
			try {
				const res = await sendRequest({
					image_b64: imageB64,
					mime,
					from,
					to,
					reqid: Date.now() % 1000000,
				});
				resolve(res as TranslateImageResult);
			} catch (err) {
				reject(err);
			}
		});
	});
}

export async function warmTranslateImage(): Promise<boolean> {
	try {
		const res = await sendRequest({ action: "warmup" }, 120000);
		return res?.success === true;
	} catch (e) {
		console.warn("[translateImage] warmup failed:", String(e).slice(0, 200));
		return false;
	}
}

export function closeTranslateImageBridge() {
	const proc = persistentProc;
	if (!proc) return;
	persistentProc = null;
	try {
		rl?.close();
	} catch {}
	rl = null;
	rejectAllPending(new Error("Translate image bridge closed"));
	try {
		proc.stdin.end();
	} catch {}
	const hard = setTimeout(() => {
		try {
			proc.kill();
		} catch {}
	}, 10_000);
	hard.unref?.();
	proc.exited?.then(() => clearTimeout(hard))?.catch?.(() => {});
}

process.on("exit", closeTranslateImageBridge);
