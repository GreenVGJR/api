import { Hono } from 'hono';
import { dispatch } from '../../functions/httpRequest.js';
import { EmojiLookup } from '../../functions/request.js';

const app = new Hono();

app.get('/emoji', async (c) => {
    const q = c.req.query('q');
    if (q === undefined) {
        return c.json({ "error": "Missing parameter required" }, 202);
    }
    else if (q === '') {
        return c.json({ "error": "Nothing to do" }, 202);
    }

    const limitStr = c.req.query('limit');
    const parsedLimit = parseInt(limitStr || '25', 10);
    const limit = isNaN(parsedLimit) ? 25 : Math.max(1, parsedLimit);

    return await dispatch(c, () => EmojiLookup(q, limit));
});

export default app;
