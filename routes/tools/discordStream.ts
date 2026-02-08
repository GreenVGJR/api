import { Hono } from 'hono';
const app = new Hono();

import { DiscordStream } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

app.get('/discord/stream', async (c) => {
    const token = c.req.query('token');
    const channelId = c.req.query('channelId');
    const messageId = c.req.query('messageId');
    const url = c.req.query('url');
    const clone = c.req.query('clone') === 'true';
    const onEmbed = c.req.query('onEmbed') === 'true';
    const awemeId = c.req.query('awemeId');

    c.header('X-Route', 'discord.com');
    // @ts-ignore
    return await dispatch(c, () => DiscordStream(token, channelId, messageId, url, clone, onEmbed, awemeId));
});

export default app;
