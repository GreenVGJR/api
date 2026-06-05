import { Hono } from 'hono';
const app = new Hono();

import { DiscordInfoAutomod, DiscordSetAutomod, getToken } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

const parseSnowflake = (value: string | undefined) => (value && /^\d+$/.test(value)) ? value : null;

app.get('/discord/infoAutomod', async (c) => {
    const token = getToken(c);
    const guildId = parseSnowflake(c.req.query('guildId'));

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordInfoAutomod(token!, guildId!));
});

app.get('/discord/setAutomod', async (c) => {
    const token = getToken(c);
    const guildId = parseSnowflake(c.req.query('guildId'));
    const ruleId = parseSnowflake(c.req.query('ruleId')) || undefined;

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordSetAutomod(token, guildId, ruleId, c.req.query(), 'set'));
});

app.get('/discord/modifyAutomod', async (c) => {
    const token = getToken(c);
    const guildId = parseSnowflake(c.req.query('guildId'));
    const ruleId = parseSnowflake(c.req.query('ruleId'));

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);
    if (!ruleId) return c.json({ error: "Missing valid parameter: ruleId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordSetAutomod(token, guildId, ruleId, c.req.query(), 'modify'));
});

export default app;
