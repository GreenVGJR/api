import { Hono } from 'hono';
const app = new Hono();

const { request } = require('undici');
import { dispatch, blobDispatch  } from '../../functions/httpRequest.js';

app.get('/applemusic', async (c) => {
    const query = c.req.query('q');
    if(query === undefined) { 
return c.json({"error":"Missing parameter required"}, 202);
}
else if(query === '') {
return c.json({"error":"Nothing to do"}, 202);
}
    c.header('X-Route', 'itunes.apple.com, music.apple.com');

    const task = async () => {
        try {
        const [res, res2] = await Promise.all([
            request(`https://itunes.apple.com/search?media=music&limit=30&country=US&term=${query}`, { method: 'GET' }),
            request(`https://music.apple.com/us/search?term=${query}`, { method: 'GET' })
        ]);

        const lks = await res.body.json();
        const lks2 = await res2.body.text();
        let parselks2 = [];
        try {
            parselks2 = JSON.parse(lks2.split('id="serialized-server-data">')[1].split('</script>')[0]);
        }
        catch {}

        return { data: [lks?.results || null, parselks2?.[0]?.data?.sections || null]}
        }
        catch (e) {
            console.log(e);
        return null;
        }
    };

    return await dispatch(c, task);
});

export default app;