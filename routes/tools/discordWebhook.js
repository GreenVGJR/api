"use strict";

const { Hono } = require('hono');
const app = new Hono();

const { DiscordWebhook } = require('../../functions/request');
const { dispatch } = require('../../functions/httpRequest');

const getToken = (c) => {
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
    const webhookId = c.req.query('webhookId');
    const webhookToken = c.req.query('webhookToken');

    if (!token && !webhookToken) return c.json(["Missing valid parameter: token or webhookToken"], 202);
    if (!webhookId) return c.json(["Missing valid parameter: webhookId"], 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordWebhook(token, webhookId, { action: 'info', webhookToken }, []));
});

app.get('/discord/webhook/create', async (c) => {
    const token = getToken(c);
    const channelId = c.req.query('channelId');
    const name = c.req.query('name');
    const avatar = c.req.query('avatar');

    if (!token) return c.json(["Missing valid parameter: token"], 202);
    if (!channelId) return c.json(["Missing valid parameter: channelId"], 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordWebhook(token, channelId, { action: 'create', name, avatar }, []));
});

app.get('/discord/webhook/delete', async (c) => {
    const token = getToken(c);
    const webhookId = c.req.query('webhookId');
    const webhookToken = c.req.query('webhookToken');

    if (!token && !webhookToken) return c.json(["Missing valid parameter: token or webhookToken"], 202);
    if (!webhookId) return c.json(["Missing valid parameter: webhookId"], 202);

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => DiscordWebhook(token, webhookId, { action: 'delete', webhookToken }, []));
});

module.exports = app;
