// still unstable

import { join } from 'path';
import readline from 'readline';
import { Readable } from 'stream';

export interface SelectorConfig {
    selector: string;
    xpath?: boolean;
    all?: boolean;
}

export interface ScraplingOptions {
    url: string;
    fetcherType?: 'basic' | 'stealthy' | 'dynamic';
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    proxy?: string | { server: string; username?: string; password?: string };
    headless?: boolean;
    networkIdle?: boolean;
    timeout?: number;
    solveCloudflare?: boolean;
    googleSearch?: boolean;
    waitSelector?: string;
    waitSelectorState?: 'attached' | 'detached' | 'visible' | 'hidden';
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
let pendingResolve: ((value: any) => void) | null = null;
let pendingReject: ((reason: any) => void) | null = null;
let requestQueue: Promise<any> = Promise.resolve();

function initSubprocess() {
    const projectRoot = process.cwd();
    const pythonPath = join(projectRoot, '.venv', 'bin', 'python');
    const bridgePath = join(projectRoot, 'functions', 'scrapling_bridge.py');

    persistentProc = Bun.spawn({
        cmd: [pythonPath, bridgePath],
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe'
    });

    rl = readline.createInterface({
        input: Readable.fromWeb(persistentProc.stdout as any),
        crlfDelay: Infinity
    });

    rl.on('line', (line) => {
        if (pendingResolve) {
            try {
                const parsed = JSON.parse(line);
                pendingResolve(parsed);
            } catch (err) {
                pendingReject?.(new Error(`Failed to parse bridge output: ${line}`));
            }
            pendingResolve = null;
            pendingReject = null;
        }
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
        } catch (err) {
            
        }
    };
    logStderr();

    persistentProc.exited.then((exitCode: number) => {
        persistentProc = null;
        rl = null;
        if (pendingReject) {
            pendingReject(new Error(`Python bridge process exited unexpectedly with code ${exitCode}.`));
            pendingResolve = null;
            pendingReject = null;
        }
    });
}

async function executeRequest(options: ScraplingOptions): Promise<any> {
    if (!persistentProc) {
        initSubprocess();
    }

    const payload = {
        url: options.url,
        fetcher_type: options.fetcherType || 'stealthy',
        method: options.method || 'GET',
        headers: options.headers,
        cookies: options.cookies,
        proxy: options.proxy,
        headless: options.headless !== false,
        network_idle: options.networkIdle || false,
        timeout: options.timeout || 30000,
        solve_cloudflare: options.solveCloudflare !== false,
        wait_selector: options.waitSelector,
        wait_selector_state: options.waitSelectorState,
        wait_ms: options.waitMs,
        body: options.body,
        selectors: options.selectors || {},
        extract_markdown: options.extractMarkdown || false,
        extract_text: options.extractText || false,
        extract_html: options.extractHtml || false,
        google_search: options.googleSearch !== false
    };

    return new Promise((resolve, reject) => {
        pendingResolve = resolve;
        pendingReject = reject;

        try {
            const payloadBytes = new TextEncoder().encode(JSON.stringify(payload) + '\n');
            persistentProc.stdin.write(payloadBytes);
            persistentProc.stdin.flush();
        } catch (err) {
            reject(err);
            pendingResolve = null;
            pendingReject = null;
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

process.on('exit', closeBrowser);
process.on('SIGINT', () => {
    closeBrowser();
    process.exit(0);
});
process.on('SIGTERM', () => {
    closeBrowser();
    process.exit(0);
});

export default browserRequest;