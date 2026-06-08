import { Hono } from "hono";
const app = new Hono();

import { DriftProfile } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/drift", async (c) => {
  const query = c.req.query("q");
  if (query === undefined) {
    return c.json({ error: "Missing parameter required" }, 202);
  } else if (query === "") {
    return c.json({ error: "Nothing to do" }, 202);
  }

  c.header("X-Route", "drift.rip");
  c.header("X-Ech-Target", "cloudflare-ech");

  return await dispatch(c, () => DriftProfile(query));
});

export default app;
