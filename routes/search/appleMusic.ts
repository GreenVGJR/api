import { Hono } from 'hono';
const app = new Hono();

import { request, commonHeaders } from '../../functions/request.js';
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
            const [res, res2, res3, res4, res5, res6] = await Promise.all([
                request(`https://itunes.apple.com/search?media=music&limit=20&country=US&term=${encodeURIComponent(query)}`, { 
                    method: 'GET',
                    headers: commonHeaders
                }),
                request(`https://music.apple.com/us/search?term=${encodeURIComponent(query)}`, { 
                    method: 'GET',
                    headers: commonHeaders
                }),
                request(`https://itunes.apple.com/search?media=audiobook&limit=20&country=US&term=${encodeURIComponent(query)}`, { 
                    method: 'GET',
                    headers: commonHeaders
                }),
                request(`https://itunes.apple.com/search?media=podcast&limit=20&country=US&term=${encodeURIComponent(query)}`, { 
                    method: 'GET',
                    headers: commonHeaders
                }),
                request(`https://itunes.apple.com/search?media=musicVideo&limit=20&country=US&term=${encodeURIComponent(query)}`, { 
                    method: 'GET',
                    headers: commonHeaders
                }),
                request(`https://itunes.apple.com/search?media=tvShow&limit=20&country=US&term=${encodeURIComponent(query)}`, { 
                    method: 'GET',
                    headers: commonHeaders
                }),
            ]);

            const [lks, lks2, lks3, lks4, lks5, lks6]: any = await Promise.all([
                res.body.json(),
                res2.body.text(),
                res3.body.json(),
                res4.body.json(),
                res5.body.json(),
                res6.body.json(),
            ]);

            let parselks2: any = [];
            try {
                const serverDataMatch = lks2.match(/<script[^>]*id=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/);
                if (serverDataMatch) {
                    parselks2 = JSON.parse(serverDataMatch[1]);
                }
            }
            catch (e) {
                console.error("Apple Music parse error:", e);
            }

            return { data: [{
                music: lks?.results || null,
                musicVideo: lks5?.results || null,
                audiobook: lks3?.results || null,
                podcast: lks4?.results || null,
                tvShow: lks5?.results || null
            },
            parselks2?.data?.[0]?.data?.sections || null
            ]}
        }
        catch (e) {
            console.log(e);
            return null;
        }
    };

    return await dispatch(c, task);
});

export default app;
