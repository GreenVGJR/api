import { Hono } from "hono";
const app = new Hono();

import { TrakteerProfile } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/trakteer", async (c) => {
  const query = c.req.query("q");
  if (query === undefined) {
    return c.json({ error: "Missing parameter required" }, 202);
  } else if (query === "") {
    return c.json({ error: "Nothing to do" }, 202);
  }

  c.header("X-Route", "trakteer.id");
  c.header("X-Ech-Target", "cloudflare-ech");

  return await dispatch(c, () => TrakteerProfile(query));
});

export default app;
