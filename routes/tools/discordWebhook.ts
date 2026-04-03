import { Hono } from 'hono';
const app = new Hono();

import { DiscordWebhook, getQuery, getToken } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

import { Context } from 'hono';

app.get('/discord/webhook/info', async (c) => {
    const token = getToken(c);
    let webhookId = getQuery(c, 'webhookId');
    const webhookToken = getQuery(c, 'webhookToken');
    const webhookUrl = getQuery(c, 'webhookUrl');

    if (webhookUrl && !webhookId) {
        const match = webhookUrl.match(/webhooks\/(\d+)/);
        if (match) webhookId = match[1];
    }

    if (!webhookUrl && !token && !webhookToken) return c.json({ error: "Missing valid parameter: token or webhookToken or webhookUrl" }, 202);
    if (!webhookUrl && !webhookId) return c.json({ error: "Missing valid parameter: webhookId or webhookUrl" }, 202);

    c.header('X-Route', 'discord.com');
    // @ts-ignore
    return await dispatch(c, () => DiscordWebhook(token, webhookId, { action: 'info', webhookToken, webhookUrl }, []));
});

app.get('/discord/webhook/create', async (c) => {
    const token = getToken(c);
    const channelId = getQuery(c, 'channelId');
    const name = getQuery(c, 'name');
    const avatar = getQuery(c, 'avatar');

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!channelId) return c.json({ error: "Missing valid parameter: channelId" }, 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordWebhook(token!, channelId!, { action: 'create', name, avatar }, []));
});

app.get('/discord/webhook/delete', async (c) => {
    const token = getToken(c);
    let webhookId = getQuery(c, 'webhookId');
    const webhookToken = getQuery(c, 'webhookToken');
    const webhookUrl = getQuery(c, 'webhookUrl');

    if (webhookUrl && !webhookId) {
        const match = webhookUrl.match(/webhooks\/(\d+)/);
        if (match) webhookId = match[1];
    }

    if (!webhookUrl && !token && !webhookToken) return c.json({ error: "Missing valid parameter: token or webhookToken or webhookUrl" }, 202);
    if (!webhookUrl && !webhookId) return c.json({ error: "Missing valid parameter: webhookId or webhookUrl" }, 202);

    c.header('X-Route', 'discord.com');
    // @ts-ignore
    return await dispatch(c, () => DiscordWebhook(token, webhookId, { action: 'delete', webhookToken, webhookUrl }, []));
});

app.get('/discord/webhook/send', async (c) => {
    const token = getToken(c);
    const webhookId = getQuery(c, 'webhookId');
    const webhookToken = getQuery(c, 'webhookToken');
    const webhookUrl = getQuery(c, 'webhookUrl');

    const content = getQuery(c, 'content');
    const username = getQuery(c, 'username');
    const avatar_url = getQuery(c, 'avatar');

    if (!webhookUrl && !webhookToken) return c.json({ error: "Missing valid parameter: webhookToken or webhookUrl" }, 202);
    if (!webhookUrl && !webhookId) return c.json({ error: "Missing valid parameter: webhookId or webhookUrl" }, 202);

    c.header('X-Route', 'discord.com');
    // @ts-ignore
    return await dispatch(c, () => DiscordWebhook(token, webhookId, {
        action: 'send',
        webhookToken,
        webhookUrl,
        content,
        username,
        avatar_url
    }, []));
});

app.get('/discord/webhook/list', async (c) => {
    const token = getToken(c);
    const channelId = getQuery(c, 'channelId');

    if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
    if (!channelId) return c.json({ error: "Missing valid parameter: channelId" }, 202);

    c.header('X-Route', 'discord.com');
    // @ts-ignore
    return await dispatch(c, () => DiscordWebhook(token, channelId, { action: 'list' }, []));
});

export default app;