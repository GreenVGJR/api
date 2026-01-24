import { Hono } from 'hono';
const app = new Hono();

import { redditMedia  } from '../../functions/request.js';
import { dispatch, blobDispatch  } from '../../functions/httpRequest.js';

app.get('/reddit/media', async (c) => {
    const query = c.req.query('q');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'old.reddit.com');
    return await dispatch(c, () => redditMedia(query));
});

export default app;