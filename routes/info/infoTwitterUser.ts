import { Hono } from 'hono';
const app = new Hono();

import { infoTwitterUser  } from '../../functions/request';
import { dispatch, blobDispatch  } from '../../functions/httpRequest';

app.get('/twitter/user', async (c) => {
    const query = c.req.query('q');
    if (query === undefined) {
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'api.x.com, syndication.twitter.com');
    return await dispatch(c, () => infoTwitterUser(query));
});

export default app;