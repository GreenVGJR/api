import { Hono } from "hono";
import { dispatch } from "../../functions/httpRequest.js";
const app = new Hono();
import { SPLyrics } from "../../functions/request.js";

app.get("/spotify", async (c) => {
  const query = c.req.query("q");
  if (query === undefined) {
    return c.json({ error: "Missing parameter required" }, 202);
  } else if (query === "") {
    return c.json({ error: "Nothing to do" }, 202);
  }
  c.header("X-Route", "spclient.wg.spotify.com");

  return await dispatch(c, () => SPLyrics(query!));
});

export default app;
