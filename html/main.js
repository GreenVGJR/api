{{SSR_STATE}}
if (window.location.pathname === "/") {
  window.location.replace("/playground");
}

const DEFAULT_PHRASES = ["Wanna test something?", "Sweet", "Howdy.", "..."];
function getDefaultResponseHTML() {
  const randomPhrase = DEFAULT_PHRASES[Math.floor(Math.random() * DEFAULT_PHRASES.length)];
  return `<div class="flex flex-col items-center justify-center">
    <div class="text-white-500 text-xs">${randomPhrase}</div>
    <div class="text-dark-500 text-xs mt-3">Made with <a href="https://antigravity.google" target="_blank" class="hover:underline"><span class="bg-gradient-to-r from-[#9EF3A7] via-[#1BA1E3] to-[#1B6EE3] bg-clip-text text-transparent">Antigravity</span></a> and <a href="https://opencode.ai" target="_blank" class="hover:underline"><span class="bg-gradient-to-r from-white via-gray-300 to-gray-500 bg-clip-text text-transparent">Opencode</span></a></div>
    <div class="flex items-center gap-2 mt-2 text-gray-400 text-xs flex-wrap justify-center">
      <a href="https://github.com/GreenVGJR/api" target="_blank" class="hover:text-mint-400 transition-colors">Source Code</a><span class="text-gray-400">|</span><a href="https://status.vgjr.top" target="_blank" class="hover:text-mint-400 transition-colors">Status Page</a><span class="text-gray-400">|</span><a href="https://ko-fi.com/greenvgjr" target="_blank" class="hover:text-mint-400 transition-colors">Support :D</a>
    </div>
  </div>`;
}
const DEFAULT_RESPONSE_HTML = getDefaultResponseHTML();

// Initialize layout and Tailwind config dynamically
const initSPA = () => {
  // Inject Fonts
  const fontsLink = document.createElement("link");
  fontsLink.rel = "stylesheet";
  fontsLink.href =
    "https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap";
  document.head.appendChild(fontsLink);

  // Build the UI structure
  document.body.className =
    "bg-black text-white font-sans";
  document.body.innerHTML = `
    <div class="h-dvh flex flex-col max-w-5xl xl:max-w-[84rem] mx-auto px-4 sm:px-6 py-3 sm:py-6">
        <section id="playgroundView" class="flex flex-col flex-1 min-h-0">
        <div class="flex flex-col xl:grid xl:grid-cols-[150px_minmax(0,64rem)_150px] gap-1.5 xl:gap-4 flex-1 min-h-0">
            <aside class="overflow-x-auto xl:overflow-y-auto flex-shrink-0 xl:h-full min-h-0 border-b border-dark-700 xl:border-b-0 xl:border-r xl:border-dark-700 xl:pr-3 pb-1.5 xl:pb-0 no-scrollbar">
                <nav class="flex xl:flex-col gap-1.5" aria-label="Page navigation">
                    <a href="/playground" data-page-link class="page-link block px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 hover:text-white whitespace-nowrap transition-colors" data-page="playground">Playground</a>
                    <a href="/terms" data-page-link class="page-link block px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 hover:text-white whitespace-nowrap transition-colors" data-page="terms">Terms</a>
                    <a href="/privacy" data-page-link class="page-link block px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 hover:text-white whitespace-nowrap transition-colors" data-page="privacy">Privacy</a>
                    <a href="/logs" target="_blank" rel="noopener" class="page-link block px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 hover:text-white whitespace-nowrap transition-colors">Logs</a>
                </nav>
            </aside>

            <div class="flex flex-col flex-1 min-h-0 min-w-0">
                <div id="urlBar" class="relative mb-3 sm:mb-2 flex-shrink-0">
                    <div class="flex items-center bg-black/60 rounded-lg sm:rounded-xl border border-dark-500 overflow-hidden focus-within:border-white/20 transition-colors">
                        <textarea id="urlInput" class="flex-1 bg-transparent py-2 sm:py-3 px-3 sm:px-4 font-mono text-xs sm:text-sm text-white placeholder-gray-600 outline-none resize-none overflow-x-auto whitespace-nowrap focus:whitespace-pre-wrap focus:break-all focus:overflow-x-auto no-scrollbar" spellcheck="false" autocomplete="off" rows="1"></textarea>
                        <button id="copyBtn" class="copy-btn cursor-pointer p-3 text-gray-500 hover:text-mint-400 transition-colors" title="Copy URL">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                    </div>
                </div>

                <aside id="categoryTabsMobile" class="block xl:hidden category-tabs overflow-x-auto flex-shrink-0 min-h-0 border-b border-dark-700 pb-1.5 mb-1.5 no-scrollbar">
                    <nav class="flex gap-1.5" aria-label="Endpoint categories">
                        <button class="tab-btn cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="search">Search</button>
                        <button class="tab-btn cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="suggestion">Suggestion</button>
                        <button class="tab-btn cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="profile">Profile</button>
                        <button class="tab-btn cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="lyrics">Lyrics</button>
                        <button class="tab-btn cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="tools">Tools</button>
                        <button class="tab-btn cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="discord_tools">Discord</button>
                        <button class="tab-btn cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="info">Info</button>
                        <button class="tab-btn cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="download">Download</button>
                        <button class="tab-btn cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="music">Music</button>
                    </nav>
                </aside>

                <div id="workspaceGrid" class="flex flex-col md:grid md:grid-cols-[300px_1fr] gap-1.5 md:gap-4 flex-1 min-h-0">
                    <div id="endpointPane" class="overflow-y-auto pr-1 flex-[2] md:flex-none md:h-full min-h-0 border-b border-dark-700 md:border-b-0 pb-1.5 md:pb-0 no-scrollbar">
                        <div id="endpointsList" class="space-y-1"></div>
                    </div>

                    <div class="flex flex-col min-h-0 min-w-0 overflow-hidden flex-[8] md:flex-[7]">
                        <div class="bg-dark-700/30 panel-gradient rounded-lg sm:rounded-xl border border-dark-500 flex-1 flex flex-col min-h-0">
                            <div id="responseHeader" class="rounded-t-lg sm:rounded-t-xl flex items-center align-center justify-between px-3 sm:px-4 py-1.5 sm:py-2 border-b border-dark-500 flex-shrink-0">
                                <span class="text-xs text-gray-500 font-mono inline-flex items-center">
                                    <span id="statusDot" class="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-gray-500 mr-3"></span>
                                    <span id="statusTextWrap" class="relative inline-block overflow-hidden h-[1.2em] whitespace-nowrap">
                                        <span id="responseTitle" class="font-semibold text-gray-400 absolute inset-0 flex items-center"></span>
                                        <span id="responseTitleNext" class="font-semibold text-gray-400 absolute inset-0 flex items-center" style="display:none"></span>
                                        <span id="statusSizer" class="invisible" aria-hidden="true"></span>
                                    </span><span class="text-gray-600 mx-1.5">|</span><span id="uptimeDisplay" class="text-gray-500">00:00:00</span>
                                </span>
                                <div id="responseActions" class="flex items-center gap-3">
                                    <button id="clearResponseBtn" class="cursor-pointer text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1.5 text-xs font-semibold" title="Clear Response">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                        </svg>
                                        <span>Clear</span>
                                    </button>
                                    <button id="copyResponseBtn" class="cursor-pointer text-gray-400 hover:text-mint-400 transition-colors flex items-center gap-1.5 text-xs font-semibold" title="Copy Response">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                        </svg>
                                        <span>Copy</span>
                                    </button>
                                </div>
                            </div>
                            <div id="responseAreaWrap" class="relative flex-1 min-h-0">
                                <div id="responseArea" class="response-area rounded-b-lg sm:rounded-b-xl font-mono text-sm text-gray-300 p-3 sm:p-4 absolute inset-0 overflow-auto empty-state">
                                    ${DEFAULT_RESPONSE_HTML}
                                </div>
                                <div id="customScrollTrack" class="custom-scrollbar-track" aria-hidden="true">
                                    <div id="customScrollThumb" class="custom-scrollbar-thumb"></div>
                                </div>
                            </div>
                        </div>

                        <div id="paramsPanel" class="mt-1.5 sm:mt-2 flex-shrink-0 hidden">
                            <div class="bg-dark-700/30 panel-gradient rounded-lg sm:rounded-xl border border-dark-500 overflow-hidden">
                                <button id="paramsToggle" class="w-full cursor-pointer flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2 text-xs text-gray-400 hover:text-gray-200 transition-colors">
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
                                <div id="paramsBody" class="params-body no-scrollbar"><div id="paramsContainer" class="px-2 sm:px-3 pb-2 sm:pb-3 space-y-1.5 sm:space-y-2"></div></div>
                            </div>
                        </div>

                        <div id="sendRow" class="mt-2 sm:mt-3 mb-4 md:mb-0 pb-[env(safe-area-inset-bottom)] flex flex-col md:flex-row items-center gap-2 sm:gap-4 flex-shrink-0">
                            <button id="sendBtn" class="w-full md:flex-1 text-black font-semibold py-2 sm:py-2.5 px-5 sm:px-6 rounded-lg text-sm sm:text-base transition-colors flex items-center justify-center gap-2 cursor-pointer outline-none focus:outline-none active:outline-none">
                                <span class="send-label">Send</span><span class="send-arrow">➜</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <aside id="categoryTabsDesktop" class="hidden xl:block category-tabs overflow-y-auto flex-shrink-0 xl:h-full min-h-0 border-l border-dark-700 xl:pl-3 pb-1.5 no-scrollbar">
                <div class="text-[10px] font-semibold uppercase tracking-widest text-gray-600 px-1 mb-2 flex items-center" style="height: var(--url-bar-h, 44px); align-items: flex-end; padding-bottom: 6px;">Category</div>
                <nav class="flex flex-col gap-1.5" aria-label="Endpoint categories">
                    <button class="tab-btn cursor-pointer block w-full text-left px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 hover:text-white whitespace-nowrap transition-colors" data-category="search">Search</button>
                    <button class="tab-btn cursor-pointer block w-full text-left px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 hover:text-white whitespace-nowrap transition-colors" data-category="suggestion">Suggestion</button>
                    <button class="tab-btn cursor-pointer block w-full text-left px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 hover:text-white whitespace-nowrap transition-colors" data-category="profile">Profile</button>
                    <button class="tab-btn cursor-pointer block w-full text-left px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 hover:text-white whitespace-nowrap transition-colors" data-category="lyrics">Lyrics</button>
                    <button class="tab-btn cursor-pointer block w-full text-left px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 hover:text-white whitespace-nowrap transition-colors" data-category="tools">Tools</button>
                    <button class="tab-btn cursor-pointer block w-full text-left px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 hover:text-white whitespace-nowrap transition-colors" data-category="discord_tools">Discord</button>
                    <button class="tab-btn cursor-pointer block w-full text-left px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 hover:text-white whitespace-nowrap transition-colors" data-category="info">Info</button>
                    <button class="tab-btn cursor-pointer block w-full text-left px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 hover:text-white whitespace-nowrap transition-colors" data-category="download">Download</button>
                    <button class="tab-btn cursor-pointer block w-full text-left px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 hover:text-white whitespace-nowrap transition-colors" data-category="music">Music</button>
                </nav>
            </aside>
        </div>
        </section>
    </div>`;
};

// Start SPA immediately
initSPA();

// Force a full reload if the page was restored from bfcache (back/forward cache)
// so a stale/cached instance is never reused.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) window.location.reload();
});

// Sync --url-bar-h so the right sidebar "Categories" label fills the same
// vertical space as the URL bar (desktop view gap fix).
requestAnimationFrame(() => {
  const _urlBarEl = document.getElementById("urlBar");
  if (_urlBarEl) {
    const syncUrlBarH = () => {
      document.documentElement.style.setProperty("--url-bar-h", _urlBarEl.getBoundingClientRect().height + "px");
    };
    syncUrlBarH();
    new ResizeObserver(syncUrlBarH).observe(_urlBarEl);
  }
});

let endpoints = {
  search: [],
  suggestion: [],
  profile: [],
  lyrics: [],
  tools: [],
  discord_tools: [],
  info: [],
  download: [],
  music: [],
};

let prt = "";
let lfprt = "";
let currentCategory = "search";
let currentEndpoint = null;
let isLoading = false;
let lastRawResponse = "";
let hasMediaResponse = false;
let isCoolingDown = false;

const apiBaseUrl = window.API_BASE_URL;
const endpointCategories = Object.keys(endpoints);

function normalizeEndpointPayload(payload) {
  const root = Array.isArray(payload)
    ? payload.find((item) => item && typeof item === "object" && (item.routes || item.endpoints || item.playgroundRoutes))
    : payload;
  const raw = root?.playgroundRoutes || root?.endpoints || root?.routes || payload?.playgroundRoutes || payload?.endpoints || payload?.routes;
  if (!raw || typeof raw !== "object") return null;

  const normalized = {};
  let found = false;
  for (const category of endpointCategories) {
    const categoryRoutes = raw[category];
    const alreadyFlat = Array.isArray(categoryRoutes) && categoryRoutes.every((ep) => ep && typeof ep.path === "string");
    normalized[category] = categoryRoutes ? (alreadyFlat ? categoryRoutes : flattenRoutes(categoryRoutes)) : [];
    if (normalized[category].length > 0) found = true;
  }
  return found ? normalized : null;
}

const urlInput = document.getElementById("urlInput");
const copyBtn = document.getElementById("copyBtn");
const copyResponseBtn = document.getElementById("copyResponseBtn");
const clearResponseBtn = document.getElementById("clearResponseBtn");
const sendBtn = document.getElementById("sendBtn");
const sendBtnLabel = sendBtn.querySelector(".send-label");
const responseArea = document.getElementById("responseArea");
const statusDotEl = document.getElementById("statusDot");
const statusText = { textContent: "", className: "" };

function setStatusDotColor(colorClass, pulse = false) {
  if (!statusDotEl) return;
  statusDotEl.className = `w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full mr-3 bg-${colorClass}${pulse ? " animate-pulse" : ""}`;
}
const workspaceGrid = document.getElementById("workspaceGrid");
const endpointPane = document.getElementById("endpointPane");
const endpointsList = document.getElementById("endpointsList");
const tabBtns = document.querySelectorAll(".tab-btn");
const categoryTabs = document.querySelectorAll(".category-tabs");
const urlBar = document.getElementById("urlBar");
const responseHeader = document.getElementById("responseHeader");
const responseTitle = document.getElementById("responseTitle");
const responseTitleNext = document.getElementById("responseTitleNext");
const responseActions = document.getElementById("responseActions");

let slideAnimTimeout = null;

const STATUS_BASE_CLASS = "absolute inset-0 flex items-center";
const statusTextWrap = document.getElementById("statusTextWrap");
const statusSizer = document.getElementById("statusSizer");

function syncStatusWidth() {
  if (statusSizer && statusTextWrap) statusTextWrap.style.width = statusSizer.offsetWidth + "px";
}
syncStatusWidth();

function slideStatusText(text, className) {
  if (slideAnimTimeout) clearTimeout(slideAnimTimeout);
  if (statusSizer) statusSizer.textContent = text;
  syncStatusWidth();
  if (!responseTitleNext) {
    responseTitle.textContent = text;
    responseTitle.className = `${STATUS_BASE_CLASS} ${className}`;
    return;
  }

  responseTitleNext.textContent = text;
  responseTitleNext.className = `${STATUS_BASE_CLASS} ${className}`;
  responseTitleNext.style.display = "";
  responseTitleNext.classList.add("status-slide-in");
  responseTitle.classList.add("status-slide-out");

  slideAnimTimeout = setTimeout(() => {
    responseTitle.textContent = text;
    responseTitle.className = `${STATUS_BASE_CLASS} ${className}`;
    responseTitle.classList.remove("status-slide-out");
    responseTitleNext.style.display = "none";
    responseTitleNext.classList.remove("status-slide-in");
  }, 200);
}

// Shared helper for the common "set dot color + status text + animate" sequence.
function setStatus(dotColor, text, textClass) {
  setStatusDotColor(dotColor);
  statusText.textContent = text;
  statusText.className = textClass;
  slideStatusText(text, "font-semibold " + textClass);
}

const sendRow = document.getElementById("sendRow");
const paramsPanel = document.getElementById("paramsPanel");
const paramsToggle = document.getElementById("paramsToggle");
const paramsBody = document.getElementById("paramsBody");
const paramsContainer = document.getElementById("paramsContainer");
const paramsCount = document.getElementById("paramsCount");
const paramsChevron = document.getElementById("paramsChevron");

document.addEventListener("click", () => closeEnumDropdowns());
window.addEventListener("resize", () => closeEnumDropdowns());
const paramsObserver = new ResizeObserver(() => updateParamsBodyHeight());
paramsObserver.observe(paramsContainer);

const legalPages = {
  terms: {
    title: "Terms of Service",
    switchLabel: "Privacy Policy",
    switchPath: "/privacy",
    sections: [
      [
        "Acceptance",
        "By using or accessing VGJR API, the playground, or any endpoint, you agree to these Terms. If you do not agree, do not use the service.",
      ],
      [
        "Allowed Use",
        "Use the service only for personal, development, automation, or integration purposes. Any kind malicious activity and commercial purpose are not allowed.",
      ],
      [
        "Tokens and Credentials",
        "If you submit Discord tokens, webhook URLs, IDs, or other credentials, you are responsible for having permission to use them and for keeping them secure. Rotate any credential that may have been exposed.",
      ],
      [
        "Third-Party Services",
        "Endpoints may call platforms such as search engines, media services, Discord, AI providers, and public APIs. Their own terms and policies may also apply. We're not responsible their content, availability, limits, or policy changes.",
      ],
      [
        "No Warranty",
        "The service is provided as is and as available, without warranties of accuracy, uptime, security, compatibility, or fitness for a specific purpose.",
      ],
      [
        "Limitation of Liability",
        "To the maximum extent permitted by law, We are not liable for losses, damages, account actions, data loss, third-party consequences, or service interruptions caused by your use of the service.",
      ],
      [
        "Suspension or Blocking",
        "Access may be blocked, limited, or suspended if usage appears abusive, unsafe, unlawful, harmful to infrastructure, or harmful to third-party services.",
      ],
      [
        "Changes",
        "These Terms may be updated as the project changes. Continued use of the service after updates means you accept the updated Terms.",
      ],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    switchLabel: "Terms of Service",
    switchPath: "/terms",
    sections: [
      [
        "Data You Provide",
        "Depending on the endpoint, you may provide search queries, URLs, prompts, text to translate, usernames, IDs, media links, Discord tokens, guild IDs, channel IDs, webhook URLs, music queries, database keys, hashes, or stored values.",
      ],
      [
        "Automatically Processed Data",
        "Standard request data may be processed, including IP address, user agent, request path, query string, headers, timestamps, response status, and diagnostic details. This may be used for operation, debugging, security, abuse prevention, and reliability.",
      ],
      [
        "How Data Is Used",
        "Data is used to provide requested API responses, call third-party services, operate Discord or music features requested by you, store values submitted to database endpoints, prevent abuse, troubleshoot issues, and improve reliability.",
      ],
      [
        "How We Handle Your Data",
        "We usually do not store your data. Most requests only act as a relay: your input is processed to complete the request, then the response is returned. Some endpoints, such as database and music features, may store data until an action deletes, clears, overwrites, or destroys it.",
      ],
      [
        "Third-Party Sharing",
        "Some endpoint inputs must be sent to third-party services to complete your request. For example, search terms may be sent to a search or media provider, Discord values may be sent to Discord APIs, and AI prompts may be sent to an AI provider.",
      ],
      [
        "Sensitive Information",
        "Avoid sending private, sensitive, or confidential information unless required for the endpoint and you understand the risk. Query strings may appear in server logs or third-party request logs.",
      ],
      [
        "Changes",
        "This Privacy Policy may be updated as the project changes. Continued use of the service after updates means you accept the updated policy.",
      ],
    ],
  },
};

let activePage = null;

function pageFromPath(pathname) {
  if (pathname === "/terms") return "terms";
  if (pathname === "/privacy") return "privacy";
  return "playground";
}

function setPageLinkState(page) {
  document.querySelectorAll(".page-link").forEach((link) => {
    const active = link.dataset.page === page;
    link.classList.toggle("active", active);
    link.classList.toggle("text-white", active);
    link.classList.toggle("text-gray-300", !active);
    link.classList.toggle("border-mint-400", active);
    link.classList.toggle("border-dark-500", !active);
    link.classList.toggle("bg-white/10", active);
  });
}

// Shows/hides the playground-only chrome (url bar, category tabs, endpoint
// list, response header/actions, send row) shared by both page renderers.
function setPlaygroundChromeVisible(visible) {
  urlBar.classList.toggle("hidden", !visible);
  categoryTabs.forEach((el) => el.classList.toggle("tabs-hidden", !visible));
  endpointPane.classList.toggle("hidden", !visible);
  workspaceGrid.style.gridTemplateColumns = visible ? "" : "minmax(0, 1fr)";
  responseHeader.classList.toggle("hidden", !visible);
  responseActions.classList.toggle("hidden", !visible);
  sendRow.classList.toggle("hidden", !visible);
}

function setScrollTrackVisible(visible) {
  const scrollTrack = document.getElementById("customScrollTrack");
  if (scrollTrack) scrollTrack.style.display = visible ? "" : "none";
}

function renderLegalPage(page) {
  const legal = legalPages[page];
  if (!legal) return;

  if (animationTimeout) clearTimeout(animationTimeout);
  endpointsList.classList.remove("is-animating");
  endpointsList.innerHTML = "";

  responseArea.classList.remove("empty-state", "font-mono");
  responseArea.classList.add("font-sans", "no-scrollbar");
  responseArea.innerHTML = `
        <section class="rounded-xl sm:rounded-2xl border border-dark-500 bg-black/30 p-5 sm:p-8 mb-4 sm:mb-5">
            <h1 class="text-3xl sm:text-5xl font-bold tracking-[-0.06em] text-white">${legal.title}</h1>
            ${legal.description ? `<p class="mt-4 text-sm sm:text-base text-gray-400 max-w-3xl">${legal.description}</p>` : ""}
        </section>

        <section class="grid gap-3 sm:gap-4">
            ${legal.sections
              .map(
                ([title, text], index) => `
                <article id="legal-section-${page}-${index}" class="rounded-xl border border-dark-500 bg-black/35 p-4 sm:p-5 scroll-mt-4">
                    <h2 class="text-sm sm:text-base font-semibold text-white mb-2"><span class="text-mint-400 font-mono">${String(index + 1).padStart(2, "0")}.</span> ${title}</h2>
                    <p class="text-sm text-gray-400 leading-6">${text}</p>
                </article>
            `,
              )
              .join("")}
        </section>
    `;

  setPlaygroundChromeVisible(false);
  paramsPanel.classList.add("hidden");
  paramsBody.style.height = null;
  paramsChevron.classList.remove("rotated");
  tabBtns.forEach((btn) => btn.classList.remove("active"));
  responseTitle.textContent = legal.title;
  lastRawResponse = legal.sections
    .map(([title, text]) => `${title}\n${text}`)
    .join("\n\n");
  setScrollTrackVisible(false);
  activePage = page;
}

function renderPlaygroundPage() {
  setPlaygroundChromeVisible(true);
  responseArea.classList.add("font-mono");
  responseArea.classList.remove("font-sans", "no-scrollbar");

  if (activePage && activePage !== "playground") {
    lastRawResponse = "";
    responseArea.classList.add("empty-state");
    responseArea.innerHTML = DEFAULT_RESPONSE_HTML;
    setStatus("gray-500", "Idle", "text-gray-500");
    if (currentEndpoint) {
      urlInput.value = buildEndpointUrl(currentEndpoint);
      adjustHeight();
    }
  }

  renderEndpoints();
  renderParams();
  setActiveCategoryTab();
  activePage = "playground";
  setScrollTrackVisible(true);
}

let lastRenderedPage = null;

function renderCurrentPage() {
  const page = pageFromPath(window.location.pathname);
  const isLegalPage = page === "terms" || page === "privacy";
  const prevPage = lastRenderedPage;
  lastRenderedPage = page;

  document.title = isLegalPage
    ? `${legalPages[page].title} | VGJR`
    : "Playground | VGJR";
  setPageLinkState(page);

  if (isLegalPage) {
    renderLegalPage(page);
    responseArea.scrollTop = 0;
  } else {
    renderPlaygroundPage();
    if (prevPage && prevPage !== "playground") refreshEndpointsFromJson();
  }
  updateConnectionUI();
}

function isVerifying() {
  return statusText && statusText.textContent === "Verifying";
}

// Shared guard used before sending a request or handling send-related shortcuts.
function isBusy() {
  return isLoading || isCoolingDown || turnstileRendered || !!document.getElementById("turnstileWidget") || isVerifying();
}

document.addEventListener("click", (event) => {
  const clickTarget = event.target instanceof Element ? event.target : null;
  const link = clickTarget?.closest("[data-page-link]");
  if (!link) return;

  if (isVerifying()) {
    event.preventDefault();
    return;
  }

  const href = link.getAttribute("href");
  if (!href) return;

  const targetUrl = new URL(href, window.location.origin);
  if (targetUrl.origin !== window.location.origin) return;

  const nextPage = pageFromPath(targetUrl.pathname);
  if (!["playground", "terms", "privacy"].includes(nextPage)) return;

  event.preventDefault();
  const isLeavingPlayground = window.location.pathname !== targetUrl.pathname && pageFromPath(window.location.pathname) === "playground";
  if (isLeavingPlayground && !confirmDiscardParams()) return;
  if (isLeavingPlayground) clearAllInputs();
  if (targetUrl.pathname !== window.location.pathname) {
    history.pushState({}, "", targetUrl.pathname);
  }
  renderCurrentPage();
});

window.addEventListener("popstate", () => {
  if (isVerifying()) {
    history.pushState(null, "", window.location.pathname);
    return;
  }
  renderCurrentPage();
});

let paramsOpen = window.innerWidth >= 768;
let currentParams = [];

urlInput.value = apiBaseUrl + (apiBaseUrl.endsWith("/") ? "" : "/");

function adjustHeight() {
  setTimeout(() => {
    urlInput.style.height = "auto";
    const newHeight = Math.min(urlInput.scrollHeight, 100);
    urlInput.style.height = newHeight + "px";
    urlInput.style.overflowY = urlInput.scrollHeight > 100 ? "auto" : "hidden";
  }, 0);
}

adjustHeight();
urlInput.addEventListener("input", adjustHeight);
urlInput.addEventListener("focus", adjustHeight);
window.addEventListener("resize", adjustHeight);

function updateStatusUI(ok, status, duration) {
  slideStatusText(`${status} • ${duration}ms`, "font-semibold text-gray-400");
  setStatusDotColor(ok ? "mint-400" : "red-500");
  statusText.textContent = ok ? "OK" : "Error";
  statusText.className = ok ? "text-mint-400" : "text-red-400";
}

function routeToEndpoint(route, types = []) {
  const parts = route.split("?");
  return {
    path: parts[0],
    query: parts.length > 1 ? "?" + parts[1] : "",
    types: Array.isArray(types)
      ? types.filter((type) => typeof type === "string")
      : [],
  };
}

function flattenRoutes(obj) {
  let flatResults = [];
  if (Array.isArray(obj)) {
    if (typeof obj[0] === "string") {
      return [routeToEndpoint(obj[0], obj.slice(1))];
    }

    return obj
      .map((item) => {
        if (typeof item === "string") {
          return routeToEndpoint(item);
        } else if (Array.isArray(item) && typeof item[0] === "string") {
          return routeToEndpoint(item[0], item.slice(1));
        } else if (typeof item === "object" && item !== null) {
          return flattenRoutes(item);
        }
        return null;
      })
      .flat()
      .filter(Boolean);
  } else if (typeof obj === "object" && obj !== null) {
    for (const key in obj) {
      const childResults = flattenRoutes(obj[key]);
      flatResults = flatResults.concat(childResults);
    }
  }
  return flatResults;
}

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
  9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
  16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15,
  21,
];
const MD5_K = Array.from({ length: 64 }, (_, i) =>
  Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000),
);

function md5(input) {
  const bytes = new TextEncoder().encode(String(input));
  const bitLength = bytes.length * 8;
  const paddedLength = ((bytes.length + 9 + 63) >> 6) << 6;
  const buffer = new Uint8Array(paddedLength);
  buffer.set(bytes);
  buffer[bytes.length] = 0x80;

  const view = new DataView(buffer.buffer);
  view.setUint32(paddedLength - 8, bitLength >>> 0, true);
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const words = new Array(16);
    for (let i = 0; i < 16; i++)
      words[i] = view.getUint32(offset + i * 4, true);

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let i = 0; i < 64; i++) {
      let f;
      let g;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }

      const rotatedInput = (f + a + MD5_K[i] + words[g]) >>> 0;
      a = d;
      d = c;
      c = b;
      b =
        (b +
          ((rotatedInput << MD5_S[i]) | (rotatedInput >>> (32 - MD5_S[i])))) >>>
        0;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  return [a0, b0, c0, d0]
    .map((word) =>
      [0, 8, 16, 24]
        .map((shift) => ((word >>> shift) & 0xff).toString(16).padStart(2, "0"))
        .join(""),
    )
    .join("");
}

function formatChallengeHash(hash) {
  let numbers = "";
  let letters = "";
  for (const char of hash.toLowerCase()) {
    if (char >= "0" && char <= "9") numbers += char;
    else if (char >= "a" && char <= "f") letters += char;
  }
  return numbers + letters;
}

let solvedChallengeCode = null;

function triggerSendButtonAnimation() {
  sendBtn.classList.remove("send-clicked");
  void sendBtn.offsetWidth;
  sendBtn.classList.add("send-clicked");
  setTimeout(() => sendBtn.classList.remove("send-clicked"), 240);
}

function setSendButtonLabel(text) {
  sendBtnLabel.textContent = text;
}

function hasConnection() {
  return navigator.onLine !== false;
}

function updateConnectionUI() {
  if (!hasConnection()) {
    setSendButtonLabel("No Connection");
    sendBtn.classList.add("opacity-50", "cursor-not-allowed");
    sendBtn.classList.remove("opacity-70");

    if (!isLoading) setStatus("red-500", "Offline", "text-red-400");
    return false;
  }

  if (!isLoading && !isCoolingDown && statusText.textContent !== "Connecting") {
    setSendButtonLabel("Send");
    sendBtn.classList.remove("opacity-50", "cursor-not-allowed", "opacity-70");

    if (statusText.textContent === "Offline") setStatus("gray-500", "Idle", "text-gray-500");
  }
  return true;
}

function removeOfflinePlayground() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations?.().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    }).catch(() => {});
  });
}

removeOfflinePlayground();

// Renders a fetched blob (image/video/audio) into the response area.
// `buildTag(url)` returns the markup for the specific media element.
async function renderBlobMedia(response, startTime, buildTag) {
  const blob = await response.blob();
  const duration = Math.round(performance.now() - startTime);
  updateStatusUI(response.ok, response.status, duration);
  const url = URL.createObjectURL(blob);

  lastRawResponse = "";
  hasMediaResponse = true;

  responseArea.classList.add("empty-state");
  responseArea.innerHTML = `<div class="w-full h-full flex items-center justify-center p-4">${buildTag(url)}</div>`;
}

async function performRequest(targetUrl, retryCount = 0) {
  if (retryCount === 0 && isBusy()) return null;
  if (retryCount === 0 && !hasConnection()) {
    updateConnectionUI();
    return null;
  }

  if (retryCount === 0) {
    isLoading = true;
    setSendButtonLabel("Loading...");
    sendBtn.classList.add("opacity-70");
    responseArea.classList.add("empty-state");
    responseArea.innerHTML = "";

    setStatus("yellow-400", "Fetching", "text-yellow-400");
  }

  let resultData = null;
  let response = null;

  try {
    const startTime = performance.now();
    const parseUrl = new URL(targetUrl);
    const headers = {
      Accept: "application/json",
    };
    let fetchUrl = targetUrl;
    if (prt) {
      headers["x-sz-token"] = prt;
      const url = new URL(targetUrl);
      url.searchParams.set(lfprt, prt);
      fetchUrl = url.toString();
    }
    if (solvedChallengeCode && parseUrl.pathname.startsWith("/music/")) {
      headers["x-challenge-codes"] = solvedChallengeCode;
      headers["x-challenge"] = formatChallengeHash(md5(solvedChallengeCode));
    }

    const isDownload = parseUrl.pathname.startsWith("/download/");
    if (isDownload) {
      const url = new URL(targetUrl);
      url.searchParams.set('json', 'true');
      fetchUrl = url.toString();
    }
    const fetchOptions = { headers, mode: "same-origin", referrerPolicy: "no-referrer", redirect: isDownload ? "manual" : undefined };
    response = await fetch(fetchUrl, fetchOptions);
    setStatus("blue-400", "Rendering", "text-gray-400");

    let duration;

    if (isDownload) {
      const contentType = response.headers.get("content-type") || "";

      if (contentType === "application/json") {
        try {
          const text = await response.clone().text();
          const json = JSON.parse(text);
          if (json.url && json.type) {
            const mediaUrl = json.url;
            const isVideo = json.type === "video";

            duration = Math.round(performance.now() - startTime);
            updateStatusUI(true, 200, duration);

            isLoading = false;
            setSendButtonLabel("Send");
            sendBtn.classList.remove("opacity-70");
            setStatusDotColor("mint-400");
            statusText.textContent = response.status.toString();
            statusText.className = "text-mint-400";
            lastRawResponse = "";
            hasMediaResponse = true;

            responseArea.classList.add("empty-state");
            const mediaTag = isVideo
              ? `<video src="${encodeURI(mediaUrl)}" controls class="max-w-full max-h-full rounded-lg shadow-lg" style="object-fit: contain;"></video>`
              : `<img src="${encodeURI(mediaUrl)}" alt="Download" class="max-w-full max-h-full rounded-lg shadow-lg" style="object-fit: contain;" />`;
            responseArea.innerHTML = `<div class="w-full h-full flex items-center justify-center p-4">${mediaTag}</div>`;
            return null;
          }
        } catch (e) {}
      }
    }

    const contentType = response.headers.get("content-type") || "";
    const encHeader = (response.headers.get("Content-Encoding") || "").trim();

    const nonStandardCoding = encHeader.length > 0 && !/^(gzip|deflate|br|compress)(\s*,\s*(gzip|deflate|br|compress))*$/i.test(encHeader);

    let payloadLooksTextual = false;
    if (contentType.startsWith("image/") || nonStandardCoding) {
      try {
        const probeReader = response.clone().body.getReader();
        const { value: probeChunk, done: probeDone } = await probeReader.read();
        if (!probeDone && probeChunk && probeChunk.length) {
          const f = probeChunk[0];
          if (f === 0x7b || f === 0x5b || f === 0x22) payloadLooksTextual = true;
        }
      } catch {}
    }

    if ((contentType.startsWith("image/") && !payloadLooksTextual) && !nonStandardCoding) {
      await renderBlobMedia(response, startTime, (url) =>
        `<img src="${url}" alt="API Response" class="max-w-full max-h-full rounded-lg shadow-lg" style="object-fit: contain;" />`);
    } else if (
      (contentType.startsWith("video/") ||
        contentType === "application/octet-stream") &&
      response.headers.get("x-player") !== "lavalink" &&
      !nonStandardCoding
    ) {
      await renderBlobMedia(response, startTime, (url) =>
        `<video src="${url}" controls class="max-w-full max-h-full rounded-lg shadow-lg" style="object-fit: contain;"></video>`);
    } else if (contentType.startsWith("audio/") && !nonStandardCoding) {
      await renderBlobMedia(response, startTime, (url) =>
        `<audio src="${url}" controls class="w-full max-w-full rounded-lg shadow-lg"></audio>`);
    } else {
      responseArea.classList.remove("empty-state");

      const bodyReader = response.body.getReader();
      const { value: firstChunk, done: firstDone } = await bodyReader.read();

      const isGzip = !firstDone && firstChunk && firstChunk[0] === 0x1f && firstChunk[1] === 0x8b;
      const isDeflate = !firstDone && firstChunk && firstChunk[0] === 0x78;
      const decompressFormat = isGzip ? "gzip" : isDeflate ? "deflate" : null;
      const needsDecompress = !!decompressFormat;

      // Rebuild a stream starting with the already-peeked first chunk,
      // then continue draining the original reader.
      const rebuiltStream = new ReadableStream({
        async start(controller) {
          if (!firstDone && firstChunk) controller.enqueue(firstChunk);
          while (true) {
            const { value, done } = await bodyReader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        },
      });

      const finalStream = needsDecompress
        ? rebuiltStream.pipeThrough(new DecompressionStream(decompressFormat))
        : rebuiltStream;

      const streamReader = finalStream.getReader();
      const decoder = new TextDecoder();

      let text = "";

      try {
        while (true) {
          const { value, done } = await streamReader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode(); // flush any remaining bytes
      } catch {}

      duration = Math.round(performance.now() - startTime);

      let cleanText = text.trim();
      if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
        cleanText = cleanText
          .substring(1, cleanText.length - 1)
          .replace(/\\n/g, "\n")
          .replace(/\\"/g, '"');
      }

      let decryptedText = cleanText;

      const isLavalink = response.headers.get("x-player") === "lavalink";
      if (response.status === 302 && isLavalink && retryCount < 4) {
        try {
          const data = JSON.parse(decryptedText);
          if (data && data.c && data._challenge && typeof d === "function") {
            responseArea.innerHTML = "";
            await new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            );
            const solved = await d(data.c, data.d || 10);
            if (solved) {
              solvedChallengeCode = solved;
              return await performRequest(targetUrl, retryCount + 1);
            }
          }
        } catch {}
      } else if (response.status === 302 && isLavalink) {
        solvedChallengeCode = null;
      }

      let formatted = text;
      let isJson = false;

      try {
        const data = JSON.parse(decryptedText);
        if (typeof data === "object" || Array.isArray(data)) {
          formatted = JSON.stringify(data, null, 1);
          isJson = true;
        } else {
          formatted = String(data);
        }
        resultData = data;
      } catch {}

      lastRawResponse = decryptedText;

      responseArea.innerHTML =
        '<pre style=\"white-space: pre-wrap; word-break: break-all; overflow-wrap: anywhere;\"></pre>';
      const preElement = responseArea.querySelector("pre");

      if (!isJson) {
        preElement.innerHTML = linkifyText(formatted);
        updateStatusUI(response.ok, response.status, duration);
      } else {
        const resOk = response.ok;
        const resStatus = response.status;
        const lines = formatted.split("\n");

        if (formatted.length > 5000) {
          preElement.textContent = formatted;

          const CHUNK_SIZE = 200;
          let chunkIndex = 0;
          let colorfulHTML = "";

          const buildColorfulChunk = () => {
            const end = Math.min(chunkIndex + CHUNK_SIZE, lines.length);
            const chunkString = lines.slice(chunkIndex, end).join("\n");
            try {
              colorfulHTML += syntaxHighlight(chunkString) + (end < lines.length ? "\n" : "");
            } catch {
              colorfulHTML += escapeHTML(chunkString) + (end < lines.length ? "\n" : "");
            }
            chunkIndex = end;

            if (chunkIndex < lines.length) {
              requestAnimationFrame(buildColorfulChunk);
            } else {
              const scrollTop = preElement.scrollTop;
              preElement.innerHTML = colorfulHTML;
              preElement.scrollTop = scrollTop;
              updateStatusUI(resOk, resStatus, duration);
            }
          };

          requestAnimationFrame(buildColorfulChunk);
        } else {
          const CHUNK_SIZE = 200;
          let chunkIndex = 0;

          const processChunk = () => {
            if (chunkIndex >= lines.length) return;

            const deadline = performance.now() + 50;
            const fragments = [];

            while (chunkIndex < lines.length && performance.now() < deadline) {
              const end = Math.min(chunkIndex + CHUNK_SIZE, lines.length);
              const chunkLines = lines.slice(chunkIndex, end);
              const chunkString = chunkLines.join("\n");
              let highlighted;
              try {
                highlighted = syntaxHighlight(chunkString);
              } catch {
                highlighted = escapeHTML(chunkString);
              }
              fragments.push(highlighted + (end < lines.length ? "\n" : ""));
              chunkIndex = end;
            }

            if (fragments.length > 0) {
              preElement.insertAdjacentHTML("beforeend", fragments.join(""));
            }

            if (chunkIndex < lines.length) {
              requestAnimationFrame(processChunk);
            }
          };

          processChunk();
          updateStatusUI(response.ok, response.status, duration);
        }
      }
    }
  } catch (err) {
    responseArea.classList.remove("empty-state");
    responseArea.innerHTML = `<span class="text-red-400">Error: ${err.message}</span>`;
    setStatus("red-500", "Failed", "text-red-400");
  } finally {
    if (retryCount === 0) {
      isLoading = false;
      response = null;
      if (!hasConnection()) {
        isCoolingDown = false;
        updateConnectionUI();
      } else {
        setSendButtonLabel("Send");

        isCoolingDown = true;
        sendBtn.classList.add("opacity-50", "cursor-not-allowed");

        setTimeout(() => {
          isCoolingDown = false;
          updateConnectionUI();
        }, 300);
      }
    }
  }

  return resultData;
}

function parseQueryParams(queryString, types = []) {
  if (!queryString || !queryString.startsWith("?")) return [];
  const raw = queryString.substring(1);
  const params = [];
  const parts = raw.split("&");
  for (const part of parts) {
    const eqIdx = part.indexOf("=");
    const typeMeta = parseParamTypeSpec(types[params.length]);
    if (eqIdx === -1) {
      params.push({
        key: part,
        value: "",
        type: typeMeta.type,
        options: typeMeta.options,
      });
    } else {
      params.push({
        key: part.substring(0, eqIdx),
        value: decodeURIComponent(part.substring(eqIdx + 1)),
        type: typeMeta.type,
        options: typeMeta.options,
      });
    }
  }
  return params;
}

function buildQueryString(params) {
  if (params.length === 0) return "";
  const nonEmpty = params.filter((p) => p.value !== "");
  if (nonEmpty.length === 0) return "";
  return (
    "?" +
    nonEmpty
      .map((p) => {
        let raw = p.value;
        try { raw = decodeURIComponent(raw); } catch {}
        const encodedValue = encodeURIComponent(raw);
        return `${encodeURIComponent(p.key)}=${encodedValue}`;
      })
      .join("&")
  );
}

function getEndpointPath(endpoint) {
  const path = endpoint?.path || "/";
  const qIdx = path.indexOf("?");
  const cleanPath = qIdx === -1 ? path : path.slice(0, qIdx);
  return cleanPath || "/";
}

function getEndpointQuery(endpoint) {
  const query = endpoint?.query || "";
  if (query) return query.startsWith("?") ? query : "?" + query;

  const path = endpoint?.path || "";
  const qIdx = path.indexOf("?");
  return qIdx === -1 ? "" : path.slice(qIdx);
}

const PARAM_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "url",
  "enum",
  "enum_multi",
  "json",
]);

// Splits a comma-separated string into trimmed, non-empty parts.
function parseCSVList(value) {
  return value ? value.split(",").map((v) => v.trim()).filter(Boolean) : [];
}

function parseParamTypeSpec(typeSpec) {
  const spec = String(typeSpec || "");
  const separatorIndex = spec.indexOf(":");
  const rawType = separatorIndex === -1 ? spec : spec.slice(0, separatorIndex);
  const type = PARAM_TYPES.has(rawType) ? rawType : "string";
  const options =
    (type === "enum" || type === "enum_multi") && separatorIndex !== -1
      ? parseCSVList(spec.slice(separatorIndex + 1))
      : [];

  return { type, options };
}

function normalizeParamType(typeSpec) {
  return parseParamTypeSpec(typeSpec).type;
}

function buildEndpointUrl(endpoint) {
  if (!endpoint) return apiBaseUrl;
  const cleanBase = apiBaseUrl.replace(/\/$/, "");
  const endpointPath = getEndpointPath(endpoint);
  const cleanPath = endpointPath.startsWith("/")
    ? endpointPath
    : "/" + endpointPath;
  return cleanBase + cleanPath;
}

function renderParamControl(p, i) {
  const type = normalizeParamType(p.type);
  const value = String(p.value ?? "");
  const enumOptions = Array.isArray(p.options) ? p.options : [];
  const titleAttr = enumOptions.length
    ? ` title="${escapeAttribute(enumOptions.join(", "))}"`
    : "";

  if (type === "enum" && enumOptions.length) {
    const optionValues =
      value && !enumOptions.includes(value)
        ? [value, ...enumOptions]
        : enumOptions;
    return `
            <div class="param-enum" data-param-index="${i}">
                <input
                    type="hidden"
                    class="param-input param-enum-value-input"
                    data-param-index="${i}"
                    value="${escapeAttribute(value)}"
                />
                <button
                    type="button"
                    class="param-enum-button"
                    data-param-index="${i}"
                    aria-haspopup="listbox"
                    aria-expanded="false"
                    ${titleAttr}
                >
                    <span class="param-enum-selected${value ? "" : " is-placeholder"}">${escapeHTML(value || "enum")}</span>
                    <span class="param-enum-arrow" aria-hidden="true">v</span>
                </button>
                <div class="param-enum-menu no-scrollbar" role="listbox" hidden>
                    <button type="button" class="param-enum-option${value === "" ? " selected" : ""}" data-value="" role="option" aria-selected="${value === "" ? "true" : "false"}">enum</button>
                    ${optionValues.map((option) => `<button type="button" class="param-enum-option${option === value ? " selected" : ""}" data-value="${escapeAttribute(option)}" role="option" aria-selected="${option === value ? "true" : "false"}">${escapeHTML(option)}</button>`).join("")}
                </div>
            </div>
        `;
  }

  if (type === "enum_multi" && enumOptions.length) {
    const selectedValues = parseCSVList(value);
    return `
            <div class="param-enum param-enum-multi" data-param-index="${i}">
                <input
                    type="hidden"
                    class="param-input param-enum-value-input"
                    data-param-index="${i}"
                    value="${escapeAttribute(value)}"
                />
                <button
                    type="button"
                    class="param-enum-button"
                    data-param-index="${i}"
                    aria-haspopup="listbox"
                    aria-expanded="false"
                    ${titleAttr}
                >
                    <span class="param-enum-selected${selectedValues.length ? "" : " is-placeholder"}">${selectedValues.length ? escapeHTML(selectedValues.join(", ")) : "enum (multi)"}</span>
                    <span class="param-enum-arrow" aria-hidden="true">v</span>
                </button>
                <div class="param-enum-menu no-scrollbar" role="listbox" hidden>
                    ${enumOptions.map((option) => {
                      const isChecked = selectedValues.includes(option) ? " checked" : "";
                      return `<button type="button" class="param-enum-option param-enum-multi-option${isChecked}" data-value="${escapeAttribute(option)}" role="option" aria-selected="${isChecked ? "true" : "false"}"><span class="param-enum-check" aria-hidden="true">${isChecked ? "\u2611" : "\u2610"}</span>${escapeHTML(option)}</button>`;
                    }).join("")}
                </div>
            </div>
        `;
  }

  return `
        <textarea
            class="param-input no-scrollbar"
            data-param-index="${i}"
            placeholder="${escapeAttribute(type)}"
            ${titleAttr}
            spellcheck="false"
            autocomplete="off"
            rows="1"
        >${escapeHTML(value)}</textarea>
    `;
}

function closeEnumDropdowns(exceptControl = null) {
  let changed = false;
  paramsContainer.querySelectorAll(".param-enum.open").forEach((control) => {
    if (control === exceptControl) return;
    control.classList.remove("open");
    control
      .querySelector(".param-enum-button")
      ?.setAttribute("aria-expanded", "false");
    const menu = control.querySelector(".param-enum-menu");
    if (menu) menu.hidden = true;
    changed = true;
  });
  if (changed) requestAnimationFrame(updateParamsBodyHeight);
}

function updateParamsBodyHeight() {
  if (!paramsOpen || currentParams.length === 0) return;
  const maxH = window.innerHeight * 0.5;
  paramsBody.style.height = Math.min(paramsContainer.offsetHeight, maxH) + "px";
}

function setEnumControlValue(control, value, notify = true) {
  const hiddenInput = control.querySelector(".param-enum-value-input");
  const selected = control.querySelector(".param-enum-selected");
  if (!hiddenInput || !selected) return;

  hiddenInput.value = value;
  selected.textContent = value || "enum";
  selected.classList.toggle("is-placeholder", value === "");

  control.querySelectorAll(".param-enum-option").forEach((option) => {
    const isSelected = option.dataset.value === value;
    option.classList.toggle("selected", isSelected);
    option.setAttribute("aria-selected", isSelected ? "true" : "false");
  });

  if (notify) hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
}

function setEnumMultiControlValue(control, toggleValue, notify = true) {
  const hiddenInput = control.querySelector(".param-enum-value-input");
  const selected = control.querySelector(".param-enum-selected");
  if (!hiddenInput || !selected) return;

  const current = parseCSVList(hiddenInput.value);
  const idx = current.indexOf(toggleValue);
  if (idx === -1) current.push(toggleValue);
  else current.splice(idx, 1);

  const newValue = current.join(",");
  hiddenInput.value = newValue;
  selected.textContent = newValue || "enum (multi)";
  selected.classList.toggle("is-placeholder", newValue === "");

  control.querySelectorAll(".param-enum-multi-option").forEach((option) => {
    const isChecked = current.includes(option.dataset.value);
    option.classList.toggle("checked", isChecked);
    option.setAttribute("aria-selected", isChecked ? "true" : "false");
    const check = option.querySelector(".param-enum-check");
    if (check) check.textContent = isChecked ? "\u2611" : "\u2610";
  });

  if (notify) hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
}

function syncEnumControlsFromInputs() {
  paramsContainer.querySelectorAll(".param-enum").forEach((control) => {
    const hiddenInput = control.querySelector(".param-enum-value-input");
    if (!hiddenInput) return;
    if (control.classList.contains("param-enum-multi")) {
      setEnumMultiControlValueSync(control, hiddenInput.value);
    } else {
      setEnumControlValue(control, hiddenInput.value, false);
    }
  });
}

function setEnumMultiControlValueSync(control, value) {
  const hiddenInput = control.querySelector(".param-enum-value-input");
  const selected = control.querySelector(".param-enum-selected");
  if (!hiddenInput || !selected) return;
  hiddenInput.value = value;
  const values = parseCSVList(value);
  selected.textContent = values.join(", ") || "enum (multi)";
  selected.classList.toggle("is-placeholder", values.length === 0);
  control.querySelectorAll(".param-enum-multi-option").forEach((option) => {
    const isChecked = values.includes(option.dataset.value);
    option.classList.toggle("checked", isChecked);
    option.setAttribute("aria-selected", isChecked ? "true" : "false");
    const check = option.querySelector(".param-enum-check");
    if (check) check.textContent = isChecked ? "\u2611" : "\u2610";
  });
}

function setupEnumControls() {
  paramsContainer.querySelectorAll(".param-enum").forEach((control) => {
    const button = control.querySelector(".param-enum-button");
    const menu = control.querySelector(".param-enum-menu");
    if (!button || !menu) return;

    const openMenu = () => {
      closeEnumDropdowns(control);
      control.classList.add("open");
      button.setAttribute("aria-expanded", "true");
      menu.hidden = false;
      requestAnimationFrame(updateParamsBodyHeight);
    };

    const closeMenu = () => {
      control.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
      menu.hidden = true;
      requestAnimationFrame(updateParamsBodyHeight);
    };

    button.addEventListener("click", (e) => {
      e.stopPropagation();
      if (control.classList.contains("open")) closeMenu();
      else openMenu();
    });

    button.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openMenu();
        (
          menu.querySelector(".param-enum-option.selected") ||
          menu.querySelector(".param-enum-option")
        )?.focus();
      } else if (e.key === "Escape") {
        closeMenu();
      }
    });

    menu.querySelectorAll(".param-enum-option").forEach((option) => {
      const isMulti = control.classList.contains("param-enum-multi");

      option.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isMulti) {
          setEnumMultiControlValue(control, option.dataset.value || "");
        } else {
          setEnumControlValue(control, option.dataset.value || "");
          closeMenu();
          button.focus();
        }
      });

      option.addEventListener("keydown", (e) => {
        const options = Array.from(menu.querySelectorAll(".param-enum-option"));
        const currentIndex = options.indexOf(option);

        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (isMulti) {
            setEnumMultiControlValue(control, option.dataset.value || "");
          } else {
            setEnumControlValue(control, option.dataset.value || "");
            closeMenu();
            button.focus();
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          closeMenu();
          button.focus();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          options[Math.min(currentIndex + 1, options.length - 1)]?.focus();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          options[Math.max(currentIndex - 1, 0)]?.focus();
        }
      });
    });
  });
}

function hasParamInputValues() {
  return Array.from(paramsContainer.querySelectorAll(".param-input")).some(
    (input) => input.value && input.value.trim() !== "",
  );
}

function clearAllInputs() {
  urlInput.value = apiBaseUrl + (apiBaseUrl.endsWith("/") ? "" : "/");
  paramsContainer.querySelectorAll(".param-input").forEach((input) => {
    input.value = "";
  });
  currentParams.forEach((p) => (p.value = ""));
  adjustHeight();
}

function confirmDiscardParams() {
  if (!hasParamInputValues()) return true;
  return window.confirm("Switch anyway?");
}

function renderParams() {
  const page = pageFromPath(window.location.pathname);
  if (page === "terms" || page === "privacy") return;
  paramsPanel.classList.remove("hidden");
  const endpointQuery = getEndpointQuery(currentEndpoint);

  if (!currentEndpoint || !endpointQuery) {
    currentParams = [];
  } else {
    currentParams = parseQueryParams(
      endpointQuery,
      currentEndpoint.types || [],
    );
  }

  hideResponseArea();

  paramsCount.textContent = currentParams.length;

  if (currentParams.length > 0) {
    try {
      const currentUrl = urlInput.value;
      const qIdx = currentUrl.indexOf("?");
      if (qIdx !== -1) {
        const currentUrlParams = parseQueryParams(currentUrl.substring(qIdx));
        for (const cp of currentParams) {
          const match = currentUrlParams.find((up) => up.key === cp.key);
          if (match && match.value) {
            cp.value = match.value;
          }
        }
      }
    } catch {}

    paramsContainer.innerHTML = currentParams
      .map(
        (p, i) => `
            <div class="param-row">
                <label class="param-label" title="${escapeAttribute(p.key)}">${escapeHTML(p.key)}</label>
                <div class="param-input-wrap">
                    ${renderParamControl(p, i)}
                </div>
            </div>
        `,
      )
      .join("");

    paramsContainer.querySelectorAll(".param-input").forEach((input) => {
      const updateValue = () => {
        const idx = parseInt(input.dataset.paramIndex);
        currentParams[idx].value = input.value;
        syncParamsToUrl();
      };
      input.addEventListener("input", updateValue);
      input.addEventListener("change", updateValue);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          sendBtn.click();
        }
      });
    });

    setupEnumControls();
  } else {
    paramsContainer.innerHTML =
      '<div class="text-xs text-gray-500 text-center py-2">No parameters needed.</div>';
  }

  scheduleRestoreResponseArea();

  if (currentParams.length > 0 && window.innerWidth >= 768) {
    paramsChevron.classList.add("rotated");
    paramsOpen = true;
    updateParamsBodyHeight();
  } else {
    paramsChevron.classList.remove("rotated");
    paramsOpen = false;
    paramsBody.style.height = null;
  }
}

function syncParamsToUrl() {
  const queryString = buildQueryString(currentParams);
  const cleanBase = apiBaseUrl.replace(/\/$/, "");
  const path = currentEndpoint ? getEndpointPath(currentEndpoint) : "/";
  const cleanPath = path.startsWith("/") ? path : "/" + path;

  urlInput.value = cleanBase + cleanPath + queryString;
  adjustHeight();
}

function syncUrlToParams() {
  if (currentParams.length === 0) return;
  try {
    const currentUrl = urlInput.value;
    const qIdx = currentUrl.indexOf("?");
    if (qIdx === -1) return;
    const currentUrlParams = parseQueryParams(currentUrl.substring(qIdx));
    let changed = false;
    for (const cp of currentParams) {
      const match = currentUrlParams.find((up) => up.key === cp.key);
      if (match && match.value !== cp.value) {
        cp.value = match.value;
        changed = true;
      }
    }
    if (changed) {
      paramsContainer.querySelectorAll(".param-input").forEach((input) => {
        const idx = parseInt(input.dataset.paramIndex);
        if (currentParams[idx] && input.value !== currentParams[idx].value) {
          input.value = currentParams[idx].value;
        }
      });
      syncEnumControlsFromInputs();
    }
  } catch {}
}

paramsToggle.addEventListener("click", () => {
  paramsOpen = !paramsOpen;
  paramsChevron.classList.toggle("rotated", paramsOpen);

  hideResponseArea();

  if (paramsOpen) {
    updateParamsBodyHeight();
  } else {
    closeEnumDropdowns();
    paramsBody.style.height = null;
  }
  
  scheduleRestoreResponseArea();
});

function selectInitialEndpointFromCurrentCategory() {
  if (endpoints[currentCategory] && endpoints[currentCategory].length > 0) {
    currentEndpoint = endpoints[currentCategory][0];
    urlInput.value = buildEndpointUrl(currentEndpoint);
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
}

function setActiveCategoryTab() {
  tabBtns.forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(
    `.tab-btn[data-category="${currentCategory}"]`
  ).forEach((btn) => btn.classList.add("active"));
}

let turnstileRendered = false;

function hideResponseArea() {
  if (lastRawResponse) responseArea.style.display = "none";
}

function restoreResponseArea() {
  if (lastRawResponse) responseArea.style.display = null;
}

// Restores the response area after params panel animations settle
// (skips the delay entirely if the user prefers reduced motion).
function scheduleRestoreResponseArea() {
  const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 150;
  setTimeout(() => requestAnimationFrame(restoreResponseArea), delay);
}

function showTurnstileChallenge() {
  if (turnstileRendered) return;
  turnstileRendered = true;
  isLoading = true;
  setSendButtonLabel("Send");
  sendBtn.classList.add("opacity-50", "cursor-not-allowed");
  sendBtn.classList.remove("opacity-70");

  setStatus("yellow-400", "Verifying", "text-yellow-400");

  responseArea.innerHTML = `
    <div class="w-full flex flex-col items-center justify-center">
      ${DEFAULT_RESPONSE_HTML}
      <div class="w-full flex flex-col items-center gap-2 pt-2 pb-3 px-4">
        <div id="turnstileWidget" class="min-h-[65px] flex items-center justify-center"></div>
        <div id="turnstileError" class="text-xs text-red-400 font-sans hidden"></div>
      </div>
    </div>`;

  const loadScript = () =>
    new Promise((resolve) => {
      if (window.turnstile) return resolve(true);
      let attempts = 0;
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          resolve(true);
        } else if (attempts++ > 50) {
          clearInterval(interval);
          resolve(false);
        }
      }, 100);
    });

  const renderWidget = () => {
    const el = document.getElementById("turnstileWidget");
    if (!el || !window.turnstile) return;
    window.turnstile.render(el, {
      sitekey: window.TURNSTILE_SITE_KEY,
      theme: "dark",
      callback: async (token) => {
        turnstileRendered = false;
        responseArea.innerHTML = DEFAULT_RESPONSE_HTML;
        sendBtn.classList.remove("opacity-50", "cursor-not-allowed");
        sendBtn.classList.add("opacity-70");
        await refreshEndpointsFromJson();
      },
      "expired-callback": () => {
        const el = document.getElementById("turnstileWidget");
        if (window.turnstile && el) window.turnstile.reset(el);
      },
      "error-callback": () => {
        const errEl = document.getElementById("turnstileError");
        if (errEl) {
          errEl.textContent = "Challenge failed to load. Refresh to retry.";
          errEl.classList.remove("hidden");
        }
      },
    });
  };

  loadScript().then((ok) => {
    if (!ok) {
      const errEl = document.getElementById("turnstileError");
      if (errEl) {
        errEl.textContent = "Could not load Turnstile. Refresh to retry.";
        errEl.classList.remove("hidden");
      }
      return;
    }
    renderWidget();
  });
}

async function refreshEndpointsFromJson() {
  try {
    setStatus("blue-400", "Connecting", "text-gray-400");

    let statsRes = null;
    try {
      statsRes = await fetch("/?json", { priority: "low", cache: "no-store", mode: "same-origin", referrerPolicy: "no-referrer", headers: { Accept: "application/json" } });
      if (statsRes.status === 403) {
        if (pageFromPath(window.location.pathname) === "playground") showTurnstileChallenge();
        return false;
      }
      if (statsRes.ok) {
        const statsPayload = await statsRes.json();
        isLoading = false;
        prt = statsPayload[1]._build[1];
        lfprt = statsPayload[1]._build[0];
        setUptimeFromJsonPayload(statsPayload);

        const freshEndpoints = normalizeEndpointPayload(statsPayload);
        if (freshEndpoints) {
          const previousPath = currentEndpoint?.path;
          endpoints = freshEndpoints;
          const categoryList = endpoints[currentCategory] || [];
          currentEndpoint =
            (previousPath && categoryList.find((ep) => ep.path === previousPath)) ||
            categoryList[0] ||
            null;

          if (currentEndpoint) {
            urlInput.value = buildEndpointUrl(currentEndpoint);
            adjustHeight();
          }

          renderEndpoints();
          renderParams();
          if (currentEndpoint) {
            syncUrlToParams();
            syncParamsToUrl();
          }
        }
      }
    } catch {}

    if (statusText.textContent === "Connecting") {
      setStatus("gray-500", statsRes && !statsRes.ok ? `${statsRes.status} - Failed` : "Idle", "text-gray-500");
    }
    return true;
  } catch {
    setStatus("red-500", "Failed", "text-red-400");
    sendBtn.classList.remove("opacity-50", "cursor-not-allowed");
    return false;
  }
}

async function fetchInitialEndpoints() {
  selectInitialEndpointFromCurrentCategory();
  setActiveCategoryTab();
}

let animationTimeout = null;

function renderEndpoints(animate = false) {
  const categoryEndpoints = endpoints[currentCategory] || [];

  // Capture old state if animating
  let oldHTML = "";
  if (animate) {
    // If already animating, take the content from the 'new' layer that was coming in
    const currentNewLayer = endpointsList.querySelector(".swipe-layer.new");
    if (currentNewLayer) {
      oldHTML = currentNewLayer.innerHTML;
    } else {
      oldHTML = endpointsList.innerHTML;
    }
  }

  if (categoryEndpoints.length === 0) {
    if (animationTimeout) clearTimeout(animationTimeout);
    endpointsList.classList.remove("is-animating");
    endpointsList.innerHTML = `
            <div class="text-gray-600 text-xs p-4 text-center">
                ${Object.keys(endpoints).length === 0 ? "Loading..." : "No endpoints found."}
            </div>
         `;
    return;
  }

  const newHTML = categoryEndpoints
    .map(
      (ep, index) => `
        <button 
            class="endpoint-item cursor-pointer block w-full text-left py-1 px-2 sm:px-3 rounded-lg font-mono text-xs text-white-400 hover:bg-dark-700 ${currentEndpoint && currentEndpoint.path === ep.path ? "active bg-dark-700 text-mint-400 border-l-2 border-mint-400" : ""} break-all transition-colors"
            data-index="${index}"
        >
            ${ep.path}
        </button>
    `,
    )
    .join("");

  if (animationTimeout) clearTimeout(animationTimeout);

  if (animate && oldHTML && !oldHTML.includes("Loading...")) {
    endpointsList.classList.add("is-animating");
    endpointsList.innerHTML = `
            <div class="swipe-layer old space-y-1">${oldHTML}</div>
            <div class="swipe-layer new space-y-1">${newHTML}</div>
        `;

    const finishSwipe = () => {
      if (!endpointsList.classList.contains("is-animating")) return;
      const newLayer = endpointsList.querySelector(".swipe-layer.new");
      if (newLayer) {
        endpointsList.innerHTML = newLayer.innerHTML;
        endpointsList.classList.remove("is-animating");
        attachEndpointListeners();
      }
      animationTimeout = null;
      endpointsList.querySelectorAll(".swipe-layer").forEach((layer) =>
        layer.removeEventListener("animationend", finishSwipe)
      );
    };

    endpointsList.querySelectorAll(".swipe-layer").forEach((layer) =>
      layer.addEventListener("animationend", finishSwipe)
    );

    animationTimeout = setTimeout(finishSwipe, 700);
  } else {
    endpointsList.classList.remove("is-animating");
    endpointsList.innerHTML = `<div class="space-y-1">${newHTML}</div>`;
    attachEndpointListeners();
  }
}

function attachEndpointListeners() {
  endpointsList.querySelectorAll(".endpoint-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (isVerifying()) return;
      const index = parseInt(btn.dataset.index);
      if (currentEndpoint && endpoints[currentCategory][index] === currentEndpoint) return;
      if (!confirmDiscardParams()) return;
      currentEndpoint = endpoints[currentCategory][index];
      urlInput.value = buildEndpointUrl(currentEndpoint);
      adjustHeight();
      renderEndpoints();
      renderParams();

      setActiveCategoryTab();
    });
  });
}

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (isVerifying()) return;
    const nextCategory = btn.dataset.category;
    const wasLegalPage =
      pageFromPath(window.location.pathname) !== "playground";

    // Prevent re-rendering and animating if clicking the already active tab
    if (!wasLegalPage && currentCategory === nextCategory) return;

    if (!confirmDiscardParams()) return;

    const wasOpen = !wasLegalPage && paramsOpen;

    if(window.innerWidth >= 768) hideResponseArea();
    if (wasOpen) {
      paramsBody.style.height = null;
      paramsChevron.classList.remove("rotated");
    }

    setTimeout(
      () => {

        if (wasLegalPage) history.pushState({}, "", "/playground");

        currentCategory = nextCategory;
        setActiveCategoryTab();
        const categoryList = endpoints[currentCategory] || [];
        if (categoryList.length > 0) {
          currentEndpoint = categoryList[0];
          urlInput.value = buildEndpointUrl(currentEndpoint);
          adjustHeight();
        } else {
          currentEndpoint = null;
        }
        if (wasLegalPage) {
          renderCurrentPage();
        } else {
          renderEndpoints(true);
          renderParams();
        }
        endpointPane.scrollTo({
          top: 0,
          behavior: window.innerWidth >= 768 ? "smooth" : "auto",
        });

        if (window.innerWidth >= 768) scheduleRestoreResponseArea();
      },
      wasOpen ? 50 : 0,
    );
  });
});

urlInput.addEventListener("keydown", (e) => {
  if (statusText.textContent === "Connecting" || statusText.textContent === "Verifying" || isLoading || turnstileRendered || document.getElementById("turnstileWidget")) {
    e.preventDefault();
    urlInput.blur();
    return;
  }
  if (e.key === "Enter" && !isLoading && !turnstileRendered && !document.getElementById("turnstileWidget") && statusText.textContent !== "Verifying") {
    e.preventDefault();
    urlInput.blur();
    sendBtn.click();
  }

  if (
    (e.key === "Backspace" || e.key === "Delete") &&
    urlInput.selectionStart <= apiBaseUrl.length &&
    urlInput.selectionEnd === urlInput.selectionStart
  ) {
    e.preventDefault();
  }
});

urlInput.addEventListener("input", () => {
  let val = urlInput.value;

  if (!val.startsWith(apiBaseUrl)) {
    const baseIdx = val.indexOf(apiBaseUrl);
    if (baseIdx > 0) {
      val = val.substring(baseIdx);
    } else {
      let pathIndex = val.indexOf("/");
      if (val.match(/^https?:\/\//)) {
        pathIndex = val.indexOf("/", 8);
      }

      let path = "";
      if (pathIndex !== -1) {
        path = val.substring(pathIndex);
      }
      val = apiBaseUrl + path;
    }
  }

  const queryIdx = val.indexOf("?");
  let pathPart =
    queryIdx === -1
      ? val.substring(apiBaseUrl.length)
      : val.substring(apiBaseUrl.length, queryIdx);
  let queryPart = queryIdx === -1 ? "" : val.substring(queryIdx);

  // Keep the live input readable while typing to prevent cursor jumps
  // We only do basic normalization here.
  const hostOnly = apiBaseUrl.replace(/^https?:\/\//, "");

  let dirty = true;
  let safety = 0;
  while (dirty && safety < 10) {
    dirty = false;
    safety++;

    if (pathPart.startsWith("/" + hostOnly)) {
      pathPart = pathPart.substring(1 + hostOnly.length);
      dirty = true;
    } else if (pathPart.startsWith("//" + hostOnly)) {
      pathPart = pathPart.substring(2 + hostOnly.length);
      dirty = true;
    } else if (pathPart.startsWith("/" + apiBaseUrl)) {
      pathPart = pathPart.substring(1 + apiBaseUrl.length);
      dirty = true;
    } else if (pathPart.startsWith(apiBaseUrl)) {
      pathPart = pathPart.substring(apiBaseUrl.length);
      dirty = true;
    } else if (pathPart.startsWith("//")) {
      pathPart = pathPart.substring(1);
      dirty = true;
    }
  }

  if (pathPart && !pathPart.startsWith("/")) {
    pathPart = "/" + pathPart;
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
  const qIdx = val.indexOf("?");

  // Clear all highlights first
  document
    .querySelectorAll(".param-input")
    .forEach((el) => el.classList.remove("highlight-active"));

  if (qIdx === -1 || pos <= qIdx) return;

  const query = val.substring(qIdx + 1);
  const posInQuery = pos - (qIdx + 1);
  const parts = query.split("&");

  let currentLen = 0;
  for (let i = 0; i < parts.length; i++) {
    const partLen = parts[i].length;
    // Check if cursor is within this parameter's range
    if (posInQuery >= currentLen && posInQuery <= currentLen + partLen) {
      const input = document.querySelector(
        `.param-input[data-param-index="${i}"]`,
      );
      if (input) {
        input.classList.add("highlight-active");
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

urlInput.addEventListener("click", updateParamHighlight);
urlInput.addEventListener("keyup", updateParamHighlight);
urlInput.addEventListener("focus", updateParamHighlight);

urlInput.addEventListener("blur", () => {
  // Clear highlights when focus is lost
  document
    .querySelectorAll(".param-input")
    .forEach((el) => el.classList.remove("highlight-active"));

  const val = urlInput.value;
  const queryIdx = val.indexOf("?");
  if (queryIdx === -1) return;

  const base = val.substring(0, queryIdx + 1);
  const query = val.substring(queryIdx + 1);
  const parts = query.split("&");

  const washedQuery = parts
    .map((part) => {
      const eqIdx = part.indexOf("=");
      if (eqIdx === -1) return part;
      const key = part.substring(0, eqIdx);
      const rawVal = part.substring(eqIdx + 1);
      return key + "=" + encodeURIComponent(decodeURIComponent(rawVal));
    })
    .join("&");

  urlInput.value = base + washedQuery;
  adjustHeight();
});

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "-9999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand("copy");
    return true;
  } finally {
    document.body.removeChild(textArea);
  }
}

copyBtn.addEventListener("click", async () => {
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
  } catch (err) {}
});

copyResponseBtn.addEventListener("click", async () => {
  if (!lastRawResponse) return;

  try {
    await copyToClipboard(lastRawResponse);
    const originalText = copyResponseBtn.querySelector("span").textContent;
    copyResponseBtn.querySelector("span").textContent = "Copied!";
    copyResponseBtn.classList.add("text-mint-400");

    setTimeout(() => {
      copyResponseBtn.querySelector("span").textContent = originalText;
      copyResponseBtn.classList.remove("text-mint-400");
    }, 1500);
  } catch (err) {}
});

clearResponseBtn.addEventListener("click", () => {
  if (statusText.textContent === "Connecting" || (lastRawResponse === "" && !hasMediaResponse)) return;
  lastRawResponse = "";
  hasMediaResponse = false;
  responseArea.classList.add("empty-state");
  responseArea.innerHTML = DEFAULT_RESPONSE_HTML;
  setStatus("gray-500", "Idle", "text-gray-500");
  updateConnectionUI();
});

sendBtn.addEventListener("click", () => {
  if (isBusy()) return;
  if (pageFromPath(window.location.pathname) !== "playground") return;
  if (!hasConnection()) {
    updateConnectionUI();
    return;
  }
  triggerSendButtonAnimation();
  performRequest(urlInput.value);
});

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return escapeHTML(value).replace(/"/g, "&quot;");
}

function unescapeHTML(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function responseLink(href, content) {
  return `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer" class="response-link">${content}</a>`;
}

function linkifyText(text) {
  return escapeHTML(text).replace(/https?:\/\/[^\s"'<>]+/g, (match) => {
    const trailing = match.match(/[),.;:!?\]]+$/)?.[0] || "";
    const href = match.slice(0, match.length - trailing.length);
    if (!isHttpUrl(unescapeHTML(href))) return match;
    return responseLink(unescapeHTML(href), href) + trailing;
  });
}

function syntaxHighlight(json) {
  json = escapeHTML(json);
  const len = json.length;
  let result = "";
  let i = 0;

  while (i < len) {
    const ch = json[i];

    if (ch === '"') {
      const start = i;
      i++;
      while (i < len) {
        if (json[i] === "\\") {
          i += 2;
        } else if (json[i] === '"') {
          i++;
          break;
        } else {
          i++;
        }
      }

      let j = i;
      while (j < len && json[j] === " ") j++;
      if (j < len && json[j] === ":") {
        result +=
          '<span class="text-cyan-400">' +
          json.slice(start, i) +
          '</span><span class="text-gray-500">:</span>';
        i = j + 1;
      } else {
        const content = json.slice(start + 1, i - 1);
        if (content.startsWith("http")) {
          const raw = unescapeHTML(content);
          if (isHttpUrl(raw)) {
            result += responseLink(
              raw,
              '<span class="text-emerald-400">' +
                json.slice(start, i) +
                "</span>",
            );
          } else {
            result +=
              '<span class="text-emerald-400">' +
              json.slice(start, i) +
              "</span>";
          }
        } else {
          result +=
            '<span class="text-emerald-400">' +
            json.slice(start, i) +
            "</span>";
        }
      }
    } else if (ch === "-" || (ch >= "0" && ch <= "9")) {
      const start = i;
      i++;
      while (
        i < len &&
        ((json[i] >= "0" && json[i] <= "9") ||
          json[i] === "." ||
          json[i] === "e" ||
          json[i] === "E" ||
          json[i] === "+" ||
          json[i] === "-")
      ) {
        i++;
      }
      result +=
        '<span class="text-orange-300">' + json.slice(start, i) + "</span>";
    } else if (json.startsWith("true", i)) {
      result += '<span class="text-purple-400">true</span>';
      i += 4;
    } else if (json.startsWith("false", i)) {
      result += '<span class="text-purple-400">false</span>';
      i += 5;
    } else if (json.startsWith("null", i)) {
      result += '<span class="text-gray-500">null</span>';
      i += 4;
    } else {
      result += ch;
      i++;
    }
  }
  return result;
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    if (isBusy()) return;
    sendBtn.click();
  }
});

window.addEventListener("online", updateConnectionUI);
window.addEventListener("offline", updateConnectionUI);

let serverUptimeTimestamp = null;

function parseUptimeSeconds(value) {
  if (typeof value === "number") {
    if (value > 1000000000) {
      return Math.floor(Date.now() / 1000) - value;
    }
    return value;
  }
  if (typeof value === "string") {
    const num = Number(value);
    if (!Number.isNaN(num) && num > 1000000000) {
      return Math.floor(Date.now() / 1000) - num;
    }
  }
  if (typeof value !== "string") return null;
  const parts = value.split(":").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function setUptimeFromJsonPayload(payload) {
  const info = Array.isArray(payload)
    ? payload.find((item) => item && typeof item === "object" && item.uptime)
    : payload;
  const uptimeVal = info?.uptime;
  if (uptimeVal === undefined || uptimeVal === null) return false;

  if (typeof uptimeVal === "string" && /^\d{10,}$/.test(uptimeVal)) {
    serverUptimeTimestamp = Number(uptimeVal);
  } else if (typeof uptimeVal === "number" && uptimeVal > 1000000000) {
    serverUptimeTimestamp = uptimeVal;
  } else {
    const seconds = parseUptimeSeconds(uptimeVal);
    if (seconds === null) return false;
    serverUptimeTimestamp = Math.floor(Date.now() / 1000) - seconds;
  }

  updateUptime();
  return true;
}

function updateUptime() {
  const uptimeDisplay = document.getElementById("uptimeDisplay");
  if (!uptimeDisplay || serverUptimeTimestamp === null) return;

  const diff = Math.floor(Date.now() / 1000) - serverUptimeTimestamp;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;

  uptimeDisplay.textContent = [h, m, s]
    .map((v) => v.toString().padStart(2, "0"))
    .join(":");
}

setInterval(updateUptime, 1000);

fetchInitialEndpoints().then(() => {
  renderCurrentPage();
  updateConnectionUI();

  // Final height adjustment after everything is loaded and rendered
  adjustHeight();

  const afterFontsReady = (fn) => {
    if (document.fonts) document.fonts.ready.then(fn);
    else fn();
  };

  // Also re-adjust when fonts are ready (prevents height jump from system font -> custom font)
  afterFontsReady(async () => {
    adjustHeight();
    syncStatusWidth();

    const updated = await refreshEndpointsFromJson();
    if (!updated) selectInitialEndpointFromCurrentCategory();
  });
});

// Mobile custom scrollbar — draggable, rAF-batched.
(() => {
  const track = document.getElementById("customScrollTrack");
  const thumb = document.getElementById("customScrollThumb");
  if (!track || !thumb) return;

  let isDragging = false;
  let dragStartY = 0;
  let dragStartScrollTop = 0;
  let lastClientY = 0;
  let dragRafId = null;
  let updateRafId = null;

  const update = () => {
    updateRafId = null;
    const { scrollHeight, clientHeight, scrollTop } = responseArea;
    const scrollable = scrollHeight - clientHeight;
    if (scrollable <= 1) {
      thumb.style.display = "none";
      return;
    }
    thumb.style.display = "";
    const trackHeight = track.clientHeight;
    const thumbHeight = Math.max(24, (clientHeight / scrollHeight) * trackHeight);
    const maxTop = trackHeight - thumbHeight;
    thumb.style.height = thumbHeight + "px";
    thumb.style.transform = `translateY(${(scrollTop / scrollable) * maxTop}px)`;
  };

  const scheduleUpdate = () => {
    if (updateRafId !== null) return;
    updateRafId = requestAnimationFrame(update);
  };

  const applyDrag = () => {
    if (!isDragging) { dragRafId = null; return; }
    const { scrollHeight, clientHeight } = responseArea;
    const scrollable = scrollHeight - clientHeight;
    const trackHeight = track.clientHeight;
    const thumbHeight = thumb.offsetHeight;
    const maxThumbTop = trackHeight - thumbHeight;
    if (maxThumbTop > 0) {
      const deltaY = lastClientY - dragStartY;
      const deltaRatio = deltaY / maxThumbTop;
      responseArea.scrollTop = dragStartScrollTop + deltaRatio * scrollable;
    }
    dragRafId = requestAnimationFrame(applyDrag);
  };

  const stopDrag = () => {
    if (!isDragging) return;
    if (dragRafId) cancelAnimationFrame(dragRafId);
    dragRafId = null;
    isDragging = false;
    thumb.classList.remove("dragging");
  };

  thumb.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    isDragging = true;
    dragStartY = e.clientY;
    lastClientY = e.clientY;
    dragStartScrollTop = responseArea.scrollTop;
    thumb.classList.add("dragging");
    thumb.setPointerCapture(e.pointerId);
    dragRafId = requestAnimationFrame(applyDrag);
  });

  thumb.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    lastClientY = e.clientY;
  });

  thumb.addEventListener("pointerup", stopDrag);
  thumb.addEventListener("pointercancel", stopDrag);

  track.addEventListener("pointerdown", (e) => {
    if (e.target === thumb) return;
    const trackRect = track.getBoundingClientRect();
    const clickRatio = (e.clientY - trackRect.top) / trackRect.height;
    const { scrollHeight, clientHeight } = responseArea;
    responseArea.scrollTop = clickRatio * (scrollHeight - clientHeight);
  });

  responseArea.addEventListener("scroll", scheduleUpdate, { passive: true });
  new ResizeObserver(scheduleUpdate).observe(responseArea);
  update();
})();