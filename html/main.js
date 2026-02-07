let endpoints = {
    search: [],
    lyrics: [],
    tools: [],
    info: []
};

let currentCategory = 'search';
let currentEndpoint = { path: '/loading...', query: '' };
let isLoading = false;
let lastRawResponse = '';
let isCoolingDown = false;

const apiBaseUrl = window.API_BASE_URL || 'https://api.vgjr.top';

const urlInput = document.getElementById('urlInput');
const copyBtn = document.getElementById('copyBtn');
const copyResponseBtn = document.getElementById('copyResponseBtn');
const sendBtn = document.getElementById('sendBtn');
const responseArea = document.getElementById('responseArea');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const endpointsList = document.getElementById('endpointsList');
const tabBtns = document.querySelectorAll('.tab-btn');

urlInput.value = apiBaseUrl + (apiBaseUrl.endsWith('/') ? '' : '/');

function adjustHeight() {
    urlInput.style.height = 'auto';
    urlInput.style.height = urlInput.scrollHeight + 'px';
}

adjustHeight();
urlInput.addEventListener('input', adjustHeight);
window.addEventListener('resize', adjustHeight);

function flattenRoutes(obj, parentPath = '') {
    let flatResults = [];
    if (Array.isArray(obj)) {
        return obj.map(item => {
            if (typeof item === 'string') {
                const parts = item.split('?');
                return {
                    path: parts[0],
                    query: parts.length > 1 ? '?' + parts[1] : '',
                    description: 'API Endpoint'
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

async function performRequest(targetUrl) {
    if (isLoading || isCoolingDown) return null;
    
    isLoading = true;
    sendBtn.innerHTML = '<span>Loading...</span>';
    sendBtn.classList.add('opacity-70');
    responseArea.classList.add('empty-state');
    responseArea.innerHTML = '<span class="text-gray-500 loading">Fetching...</span>';
    
    statusIndicator.querySelector('span:first-child').className = 'w-2 h-2 rounded-full bg-yellow-400 animate-pulse';
    statusText.textContent = 'Fetching';
    statusText.className = 'text-yellow-400';

    let resultData = null;

    try {
        const startTime = performance.now();
        const response = await fetch(targetUrl, {
            headers: { 'Accept': 'application/json' }
        });
        
        responseArea.classList.add('empty-state');
        responseArea.innerHTML = '<span class="text-gray-500 loading">Waiting response...</span>';
        statusText.textContent = 'Fetching';
        
        const contentType = response.headers.get('content-type') || '';
        let duration;
        
        if (contentType.startsWith('image/')) {
            const blob = await response.blob();
            duration = Math.round(performance.now() - startTime);
            const imageUrl = URL.createObjectURL(blob);
            
            lastRawResponse = '';
            
            responseArea.classList.add('empty-state');
            responseArea.innerHTML = `
                <div class="w-full h-full flex items-center justify-center p-4">
                    <img src="${imageUrl}" alt="API Response" class="max-w-full max-h-full rounded-lg shadow-lg" style="object-fit: contain;" />
                </div>
            `;
        } else {
            responseArea.classList.remove('empty-state');
            
            const text = await response.text();
            duration = Math.round(performance.now() - startTime);
            let formatted = text;
            let isJson = false;
            
            try {
                const data = JSON.parse(text);
                formatted = JSON.stringify(data, null, 2);
                isJson = true;
                resultData = data;
            } catch {
            }
            
            lastRawResponse = text;

            responseArea.innerHTML = '<pre style=\"white-space: pre-wrap; word-break: break-all; overflow-wrap: anywhere;\"></pre>';
            const preElement = responseArea.querySelector('pre');

            if (!isJson) {
                 preElement.textContent = formatted;
            } else {
                const lines = formatted.split('\n');
                const CHUNK_SIZE = 5000;
                let chunkIndex = 0;
                
                const processChunk = () => {
                    if (chunkIndex >= lines.length) return;
                    
                    const end = Math.min(chunkIndex + CHUNK_SIZE, lines.length);
                    const chunkLines = lines.slice(chunkIndex, end);
                    const chunkString = chunkLines.join('\n');
                    
                    const highlighted = syntaxHighlight(chunkString);
                    
                    preElement.insertAdjacentHTML('beforeend', highlighted + (end < lines.length ? '\n' : ''));
                    
                    chunkIndex = end;
                    
                    if (chunkIndex < lines.length) {
                        requestAnimationFrame(processChunk);
                    }
                };
                
                processChunk();
            }
        }
        
        const statusDot = statusIndicator.querySelector('span:first-child');
        
        if (response.ok) {
            statusDot.className = 'w-2 h-2 rounded-full bg-mint-400';
            statusText.textContent = `${response.status} • ${duration}ms`;
            statusText.className = 'text-mint-400';
        } else {
            statusDot.className = 'w-2 h-2 rounded-full bg-red-500';
            statusText.textContent = `${response.status} • ${duration}ms`;
            statusText.className = 'text-red-400';
        }
    } catch (err) {
        responseArea.classList.remove('empty-state');
        responseArea.innerHTML = `<span class="text-red-400">Error: ${err.message}</span>`;
        statusIndicator.querySelector('span:first-child').className = 'w-2 h-2 rounded-full bg-red-500';
        statusText.textContent = 'Failed';
        statusText.className = 'text-red-400';
    } finally {
        isLoading = false;
        sendBtn.innerHTML = 'Send';
        
        isCoolingDown = true;
        sendBtn.classList.add('opacity-50', 'cursor-not-allowed');
        let timeLeft = 0.5;
        
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
    
    return resultData;
}

async function fetchInitialEndpoints() {
    try {
        const data = await performRequest(urlInput.value);
        
        const routesObj = data?.find(item => item.routes)?.routes;
        
        if (routesObj) {
            ['search', 'lyrics', 'tools', 'info'].forEach(cat => {
                if (routesObj[cat]) {
                    endpoints[cat] = flattenRoutes(routesObj[cat]);
                }
            });
            renderEndpoints();
        }
    } catch (err) {
        console.error("Failed to fetch dynamic endpoints:", err);
    }
}

function renderEndpoints() {
    const categoryEndpoints = endpoints[currentCategory] || [];
    
    if (categoryEndpoints.length === 0) {
         endpointsList.innerHTML = `
            <div class="text-gray-600 text-xs p-4 text-center">
                ${Object.keys(endpoints).length === 0 ? 'Loading...' : 'No endpoints found.'}
            </div>
         `;
         return;
    }

    endpointsList.innerHTML = categoryEndpoints.map((ep, index) => `
        <button 
            class="endpoint-item block w-full text-left py-1 px-3 rounded-lg font-mono text-xs text-gray-400 hover:bg-dark-700 ${currentEndpoint && currentEndpoint.path === ep.path ? 'active bg-dark-700 text-mint-400 border-l-2 border-mint-400' : ''} truncate transition-colors"
            data-index="${index}"
            title="${ep.description}"
        >
            ${ep.path}
        </button>
    `).join('');

    endpointsList.querySelectorAll('.endpoint-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            currentEndpoint = endpoints[currentCategory][index];
            urlInput.value = apiBaseUrl + currentEndpoint.path + currentEndpoint.query;
            adjustHeight();
            renderEndpoints();
            
            // Activate the corresponding tab button
            tabBtns.forEach(b => b.classList.remove('active'));
            const activeTab = document.querySelector(`.tab-btn[data-category="${currentCategory}"]`);
            if (activeTab) activeTab.classList.add('active');
        });
    });
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
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
        renderEndpoints();
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
    const queryPart = queryIdx === -1 ? '' : val.substring(queryIdx);
    
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
        console.error('Failed to copy:', err);
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
        console.error('Failed to copy response:', err);
    }
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

fetchInitialEndpoints();
