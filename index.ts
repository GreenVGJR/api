import app from "./app.js";
import { getBotGuardChallenge, getYoutubei } from "./functions/request.js";
import { getOCRWorker } from "./functions/ocrWorker.js";
import { destroyAllPlayers } from "./functions/musicPlayer.js";

const port = 3000;
const g = globalThis as any;

g.__vgjr_refresh_count = (g.__vgjr_refresh_count || 0) + 1;
g.__vgjr_last_reload = Date.now();

if (!g.__vgjr_initialized) {
	g.__vgjr_initialized = true;
	g.__vgjr_starttime = Date.now();
	g.__vgjr_refresh_count = 0;
	setTimeout(() => {
		import("./functions/musicPlayer.js")
			.then(({ autoInit }) => autoInit())
			.catch(() => {});
	}, 0);

	Promise.allSettled([getBotGuardChallenge(), getYoutubei(), getOCRWorker()])
		.then((results) => {
			const failed = results.find((result) => result.status === "rejected") as
				PromiseRejectedResult | undefined;
			if (failed) console.error("YouTube/OCR warmup failed:", failed.reason);
		})
		.catch((err) => {
			console.error("YouTube/OCR warmup failed:", err);
		});

	console.log(`\n🚀 Bun Server is running!`);
	console.log(`🏠 Local:    http://localhost:${port}/playground`);
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
	hostname: "::1",
	idleTimeout: 255,
	fetch(req: Request) {
		return app.fetch(req);
	},
};
