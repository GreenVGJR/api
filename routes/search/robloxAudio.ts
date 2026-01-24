import { Hono } from 'hono';
const app = new Hono();

import { robloxAudio  } from '../../functions/request';
import { dispatch  } from '../../functions/httpRequest';

app.get('/roblox/audio', async (c) => {
    const query = c.req.query('q');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'apis.roblox.com, thumbnails.roblox.com');
    return await dispatch(c, () => robloxAudio(query));
});

export default app;
