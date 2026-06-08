import { Hono } from "hono";
const app = new Hono();

import { Genius } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/genius", async (c) => {
  const query = c.req.query("q");
  if (query === undefined) {
    return c.json({ error: "Missing parameter required" }, 202);
  } else if (query === "") {
    return c.json({ error: "Nothing to do" }, 202);
  }
  c.header("X-Route", "genius.com");
  c.header("X-Ech-Target", "genius");
  return await dispatch(c, () => Genius(query));
});

export default app;
