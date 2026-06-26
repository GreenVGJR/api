import { Hono } from "hono";
const app = new Hono();

import { ImageOCR } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/ocr", async (c) => {
  const imageUrl = c.req.query("imageUrl");
  if (imageUrl === undefined) {
    return c.json({ error: "Missing parameter required" }, 202);
  } else if (imageUrl === "") {
    return c.json({ error: "Nothing to do" }, 202);
  }
  return await dispatch(c, () => ImageOCR(imageUrl));
});

export default app;
