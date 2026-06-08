{{SSR_STATE}}
if (window.location.pathname === "/") {
  window.location.replace("/playground");
}

// Initialize layout and Tailwind config dynamically
const initSPA = () => {
  // Inject Fonts
  const fontsLink = document.createElement("link");
  fontsLink.rel = "stylesheet";
  fontsLink.href =
    "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap";
  document.head.appendChild(fontsLink);

  // Build the UI structure
  document.body.className =
    "bg-black text-white font-sans antialiased overflow-hidden";
  document.body.innerHTML = `
    <div class="h-dvh flex flex-col max-w-5xl xl:max-w-[84rem] mx-auto px-4 sm:px-6 py-3 sm:py-6">
        <section id="playgroundView" class="flex flex-col flex-1 min-h-0">
        <div class="flex flex-col xl:grid xl:grid-cols-[150px_minmax(0,64rem)_150px] gap-1.5 xl:gap-4 flex-1 min-h-0">
            <aside class="overflow-x-auto xl:overflow-y-auto flex-shrink-0 xl:h-full min-h-0 border-b border-dark-700 xl:border-b-0 xl:border-r xl:border-dark-700 xl:pr-3 pb-1.5 xl:pb-0 no-scrollbar">
                <nav class="flex xl:flex-col gap-1.5" aria-label="Page navigation">
                    <a href="/playground" data-page-link class="page-link block px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 hover:text-white whitespace-nowrap transition-colors" data-page="playground">Playground</a>
                    <a href="/terms" data-page-link class="page-link block px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 hover:text-white whitespace-nowrap transition-colors" data-page="terms">Terms</a>
                    <a href="/privacy" data-page-link class="page-link block px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 hover:text-white whitespace-nowrap transition-colors" data-page="privacy">Privacy</a>
                </nav>
            </aside>

            <div class="flex flex-col flex-1 min-h-0 min-w-0">
                <div id="urlBar" class="relative mb-3 sm:mb-4 flex-shrink-0">
                    <div class="flex items-center bg-black/60 rounded-lg sm:rounded-xl border border-dark-500 overflow-hidden focus-within:border-white/20 transition-colors">
                        <textarea id="urlInput" class="flex-1 bg-transparent py-2 sm:py-3 px-3 sm:px-4 font-mono text-xs sm:text-sm text-white placeholder-gray-600 outline-none resize-none overflow-x-auto whitespace-nowrap focus:whitespace-pre-wrap focus:break-all focus:overflow-x-auto no-scrollbar" placeholder="https://api.vgjr.top/search/youtube/video?q=" spellcheck="false" autocomplete="off" rows="1"></textarea>
                        <button id="copyBtn" class="copy-btn cursor-pointer p-3 text-gray-500 hover:text-mint-400 transition-colors" title="Copy URL">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                    </div>
                </div>

                <div id="categoryTabs" class="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4 flex-shrink-0 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar" aria-label="Endpoint categories">
                    <button class="tab-btn cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="search">Search</button>
                    <button class="tab-btn cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="profile">Profile</button>
                    <button class="tab-btn cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="lyrics">Lyrics</button>
                    <button class="tab-btn cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="tools">Tools</button>
                    <button class="tab-btn cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="info">Info</button>
                    <button class="tab-btn cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="download">Download</button>
                    <button class="tab-btn cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium border border-dark-500 text-gray-300 hover:border-gray-500 whitespace-nowrap" data-category="music">Music</button>
                </div>

                <div id="workspaceGrid" class="flex flex-col md:grid md:grid-cols-[260px_1fr] gap-1.5 md:gap-4 flex-1 min-h-0">
                    <div id="endpointPane" class="overflow-y-auto pr-1 flex-[3] md:flex-none md:h-full min-h-0 border-b border-dark-700 md:border-b-0 pb-1.5 md:pb-0 no-scrollbar">
                        <div id="endpointsList" class="space-y-1"></div>
                    </div>

                    <div class="flex flex-col min-h-0 min-w-0 overflow-hidden flex-[6] md:flex-[7]">
                        <div class="bg-dark-700/30 panel-gradient rounded-lg sm:rounded-xl border border-dark-500 flex-1 overflow-hidden flex flex-col min-h-0">
                            <div id="responseHeader" class="flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2 border-b border-dark-500 flex-shrink-0">
                                <span class="text-xs text-gray-500 font-mono"><span id="responseTitle" class="font-semibold text-gray-400">Response</span> | <span id="uptimeDisplay" class="text-gray-500">00:00:00</span></span>
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
                            <div id="responseArea" class="response-area font-mono text-sm text-gray-300 p-3 sm:p-4 overflow-auto flex-1 empty-state w-0 min-w-full">
                                <span class="text-white-500">What you gonna try?</span>
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

                        <div id="sendRow" class="mt-2 sm:mt-3 flex flex-col md:flex-row items-center gap-2 sm:gap-4 flex-shrink-0">
                            <button id="sendBtn" class="w-full md:flex-1 text-black font-semibold py-2 sm:py-2.5 px-5 sm:px-6 rounded-lg text-sm sm:text-base transition-colors flex items-center justify-center gap-2 cursor-pointer outline-none focus:outline-none active:outline-none">
                                <span class="send-label">Send</span><span class="send-arrow">➜</span>
                            </button>
                            <div id="statusIndicator" class="flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-mono w-full md:w-auto">
                                <span class="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-gray-500"></span><span id="statusText" class="text-gray-500">Ready</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="hidden xl:block" aria-hidden="true"></div>
        </div>
        </section>

        <footer class="mt-3 sm:mt-4 flex flex-col items-center md:flex-row md:items-center md:justify-between text-gray-600 text-xs flex-shrink-0 gap-1.5 sm:gap-2 md:gap-0 pb-1 sm:pb-2 w-full max-w-5xl mx-auto">
            <div class="flex flex-col items-center md:items-start space-y-0.5 sm:space-y-1">
                <p>Built with <span class="text-mint-400">♥</span></p>
                <p class="flex items-center gap-1 sm:gap-1.5">
                    <span>AI-Generated by</span>
                    <a href="https://claude.ai" target="_blank" class="inline-flex items-center gap-1 text-[#D97757] hover:underline"><span>Claude</span></a>
                    <span>and</span>
                    <a href="https://gemini.google.com" target="_blank" class="inline-flex items-center gap-1 hover:underline"><span class="bg-gradient-to-r from-[#1BA1E3] via-[#9B72CB] to-[#F49C46] bg-clip-text text-transparent">Gemini</span></a>
                </p>
            </div>
            <div class="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-gray-500">
                <a href="https://github.com/GreenVGJR/api" target="_blank" class="hover:text-mint-400 transition-colors">Source Code</a><span class="text-dark-500">|</span><a href="https://status.vgjr.top" target="_blank" class="hover:text-mint-400 transition-colors">Status Page</a><span class="text-dark-500">|</span><a href="https://ko-fi.com/greenvgjr" target="_blank" class="hover:text-mint-400 transition-colors">Support Me?</a>
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
  music: [],
};

let currentCategory = "search";
let currentEndpoint = { path: "/loading...", query: "", types: [] };
let isLoading = false;
let lastRawResponse = "";
let isCoolingDown = false;

const apiBaseUrl = window.API_BASE_URL || "https://api.vgjr.top";

if (window.SERVER_ENDPOINTS) {
  try {
    endpoints = window.SERVER_ENDPOINTS;
  } catch {}
}

const urlInput = document.getElementById("urlInput");
const copyBtn = document.getElementById("copyBtn");
const copyResponseBtn = document.getElementById("copyResponseBtn");
const clearResponseBtn = document.getElementById("clearResponseBtn");
const sendBtn = document.getElementById("sendBtn");
const sendBtnLabel = sendBtn.querySelector(".send-label");
const responseArea = document.getElementById("responseArea");
const statusIndicator = document.getElementById("statusIndicator");
const statusText = document.getElementById("statusText");
const workspaceGrid = document.getElementById("workspaceGrid");
const endpointPane = document.getElementById("endpointPane");
const endpointsList = document.getElementById("endpointsList");
const tabBtns = document.querySelectorAll(".tab-btn");
const categoryTabs = document.getElementById("categoryTabs");
const urlBar = document.getElementById("urlBar");
const responseHeader = document.getElementById("responseHeader");
const responseTitle = document.getElementById("responseTitle");
const responseActions = document.getElementById("responseActions");
const sendRow = document.getElementById("sendRow");
const paramsPanel = document.getElementById("paramsPanel");
const paramsToggle = document.getElementById("paramsToggle");
const paramsBody = document.getElementById("paramsBody");
const paramsContainer = document.getElementById("paramsContainer");
const paramsCount = document.getElementById("paramsCount");
const paramsChevron = document.getElementById("paramsChevron");

document.addEventListener("click", () => closeEnumDropdowns());
window.addEventListener("resize", () => closeEnumDropdowns());

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

function renderLegalPage(page) {
  const legal = legalPages[page];
  if (!legal) return;

  if (animationTimeout) clearTimeout(animationTimeout);
  endpointsList.classList.remove("is-animating");
  endpointsList.innerHTML = "";

  responseArea.classList.remove("empty-state", "font-mono");
  responseArea.classList.add("font-sans");
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

  urlBar.classList.add("hidden");
  categoryTabs.classList.add("hidden");
  endpointPane.classList.add("hidden");
  workspaceGrid.style.gridTemplateColumns = "minmax(0, 1fr)";
  responseHeader.classList.add("hidden");
  responseActions.classList.add("hidden");
  sendRow.classList.add("hidden");
  paramsPanel.classList.add("hidden");
  paramsBody.style.height = null;
  paramsChevron.classList.remove("rotated");
  tabBtns.forEach((btn) => btn.classList.remove("active"));
  responseTitle.textContent = legal.title;
  lastRawResponse = legal.sections
    .map(([title, text]) => `${title}\n${text}`)
    .join("\n\n");
  activePage = page;
}

function renderPlaygroundPage() {
  urlBar.classList.remove("hidden");
  categoryTabs.classList.remove("hidden");
  endpointPane.classList.remove("hidden");
  workspaceGrid.style.gridTemplateColumns = "";
  responseHeader.classList.remove("hidden");
  responseActions.classList.remove("hidden");
  sendRow.classList.remove("hidden");
  responseTitle.textContent = "Response";
  responseArea.classList.add("font-mono");
  responseArea.classList.remove("font-sans");

  if (activePage && activePage !== "playground") {
    lastRawResponse = "";
    responseArea.classList.add("empty-state");
    responseArea.innerHTML =
      '<span class="text-white-500">What you gonna try?</span>';
    statusIndicator.querySelector("span:first-child").className =
      "w-2 h-2 rounded-full bg-gray-500";
    statusText.textContent = "Ready";
    statusText.className = "text-gray-500";
  }

  renderEndpoints();
  renderParams();
  tabBtns.forEach((btn) => btn.classList.remove("active"));
  const activeTab = document.querySelector(
    `.tab-btn[data-category="${currentCategory}"]`,
  );
  if (activeTab) activeTab.classList.add("active");
  activePage = "playground";
}

function renderCurrentPage() {
  const page = pageFromPath(window.location.pathname);
  const isLegalPage = page === "terms" || page === "privacy";

  document.title = isLegalPage
    ? `${legalPages[page].title} | VGJR`
    : "Playground | VGJR";
  setPageLinkState(page);

  if (isLegalPage) {
    renderLegalPage(page);
    responseArea.scrollTop = 0;
  } else {
    renderPlaygroundPage();
  }
  updateConnectionUI();
}

document.addEventListener("click", (event) => {
  const clickTarget = event.target instanceof Element ? event.target : null;
  const link = clickTarget?.closest("[data-page-link]");
  if (!link) return;

  const href = link.getAttribute("href");
  if (!href) return;

  const targetUrl = new URL(href, window.location.origin);
  if (targetUrl.origin !== window.location.origin) return;

  const nextPage = pageFromPath(targetUrl.pathname);
  if (!["playground", "terms", "privacy"].includes(nextPage)) return;

  event.preventDefault();
  if (targetUrl.pathname !== window.location.pathname) {
    history.pushState({}, "", targetUrl.pathname);
  }
  renderCurrentPage();
});

window.addEventListener("popstate", renderCurrentPage);

let paramsOpen = window.innerWidth >= 768;
let currentParams = [];

urlInput.value = apiBaseUrl + (apiBaseUrl.endsWith("/") ? "" : "/");

function adjustHeight() {
  urlInput.style.height = "auto";
  const newHeight = Math.min(urlInput.scrollHeight, 100);
  urlInput.style.height = newHeight + "px";
  urlInput.style.overflowY = urlInput.scrollHeight > 100 ? "auto" : "hidden";
}

adjustHeight();
urlInput.addEventListener("input", adjustHeight);
urlInput.addEventListener("focus", () => setTimeout(adjustHeight, 0));
window.addEventListener("resize", adjustHeight);

function updateStatusUI(ok, status, duration) {
  const statusDot = statusIndicator.querySelector("span:first-child");
  if (ok) {
    statusDot.className = "w-2 h-2 rounded-full bg-mint-400";
    statusText.textContent = `${status} • ${duration}ms`;
    statusText.className = "text-mint-400";
  } else {
    statusDot.className = "w-2 h-2 rounded-full bg-red-500";
    statusText.textContent = `${status} • ${duration}ms`;
    statusText.className = "text-red-400";
  }
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
  const statusDot = statusIndicator.querySelector("span:first-child");

  if (!hasConnection()) {
    setSendButtonLabel("No Connection");
    sendBtn.classList.add("opacity-50", "cursor-not-allowed");
    sendBtn.classList.remove("opacity-70");

    if (!isLoading) {
      statusDot.className = "w-2 h-2 rounded-full bg-red-500";
      statusText.textContent = "Offline";
      statusText.className = "text-red-400";
    }
    return false;
  }

  if (!isLoading && !isCoolingDown) {
    setSendButtonLabel("Send");
    sendBtn.classList.remove("opacity-50", "cursor-not-allowed", "opacity-70");

    if (statusText.textContent === "Offline") {
      statusDot.className = "w-2 h-2 rounded-full bg-gray-500";
      statusText.textContent = "Ready";
      statusText.className = "text-gray-500";
    }
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

function formatVerboseHeaders(headers) {
  return Object.entries(headers)
    .map(([key, value]) => `> ${key}: ${value}`)
    .join("\n");
}

function createVerboseFetchView(targetUrl, fetchOptions) {
  const requestUrl = new URL(targetUrl);
  const method = (fetchOptions?.method || "GET").toUpperCase();
  const headers = fetchOptions?.headers || {};
  const startedAt = performance.now();
  const lines = [
    `* URL: ${requestUrl.href}`,
    `* Host: ${requestUrl.host}`,
    `* Scheme: ${requestUrl.protocol.replace(":", "")}`,
    `* Method: ${method}`,
    `> ${method} ${requestUrl.pathname}${requestUrl.search}`,
    `> Host: ${requestUrl.host}`,
    formatVerboseHeaders(headers),
    `* Request dispatched`,
  ].filter(Boolean);

  responseArea.classList.add("empty-state");
  responseArea.innerHTML = `
        <div class="relative w-full h-full min-h-[180px] overflow-hidden rounded-lg">
            <pre id="verboseFetchLog" class="absolute inset-0 overflow-auto no-scrollbar whitespace-pre-wrap break-all p-3 sm:p-4 text-[10px] sm:text-xs leading-5 text-gray-600 blur-[0.2px] opacity-70 select-text"></pre>
            <div id="verboseFetchOverlay" class="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/10">
                <span class="waiting-loading text-sm sm:text-base">Fetching...</span>
            </div>
        </div>
    `;

  const logEl = document.getElementById("verboseFetchLog");
  const overlayEl = document.getElementById("verboseFetchOverlay");

  const render = () => {
    if (!logEl) return;
    logEl.textContent = lines.join("\n");
    logEl.scrollTop = logEl.scrollHeight;
  };

  render();

  return {
    line(text) {
      const elapsed = Math.round(performance.now() - startedAt);
      lines.push(`* [${elapsed}ms] ${text}`);
      render();
    },
    response(response) {
      const elapsed = Math.round(performance.now() - startedAt);
      lines.push(
        `< HTTP ${response.status} ${response.statusText || ""}`.trimEnd(),
      );
      response.headers.forEach((value, key) =>
        lines.push(`< ${key}: ${value}`),
      );
      lines.push(`* [${elapsed}ms] Response headers received`);
      render();
    },
    done(label = "Response body received") {
      const elapsed = Math.round(performance.now() - startedAt);
      lines.push(`* [${elapsed}ms] ${label}`);
      render();
      if (overlayEl)
        overlayEl.innerHTML =
          '<span class="waiting-loading text-sm sm:text-base">Rendering response...</span>';
    },
    fail(error) {
      const elapsed = Math.round(performance.now() - startedAt);
      lines.push(`* [${elapsed}ms] Fetch failed: ${error?.message || error}`);
      render();
    },
  };
}

async function performRequest(targetUrl, retryCount = 0) {
  if (retryCount === 0 && (isLoading || isCoolingDown)) return null;
  if (retryCount === 0 && !hasConnection()) {
    updateConnectionUI();
    return null;
  }
  let verboseFetch = null;

  if (retryCount === 0) {
    isLoading = true;
    setSendButtonLabel("Loading...");
    sendBtn.classList.add("opacity-70");
    responseArea.classList.add("empty-state");
    responseArea.innerHTML =
      '<span class="text-gray-500 flex h-full items-center justify-center">Fetching...</span>';

    statusIndicator.querySelector("span:first-child").className =
      "w-2 h-2 rounded-full bg-yellow-400 animate-pulse";
    statusText.textContent = "Fetching";
    statusText.className = "text-yellow-400";
  }

  let resultData = null;

  try {
    const startTime = performance.now();
    const parseUrl = new URL(targetUrl);
    const headers = {
      Accept: "application/json",
    };
    headers["x-tel-data"] = btoa(
      JSON.stringify([
        [
          String(screen.height),
          String(screen.width),
          String(window.innerHeight),
          String(window.innerWidth),
          String(lastCursorX ?? ""),
          String(lastCursorY ?? ""),
        ],
        solvedChallengeCode !== null,
        window.location.pathname,
      ]),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    if (solvedChallengeCode && parseUrl.pathname.startsWith("/music/")) {
      headers["x-challenge-codes"] = solvedChallengeCode;
      headers["x-challenge"] = formatChallengeHash(md5(solvedChallengeCode));
    }

    const fetchOptions = { headers, mode: "same-origin" };
    verboseFetch = createVerboseFetchView(targetUrl, fetchOptions);
    verboseFetch.line("Waiting for response headers...");
    const response = await fetch(targetUrl, fetchOptions);
    verboseFetch.response(response);

    statusText.textContent = "Fetching";

    const contentType = response.headers.get("content-type") || "";
    let duration;

    if (contentType.startsWith("image/")) {
      verboseFetch.line("Reading image body...");
      const blob = await response.blob();
      duration = Math.round(performance.now() - startTime);
      verboseFetch.done(
        `Image body received (${blob.size.toLocaleString()} bytes)`,
      );
      updateStatusUI(response.ok, response.status, duration);
      const imageUrl = URL.createObjectURL(blob);

      lastRawResponse = "";

      responseArea.classList.add("empty-state");
      responseArea.innerHTML = `
                <div class="w-full h-full flex items-center justify-center p-4">
                    <img src="${imageUrl}" alt="API Response" class="max-w-full max-h-full rounded-lg shadow-lg" style="object-fit: contain;" />
                </div>
            `;
    } else if (
      (contentType.startsWith("video/") ||
        contentType === "application/octet-stream") &&
      response.headers.get("x-player") !== "lavalink"
    ) {
      verboseFetch.line("Reading binary body...");
      const blob = await response.blob();
      duration = Math.round(performance.now() - startTime);
      verboseFetch.done(
        `Binary body received (${blob.size.toLocaleString()} bytes)`,
      );
      updateStatusUI(response.ok, response.status, duration);
      const videoUrl = URL.createObjectURL(blob);

      lastRawResponse = "";

      responseArea.classList.add("empty-state");
      responseArea.innerHTML = `
                <div class="w-full h-full flex items-center justify-center p-4">
                    <video src="${videoUrl}" controls class="max-w-full max-h-full rounded-lg shadow-lg" style="object-fit: contain;"></video>
                </div>
            `;
    } else {
      responseArea.classList.remove("empty-state");

      verboseFetch.line("Reading response body...");
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let text;
      const isGzip =
        bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
      if (isGzip) {
        verboseFetch.line("Decompressing gzip body...");
        text = await new Response(
          new Blob([arrayBuffer])
            .stream()
            .pipeThrough(new DecompressionStream("gzip")),
        ).text();
        verboseFetch.done(
          `Decompressed body received (${text.length.toLocaleString()} chars)`,
        );
      } else {
        text = new TextDecoder().decode(arrayBuffer);
        verboseFetch.done(
          `Text body received (${text.length.toLocaleString()} chars)`,
        );
      }
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
            responseArea.innerHTML =
              '<div class="loading flex h-full flex-col items-center justify-center text-center"><span class="text-white">Solving challenges...</span><span class="mt-2 text-xs text-gray-400">This may take a while</span></div>';
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
      } catch {}

      lastRawResponse = decryptedText;

      responseArea.innerHTML =
        '<pre style=\"white-space: pre-wrap; word-break: break-all; overflow-wrap: anywhere;\"></pre>';
      const preElement = responseArea.querySelector("pre");

      if (!isJson) {
        preElement.innerHTML = linkifyText(formatted);
      } else {
        const lines = formatted.split("\n");
        const CHUNK_SIZE = 1;
        let chunkIndex = 0;

        const processChunk = () => {
          if (chunkIndex >= lines.length) return;

          const deadline = performance.now() + 10;
          const fragments = [];

          while (chunkIndex < lines.length && performance.now() < deadline) {
            const end = Math.min(chunkIndex + CHUNK_SIZE, lines.length);
            const chunkLines = lines.slice(chunkIndex, end);
            const chunkString = chunkLines.join("\n");
            const highlighted = syntaxHighlight(chunkString);
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
      }
    }
  } catch (err) {
    verboseFetch?.fail(err);
    responseArea.classList.remove("empty-state");
    responseArea.innerHTML = `<span class="text-red-400">Error: ${err.message}</span>`;
    statusIndicator.querySelector("span:first-child").className =
      "w-2 h-2 rounded-full bg-red-500";
    statusText.textContent = "Failed";
    statusText.className = "text-red-400";
  } finally {
    if (retryCount === 0) {
      isLoading = false;
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
  return (
    "?" +
    params
      .map((p) => {
        // Ensure values are fully encoded (slashes, colons, etc)
        const encodedValue = encodeURIComponent(decodeURIComponent(p.value));
        return `${encodeURIComponent(p.key)}=${encodedValue}`;
      })
      .join("&")
  );
}

const PARAM_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "url",
  "enum",
  "json",
]);

function parseParamTypeSpec(typeSpec) {
  const spec = String(typeSpec || "");
  const separatorIndex = spec.indexOf(":");
  const rawType = separatorIndex === -1 ? spec : spec.slice(0, separatorIndex);
  const type = PARAM_TYPES.has(rawType) ? rawType : "string";
  const options =
    type === "enum" && separatorIndex !== -1
      ? spec
          .slice(separatorIndex + 1)
          .split(",")
          .map((option) => option.trim())
          .filter(Boolean)
      : [];

  return { type, options };
}

function normalizeParamType(typeSpec) {
  return parseParamTypeSpec(typeSpec).type;
}

function buildEndpointUrl(endpoint) {
  if (!endpoint) return apiBaseUrl;
  const cleanBase = apiBaseUrl.replace(/\/$/, "");
  const cleanPath = endpoint.path.startsWith("/")
    ? endpoint.path
    : "/" + endpoint.path;
  return cleanBase + cleanPath + (endpoint.query || "");
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

  return `
        <input
            type="text"
            class="param-input"
            data-param-index="${i}"
            value="${escapeAttribute(value)}"
            placeholder="${escapeAttribute(type)}"
            ${titleAttr}
            spellcheck="false"
            autocomplete="off"
        />
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
  paramsBody.style.height = Math.min(paramsContainer.offsetHeight, 250) + "px";
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

function syncEnumControlsFromInputs() {
  paramsContainer.querySelectorAll(".param-enum").forEach((control) => {
    const hiddenInput = control.querySelector(".param-enum-value-input");
    if (hiddenInput) setEnumControlValue(control, hiddenInput.value, false);
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
      option.addEventListener("click", (e) => {
        e.stopPropagation();
        setEnumControlValue(control, option.dataset.value || "");
        closeMenu();
        button.focus();
      });

      option.addEventListener("keydown", (e) => {
        const options = Array.from(menu.querySelectorAll(".param-enum-option"));
        const currentIndex = options.indexOf(option);

        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEnumControlValue(control, option.dataset.value || "");
          closeMenu();
          button.focus();
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

function renderParams() {
  paramsPanel.classList.remove("hidden");

  if (!currentEndpoint || !currentEndpoint.query) {
    currentParams = [];
  } else {
    currentParams = parseQueryParams(
      currentEndpoint.query,
      currentEndpoint.types || [],
    );
  }

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

  setTimeout(() => {
    if (currentParams.length > 0) {
      if (window.innerWidth >= 768) {
        paramsChevron.classList.add("rotated");
        paramsOpen = true;
        updateParamsBodyHeight();
      } else {
        paramsChevron.classList.remove("rotated");
        paramsOpen = false;
        paramsBody.style.height = null;
      }
    } else {
      paramsChevron.classList.remove("rotated");
      paramsOpen = false;
      paramsBody.style.height = null;
    }
  }, 0);
}

function syncParamsToUrl() {
  const queryString = buildQueryString(currentParams);
  const cleanBase = apiBaseUrl.replace(/\/$/, "");
  const path = currentEndpoint ? currentEndpoint.path : "/";
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

  if (paramsOpen) {
    updateParamsBodyHeight();
  } else {
    closeEnumDropdowns();
    paramsBody.style.height = null;
  }
});

async function fetchInitialEndpoints() {
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

  const firstTab = document.querySelector(
    `.tab-btn[data-category="${currentCategory}"]`,
  );
  if (firstTab) firstTab.classList.add("active");
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

    animationTimeout = setTimeout(() => {
      const newLayer = endpointsList.querySelector(".swipe-layer.new");
      if (newLayer) {
        endpointsList.innerHTML = newLayer.innerHTML;
        endpointsList.classList.remove("is-animating");
        attachEndpointListeners();
      }
      animationTimeout = null;
    }, 350);
  } else {
    endpointsList.classList.remove("is-animating");
    endpointsList.innerHTML = `<div class="space-y-1">${newHTML}</div>`;
    attachEndpointListeners();
  }
}

function attachEndpointListeners() {
  endpointsList.querySelectorAll(".endpoint-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = parseInt(btn.dataset.index);
      currentEndpoint = endpoints[currentCategory][index];
      urlInput.value = buildEndpointUrl(currentEndpoint);
      adjustHeight();
      renderEndpoints();
      renderParams();

      tabBtns.forEach((b) => b.classList.remove("active"));
      const activeTab = document.querySelector(
        `.tab-btn[data-category="${currentCategory}"]`,
      );
      if (activeTab) activeTab.classList.add("active");
    });
  });
}

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const nextCategory = btn.dataset.category;
    const wasLegalPage =
      pageFromPath(window.location.pathname) !== "playground";

    // Prevent re-rendering and animating if clicking the already active tab
    if (!wasLegalPage && currentCategory === nextCategory) return;

    const wasOpen = !wasLegalPage && paramsOpen;

    if (wasOpen) {
      paramsBody.style.height = null;
      paramsChevron.classList.remove("rotated");
    }

    setTimeout(
      () => {
        if (wasLegalPage) history.pushState({}, "", "/playground");

        tabBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentCategory = nextCategory;
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
      },
      wasOpen ? 50 : 0,
    );
  });
});

urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !isLoading) {
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
  lastRawResponse = "";
  responseArea.classList.add("empty-state");
  responseArea.innerHTML =
    '<span class="text-white-500">What you gonna try?</span>';
  statusIndicator.querySelector("span:first-child").className =
    "w-2 h-2 rounded-full bg-gray-500";
  statusText.textContent = "Ready";
  statusText.className = "text-gray-500";
  updateConnectionUI();
});

sendBtn.addEventListener("click", () => {
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

let lastCursorX = null;
let lastCursorY = null;
document.addEventListener("mousemove", (e) => {
  lastCursorX = e.clientX;
  lastCursorY = e.clientY;
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    sendBtn.click();
  }
});

window.addEventListener("online", updateConnectionUI);
window.addEventListener("offline", updateConnectionUI);

function updateUptime() {
  const uptimeDisplay = document.getElementById("uptimeDisplay");
  if (!uptimeDisplay || !window.SERVER_STARTTIME) return;

  const diff = Math.floor((Date.now() - window.SERVER_STARTTIME) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;

  uptimeDisplay.textContent = [h, m, s]
    .map((v) => v.toString().padStart(2, "0"))
    .join(":");
}

setInterval(updateUptime, 1000);
updateUptime();

fetchInitialEndpoints().then(() => {
  renderCurrentPage();
  updateConnectionUI();

  // Final height adjustment after everything is loaded and rendered
  setTimeout(adjustHeight, 0);

  // Also re-adjust when fonts are ready (prevents height jump from system font -> custom font)
  if (document.fonts) {
    document.fonts.ready.then(() => {
      adjustHeight();
    });
  }
});
