import app from "./app.js";
import { getBotGuardChallenge, getYoutubei } from "./functions/request.js";
import { getOCRWorker } from "./functions/ocrWorker.js";

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
