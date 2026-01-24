import { Hono } from 'hono';
const app = new Hono();

import { TiktokVideo  } from '../../functions/request.js';
import { dispatch, blobDispatch  } from '../../functions/httpRequest.js';

app.get('/tiktok/video', async (c) => {
    const query = c.req.query('q');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'api-boot.tiktokv.com');
    return await dispatch(c, () => TiktokVideo(query));
});

export default app;