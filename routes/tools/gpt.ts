import { Hono } from "hono";
const app = new Hono();

import { OpenRouterGPT } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/chat/gpt", async (c) => {
  const query = c.req.query("prompt");
  if (query === undefined) {
    return c.json({ error: "Missing parameter required" }, 202);
  } else if (query === "") {
    return c.json({ error: "Nothing to do" }, 202);
  }
  const conversation = c.req.query("conversation");
  c.header("X-Route", "openrouter.ai");
  return await dispatch(c, () => OpenRouterGPT(query, conversation));
});

export default app;
