import { Hono } from 'hono';
import crypto from 'crypto';
const app = new Hono();

app.get('/md5', async (c) => {
    const query = c.req.query('q');
    if (query === undefined) {
        return c.json({ "error": "Missing parameter required" }, 202);
    }
    else if (query === '') {
        return c.json({ "error": "Nothing to do" }, 202);
    }
    return c.json({ value: crypto.createHash("md5").update(query).digest("hex") })
});

export default app;