import { Hono } from 'hono';
const app = new Hono();

import { infoSoundcloud  } from '../../functions/request.js';
import { dispatch, blobDispatch  } from '../../functions/httpRequest.js';

app.get('/soundcloud', async (c) => {
    const query = c.req.query('url');
    if (query === undefined) {
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'api-v2.soundcloud.com');
    return await dispatch(c, () => infoSoundcloud(query));
});

export default app;