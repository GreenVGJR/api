import { Hono } from "hono";
const app = new Hono();

import { googleWeather } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/weather", async (c) => {
  const query = c.req.query("q");
  if (query === undefined) {
    return c.json({ error: "Missing parameter required" }, 202);
  } else if (query === "") {
    return c.json({ error: "Nothing to do" }, 202);
  }
  c.header("X-Route", "weather.googleapis.com, www.bing.com, www.google.com");
  return await dispatch(c, () => googleWeather(query));
});

export default app;
