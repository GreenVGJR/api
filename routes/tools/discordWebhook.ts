import { Hono } from 'hono';
const app = new Hono();

import { DiscordWebhook  } from '../../functions/request.js';
import { dispatch  } from '../../functions/httpRequest.js';

import { Context } from 'hono';

const getQuery = (c: Context, key: string) => {
    const val = c.req.query(key);
    if (val === undefined) return undefined;
    if (val === 'null') return null;
    return val;
};

const getToken = (c: Context) => {
    try {
        const token = c.req.query('token');
        if (!token) return null;
        const checktoken = Number.isInteger(parseInt(atob(token.split('.')[0])));
        return checktoken ? token : null;
    } catch {
        return null;
    }
};

app.get('/discord/webhook/info', async (c) => {
    const token = getToken(c);
    const webhookId = getQuery(c, 'webhookId');
    const webhookToken = getQuery(c, 'webhookToken');
    const webhookUrl = getQuery(c, 'webhookUrl');

    if (!webhookUrl && !token && !webhookToken) return c.json(["Missing valid parameter: token or webhookToken"], 202);
    if (!webhookUrl && !webhookId) return c.json(["Missing valid parameter: webhookId"], 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordWebhook(token!, webhookId!, { action: 'info', webhookToken, webhookUrl }, []));
});

app.get('/discord/webhook/create', async (c) => {
    const token = getToken(c);
    const channelId = getQuery(c, 'channelId');
    const name = getQuery(c, 'name');
    const avatar = getQuery(c, 'avatar');

    if (!token) return c.json(["Missing valid parameter: token"], 202);
    if (!channelId) return c.json(["Missing valid parameter: channelId"], 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordWebhook(token!, channelId!, { action: 'create', name, avatar }, []));
});

app.get('/discord/webhook/delete', async (c) => {
    const token = getToken(c);
    const webhookId = getQuery(c, 'webhookId');
    const webhookToken = getQuery(c, 'webhookToken');
    const webhookUrl = getQuery(c, 'webhookUrl');

    if (!webhookUrl && !token && !webhookToken) return c.json(["Missing valid parameter: token or webhookToken"], 202);
    if (!webhookUrl && !webhookId) return c.json(["Missing valid parameter: webhookId"], 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordWebhook(token!, webhookId!, { action: 'delete', webhookToken, webhookUrl }, []));
});

app.get('/discord/webhook/send', async (c) => {
    const token = getToken(c);
    const webhookId = getQuery(c, 'webhookId');
    const webhookToken = getQuery(c, 'webhookToken');
    const webhookUrl = getQuery(c, 'webhookUrl');

    const content = getQuery(c, 'content');
    const username = getQuery(c, 'username');
    const avatar_url = getQuery(c, 'avatar');
 
    if (!webhookUrl && !webhookToken) return c.json(["Missing valid parameter: webhookToken or webhookUrl"], 202);
    if (!webhookUrl && !webhookId) return c.json(["Missing valid parameter: webhookId"], 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordWebhook(token!, webhookId!, { 
        action: 'send', 
        webhookToken, 
        webhookUrl,
        content,
        username,
        avatar_url
    }, []));
});

export default app;
