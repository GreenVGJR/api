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
const warmupPromise = firstBoot
	? Promise.all([
			import("./functions/musicPlayer.js").then(({ autoInit }) => autoInit()).catch(() => {}),
			import("./functions/browserRequest.js").then(({ warmBrowser }) => warmBrowser()).catch(() => {}),
			import("./functions/request.js").then(({ warmPoToken }) => warmPoToken()).catch(() => {}), // Prime poToken cache.
		])
	: Promise.resolve();

appPromise.then(() => console.log(`✅ App ready in ${Date.now() - bootAt}ms`)).catch((e) => console.error("❌ App failed to load:", e));
if (firstBoot) warmupPromise.then(() => console.log(`✅ Warmup complete in ${Date.now() - bootAt}ms`));

if (firstBoot) {
	console.log(`\n🚀 Bun Server is running!`);
	console.log(`🏠 Local:    http://localhost:${port}/playground`);
	console.log(`App is loading, please wait...`);
	g.__vgjr_refresh_count = 0;

	if (!g.__vgjr_shutdown_handlers) {
		g.__vgjr_shutdown_handlers = true;
		const shutdown = async () => {
			const { destroyAllPlayers } = await import("./functions/musicPlayer.js").catch(() => ({ destroyAllPlayers: async () => {} }));
			await destroyAllPlayers().catch(() => {});
		};
		process.on("SIGINT", async () => {
			console.log("\n[SIGINT] Shutting down music players...");
			await shutdown();
			await new Promise((r) => setTimeout(r, 500));
			process.exit(0);
		});
		process.on("SIGTERM", async () => {
			console.log("\n[SIGTERM] Shutting down music players...");
			await shutdown();
			await new Promise((r) => setTimeout(r, 500));
			process.exit(0);
		});
	}
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
