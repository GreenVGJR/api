const { stream } = require('hono/streaming');
const crypto = require('crypto');
const { getCookie, setCookie, deleteCookie } = require('hono/cookie');
const { generate_hash } = require('../config.json');

const blobDispatch = async (c, body, headers) => {
  try {
    if (c.req.method !== 'GET') return c.text('', 200);
  } catch {
    return c.text('', 200);
  }

  if (Object.entries(c.req.queries()).length !== 1) {
    return c.text('Forbidden', 403);
  }

  c.header('X-Enc-Route', 'v2');
  
  const type = headers?.get ? headers.get('content-type') : headers?.['content-type'];
  const filtype1 = type?.split('/')?.[0];
  const defaultExtensions = {
    'video': 'mp4',
    'image': 'png',
    'audio': 'mp3',
    'text': 'plain',
    'application': 'octet-stream'
  };
  const subtype = type?.split('/')?.[1]?.split(';')?.[0];
  const filtype2 = subtype === '*' ? (defaultExtensions[filtype1] || null) : subtype;
  const contentType = filtype2 ? `${filtype1}/${filtype2}` : (type || 'application/octet-stream');
  
  c.header('Content-Type', contentType);
  c.header('Cache-Control', 'no-transform');
  
  return stream(c, async (s) => {
    s.onAbort(() => {});

    if (c.req.raw.signal.aborted) return;

    try {
      let resolvedBody = typeof body === 'function' ? body() : body;
      if (resolvedBody instanceof Promise) resolvedBody = await resolvedBody;

      if (c.req.raw.signal.aborted) return;

      if (resolvedBody?.ok === false) {
          console.error(`blobDispatch: Upstream returned status ${resolvedBody.status}`);
          await s.write(JSON.stringify({ error: `Upstream returned ${resolvedBody.status}` }));
          return;
      }

      const dataToPipe = resolvedBody?.body || resolvedBody;
      if (dataToPipe) {
        if (dataToPipe.getReader || dataToPipe.pipeTo) {
          await s.pipe(dataToPipe);
        } else if (dataToPipe.pipe) {
          const { Readable } = require('stream');
          await s.pipe(Readable.toWeb(dataToPipe));
        } else {
          await s.write(dataToPipe);
        }
      }
    } catch (err) {}
  });
};

const dispatch = async (c, promiseFactory) => {
  try {
  if(c.req.method !== 'GET') return c.text('', 200);
  }
  catch {
    return c.text('', 200);
  }
  if(generate_hash) {
    const sh = c.req.query('sh') || '';
    const ua = c.req.header('user-agent') || '';
    const uaHash = crypto.createHash('md5').update(ua).digest('hex').slice(0, 8);
    const checkcookie = getCookie(c, '_sign');
    
    // Use URL searchParams for consistent query hashing
    const urlObj = new URL(c.req.url);
    const queryKeys = Array.from(urlObj.searchParams.keys()).filter(k => k !== 'sh').sort();
    const queryStr = queryKeys.map(k => `${k}=${urlObj.searchParams.get(k)}`).join('&');

    const providedUaHash = sh.slice(0, 8);
    const providedQHash = sh.slice(8, 16);
    const ts = parseInt(sh.slice(16), 16);

    const qHash = crypto.createHash('md5').update(urlObj.pathname + '?' + queryStr + (isNaN(ts) ? '' : ts.toString())).digest('hex').slice(0, 8);
    const letSh = uaHash + qHash;

    const now = Date.now();
    const isForceRefresh = c.req.header('cache-control') === 'no-cache';
    const timeDiff = now - ts;

    if (sh && (providedUaHash !== uaHash || (providedQHash !== qHash && (isNaN(ts) || new String(ts).length !== 13)))) {
        return c.text('Forbidden', 403);
    }

    if (!sh || providedQHash !== qHash || (isForceRefresh && timeDiff > 3000) || timeDiff >= 30000) {
        const newQHash = crypto.createHash('md5').update(urlObj.pathname + '?' + queryStr + now.toString()).digest('hex').slice(0, 8);
        const newLetSh = uaHash + newQHash;
        const newSh = newLetSh + now.toString(16);
        const newUrl = `${urlObj.origin}${urlObj.pathname}?sh=${newSh}${queryStr ? '&' + queryStr : ''}`;

        setCookie(c, '_sign', newLetSh.split('').reverse().join(''), { 
            path: '/',
            secure: false,
            sameSite: 'Lax'
        });
        if(c.req.header('sec-fetch-site') === 'none') {
          c.header('Refresh', '0, url=' + newUrl);
          return c.text('', 303);
        }
        else {
          return c.redirect(newUrl, 302);
        }
    }

    if(checkcookie) {
      deleteCookie(c, '_sign', { 
          path: '/', 
          secure: false,
          domain: '',
          sameSite: 'Lax'
      });
      if ((checkcookie !== letSh.split('').reverse().join('')) && c.req.header('referer')) {
        return c.json(["Signature mismatch", "Refresh this page for gain access"], 200);
      }
    }

    if (timeDiff > 1000 && !isForceRefresh) {
        c.header('X-If-Cache', true);
        return c.body(null, 304);
    }
  }

  c.header('X-Enc-Route', 'v2');
  c.header('Content-Type', 'application/json');

    return stream(c, async (stream) => {
        stream.onAbort(() => {
            return;
        });

        await stream.write('');

        if (c.req.raw.signal.aborted) return;

        const data = await (typeof promiseFactory === 'function' ? promiseFactory() : promiseFactory).catch((e) => {
            console.error('Promise error:', e);
            return null;
        });

        if (c.req.raw.signal.aborted) return;

        if (!data) {
            await stream.write('null');
        } else if (typeof data === 'object') {
            await stream.write(JSON.stringify(data));
        } else {
            await stream.write(String(data));
        }
    });
};

module.exports = { dispatch, blobDispatch };