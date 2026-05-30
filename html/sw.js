const CACHE_NAME = __PLAYGROUND_CACHE_NAME__;
const LOCAL_ASSETS = [
    '/playground',
    '/terms',
    '/privacy',
    '/playground/main.js',
    '/playground/main.css',
    '/playground/cf.js',
    '/favicon.ico'
];
const EXTERNAL_ASSETS = [
    'https://cdn.jsdelivr.net/npm/@tailwindcss/browser',
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap'
];

async function cacheAsset(asset) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetch(asset, asset.startsWith('http') ? { mode: 'no-cors' } : undefined);
        if (response.ok || response.type === 'opaque') {
            await cache.put(asset, response.clone());
        }
    } catch { }
}

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        await Promise.allSettled([...LOCAL_ASSETS, ...EXTERNAL_ASSETS].map(cacheAsset));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys
            .filter(key => key.startsWith('vgjr-playground-') && key !== CACHE_NAME)
            .map(key => caches.delete(key))
        );
        await self.clients.claim();
    })());
});

function isLocalAppShell(url, request) {
    if (url.origin !== location.origin) return false;
    if (request.mode === 'navigate') return ['/', '/playground', '/terms', '/privacy'].includes(url.pathname);
    return LOCAL_ASSETS.includes(url.pathname);
}

function isExternalAppAsset(url) {
    return EXTERNAL_ASSETS.some(asset => url.href.startsWith(asset));
}

async function networkFirst(request, fallbackPath = '/playground') {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
    } catch {
        return await cache.match(request) || await cache.match(fallbackPath) || new Response('Offline', { status: 503 });
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const fresh = fetch(request).then(response => {
        if (response.ok || response.type === 'opaque') cache.put(request, response.clone()).catch(() => { });
        return response;
    }).catch(() => cached || Response.error());

    return cached || fresh;
}

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (isLocalAppShell(url, event.request)) {
        event.respondWith(networkFirst(event.request));
        return;
    }

    if (isExternalAppAsset(url)) {
        event.respondWith(staleWhileRevalidate(event.request));
    }
});
