import { Hono } from "hono";
import { dispatch } from "../../functions/httpRequest.js";
import { TimezoneInfo } from "../../functions/request.js";

const app = new Hono();

app.get("/timezone", async (c) => {
  const q = c.req.query("q");
  if (!q) {
    return c.json({ error: "Missing parameter 'q'" }, 202);
  }

  return await dispatch(c, () => TimezoneInfo(q));
});

export default app;
