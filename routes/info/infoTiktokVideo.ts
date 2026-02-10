import { Hono } from 'hono';
import { TiktokVideo } from '../../functions/request.js';
import { dispatch } from '../../functions/httpRequest.js';

const app = new Hono();

app.get('/tiktok/video', async (c) => {
    const q = c.req.query('q');
    
    if (q === undefined) {
        return c.json({"error":"Missing parameter required"}, 202);
    }
    else if(q === '') {
        return c.json({"error":"Nothing to do"}, 202);
    }
    
    c.header('X-Route', 'www.tiktok.com');
    return await dispatch(c, () => TiktokVideo(q));
});

export default app;
