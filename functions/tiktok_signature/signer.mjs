// Credits:
// https://github.com/alana72212/TikTok-Signer
// (Testing only, might remove this someday)

import fs from "fs";
import vm from "vm";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function boot(userAgent) {
	const noop = function () {};
	const el = function () {
		return {
			style: {},
			setAttribute: noop,
			getAttribute() {
				return null;
			},
			appendChild: noop,
			removeChild: noop,
			remove: noop,
			addEventListener: noop,
			removeEventListener: noop,
			getContext() {
				return null;
			},
			querySelector() {
				return null;
			},
			querySelectorAll() {
				return [];
			},
			contains() {
				return false;
			},
			cloneNode: el,
			attributes: [],
			childNodes: [],
			children: [],
		};
	};
	const canvas = function () {
		const ctx = new Proxy(
			{},
			{
				get() {
					return noop;
				},
			},
		);
		return {
			width: 0,
			height: 0,
			style: {},
			getContext() {
				return ctx;
			},
			toDataURL() {
				return "data:image/png;base64,STUB" + this.width + "x" + this.height;
			},
		};
	};
	const store = function () {
		let m = {};
		return {
			getItem(k) {
				return k in m ? m[k] : null;
			},
			setItem(k, v) {
				m[k] = String(v);
			},
			removeItem(k) {
				delete m[k];
			},
			clear() {
				m = {};
			},
			key() {
				return null;
			},
			get length() {
				return 0;
			},
		};
	};
	const nav = {
		userAgent: userAgent,
		language: "en-US",
		languages: ["en-US", "en"],
		platform: "Win32",
		vendor: "Google Inc.",
		hardwareConcurrency: 8,
		deviceMemory: 8,
		maxTouchPoints: 0,
		webdriver: false,
		plugins: { length: 0 },
		mimeTypes: { length: 0 },
		cookieEnabled: true,
		product: "Gecko",
		appName: "Netscape",
		appVersion: "5.0",
		sendBeacon() {
			return true;
		},
		toString() {
			return "[object Navigator]";
		},
	};
	const loc = {
		href: "https://www.tiktok.com/",
		protocol: "https:",
		host: "www.tiktok.com",
		hostname: "www.tiktok.com",
		port: "",
		pathname: "/",
		search: "",
		hash: "",
		origin: "https://www.tiktok.com",
		assign: noop,
		replace: noop,
		reload: noop,
		toString() {
			return this.href;
		},
	};
	const doc = {
		cookie: "",
		readyState: "complete",
		referrer: "",
		title: "",
		characterSet: "UTF-8",
		documentElement: el(),
		head: el(),
		body: el(),
		location: loc,
		createElement(t) {
			return String(t).toLowerCase() === "canvas" ? canvas() : el();
		},
		createElementNS: el,
		getElementById() {
			return null;
		},
		getElementsByTagName() {
			return [];
		},
		getElementsByClassName() {
			return [];
		},
		querySelector() {
			return null;
		},
		querySelectorAll() {
			return [];
		},
		addEventListener: noop,
		removeEventListener: noop,
		createEvent() {
			return { initEvent: noop };
		},
		dispatchEvent() {
			return true;
		},
	};
	const start = 1700000000000;
	const win = {
		navigator: nav,
		document: doc,
		location: loc,
		screen: {
			width: 1920,
			height: 1080,
			availWidth: 1920,
			availHeight: 1040,
			colorDepth: 24,
			pixelDepth: 24,
		},
		history: { length: 1, pushState: noop, replaceState: noop },
		localStorage: store(),
		sessionStorage: store(),
		performance: {
			now() {
				return Date.now() - start;
			},
			timing: {},
			getEntriesByType() {
				return [];
			},
			mark: noop,
			measure: noop,
		},
		innerWidth: 1920,
		innerHeight: 1080,
		outerWidth: 1920,
		outerHeight: 1080,
		devicePixelRatio: 1,
		addEventListener: noop,
		removeEventListener: noop,
		dispatchEvent() {
			return true;
		},
		setTimeout() {
			return 0;
		},
		clearTimeout: noop,
		setInterval() {
			return 0;
		},
		clearInterval: noop,
		requestAnimationFrame() {
			return 0;
		},
		cancelAnimationFrame: noop,
		requestIdleCallback() {
			return 0;
		},
		atob(s) {
			return Buffer.from(s, "base64").toString("binary");
		},
		btoa(s) {
			return Buffer.from(s, "binary").toString("base64");
		},
		matchMedia() {
			return { matches: false, addListener: noop, removeListener: noop };
		},
		getComputedStyle() {
			return {
				getPropertyValue() {
					return "";
				},
			};
		},
		crypto: {
			getRandomValues(a) {
				for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
				return a;
			},
		},
		TextEncoder,
		TextDecoder,
		Uint8Array,
		Uint32Array,
		Int32Array,
		Float64Array,
		ArrayBuffer,
		DataView,
		Map,
		Set,
		WeakMap,
		WeakSet,
		Promise,
		Symbol,
		Proxy,
		Reflect,
		JSON,
		Math,
		Date,
		RegExp,
		Error,
		TypeError,
		String,
		Number,
		Boolean,
		Object,
		Array,
		Function,
		isNaN,
		isFinite,
		parseInt,
		parseFloat,
		encodeURIComponent,
		decodeURIComponent,
		encodeURI,
		decodeURI,
		console,
		XMLHttpRequest() {
			return {
				open: noop,
				send: noop,
				setRequestHeader: noop,
				addEventListener: noop,
				getAllResponseHeaders() {
					return "";
				},
				readyState: 0,
				status: 0,
				responseText: "",
			};
		},
		fetch() {
			return Promise.resolve({
				ok: true,
				status: 200,
				text() {
					return Promise.resolve("");
				},
				json() {
					return Promise.resolve({});
				},
				headers: {
					get() {
						return null;
					},
				},
			});
		},
		Request(i, init) {
			this.url = String(i);
			this.method = (init && init.method) || "GET";
			this.headers = (init && init.headers) || {};
			this.body = init && init.body;
		},
		Response(b, init) {
			this.body = b;
			this.status = (init && init.status) || 200;
			this.ok = true;
			this.headers = {
				get() {
					return null;
				},
			};
		},
		Headers() {
			const m = {};
			this.get = function (k) {
				return m[String(k).toLowerCase()] || null;
			};
			this.set = function (k, v) {
				m[String(k).toLowerCase()] = v;
			};
			this.append = this.set;
			this.has = function (k) {
				return String(k).toLowerCase() in m;
			};
		},
		URL,
		URLSearchParams,
		Blob: noop,
		FormData: noop,
		Event(t) {
			this.type = t;
		},
		CustomEvent(t, o) {
			this.type = t;
			this.detail = o && o.detail;
		},
		MutationObserver() {
			return { observe: noop, disconnect: noop };
		},
		queueMicrotask(f) {
			Promise.resolve().then(f);
		},
	};
	win.window = win;
	win.self = win;
	win.globalThis = win;
	win.top = win;
	win.parent = win;
	win.frames = win;

	vm.createContext(win);
	vm.runInContext(fs.readFileSync(join(__dirname, "sdk.js"), "utf8"), win, { filename: "sandbox.js" });
	return win;
}

function sign(opts) {
	opts = opts || {};
	if (!opts.url) {
		throw new Error("sign: url is required");
	}
	const g = boot(opts.userAgent);
	const r = g.__frame;
	const enc = r.o[980].v;
	r.o[854].v.envcode = opts.envcode >>> 0;
	r.o[854].v.encodedEnvcode = enc(String(opts.envcode >>> 0));
	r.o[979].v.ubcode = opts.ubcode >>> 0;
	r.o[979].v.encodedUbcode = enc(String(opts.ubcode >>> 0));
	r.o[854].v.msToken = opts.msToken == null ? "" : String(opts.msToken);
	return g.signer.v(opts.url, opts.body == null ? "" : opts.body, opts.body == null ? "" : opts.body, opts.perf || { txr: 0, tfr: 0, ixr: 0, ifr: 0 });
}

export default sign;
