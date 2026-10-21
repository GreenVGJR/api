import { Hono } from "hono";
const app = new Hono();

import { dispatch } from "../../functions/httpRequest.js";
import { CHAT_LIMITS, CHAT_MODELS, cfChat, loadChatConversation, type ChatModel } from "../../functions/cfPlayground.js";

for (const name of Object.keys(CHAT_MODELS) as ChatModel[]) {
	app.get(`/chat/${name}`, async (c) => {
		const prompt = c.req.query("prompt");
		if (prompt === undefined) {
			return c.json({ error: "Missing parameter required" }, 202);
		} else if (prompt.trim() === "") {
			return c.json({ error: "Nothing to do" }, 202);
		} else if (prompt.length > CHAT_LIMITS.prompt) {
			return c.json({ error: `Prompt too long (max ${CHAT_LIMITS.prompt} characters)` }, 202);
		}
		if (c.req.url.length > CHAT_LIMITS.url) {
			return c.json({ error: "Request URL too long" }, 202);
		}

		const loaded = loadChatConversation(c.req.query("conversation"));
		if ("error" in loaded) {
			return c.json({ error: loaded.error }, 202);
		}

		c.header("X-Route", "playground.ai.cloudflare.com");
		return await dispatch(c, () => cfChat(name, prompt, loaded.conversation.id, loaded.conversation.turns));
	});
}

export default app;
