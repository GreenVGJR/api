import { Hono } from 'hono';
const app = new Hono();

import { OtoDB } from '../../functions/request.js';
import { dispatch, blobDispatch } from '../../functions/httpRequest.js';

app.get('/otodb', async (c) => {
    return c.text('Unavailable For Legal Reasons', 451);
    const query = c.req.query('q');
    if (query === undefined) {
        return c.json({ "error": "Missing parameter required" }, 202);
    }
    else if (query === '') {
        return c.json({ "error": "Nothing to do" }, 202);
    }
    c.header('X-Route', 'otodb.net');
    // @ts-ignore
    return await dispatch(c, () => OtoDB(query));
});

export default app;