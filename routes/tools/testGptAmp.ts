import { Hono } from 'hono';
const app = new Hono();

import { Chatplus  } from '../../functions/request.js';
import { dispatch, blobDispatch  } from '../../functions/httpRequest.js';

app.get('/chat/meta', async (c) => {
    const query = c.req.query('prompt');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'www.meta.com');
    return await dispatch(c, () => Chatplus(query));
});

export default app;