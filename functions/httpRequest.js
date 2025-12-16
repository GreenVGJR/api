const { stream } = require('hono/streaming');
const crypto = require('crypto');

const dispatch = (c, promise) => {
    const pathHash = crypto.createHash('md5').update(c.req.path).digest('hex').slice(0, 8);
    const sh = c.req.query('sh');
    let isValid = sh && sh.length === 53 && sh.endsWith(pathHash);

    if (isValid) {
        const ts = parseInt(sh.slice(32, 45));
        const isForceRefresh = c.req.header('cache-control') === 'no-cache';
        
        if (isForceRefresh) {
            const timeDiff = Date.now() - ts;
            // If token is old (> 10s), invalidate to force a new one.
            if (timeDiff > 10000) {
                isValid = false;
            } else if (timeDiff > 3000) {
                // If token is fresh (< 10s) but not brand new (> 3s), 
                // it's likely a user spamming refresh. Return 204.
                return c.body(null, 204);
            }
            // If < 3s, allow it to pass (return 200) as it's the redirect follow-up.
        } else if (c.req.header('cache-control') === 'max-age=0') {
            return c.body(null, 204);
        }
    }

    if (!isValid) {
        if (!c.req.query('q')) return c.json(["Missing parameter required"], 202);

        const url = new URL(c.req.url);
        // proper structure: UUID (32) + Timestamp (13) + Hash (8) = 53 chars
        url.searchParams.set('sh', crypto.randomUUID().replaceAll('-', '') + Date.now() + pathHash);
        return c.redirect(url.toString());
    }
    c.header('Content-Type', 'application/json');
    return stream(c, async (stream) => {
        // Send initial response to establish stream
        const [_, data] = await Promise.all([
            stream.write(''),
            promise.catch((e) => {
                console.error('Promise error:', e);
                return null;
            })
        ]);
        if (!data) {
            await stream.write('null');
        } else if (typeof data === 'object') {
            await stream.write(JSON.stringify(data));
        } else {
            await stream.write(data);
        }
    });
};

module.exports = { dispatch };