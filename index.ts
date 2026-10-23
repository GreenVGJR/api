import app from "./app.js";
import { destroyAllPlayers } from "./functions/musicPlayer.js";

const port = 3000;
const g = globalThis as any;

g.__vgjr_refresh_count = (g.__vgjr_refresh_count || 0) + 1;
g.__vgjr_last_reload = Date.now();

if (!g.__vgjr_initialized) {
	(async () => {
		await Promise.all([
			import("./functions/musicPlayer.js").then(({ autoInit }) => autoInit()).catch(() => {}),
			import("./functions/browserRequest.js").then(({ warmBrowser }) => warmBrowser()).catch(() => {}),
			import("./functions/request.js").then(({ warmPoToken }) => warmPoToken()).catch(() => {}), // Prime poToken cache.
		]);
	})();

	console.log(`\n🚀 Bun Server is running!`);
	console.log(`🏠 Local:    http://localhost:${port}/playground`);
	g.__vgjr_initialized = true;
	g.__vgjr_starttime = Date.now();
	g.__vgjr_refresh_count = 0;

	if (!g.__vgjr_shutdown_handlers) {
		g.__vgjr_shutdown_handlers = true;
		process.on("SIGINT", async () => {
			console.log("\n[SIGINT] Shutting down music players...");
			await destroyAllPlayers().catch(() => {});
			await new Promise((r) => setTimeout(r, 500));
			process.exit(0);
		});
		process.on("SIGTERM", async () => {
			console.log("\n[SIGTERM] Shutting down music players...");
			await destroyAllPlayers().catch(() => {});
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
	fetch(req: Request) {
		return app.fetch(req);
	},
};
