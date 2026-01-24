import { Hono } from 'hono';
const app = new Hono();

import { infoYoutube, infoYoutubeChannel  } from '../../functions/request';
import { dispatch, blobDispatch  } from '../../functions/httpRequest';

app.get('/youtube/video', async (c) => {
    const query = c.req.query('url');
    if (query === undefined) {
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'm.youtube.com, www.youtube.com');
    return await dispatch(c, () => infoYoutube(query));
});

app.get('/youtube/channel', async (c) => {
    const query = c.req.query('url');
    if (query === undefined) {
        return c.json({"error":"Missing parameter required"}, 202);
    }
    else if(query === '') {
        return c.json({"error":"Nothing to do"}, 202);
    }
    c.header('X-Route', 'm.youtube.com, www.youtube.com');
    return await dispatch(c, () => infoYoutubeChannel(query));
});

export default app;