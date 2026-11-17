/**
 * Startup worker: pre-mints a YouTube poToken off the main thread.
 *
 * BotGuard needs jsdom + a JS interpreter + network calls, which would block
 * the server's event loop for seconds. The result is posted back and stashed
 * on globalThis by index.ts; request.ts adopts it in getPoToken().
 */

import { warmPoToken } from "./request.js";

declare const self: { postMessage(message: unknown): void };

try {
	const token = await warmPoToken();
	if (token?.po_token) {
		self.postMessage({ ok: true, token: { po_token: token.po_token, visitor_data: token.visitor_data } });
	} else {
		self.postMessage({ ok: false, error: "warmPoToken returned no token" });
	}
} catch (e) {
	self.postMessage({ ok: false, error: String(e).slice(0, 200) });
}
