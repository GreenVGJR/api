import { Hono } from "hono";
const app = new Hono();

import { Jiosaavn } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/jiosaavn", async (c) => {
  const query = c.req.query("q");
  if (query === undefined) {
    return c.json({ error: "Missing parameter required" }, 202);
  } else if (query === "") {
    return c.json({ error: "Nothing to do" }, 202);
  }
  c.header("X-Route", "www.jiosaavn.com");
  return await dispatch(c, () => Jiosaavn(query));
});

export default app;
