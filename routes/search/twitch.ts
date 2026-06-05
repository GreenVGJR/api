import { Hono } from 'hono';
const app = new Hono();

import { Twitch  } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

app.get('/twitch', async (c) => {
    const query = c.req.query('q');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'gql.twitch.tv');
    return await dispatch(c, () => Twitch(query));
});

export default app;
