const port = 3000;
const g = globalThis as any;

g.__vgjr_refresh_count = (g.__vgjr_refresh_count || 0) + 1;
g.__vgjr_last_reload = Date.now();

const firstBoot = !g.__vgjr_initialized;
if (firstBoot) {
	g.__vgjr_starttime = Date.now();
	g.__vgjr_initialized = true;
}

const bootAt = Date.now();
const appPromise = import("./app.js");
// Warmups run off the app-ready path.
const warmupPromise = firstBoot
	? Promise.all([
			// Mint in a worker; request.ts adopts the token from globalThis.
			new Promise<void>((resolve) => {
				const bgWorker = new Worker(new URL("./functions/botguardWorker.ts", import.meta.url));
				const finish = () => {
					clearTimeout(bgTimer);
					bgWorker.terminate();
					resolve();
				};
				const bgTimer = setTimeout(() => {
					console.warn("[Botguard] worker warmup timed out");
					finish();
				}, 120_000);
				bgWorker.onmessage = (e) => {
					const data = e.data as { ok?: boolean; token?: { po_token: string; visitor_data: string }; error?: string };
					if (data?.ok && data.token?.po_token) {
						g.__vgjr_po_token = data.token;
						console.log("[Botguard] Initialized in worker");
					} else {
						console.warn("[Botguard] worker warmup failed:", data?.error ?? "unknown");
					}
					finish();
				};
				bgWorker.onerror = (e) => {
					console.warn("[Botguard] worker error:", e.message);
					finish();
				};
			}),

			// Skip the ~1s musicPlayer import entirely when no bot is configured — music routes lazy-load it on demand.
			(process.env.DISCORD_TOKENS || "").trim() ? import("./functions/musicPlayer.js").then(({ autoInit }) => autoInit()).catch(() => {}) : Promise.resolve(),
		]).then(async () => {
			// Browser tasks stay sequential: both go through the single serialized
			// browserRequest queue, so starting them together buys nothing.
			await import("./functions/browserRequest.js").then(({ warmBrowser }) => warmBrowser()).catch(() => {});
			// Prime Google trust cookies so the first search skips the cold solve.
			await import("./functions/googleTrust.js").then(({ warmGoogleTrust }) => warmGoogleTrust()).catch(() => {});
			// Collect Bing cookies so image searches ride a returning-visitor jar.
			await import("./functions/request.js").then(({ warmBingCookies }) => warmBingCookies()).catch(() => {});
		})
	: Promise.resolve();

appPromise.then(() => console.log(`✅ App ready in ${Date.now() - bootAt}ms`)).catch((e) => console.error("❌ App failed to load:", e));
if (firstBoot) warmupPromise.then(() => console.log(`✅ Warmup complete in ${Date.now() - bootAt}ms`));

if (firstBoot) {
	console.log(`\n🚀 Bun Server is running!`);
	console.log(`🏠 Local:    http://localhost:${port}/playground`);
	console.log(`App is loading, please wait...`);
	g.__vgjr_refresh_count = 0;
} else {
	console.log("🔄 Routes hot-reloaded!");
}

export default {
	port,
	hostname: "[::1]",
	idleTimeout: 255,
	async fetch(req: Request) {
		try {
			const { default: app } = await appPromise;
			return app.fetch(req);
		} catch (e) {
			console.error("App not ready:", e);
			return new Response("Service unavailable", { status: 503, headers: { "Retry-After": "2" } });
		}
	},
};
