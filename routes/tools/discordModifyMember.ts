import { Hono } from "hono";
const app = new Hono();

import { DiscordMember } from "../../functions/request.js";
import { dispatch, processImage } from "../../functions/httpRequest.js";

app.get("/discord/modifyMemberServer", async (c) => {
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
  const queryGuildId = c.req.query("guildId");
  const guildId =
    queryGuildId && Number.isInteger(parseInt(queryGuildId))
      ? queryGuildId
      : null;

  if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
  if (!guildId)
    return c.json({ error: "Missing valid parameter: guildId" }, 202);

  const getQuery = (key: string) => {
    const val = c.req.query(key);
    if (val === undefined) return undefined;
    if (val === "null") return null;
    return val;
  };

  const payload: any = {};
  const payloadError: string[] = [];

  const nickname = getQuery("nickname") ?? getQuery("nick");
  const reason = getQuery("reason");
  const bio = getQuery("bio");
  const reset = getQuery("reset");

  const avatar = getQuery("avatar");
  const banner = getQuery("banner");

  if (reset !== undefined) {
    payload.nick = null;
    payload.bio = null;
    payload.avatar = null;
    payload.banner = null;
  } else {
    if (nickname !== undefined) payload.nick = nickname;
    if (bio !== undefined) payload.bio = bio;

    if (avatar === null) {
      payload.avatar = null;
    } else if (avatar) {
      const pAvatar = await processImage(c, avatar);
      if (pAvatar == "") payloadError.push("[avatar] Failed to download image");
      if (pAvatar) payload.avatar = pAvatar;
    }

    if (banner === null) {
      payload.banner = null;
    } else if (banner) {
      const pBanner = await processImage(c, banner);
      if (pBanner == "") payloadError.push("[banner] Failed to download image");
      if (pBanner) payload.banner = pBanner;
    }
  }

  c.header("X-Route", "discord.com");
  return await dispatch(c, () =>
    DiscordMember(
      token!,
      guildId!,
      payload,
      payloadError,
      reason || undefined,
      reset !== undefined,
    ),
  );
});

export default app;
