import { Hono } from "hono";
const app = new Hono();

import {
  DiscordListMemberRole,
  PERMISSION_KEYS,
} from "../../functions/request.js";
import { dispatch } from "../../functions/httpRequest.js";

app.get("/discord/listMember/role", async (c) => {
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
    queryGuildId && /^\d+$/.test(queryGuildId) ? queryGuildId : null;

  const queryRoleId = c.req.query("roleId");
  const roleIds =
    queryRoleId
      ?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) || [];
  const roleId =
    roleIds.length > 0 && roleIds.every((id) => /^\d+$/.test(id))
      ? roleIds.join(",")
      : null;

  const validTypes = [
    "user",
    "bot",
    "all",
    "oldest",
    "newest",
    "oldest_position",
    "newest_position",
  ];
  const queryType = c.req.query("type") || "all";
  const types = queryType.split(",").map((t) => t.trim());
  const invalidTypes = types.filter((t) => !validTypes.includes(t));
  if (invalidTypes.length > 0) {
    return c.json({ error: `List types: ${validTypes.join(", ")}` }, 202);
  }
  const type = queryType;

  const permission = c.req.query("permission") || "all";
  if (permission !== "all") {
    const perms = permission.split(",").map((p) => p.trim().toLowerCase());
    const invalidPerms = perms.filter(
      (p) => !PERMISSION_KEYS.hasOwnProperty(p),
    );
    if (invalidPerms.length > 0) {
      return c.json(
        {
          error: `List permissions: all, ${Object.keys(PERMISSION_KEYS).join(", ")}`,
        },
        202,
      );
    }
  }

  if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
  if (!guildId)
    return c.json({ error: "Missing valid parameter: guildId" }, 202);
  if (!roleId) return c.json({ error: "Missing valid parameter: roleId" }, 202);

  c.header("X-Route", "discord.com");
  return await dispatch(c, () =>
    DiscordListMemberRole(token!, guildId!, roleId!, type, permission),
  );
});

export default app;
