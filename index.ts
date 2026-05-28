import { autoInit } from './functions/musicPlayer.js';
import app from './app.js';

const port = 3000;
const g = globalThis as any;

g.__vgjr_refresh_count = (g.__vgjr_refresh_count || 0) + 1;
g.__vgjr_last_reload = Date.now();

if (!g.__vgjr_initialized) {
    g.__vgjr_initialized = true;
    g.__vgjr_starttime = Date.now();
    g.__vgjr_refresh_count = 0;
    autoInit().catch(() => { });

    console.log(`\n🚀 Bun Server is running!`);
    console.log(`🏠 Local:    http://localhost:${port}/playground`);
} else {
    console.log('🔄 Routes hot-reloaded!');
}

const wsConnections = new Map<string, Set<any>>();

function validateTelData(raw: string | undefined | null): boolean {
    if (!raw) return false;
    try {
        let base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const decoded = JSON.parse(atob(base64));
        if (!Array.isArray(decoded) || decoded.length !== 3) return false;

        const [dims, solved, path] = decoded;
        if (!Array.isArray(dims) || dims.length !== 6) return false;
        if (typeof solved !== 'boolean') return false;
        if (typeof path !== 'string') return false;

        for (let i = 0; i < 4; i++) {
            if (typeof dims[i] !== 'string' || isNaN(Number(dims[i]))) return false;
        }
        if (typeof dims[4] !== 'string' || typeof dims[5] !== 'string') return false;

        return true;
    } catch {
        return false;
    }
}

function buildLocalTarget(path: string, base: string = `http://[::1]:${port}`): string | null {
    if (typeof path !== 'string') return null;
    try {
        const u = path.startsWith('/') && !path.startsWith('//')
            ? new URL(path, base)
            : new URL(path);

        const allowedOrigins = [
            new URL(base).origin,
            `http://[::1]:${port}`,
            `http://localhost:${port}`,
            `http://127.0.0.1:${port}`,
            'https://api.vgjr.top',
            'http://api.vgjr.top'
        ];

        if (!allowedOrigins.includes(u.origin)) return null;
        if (u.pathname === '/' || u.pathname.toLowerCase() === '/ws') return null;
        return u.toString();
    } catch {
        return null;
    }
}

function isLocalHost(hostname: string): boolean {
    const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '::1' ||
        h.startsWith('192.168.') || h.startsWith('10.') || h.startsWith('172.');
}

function isLocalOrigin(origin: string): boolean {
    try {
        return isLocalHost(new URL(origin).hostname);
    } catch {
        return false;
    }
}

function resolveFetchUrl(targetUrl: string, origin: string): string {
    const parsedTarget = new URL(targetUrl);
    const localOrigin = isLocalOrigin(origin);

    if (localOrigin && parsedTarget.hostname === 'api.vgjr.top') {
        parsedTarget.protocol = 'http:';
        parsedTarget.host = `[::1]:${port}`;
        return parsedTarget.toString();
    }

    if (!localOrigin && isLocalHost(parsedTarget.hostname)) {
        parsedTarget.protocol = 'https:';
        parsedTarget.host = 'api.vgjr.top';
        return parsedTarget.toString();
    }

    return parsedTarget.toString();
}

function shouldForwardWsHeader(key: string): boolean {
    const k = key.toLowerCase();
    return !(
        k === 'host' ||
        k === 'connection' ||
        k === 'upgrade' ||
        k === 'keep-alive' ||
        k === 'proxy-authenticate' ||
        k === 'proxy-authorization' ||
        k === 'te' ||
        k === 'trailer' ||
        k === 'transfer-encoding' ||
        k === 'accept-encoding' ||
        k.startsWith('sec-websocket-')
    );
}

export default {
    port,
    hostname: "::1",
    idleTimeout: 255,
    fetch(req: Request, server: any) {
        const url = new URL(req.url);

        if (url.pathname === '/ws') {
            const clientId = url.searchParams.get('client') || '';
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
                return new Response(null, { status: 404 });
            }
            const requestHeaders: Record<string, string> = {};
            req.headers.forEach((value, key) => {
                if (shouldForwardWsHeader(key)) requestHeaders[key] = value;
            });
            const origin = req.headers.get('origin') || `http://[::1]:${port}`;
            const upgraded = server.upgrade(req, { data: { clientId, requestHeaders, origin } });
            if (upgraded) return undefined;
            return new Response(null, { status: 404 });
        }

        return app.fetch(req);
    },
    websocket: {
        open(ws: any) {
            const clientId = ws.data.clientId;
            if (!wsConnections.has(clientId)) {
                wsConnections.set(clientId, new Set());
            }
            wsConnections.get(clientId)!.add(ws);
        },
        async message(ws: any, message: string | Buffer) {
            try {
                const msg = typeof message === 'string' ? JSON.parse(message) : JSON.parse(message.toString());

                if (msg.type === 'request') {
                    const { id, url, headers, method = 'GET', body } = msg;

                    const telData = headers?.['x-tel-data'];
                    if (!validateTelData(telData)) {
                        ws.send(JSON.stringify({ id, type: 'response', status: 403, statusText: 'Forbidden', headers: {} }));
                        ws.send(JSON.stringify({ id, type: 'chunk', data: '', finish: true }));
                        return;
                    }

                    const origin = ws.data?.origin || `http://[::1]:${port}`;
                    const targetUrl = buildLocalTarget(url, origin);
                    if (!targetUrl) {
                        ws.send(JSON.stringify({ id, type: 'response', status: 403, statusText: 'Forbidden', headers: {} }));
                        ws.send(JSON.stringify({ id, type: 'chunk', data: '', finish: true }));
                        return;
                    }

                    const fetchUrl = resolveFetchUrl(targetUrl, origin);

                    const fetchHeaders = new Headers();
                    const baseHeaders = ws.data?.requestHeaders || {};
                    for (const [key, value] of Object.entries(baseHeaders)) {
                        if (value !== undefined && value !== null) fetchHeaders.set(key, String(value));
                    }
                    if (headers) {
                        for (const [key, value] of Object.entries(headers)) {
                            if (value !== undefined && value !== null) {
                                fetchHeaders.set(key, String(value));
                            }
                        }
                    }
                    fetchHeaders.set('referer', `${new URL(fetchUrl).origin}/playground`);

                    const fetchOptions: RequestInit = {
                        method,
                        headers: fetchHeaders,
                        redirect: 'manual',
                    };

                    if (body && method !== 'GET' && method !== 'HEAD') {
                        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
                    }

                    const response = await fetch(fetchUrl, fetchOptions);

                    const responseHeaders: Record<string, string> = {};
                    response.headers.forEach((value, key) => {
                        responseHeaders[key] = value;
                    });

                    ws.send(JSON.stringify({
                        id,
                        type: 'response',
                        status: response.status,
                        statusText: response.statusText,
                        headers: responseHeaders,
                    }));

                    const contentType = response.headers.get('content-type') || '';
                    const isLavalink = response.headers.get('x-player') === 'lavalink';
                    const isStream = contentType.includes('text/event-stream') ||
                                     (contentType.includes('application/json') && isLavalink);

                    if ((isLavalink || isStream) && response.body) {
                        const reader = response.body.getReader();
                        const decoder = new TextDecoder();

                        try {
                            while (true) {
                                const { done: finish, value } = await reader.read();
                                if (finish) break;

                                const text = decoder.decode(value, { stream: true });
                                ws.send(JSON.stringify({
                                    id,
                                    type: 'chunk',
                                    data: text,
                                    finish: false,
                                }));
                            }
                        } catch (e) {
                        }

                        ws.send(JSON.stringify({ id, type: 'chunk', data: '', finish: true }));
                    } else if (contentType.startsWith('image/') || contentType.startsWith('video/') || contentType === 'application/octet-stream') {
                        const buffer = await response.arrayBuffer();
                        const base64 = Buffer.from(buffer).toString('base64');
                        ws.send(JSON.stringify({
                            id,
                            type: 'chunk',
                            data: base64,
                            encoding: 'base64',
                            finish: true,
                        }));
                    } else {
                        const text = await response.text();
                        ws.send(JSON.stringify({
                            id,
                            type: 'chunk',
                            data: text,
                            finish: true,
                        }));
                    }
                }
            } catch (err: any) {
                try {
                    const msg = typeof message === 'string' ? JSON.parse(message) : JSON.parse(message.toString());
                    if (msg.id) {
                        ws.send(JSON.stringify({
                            id: msg.id,
                            type: 'error',
                            message: err?.message || 'Unknown error',
                        }));
                    }
                } catch {
                    // Ignore parse errors
                }
            }
        },
        close(ws: any) {
            const clientId = ws.data?.clientId;
            if (clientId) {
                const connections = wsConnections.get(clientId);
                if (connections) {
                    connections.delete(ws);
                    if (connections.size === 0) {
                        wsConnections.delete(clientId);
                    }
                }
            }
        },
    },
};
