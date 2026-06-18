import { Hono } from "hono";
const app = new Hono();

import { SnapchatProfile } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/snapchat", async (c) => {
  const query = c.req.query("q");
  if (query === undefined) {
    return c.json({ error: "Missing parameter required" }, 202);
  } else if (query === "") {
    return c.json({ error: "Nothing to do" }, 202);
  }

  c.header("X-Route", "www.snapchat.com");

  return await dispatch(c, () => SnapchatProfile(query));
});

export default app;
