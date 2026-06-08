import { Hono } from "hono";
import { dispatch } from "../../functions/httpRequest.js";
const app = new Hono();
import { YTMusic, YTLyrics } from "../../functions/request.js";

app.get("/youtube", async (c) => {
  const query = c.req.query("q");
  if (query === undefined) {
    return c.json({ error: "Missing parameter required" }, 202);
  } else if (query === "") {
    return c.json({ error: "Nothing to do" }, 202);
  }
  c.header("X-Route", "m.youtube.com");

  const task = async () => {
    let q = query;
    let isUrl = false;
    let item: any = null;
    try {
      new URL(q!);
      isUrl = true;
    } catch {}

    try {
      if (!isUrl) {
        const tes = await YTMusic(q!);
        item = tes?.data?.[0];
        const videoId = item?.videoId;

        if (videoId) {
          q = "https://youtu.be/" + videoId;
        }
      }
      const a = await YTLyrics(q!, item);
      return a;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  return await dispatch(c, task);
});

export default app;
