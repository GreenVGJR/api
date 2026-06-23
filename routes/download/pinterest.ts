import { Hono } from "hono";
const app = new Hono();
import { infoPinterest } from "../../functions/request.js";
import { rateLimit } from "../../functions/httpRequest.js";

app.get("/pinterest", async (c) => {
  const query = c.req.query("url");
  if (query === undefined) {
    return c.json({ error: "Missing parameter required" }, 202);
  } else if (query === "") {
    return c.json({ error: "Nothing to do" }, 202);
  }
  await rateLimit();
  const result = await infoPinterest(query);
  if (!result || !result.data) {
    return c.json({ error: "Pin not found" }, 404);
  }
  const first = result.data[0]?.data;
  if (!first) {
    return c.json({ error: "Pin not found" }, 404);
  }
  const videoUrl =
    first.videos?.video_list?.V_720P?.url ||
    first.videos?.video_list?.V_HLSV4?.url ||
    first.videos?.video_list?.V_480P?.url ||
    null;
  const imageUrl = first.images_orig?.url || first.imageLargeUrl || null;
  const target = videoUrl || imageUrl;
  const mediaType = videoUrl ? "video" : imageUrl ? "image" : null;
  if (!target) {
    return c.json({ error: "Media not found" }, 404);
  }
  c.header("X-Route", "www.pinterest.com");
  if (c.req.query("json") === "1") {
    return c.json({ url: target, type: mediaType });
  }
  return c.text(target, 302, { Location: target });
});

export default app;
