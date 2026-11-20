import { Hono } from "hono";
const app = new Hono();

import { dispatch } from "../../functions/httpRequest.js";
import { loadChatConversation } from "../../functions/cfPlayground.js";
import { duckChat } from "../../functions/request.js";

const DUCK_ENDPOINTS: Record<string, string> = {
	"/chat/gpt/luna": "gpt-6-luna",
	"/chat/gpt/mini": "gpt-5.4-mini",
	"/chat/haiku": "claude-haiku-5-5",
	"/chat/mistral": "mistral-small-2603",
};

for (const [path, model] of Object.entries(DUCK_ENDPOINTS)) {
	app.get(path, async (c) => {
		const prompt = c.req.query("prompt");
		if (prompt === undefined) {
			return c.json({ error: "Missing parameter required" }, 202);
		} else if (prompt.trim() === "") {
			return c.json({ error: "Nothing to do" }, 202);
		}

		const loaded = loadChatConversation(c.req.query("conversation"));
		if ("error" in loaded) {
			return c.json({ error: loaded.error }, 202);
		}

		c.header("X-Route", "duck.ai");
		return await dispatch(c, () => duckChat(model, prompt, loaded.conversation.id, loaded.conversation.turns));
	});
}

export default app;
