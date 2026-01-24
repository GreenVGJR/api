import { Hono } from 'hono';
const app = new Hono();

import { SCMusic  } from '../../functions/request';
import { dispatch, blobDispatch  } from '../../functions/httpRequest';

app.get('/soundcloud', async (c) => {
    const query = c.req.query('q');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'api-v2.soundcloud.com, mobi.soundcloud.com');
    return await dispatch(c, () => SCMusic(query));
});

export default app;