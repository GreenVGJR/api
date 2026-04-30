document.title = "Playground | VGJR";

{{SSR_STATE}}
// Initialize layout and Tailwind config dynamically
const initSPA = () => {
    // Inject Fonts
    const fontsLink = document.createElement('link');
    fontsLink.rel = 'stylesheet';
    fontsLink.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(fontsLink);

    // Tailwind Config
    if (window.tailwind) {
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'system-ui', 'sans-serif'],
                        mono: ['JetBrains Mono', 'monospace']
                    },
                    colors: {
                        mint: { 400: '#4ade80', 500: '#22c55e', 600: '#16a34a' },
                        dark: { 900: '#0a0a0a', 800: '#141414', 700: '#1f1f1f', 600: '#2a2a2a', 500: '#3a3a3a' }
                    }
                }
            }
        };
    }

    // Build the UI structure
    document.body.className = "bg-black text-white font-sans antialiased";
    document.body.innerHTML = `
    <div class="h-screen flex flex-col max-w-5xl mx-auto px-4 py-6">
        <div class="relative mb-4 flex-shrink-0">
            <div class="flex items-center bg-black/60 rounded-xl border border-dark-500 overflow-hidden focus-within:border-white/20 transition-colors">
                <textarea id="urlInput" class="flex-1 bg-transparent py-3 px-4 font-mono text-sm text-white placeholder-gray-600 outline-none resize-none overflow-y-auto whitespace-pre-wrap break-all no-scrollbar" placeholder="https://api.vgjr.top/search/youtube/video?q=" spellcheck="false" autocomplete="off" rows="1"></textarea>
                <button id="copyBtn" class="copy-btn p-3 text-gray-500 hover:text-mint-400 transition-colors" title="Copy URL">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </button>
            </div>
        </div>

        <div class="flex gap-2 mb-4 flex-shrink-0 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
            <button class="tab-btn px-4 py-1.5 rounded-full text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="search">Search</button>
            <button class="tab-btn px-4 py-1.5 rounded-full text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="profile">Profile</button>
            <button class="tab-btn px-4 py-1.5 rounded-full text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="lyrics">Lyrics</button>
            <button class="tab-btn px-4 py-1.5 rounded-full text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="tools">Tools</button>
            <button class="tab-btn px-4 py-1.5 rounded-full text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="info">Info</button>
            <button class="tab-btn px-4 py-1.5 rounded-full text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="download">Download</button>
            <button class="tab-btn px-4 py-1.5 rounded-full text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="music">Music</button>
        </div>

        <div class="flex flex-col md:grid md:grid-cols-[240px_1fr] gap-2 md:gap-4 flex-1 min-h-0">
            <div class="overflow-y-auto pr-1 flex-[3] md:flex-none md:h-full min-h-0 border-b border-dark-700 md:border-b-0 pb-2 md:pb-0 no-scrollbar">
                <div id="endpointsList" class="space-y-1"></div>
            </div>

            <div class="flex flex-col min-h-0 min-w-0 overflow-hidden flex-[7]">
                <div class="bg-dark-700/30 panel-gradient rounded-xl border border-dark-500 flex-1 overflow-hidden flex flex-col min-h-0">
                    <div class="flex items-center justify-between px-4 py-2 border-b border-dark-500 flex-shrink-0">
                        <span class="text-xs text-gray-500 font-mono"><span class="font-semibold text-gray-400">Response</span> | Uptime: <span id="uptimeDisplay" class="text-gray-500">00:00:00</span></span>
                        <div class="flex items-center gap-3">
                            <button id="clearResponseBtn" class="text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1.5 text-xs font-semibold" title="Clear Response">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                </svg>
                                <span>Clear</span>
                            </button>
                            <button id="copyResponseBtn" class="text-gray-400 hover:text-mint-400 transition-colors flex items-center gap-1.5 text-xs font-semibold" title="Copy Response">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                <span>Copy</span>
                            </button>
                        </div>
                    </div>
                    <div id="responseArea" class="response-area font-mono text-sm text-gray-300 p-4 overflow-auto flex-1 empty-state w-0 min-w-full">
                        <span class="text-white-600">What you gonna try?</span>
                    </div>
                </div>

                <div id="paramsPanel" class="mt-2 flex-shrink-0 hidden">
                    <div class="bg-dark-700/30 panel-gradient rounded-xl border border-dark-500 overflow-hidden">
                        <button id="paramsToggle" class="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-400 hover:text-gray-200 transition-colors">
                            <span class="flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line>
                                </svg>
                                <span>Parameters</span>
                                <span id="paramsCount" class="text-[10px] bg-dark-500 px-1.5 py-0.5 rounded-full font-mono">0</span>
                            </span>
                            <svg id="paramsChevron" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-transform duration-200">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                        <div id="paramsBody" class="params-body no-scrollbar"><div id="paramsContainer" class="px-3 pb-3 space-y-2"></div></div>
                    </div>
                </div>

                <div class="mt-3 flex flex-col md:flex-row items-center gap-3 md:gap-4 flex-shrink-0">
                    <button id="sendBtn" class="w-full md:flex-1 bg-emerald-500 hover:bg-emerald-500 text-black font-semibold py-2.5 px-6 rounded-lg transition-colors flex items-center justify-center gap-2">
                        <span>Send</span><span>➜</span>
                    </button>
                    <div id="statusIndicator" class="flex items-center justify-center gap-2 text-sm font-mono w-full md:w-auto">
                        <span class="w-2 h-2 rounded-full bg-gray-500"></span><span id="statusText" class="text-gray-500">Ready</span>
                    </div>
                </div>
            </div>
        </div>

        <footer class="mt-4 flex flex-col items-center md:flex-row md:items-center md:justify-between text-gray-600 text-xs flex-shrink-0 gap-2 md:gap-0 pb-2">
            <div class="flex flex-col items-center md:items-start space-y-1">
                <p>Built with <span class="text-mint-400">♥</span></p>
                <p class="flex items-center gap-1.5">
                    <span>AI-Generated by</span>
                    <a href="https://claude.ai" target="_blank" class="inline-flex items-center gap-1 text-[#D97757] hover:underline"><span>Claude</span></a>
                    <span>and</span>
                    <a href="https://gemini.google.com" target="_blank" class="inline-flex items-center gap-1 hover:underline"><span class="bg-gradient-to-r from-[#1BA1E3] via-[#9B72CB] to-[#F49C46] bg-clip-text text-transparent">Gemini</span></a>
                </p>
            </div>
            <div class="flex items-center gap-3 text-gray-500">
                <a href="https://github.com/GreenVGJR/api" target="_blank" class="hover:text-mint-400 transition-colors">Source Code</a><span class="text-dark-500">|</span><a href="https://status.vgjr.top" target="_blank" class="hover:text-mint-400 transition-colors">Status Page</a>
            </div>
        </footer>
    </div>`;
};

// Start SPA immediately
initSPA();

let endpoints = {
    search: [],
    profile: [],
    lyrics: [],
    tools: [],
    info: [],
    download: [],
    music: []
};

let currentCategory = 'search';
let currentEndpoint = { path: '/loading...', query: '' };
let isLoading = false;
let lastRawResponse = '';
let isCoolingDown = false;

const apiBaseUrl = window.API_BASE_URL || 'https://api.vgjr.top';

if (window.SERVER_ENDPOINTS) {
    try {
        endpoints = JSON.parse(atob(window.SERVER_ENDPOINTS));
    } catch (e) { }
}

const urlInput = document.getElementById('urlInput');
const copyBtn = document.getElementById('copyBtn');
const copyResponseBtn = document.getElementById('copyResponseBtn');
const clearResponseBtn = document.getElementById('clearResponseBtn');
const sendBtn = document.getElementById('sendBtn');
const responseArea = document.getElementById('responseArea');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const endpointsList = document.getElementById('endpointsList');
const tabBtns = document.querySelectorAll('.tab-btn');
const paramsPanel = document.getElementById('paramsPanel');
const paramsToggle = document.getElementById('paramsToggle');
const paramsBody = document.getElementById('paramsBody');
const paramsContainer = document.getElementById('paramsContainer');
const paramsCount = document.getElementById('paramsCount');
const paramsChevron = document.getElementById('paramsChevron');

let paramsOpen = window.innerWidth >= 768;
let currentParams = [];

urlInput.value = apiBaseUrl + (apiBaseUrl.endsWith('/') ? '' : '/');

function adjustHeight() {
    urlInput.style.height = 'auto';
    const newHeight = Math.min(urlInput.scrollHeight, 100);
    urlInput.style.height = newHeight + 'px';
    urlInput.style.overflowY = urlInput.scrollHeight > 100 ? 'auto' : 'hidden';
}

adjustHeight();
urlInput.addEventListener('input', adjustHeight);
window.addEventListener('resize', adjustHeight);

function updateStatusUI(ok, status, duration) {
    const statusDot = statusIndicator.querySelector('span:first-child');
    if (ok) {
        statusDot.className = 'w-2 h-2 rounded-full bg-mint-400';
        statusText.textContent = `${status} • ${duration}ms`;
        statusText.className = 'text-mint-400';
    } else {
        statusDot.className = 'w-2 h-2 rounded-full bg-red-500';
        statusText.textContent = `${status} • ${duration}ms`;
        statusText.className = 'text-red-400';
    }
}

function flattenRoutes(obj, parentPath = '') {
    let flatResults = [];
    if (Array.isArray(obj)) {
        return obj.map(item => {
            if (typeof item === 'string') {
                const parts = item.split('?');
                return {
                    path: parts[0],
                    query: parts.length > 1 ? '?' + parts[1] : ''
                };
            } else if (typeof item === 'object') {
                return flattenRoutes(item);
            }
            return null;
        }).flat().filter(Boolean);
    } else if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
            const childResults = flattenRoutes(obj[key]);
            flatResults = flatResults.concat(childResults);
        }
    }
    return flatResults;
}



let solvedChallengeCode = null;
let knownDeviceID = null;

async function performRequest(targetUrl, retryCount = 0) {
    if (retryCount === 0 && (isLoading || isCoolingDown)) return null;

    if (retryCount === 0) {
        isLoading = true;
        sendBtn.innerHTML = '<span>Loading...</span>';
        sendBtn.classList.add('opacity-70');
        responseArea.classList.add('empty-state');
        responseArea.innerHTML = '<span class="text-gray-500 loading flex h-full items-center justify-center">Fetching...</span>';

        statusIndicator.querySelector('span:first-child').className = 'w-2 h-2 rounded-full bg-yellow-400 animate-pulse';
        statusText.textContent = 'Fetching';
        statusText.className = 'text-yellow-400';
    }

    let resultData = null;

    try {
        const startTime = performance.now();
        const parseUrl = new URL(targetUrl);
        const headers = {
            'Accept': 'application/json'
        };
        if (solvedChallengeCode && parseUrl.pathname.startsWith('/music/')) {
            headers[`x-challenge-codes-${knownDeviceID}`] = await xorEncrypt(encodeURIComponent(solvedChallengeCode), knownDeviceID);
        }

        const response = await fetch(targetUrl, { headers });

        responseArea.classList.add('empty-state');
        responseArea.innerHTML = '<span class="text-gray-500 loading flex h-full items-center justify-center">Waiting response...</span>';
        statusText.textContent = 'Fetching';

        const contentType = response.headers.get('content-type') || '';
        let duration;

        if (contentType.startsWith('image/')) {
            const blob = await response.blob();
            duration = Math.round(performance.now() - startTime);
            updateStatusUI(response.ok, response.status, duration);
            const imageUrl = URL.createObjectURL(blob);

            lastRawResponse = '';

            responseArea.classList.add('empty-state');
            responseArea.innerHTML = `
                <div class="w-full h-full flex items-center justify-center p-4">
                    <img src="${imageUrl}" alt="API Response" class="max-w-full max-h-full rounded-lg shadow-lg" style="object-fit: contain;" />
                </div>
            `;
        } else if ((contentType.startsWith('video/') || contentType === 'application/octet-stream') && response.headers.get('x-player') !== 'lavalink') {
            const blob = await response.blob();
            duration = Math.round(performance.now() - startTime);
            updateStatusUI(response.ok, response.status, duration);
            const videoUrl = URL.createObjectURL(blob);

            lastRawResponse = '';

            responseArea.classList.add('empty-state');
            responseArea.innerHTML = `
                <div class="w-full h-full flex items-center justify-center p-4">
                    <video src="${videoUrl}" controls class="max-w-full max-h-full rounded-lg shadow-lg" style="object-fit: contain;"></video>
                </div>
            `;
        } else {
            responseArea.classList.remove('empty-state');

            let text = await response.text();
            duration = Math.round(performance.now() - startTime);

            let decryptedText = text;
            const encKey = response.headers.get('enc-data')?.slice(0, 10);
            if (encKey) {
                // Remove potential quotes and trim
                let cleanText = text.trim();
                if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
                    cleanText = cleanText.substring(1, cleanText.length - 1);
                }
                try {
                    decryptedText = await xorDecrypt(cleanText, encKey);
                    knownDeviceID = JSON.parse(atob(response.headers.get('enc-data')?.slice(10))).join('-');
                } catch { }
            }

            const isLavalink = response.headers.get('x-player') === 'lavalink';
            if (response.status === 302 && isLavalink && retryCount < 4) {
                try {
                    const data = JSON.parse(decryptedText);
                    if (data && data.c && data._submit) {
                        responseArea.innerHTML = '<span class="text-mint-400 loading flex h-full items-center justify-center">Solving challenge...</span>';
                        const solved = await solveChallenge(data.c, knownDeviceID);
                        if (solved) {
                            solvedChallengeCode = solved;
                            return await performRequest(targetUrl, retryCount + 1);
                        }
                    }
                } catch (e) { }
            } else if (response.status === 302 && isLavalink) {
                solvedChallengeCode = null;
            }

            updateStatusUI(response.ok, response.status, duration);
            let formatted = text;
            let isJson = false;

            try {
                const data = JSON.parse(decryptedText);
                if (decryptedText === text) {
                    formatted = JSON.stringify(data, null, 2);
                    isJson = true;
                }
                resultData = data;
            } catch {
            }

            lastRawResponse = decryptedText;

            responseArea.innerHTML = '<pre style=\"white-space: pre-wrap; word-break: break-all; overflow-wrap: anywhere;\"></pre>';
            const preElement = responseArea.querySelector('pre');

            if (!isJson) {
                preElement.textContent = formatted;
            } else {
                const lines = formatted.split('\n');
                const CHUNK_SIZE = 1;
                let chunkIndex = 0;

                const processChunk = () => {
                    if (chunkIndex >= lines.length) return;

                    const deadline = performance.now() + 10;
                    const fragments = [];

                    while (chunkIndex < lines.length && performance.now() < deadline) {
                        const end = Math.min(chunkIndex + CHUNK_SIZE, lines.length);
                        const chunkLines = lines.slice(chunkIndex, end);
                        const chunkString = chunkLines.join('\n');
                        const highlighted = syntaxHighlight(chunkString);
                        fragments.push(highlighted + (end < lines.length ? '\n' : ''));
                        chunkIndex = end;
                    }

                    if (fragments.length > 0) {
                        preElement.insertAdjacentHTML('beforeend', fragments.join(''));
                    }

                    if (chunkIndex < lines.length) {
                        requestAnimationFrame(processChunk);
                    }
                };

                processChunk();
            }
        }
    } catch (err) {
        responseArea.classList.remove('empty-state');
        responseArea.innerHTML = `<span class="text-red-400">Error: ${err.message}</span>`;
        statusIndicator.querySelector('span:first-child').className = 'w-2 h-2 rounded-full bg-red-500';
        statusText.textContent = 'Failed';
        statusText.className = 'text-red-400';
    } finally {
        if (retryCount === 0) {
            isLoading = false;
            sendBtn.innerHTML = 'Send';

            isCoolingDown = true;
            sendBtn.classList.add('opacity-50', 'cursor-not-allowed');
            let timeLeft = 0.3;

            const cooldownInterval = setInterval(() => {
                timeLeft -= 0.1;
                if (timeLeft <= 0) {
                    clearInterval(cooldownInterval);
                    isCoolingDown = false;
                    sendBtn.innerHTML = '<span>Send</span><span>➜</span>';
                    sendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    sendBtn.classList.remove('opacity-70');
                }
            }, 100);
        }
    }

    return resultData;
}



function parseQueryParams(queryString) {
    if (!queryString || !queryString.startsWith('?')) return [];
    const raw = queryString.substring(1);
    const params = [];
    const parts = raw.split('&');
    for (const part of parts) {
        const eqIdx = part.indexOf('=');
        if (eqIdx === -1) {
            params.push({ key: part, value: '' });
        } else {
            params.push({
                key: part.substring(0, eqIdx),
                value: decodeURIComponent(part.substring(eqIdx + 1))
            });
        }
    }
    return params;
}

function buildQueryString(params) {
    if (params.length === 0) return '';
    return '?' + params.map(p => {
        // Ensure values are fully encoded (slashes, colons, etc)
        const encodedValue = encodeURIComponent(decodeURIComponent(p.value));
        return `${encodeURIComponent(p.key)}=${encodedValue}`;
    }).join('&');
}

function renderParams() {
    paramsPanel.classList.remove('hidden');

    if (!currentEndpoint || !currentEndpoint.query) {
        currentParams = [];
    } else {
        currentParams = parseQueryParams(currentEndpoint.query);
    }

    paramsCount.textContent = currentParams.length;

    if (currentParams.length > 0) {

        try {
            const currentUrl = urlInput.value;
            const qIdx = currentUrl.indexOf('?');
            if (qIdx !== -1) {
                const currentUrlParams = parseQueryParams(currentUrl.substring(qIdx));
                for (const cp of currentParams) {
                    const match = currentUrlParams.find(up => up.key === cp.key);
                    if (match && match.value) {
                        cp.value = match.value;
                    }
                }
            }
        } catch (e) { }

        paramsContainer.innerHTML = currentParams.map((p, i) => `
            <div class="param-row">
                <label class="param-label" title="${p.key}">${p.key}</label>
                <div class="param-input-wrap">
                    <input 
                        type="text" 
                        class="param-input" 
                        data-param-index="${i}"
                        value="${p.value.replace(/"/g, '&quot;')}"
                        spellcheck="false"
                        autocomplete="off"
                    />
                </div>
            </div>
        `).join('');


        paramsContainer.querySelectorAll('.param-input').forEach(input => {
            input.addEventListener('input', () => {
                const idx = parseInt(input.dataset.paramIndex);
                currentParams[idx].value = input.value;
                syncParamsToUrl();
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    sendBtn.click();
                }
            });
        });
    } else {
        paramsContainer.innerHTML = '<div class="text-xs text-gray-500 text-center py-2">No parameters needed.</div>';
    }


    setTimeout(() => {

        if (currentParams.length > 0) {
            if (window.innerWidth >= 768) {
                paramsChevron.classList.add('rotated');
                paramsOpen = true;
                paramsBody.style.height = Math.min(paramsContainer.offsetHeight, 250) + "px";
            } else {
                paramsChevron.classList.remove('rotated');
                paramsOpen = false;
                paramsBody.style.height = null;
            }
        } else {
            paramsChevron.classList.remove('rotated');
            paramsOpen = false;
            paramsBody.style.height = null;
        }
    }, 0);
}

function syncParamsToUrl() {
    const queryString = buildQueryString(currentParams);
    const cleanBase = apiBaseUrl.replace(/\/$/, '');
    const path = currentEndpoint ? currentEndpoint.path : '/';
    const cleanPath = path.startsWith('/') ? path : '/' + path;

    urlInput.value = cleanBase + cleanPath + queryString;
    adjustHeight();
}

function syncUrlToParams() {
    if (currentParams.length === 0) return;
    try {
        const currentUrl = urlInput.value;
        const qIdx = currentUrl.indexOf('?');
        if (qIdx === -1) return;
        const currentUrlParams = parseQueryParams(currentUrl.substring(qIdx));
        let changed = false;
        for (const cp of currentParams) {
            const match = currentUrlParams.find(up => up.key === cp.key);
            if (match && match.value !== cp.value) {
                cp.value = match.value;
                changed = true;
            }
        }
        if (changed) {

            paramsContainer.querySelectorAll('.param-input').forEach(input => {
                const idx = parseInt(input.dataset.paramIndex);
                if (currentParams[idx] && input.value !== currentParams[idx].value) {
                    input.value = currentParams[idx].value;
                }
            });
        }
    } catch (e) { }
}

paramsToggle.addEventListener('click', () => {
    paramsOpen = !paramsOpen;
    paramsChevron.classList.toggle('rotated', paramsOpen);

    if (paramsOpen) {
        paramsBody.style.height = Math.min(paramsContainer.offsetHeight, 250) + "px";
    } else {
        paramsBody.style.height = null;
    }
});



async function fetchInitialEndpoints() {

    if (endpoints[currentCategory] && endpoints[currentCategory].length > 0) {
        currentEndpoint = endpoints[currentCategory][0];

        const cleanBase = apiBaseUrl.replace(/\/$/, '');
        const cleanPath = currentEndpoint.path.startsWith('/') ? currentEndpoint.path : '/' + currentEndpoint.path;

        urlInput.value = cleanBase + cleanPath + (currentEndpoint.query || '');
        adjustHeight();

        renderEndpoints();
        renderParams();

        // Deep sync to ensure the bar and panel match
        syncUrlToParams();
        syncParamsToUrl();
    } else {
        renderEndpoints();
        renderParams();
    }

    const firstTab = document.querySelector(`.tab-btn[data-category="${currentCategory}"]`);
    if (firstTab) firstTab.classList.add('active');
}

let animationTimeout = null;

function renderEndpoints(animate = false) {
    const categoryEndpoints = endpoints[currentCategory] || [];

    // Capture old state if animating
    let oldHTML = '';
    if (animate) {
        // If already animating, take the content from the 'new' layer that was coming in
        const currentNewLayer = endpointsList.querySelector('.swipe-layer.new');
        if (currentNewLayer) {
            oldHTML = currentNewLayer.innerHTML;
        } else {
            oldHTML = endpointsList.innerHTML;
        }
    }

    if (categoryEndpoints.length === 0) {
        if (animationTimeout) clearTimeout(animationTimeout);
        endpointsList.classList.remove('is-animating');
        endpointsList.innerHTML = `
            <div class="text-gray-600 text-xs p-4 text-center">
                ${Object.keys(endpoints).length === 0 ? 'Loading...' : 'No endpoints found.'}
            </div>
         `;
        return;
    }

    const newHTML = categoryEndpoints.map((ep, index) => `
        <button 
            class="endpoint-item block w-full text-left py-1 px-3 rounded-lg font-mono text-xs text-white-400 hover:bg-dark-700 ${currentEndpoint && currentEndpoint.path === ep.path ? 'active bg-dark-700 text-mint-400 border-l-2 border-mint-400' : ''} break-all transition-colors"
            data-index="${index}"
        >
            ${ep.path}
        </button>
    `).join('');

    if (animationTimeout) clearTimeout(animationTimeout);

    if (animate && oldHTML && !oldHTML.includes('Loading...')) {
        endpointsList.classList.add('is-animating');
        endpointsList.innerHTML = `
            <div class="swipe-layer old space-y-1">${oldHTML}</div>
            <div class="swipe-layer new space-y-1">${newHTML}</div>
        `;

        animationTimeout = setTimeout(() => {
            const newLayer = endpointsList.querySelector('.swipe-layer.new');
            if (newLayer) {
                endpointsList.innerHTML = newLayer.innerHTML;
                endpointsList.classList.remove('is-animating');
                attachEndpointListeners();
            }
            animationTimeout = null;
        }, 350);
    } else {
        endpointsList.classList.remove('is-animating');
        endpointsList.innerHTML = `<div class="space-y-1">${newHTML}</div>`;
        attachEndpointListeners();
    }
}

function attachEndpointListeners() {
    endpointsList.querySelectorAll('.endpoint-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            currentEndpoint = endpoints[currentCategory][index];
            urlInput.value = apiBaseUrl + currentEndpoint.path + currentEndpoint.query;
            adjustHeight();
            renderEndpoints();
            renderParams();

            tabBtns.forEach(b => b.classList.remove('active'));
            const activeTab = document.querySelector(`.tab-btn[data-category="${currentCategory}"]`);
            if (activeTab) activeTab.classList.add('active');
        });
    });
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Prevent re-rendering and animating if clicking the already active tab
        if (currentCategory === btn.dataset.category) return;

        const wasOpen = paramsOpen;

        if (wasOpen) {
            paramsBody.style.height = null;
            paramsChevron.classList.remove('rotated');
        }

        setTimeout(() => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.dataset.category;
            const categoryList = endpoints[currentCategory] || [];
            if (categoryList.length > 0) {
                currentEndpoint = categoryList[0];
                urlInput.value = apiBaseUrl + currentEndpoint.path + currentEndpoint.query;
                adjustHeight();
            } else {
                currentEndpoint = null;
            }
            renderEndpoints(true);
            renderParams();
        }, wasOpen ? 50 : 0);
    });
});

urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !isLoading) {
        e.preventDefault();
        urlInput.blur();
        sendBtn.click();
    }

    if ((e.key === 'Backspace' || e.key === 'Delete') &&
        urlInput.selectionStart <= apiBaseUrl.length &&
        urlInput.selectionEnd === urlInput.selectionStart) {
        e.preventDefault();
    }
});

urlInput.addEventListener('input', () => {
    let val = urlInput.value;

    if (!val.startsWith(apiBaseUrl)) {
        const baseIdx = val.indexOf(apiBaseUrl);
        if (baseIdx > 0) {
            val = val.substring(baseIdx);
        } else {
            let pathIndex = val.indexOf('/');
            if (val.match(/^https?:\/\//)) {
                pathIndex = val.indexOf('/', 8);
            }

            let path = '';
            if (pathIndex !== -1) {
                path = val.substring(pathIndex);
            }
            val = apiBaseUrl + path;
        }
    }

    const queryIdx = val.indexOf('?');
    let pathPart = queryIdx === -1 ? val.substring(apiBaseUrl.length) : val.substring(apiBaseUrl.length, queryIdx);
    let queryPart = queryIdx === -1 ? '' : val.substring(queryIdx);

    // Keep the live input readable while typing to prevent cursor jumps
    // We only do basic normalization here.
    const hostOnly = apiBaseUrl.replace(/^https?:\/\//, '');

    let dirty = true;
    let safety = 0;
    while (dirty && safety < 10) {
        dirty = false;
        safety++;

        if (pathPart.startsWith('/' + hostOnly)) {
            pathPart = pathPart.substring(1 + hostOnly.length);
            dirty = true;
        } else if (pathPart.startsWith('//' + hostOnly)) {
            pathPart = pathPart.substring(2 + hostOnly.length);
            dirty = true;
        } else if (pathPart.startsWith('/' + apiBaseUrl)) {
            pathPart = pathPart.substring(1 + apiBaseUrl.length);
            dirty = true;
        } else if (pathPart.startsWith(apiBaseUrl)) {
            pathPart = pathPart.substring(apiBaseUrl.length);
            dirty = true;
        } else if (pathPart.startsWith('//')) {
            pathPart = pathPart.substring(1);
            dirty = true;
        }
    }

    if (pathPart && !pathPart.startsWith('/')) {
        pathPart = '/' + pathPart;
    }

    const newVal = apiBaseUrl + pathPart + queryPart;

    if (urlInput.value !== newVal) {
        const cursorPos = urlInput.selectionStart;
        urlInput.value = newVal;

        if (cursorPos > newVal.length) {
            urlInput.setSelectionRange(newVal.length, newVal.length);
        } else if (cursorPos < apiBaseUrl.length) {
            urlInput.setSelectionRange(apiBaseUrl.length, apiBaseUrl.length);
        } else {
            urlInput.setSelectionRange(cursorPos, cursorPos);
        }
    }


    syncUrlToParams();
    updateParamHighlight();
});

function updateParamHighlight() {
    const val = urlInput.value;
    const pos = urlInput.selectionStart;
    const qIdx = val.indexOf('?');

    // Clear all highlights first
    document.querySelectorAll('.param-input').forEach(el => el.classList.remove('highlight-active'));

    if (qIdx === -1 || pos <= qIdx) return;

    const query = val.substring(qIdx + 1);
    const posInQuery = pos - (qIdx + 1);
    const parts = query.split('&');

    let currentLen = 0;
    for (let i = 0; i < parts.length; i++) {
        const partLen = parts[i].length;
        // Check if cursor is within this parameter's range
        if (posInQuery >= currentLen && posInQuery <= currentLen + partLen) {
            const input = document.querySelector(`.param-input[data-param-index="${i}"]`);
            if (input) {
                input.classList.add('highlight-active');
                // Ensure the panel is visible if it was closed
                if (!paramsOpen && window.innerWidth >= 768) {
                    paramsToggle.click();
                }
            }
            break;
        }
        currentLen += partLen + 1; // +1 for '&'
    }
}

urlInput.addEventListener('click', updateParamHighlight);
urlInput.addEventListener('keyup', updateParamHighlight);
urlInput.addEventListener('focus', updateParamHighlight);

urlInput.addEventListener('blur', () => {
    // Clear highlights when focus is lost
    document.querySelectorAll('.param-input').forEach(el => el.classList.remove('highlight-active'));

    const val = urlInput.value;
    const queryIdx = val.indexOf('?');
    if (queryIdx === -1) return;

    const base = val.substring(0, queryIdx + 1);
    const query = val.substring(queryIdx + 1);
    const parts = query.split('&');

    const washedQuery = parts.map(part => {
        const eqIdx = part.indexOf('=');
        if (eqIdx === -1) return part;
        const key = part.substring(0, eqIdx);
        const rawVal = part.substring(eqIdx + 1);
        return key + '=' + encodeURIComponent(decodeURIComponent(rawVal));
    }).join('&');

    urlInput.value = base + washedQuery;
    adjustHeight();
});

async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        document.execCommand('copy');
        return true;
    } finally {
        document.body.removeChild(textArea);
    }
}

copyBtn.addEventListener('click', async () => {
    const fullUrl = urlInput.value;
    try {
        await copyToClipboard(fullUrl);
        copyBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20,6 9,17 4,12"></polyline>
            </svg>
        `;
        setTimeout(() => {
            copyBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2-2v1"></path>
                </svg>
            `;
        }, 1500);
    } catch (err) {
    }
});

copyResponseBtn.addEventListener('click', async () => {
    if (!lastRawResponse) return;

    try {
        await copyToClipboard(lastRawResponse);
        const originalText = copyResponseBtn.querySelector('span').textContent;
        copyResponseBtn.querySelector('span').textContent = 'Copied!';
        copyResponseBtn.classList.add('text-mint-400');

        setTimeout(() => {
            copyResponseBtn.querySelector('span').textContent = originalText;
            copyResponseBtn.classList.remove('text-mint-400');
        }, 1500);
    } catch (err) {
    }
});

clearResponseBtn.addEventListener('click', () => {
    lastRawResponse = '';
    responseArea.classList.add('empty-state');
    responseArea.innerHTML = '<span class="text-white-600">What you gonna try?</span>';
    statusIndicator.querySelector('span:first-child').className = 'w-2 h-2 rounded-full bg-gray-500';
    statusText.textContent = 'Ready';
    statusText.className = 'text-gray-500';
});

sendBtn.addEventListener('click', () => performRequest(urlInput.value));

function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'text-orange-300';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'text-cyan-400';
                match = match.slice(0, -1) + '<span class="text-gray-500">:</span>';
            } else {
                cls = 'text-emerald-400';
            }
        } else if (/true|false/.test(match)) {
            cls = 'text-purple-400';
        } else if (/null/.test(match)) {
            cls = 'text-gray-500';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        sendBtn.click();
    }
});


function updateUptime() {
    const uptimeDisplay = document.getElementById('uptimeDisplay');
    if (!uptimeDisplay || !window.SERVER_STARTTIME) return;

    const diff = Math.floor((Date.now() - window.SERVER_STARTTIME) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;

    uptimeDisplay.textContent = [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}

setInterval(updateUptime, 1000);
updateUptime();

fetchInitialEndpoints().then(() => {
    // Final height adjustment after everything is loaded and rendered
    setTimeout(adjustHeight, 0);

    // Also re-adjust when fonts are ready (prevents height jump from system font -> custom font)
    if (document.fonts) {
        document.fonts.ready.then(() => {
            adjustHeight();
        });
    }
});