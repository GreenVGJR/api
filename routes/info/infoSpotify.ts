import { Hono } from 'hono';
const app = new Hono();

import { infoSpotify  } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

app.get('/spotify', async (c) => {
    const query = c.req.query('url');
    if (query === undefined) {
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'open.spotify.com');
    return await dispatch(c, () => infoSpotify(query));
});

export default app;
