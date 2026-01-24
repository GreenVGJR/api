import { Hono } from 'hono';
const app = new Hono();

import { Shazam  } from '../../functions/request';
import { dispatch, blobDispatch  } from '../../functions/httpRequest';

app.get('/shazam', async (c) => {
    const query = c.req.query('q');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'www.shazam.com');
    return await dispatch(c, () => Shazam(query));
});

export default app;