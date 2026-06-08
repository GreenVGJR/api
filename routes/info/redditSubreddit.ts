import { Hono } from "hono";
const app = new Hono();

import { redditSubreddit } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/reddit/subreddit", async (c) => {
  const query = c.req.query("q");
  if (query === undefined) {
    return c.json({ error: "Missing parameter required" }, 202);
  } else if (query === "") {
    return c.json({ error: "Nothing to do" }, 202);
  }
  c.header("X-Route", "www.reddit.com");
  return await dispatch(c, () => redditSubreddit(query));
});

export default app;
