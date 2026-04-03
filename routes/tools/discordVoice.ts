import { Hono } from 'hono';
const app = new Hono();

import { DiscordVoice, getQuery, getToken } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

import { Context } from 'hono';

app.get('/discord/voice/deafen', async (c) => {
    const token = getToken(c);
    const guildId = getQuery(c, 'guildId');
    const userId = getQuery(c, 'userId');

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);
    if (!userId) return c.json({ error: "Missing valid parameter: userId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordVoice(token!, guildId, 'deafen', { userId }));
});

app.get('/discord/voice/undeafen', async (c) => {
    const token = getToken(c);
    const guildId = getQuery(c, 'guildId');
    const userId = getQuery(c, 'userId');

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);
    if (!userId) return c.json({ error: "Missing valid parameter: userId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordVoice(token!, guildId, 'undeafen', { userId }));
});

app.get('/discord/voice/mute', async (c) => {
    const token = getToken(c);
    const guildId = getQuery(c, 'guildId');
    const userId = getQuery(c, 'userId');

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);
    if (!userId) return c.json({ error: "Missing valid parameter: userId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordVoice(token!, guildId, 'mute', { userId }));
});

app.get('/discord/voice/unmute', async (c) => {
    const token = getToken(c);
    const guildId = getQuery(c, 'guildId');
    const userId = getQuery(c, 'userId');

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);
    if (!userId) return c.json({ error: "Missing valid parameter: userId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordVoice(token!, guildId, 'unmute', { userId }));
});

app.get('/discord/voice/kick', async (c) => {
    const token = getToken(c);
    const guildId = getQuery(c, 'guildId');
    const userId = getQuery(c, 'userId');

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);
    if (!userId) return c.json({ error: "Missing valid parameter: userId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordVoice(token!, guildId, 'kick', { userId }));
});

app.get('/discord/voice/muteall', async (c) => {
    const token = getToken(c);
    const guildId = getQuery(c, 'guildId');
    const channelId = getQuery(c, 'channelId');

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);
    if (!channelId) return c.json({ error: "Missing valid parameter: channelId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordVoice(token!, guildId, 'muteall', { channelId }));
});

app.get('/discord/voice/unmuteall', async (c) => {
    const token = getToken(c);
    const guildId = getQuery(c, 'guildId');
    const channelId = getQuery(c, 'channelId');

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);
    if (!channelId) return c.json({ error: "Missing valid parameter: channelId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordVoice(token!, guildId, 'unmuteall', { channelId }));
});

app.get('/discord/voice/deafall', async (c) => {
    const token = getToken(c);
    const guildId = getQuery(c, 'guildId');
    const channelId = getQuery(c, 'channelId');

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);
    if (!channelId) return c.json({ error: "Missing valid parameter: channelId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordVoice(token!, guildId, 'deafall', { channelId }));
});

app.get('/discord/voice/undeafall', async (c) => {
    const token = getToken(c);
    const guildId = getQuery(c, 'guildId');
    const channelId = getQuery(c, 'channelId');

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);
    if (!channelId) return c.json({ error: "Missing valid parameter: channelId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordVoice(token!, guildId, 'undeafall', { channelId }));
});

app.get('/discord/voice/kickall', async (c) => {
    const token = getToken(c);
    const guildId = getQuery(c, 'guildId');
    const channelId = getQuery(c, 'channelId');
    const authorId = getQuery(c, 'authorId');

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);
    if (!channelId) return c.json({ error: "Missing valid parameter: channelId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordVoice(token!, guildId, 'kickall', { channelId, authorId }));
});

app.get('/discord/voice/moveall', async (c) => {
    const token = getToken(c);
    const guildId = getQuery(c, 'guildId');
    const channelId = getQuery(c, 'channelId');
    const toChannelId = getQuery(c, 'toChannelId') || getQuery(c, 'to');

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);
    if (!channelId) return c.json({ error: "Missing valid parameter: channelId" }, 202);
    if (!toChannelId) return c.json({ error: "Missing valid parameter: toChannelId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordVoice(token!, guildId, 'moveall', { channelId, toChannelId }));
});

app.get('/discord/voice/list', async (c) => {
    const token = getToken(c);
    const guildId = getQuery(c, 'guildId');
    const channelId = getQuery(c, 'channelId');

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);
    if (!channelId) return c.json({ error: "Missing valid parameter: channelId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordVoice(token!, guildId, 'list', { channelId }));
});

export default app;