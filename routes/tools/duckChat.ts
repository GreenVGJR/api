import { Hono } from "hono";
const app = new Hono();

import { dispatch } from "../../functions/httpRequest.js";
import { loadChatConversation } from "../../functions/cfPlayground.js";
import { DUCK_MODEL, duckChat } from "../../functions/request.js";

app.get("/chat/gpt/luna", async (c) => {
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
	return await dispatch(c, () => duckChat(DUCK_MODEL, prompt, loaded.conversation.id, loaded.conversation.turns));
});

export default app;
