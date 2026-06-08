import { Hono } from "hono";
const app = new Hono();

import { DiscordInfoMessage } from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/discord/infoMessage", async (c) => {
  let token: string | null = null;
  try {
    const queryToken = c.req.query("token");
    if (queryToken) {
      const checktoken = Number.isInteger(
        parseInt(atob(queryToken.split(".")[0])),
      );
      if (!checktoken) throw new Error();
      token = queryToken;
    }
  } catch {}

  const queryChannelId = c.req.query("channelId");
  const channelId =
    queryChannelId && Number.isInteger(parseInt(queryChannelId))
      ? queryChannelId
      : null;

  const queryMessageId = c.req.query("messageId");
  const messageId =
    queryMessageId && Number.isInteger(parseInt(queryMessageId))
      ? queryMessageId
      : null;

  if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
  if (!channelId)
    return c.json({ error: "Missing valid parameter: channelId" }, 202);
  if (!messageId)
    return c.json({ error: "Missing valid parameter: messageId" }, 202);

  c.header("X-Route", "discord.com");
  return await dispatch(c, () =>
    DiscordInfoMessage(token!, channelId!, messageId!),
  );
});

export default app;
