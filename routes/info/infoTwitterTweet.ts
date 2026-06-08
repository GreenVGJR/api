import { Hono } from "hono";
const app = new Hono();

import { infoTwitterTweet } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/twitter/tweet", async (c) => {
  let query = c.req.query("url");
  if (query === undefined) {
    return c.json({ error: "Missing parameter required" }, 202);
  }
  query = query.match(
    /^(?:https?:\/\/)?(?:[A-Za-z0-9-]+\.)?(?:x\.com|twitter\.com)\/(?:(?:i\/web\/status)|(?:[^\/]+\/status))\/(\d{5,25})(?:\/[^\?#]*)?(?:[\?#].*)?$/,
  )?.[1];
  if (query === "" || query === undefined) {
    return c.json({ error: "Nothing to do" }, 202);
  }
  c.header("X-Route", "api.x.com, cdn.syndication.twimg.com");
  return await dispatch(c, () => infoTwitterTweet(query));
});

export default app;
