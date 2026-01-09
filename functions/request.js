"use strict";

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
const commonHeaders = {
    'Accept': 'text/html, application/json, video/*, image/*, */*',
    'Accept-Encoding': '',
    'Accept-Language': 'en',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'User-Agent': userAgent
}

const { request } = require('undici');

let keysc;
let keysp;
let keytidal;
let keydeezer;

function filterCookies(cookie) {
    if (typeof cookie !== 'string' && !Array.isArray(cookie)) return '';
    const cookieStr = Array.isArray(cookie) ? cookie.join('; ') : cookie;
    return cookieStr
        .split(';')
        .map(c => c.trim())
        .filter(c => {
            const key = c.split('=')[0];
            return key && !/^(domain|path|expires|max-age|secure|httponly|samesite)$/i.test(key);
        })
        .join('; ') + ';';
}

function filterSpecificCookies(cookie, allowedKeys = []) {
    if (typeof cookie !== 'string' && !Array.isArray(cookie)) return '';
    const cookieStr = Array.isArray(cookie) ? cookie.join('; ') : cookie;
    return cookieStr
        .split(';')
        .map(c => c.trim())
        .filter(c => allowedKeys.includes(c.split('=')[0]))
        .join('; ');
}



const soundcloudKey = exports.soundcloudKey = async function soundcloudKey() {
    const rest = await request('https://m.soundcloud.com', {
        method: 'GET',
        headers: {
            ...commonHeaders,
        }
    })
        .then(a => a.body.text())
        .then(b => b.split('"clientId":"')[1].split('"')[0])
        .catch(() => null);
    return rest;
}

const spotifyKey = exports.spotifyKey = async function spotifyKey() {
    const rest = await request(`https://open.spotify.com/embed/track/${["4PTG3Z6ehGkBFwjybzWkR8", "2yR2sziCF4WEs3klW1F38d", "0IuVhCflrQPMGRrOyoY5RW", "2yWlGEgEfPot0lv3OAjuG3", "4Xfp9BcKrKYmxJPxn68Yb8", "7uuJqaRjSXzja6VGgDpWem", "3BP1klbHxsOf6IxscNIX0r", "6BYzwbWg1Z2EB6VUXTYnhm"][Math.floor(Math.random() * 8)]}`, {
        headers: {
            ...commonHeaders,
        }
    })
        .then(a => a.body.text())
        .then(b => b.split('"accessToken":"')[1].split('"')[0])
        .catch(() => null);
    return rest;
}

const tidalKeys = exports.tidalKeys = async function tidalKeys() {
    try {
        const rest = await request(`https://embed.tidal.com/tracks/${[230917825, 432597859, 355309145, 416356151, 434875762][Math.floor(Math.random() * 5)]}`, {
            method: "GET",
            headers: {
                ...commonHeaders,
            }
        });
        const rest_get = await rest.body.text();
        const rest2 = await request("https://embed.tidal.com" + rest_get.split('type="module"')[0].split('script src="')[1].split('"')[0], {
            headers: {
                ...commonHeaders,
            }
        });
        const rest2_get = await rest2.body.text();
        return rest2_get.split('"X-Tidal-Token","')[1].split('"')[0];
    } catch { return null; }
}

const deezerKeys = exports.deezerKeys = async function deezerKeys() {
    try {
        const rest = await request("https://auth.deezer.com/login/anonymous?jo=p&rto=p", {
            headers: {
                ...commonHeaders,
            }
        });
        let rest_get = await rest.body.text();
        rest_get = JSON.parse(rest_get);
        return rest_get.jwt;
    } catch { return null; }
}

exports.YTVideo = async function YTVideo(que) {
    if (!que) return null;
    try {
        const bodyload = JSON.stringify({
            query: que,
            context: {
                client:
                {
                    clientName: "WEB",
                    clientVersion: "2.20251212",
                    hl: "en",
                    gl: "US"
                }
            }
        });
        const response = await request('https://m.youtube.com/youtubei/v1/search?prettyPrint=false&fields=contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents.itemSectionRenderer.contents.videoRenderer(videoId,detailedMetadataSnippets(snippetText/runs/text),title(runs/text),richThumbnail(movingThumbnailRenderer/movingThumbnailDetails/thumbnails/url),lengthText(simpleText),ownerText(runs/navigationEndpoint/browseEndpoint))', {
            headers: {
                ...commonHeaders,
                'content-type': 'application/json'
            },
            body: bodyload,
            method: "POST"
        });
        const res = await response.body.json();
        return res.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents.filter(o => Object.keys(o).length > 0).map(v => v.videoRenderer);
    } catch { return null; }
}

exports.YTMusic = async function YTMusic(que) {
    if (!que) return null;
    try {
        const bodyload = JSON.stringify({
            query: que,
            params: "EgWKAQIIAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D",
            context: {
                client:
                {
                    clientName: "WEB_REMIX",
                    clientVersion: "1.20251212",
                    hl: "en",
                    gl: "US"
                }
            }
        });
        const response = await request('https://m.youtube.com/youtubei/v1/search?prettyPrint=false&fields=contents.tabbedSearchResultsRenderer.tabs.tabRenderer.content.sectionListRenderer.contents.musicShelfRenderer.contents.musicResponsiveListItemRenderer(flexColumns(musicResponsiveListItemFlexColumnRenderer(text(runs(text,navigationEndpoint(watchEndpoint/videoId))))),thumbnail(musicThumbnailRenderer(thumbnail(thumbnails(url)))))', {
            headers: {
                ...commonHeaders,
                'Content-Type': 'application/json'
            },
            body: bodyload,
            method: "POST"
        });
        const res = await response.body.json();
        return res.contents.tabbedSearchResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].musicShelfRenderer.contents.filter(o => Object.keys(o).length > 0).map(v => v.musicResponsiveListItemRenderer);
    } catch { return null; }
}

exports.SCMusic = async function SCMusic(que) {
    if (!que) return null;

    try {
        const per = await request(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(que)}&client_id=${keysc}&limit=10&linked_partitioning=0`, {
            headers: {
                ...commonHeaders,
            }
        });
        const pes = await per.body.json();
        return Object.fromEntries(Object.entries(pes.collection).filter(([key]) => !['media', 'track_authorization'].includes(key)));;
    } catch { return null; }
}

exports.SPMusic = async function SPMusic(que, refresh_auth = false) {
    if (!que) return null;

    if (refresh_auth) {
        keysp = await spotifyKey();
    }

    try {
        const per = await request(`https://api.spotify.com/v1/search?q=${que}&type=track&offset=0&limit=10&market=US`, {
            headers: {
                'Authorization': 'Bearer ' + keysp,
                'App-Platform': 'WebPlayer',
                ...commonHeaders,
            }
        });

        if (per.statusCode === 401 || per.statusCode === 400) {
            return await SPMusic(que, true);
        }
        else {
            const pes = await per.body.json();
            return pes.tracks.items;
        }
    } catch { return null; }
}

exports.YTLyrics = async function YTLyrics(url) {
    let videoId = url.match(/(?:[?&]v(?:i)?=|(?:^|\/)(?:youtu\.be|v|vi|u\/\w|embed|shorts|watch|live|source)\/)([A-Za-z0-9_-]{11})(?=$|[?#&/])/)?.[1];
    videoId = videoId || null;
    if (!videoId) return null;

    try {
        const responseBody = {
            "data": null,
            "lyrics": null,
            "footer": null,
        };

        const bodyload = JSON.stringify({
            videoId: videoId,
            context: {
                client:
                {
                    clientName: "WEB_REMIX",
                    clientVersion: "1.20251212",
                    hl: "en",
                    gl: "US"
                }
            }
        });
        const response = await request('https://m.youtube.com/youtubei/v1/next?prettyPrint=false&fields=contents.singleColumnMusicWatchNextResultsRenderer.tabbedRenderer.watchNextTabbedResultsRenderer(tabs.tabRenderer(endpoint(browseEndpoint/browseId),content/musicQueueRenderer/content/playlistPanelRenderer/contents/playlistPanelVideoRenderer(title,longBylineText,thumbnail,lengthText,videoId,shortBylineText)))', {
            headers: {
                ...commonHeaders,
                'Content-Type': 'application/json',
            },
            body: bodyload,
            method: "POST"
        });
        const res = await response.body.json();

        const bodyload2 = JSON.stringify({
            browseId: res?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[1]?.tabRenderer?.endpoint?.browseEndpoint?.browseId,
            context: {
                client:
                {
                    clientName: "WEB_REMIX",
                    clientVersion: "1.20251212",
                    hl: "en",
                    gl: "US"
                }
            }
        });

        const pull = await request('https://m.youtube.com/youtubei/v1/browse?prettyPrint=false&fields=contents', {
            headers: {
                ...commonHeaders,
                'Content-Type': 'application/json'
            },
            body: bodyload2,
            method: "POST"
        });

        const res2 = await pull.body.json();

        responseBody['data'] = {
            browseId: res?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[1]?.tabRenderer?.endpoint?.browseEndpoint?.browseId,
            url: url,
            other: res?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.musicQueueRenderer?.content?.playlistPanelRenderer.contents?.[0]?.playlistPanelVideoRenderer
        };
        responseBody['lyrics'] = res2?.contents?.sectionListRenderer?.contents?.[0]?.musicDescriptionShelfRenderer?.description?.runs?.[0]?.text;
        responseBody['footer'] = res2?.contents?.sectionListRenderer?.contents?.[0]?.musicDescriptionShelfRenderer?.footer?.runs?.[0]?.text;

        return responseBody;
    } catch { return null; }
}

exports.Shazam = async function Shazam(que) {
    if (!que) return null;
    try {
        const pull = await request(`https://www.shazam.com/services/amapi/v1/catalog/US/search?types=songs&limit=10&term=${que}`, {
            headers: {
                ...commonHeaders
            }
        });
        const res = await pull.body.json();
        return res.results.songs.data;
    } catch { return null; }
}

exports.Deezer = async function Deezer(que) {
    if (!que) return null;
    try {
        const pull = await request(`https://api.deezer.com/search?limit=10&q=${que}`, {
            headers: {
                ...commonHeaders
            }
        });
        const res = await pull.body.json();
        return res.data;
    } catch { return null; }
}

exports.deezerLyrics = async function deezerLyrics(que, refresh_auth = false) {
    if (!que) return null;

    try {
        if (refresh_auth) {
            keydeezer = await deezerKeys();
        }

        const body = {
            "operationName": "SearchFull",
            "variables": {
                "query": que,
                "firstList": 1
            },
            "query": "query SearchFull($query: String!, $firstList: Int!) { instantSearch(query: $query) { results { tracks(first: $firstList) { edges { node { id title album { cover { thumbnail: urls(pictureRequest: {width: 500, height: 500}) } } } } } } } }"
        };

        const responseBody = {
            "data": null,
            "lyrics": null
        }

        const pull = await request(`https://pipe.deezer.com/api`, {
            method: "POST",
            headers: {
                ...commonHeaders,
                'Authorization': 'Bearer ' + keydeezer,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const res = await pull.body.json();

        if (res?.errors?.[0]) {
            return await deezerLyrics(que, true);
        }

        const edges = res?.data?.instantSearch?.results?.tracks?.edges;

        if (!edges || edges.length === 0) {
            return null;
        }

        const trackNode = edges[0].node;
        responseBody['data'] = trackNode;

        const body2 = {
            "operationName": "GetLyrics",
            "variables": {
                "trackId": trackNode.id
            },
            "query": "query GetLyrics($trackId: String!) { track(trackId: $trackId) { lyrics { text synchronizedLines { lrcTimestamp line } } } }"
        };

        const pull2 = await request(`https://pipe.deezer.com/api`, {
            method: "POST",
            headers: {
                ...commonHeaders,
                'Authorization': 'Bearer ' + keydeezer,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body2)
        });

        const res2 = await pull2.body.json();

        if (res2?.errors?.[0]) {
            return await deezerLyrics(que, true);
        }

        responseBody['lyrics'] = res2?.data?.track?.lyrics || null;

        return responseBody;
    } catch { return null; }
}

exports.Tidal = async function Tidal(que) {
    if (!que) return null;

    try {
        const pull = await request(`https://api.tidal.com/v1/search/tracks?countryCode=US&locale=en_US&limit=10&offset=0&query=${que}`, {
            headers: {
                ...commonHeaders,
                'X-Tidal-Token': keytidal
            }
        });

        const res = await pull.body.json();
        return res.items;
    } catch { return null; }
}

exports.Genius = async function Genius(que) {
    if (!que) return null;

    try {
        const pull = await request(`https://genius.com/api/search/song?&per_page=10&q=${que}`, {
            headers: {
                ...commonHeaders
            }
        });

        if(pull.statusCode === 403) {
            return {
                "error": "Cloudflare Turnstile asking to verify you're not a bot"
            }
        }

        const res = await pull.body.json();
        return res?.response?.sections?.[0]?.hits?.map(a => a?.result) || res;
    } catch { return null; }
}

exports.Gemini = async function Gemini(que, convo) {
    if (!que) return null;

    let objectbody = { cid: null, rid: null, rcid: null, cookies: null };
    let parsebody = null;

    if (convo) {
        try {
            parsebody = JSON.parse(atob(convo));
        }
        catch {
            return `["JSON Parsing Error"]`;
        }
    }

    if (convo != null && typeof (parsebody) === 'object') {
        objectbody['cid'] = parsebody?.cid;
        objectbody['rid'] = parsebody?.rid;
        objectbody['rcid'] = parsebody?.rcid;
        objectbody['cookies'] = parsebody?.cookies;
    }


    const qQue = encodeURIComponent(que.replaceAll('"', '\\\\\\"'));
    const qCid = objectbody.cid ? `\\"${objectbody.cid}\\"` : "null";
    const qRid = objectbody.rid ? `\\"${objectbody.rid}\\"` : "null";
    const qRcid = objectbody.rcid ? `\\"${objectbody.rcid}\\"` : "null";
    const qCookies = objectbody.cookies ?? (filterSpecificCookies(objectbody.cookies, ['NID', '__Secure-ENID']) || null);

    const reqPayload = `f.req=%5Bnull%2C%22%5B%5B%5C%22${qQue}%5C%22%2C0%2Cnull%2Cnull%2Cnull%2Cnull%2C0%5D%2C%5B%5C%22en%5C%22%5D%2C%5B${qCid}%2C${qRid}%2C${qRcid}%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%5D%2Cnull%2C%5C%22%5C%22%2Cnull%2C%5B1%5D%2C1%2Cnull%2Cnull%2C1%2C0%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B%5B0%5D%5D%2C0%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C1%2Cnull%2Cnull%2C%5B4%5D%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B2%5D%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C0%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B%5D%5D%22%5D`;

    const req = await request(`https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?hl=en`, {
        method: 'POST',
        headers: {
            ...commonHeaders,
            ...(qCookies ? { 'Cookie': qCookies } : {}),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: reqPayload
    });

    if(req.statusCode === 302) {
        return {
            "error": "Google asking to verify you're not a bot"
        }
    }

    const cookiess = await req.headers?.['set-cookie'];
    const resText = await req.body.text();
    let response;

    try {
        const cleanText = resText.split(")]}'\n\n")[1];
        const data = JSON.parse(cleanText);
        let innerData;

        data.forEach(dt => {
            let check;
            if (dt?.[0] === 'wrb.fr') {
                check = JSON.parse(dt[2]);
                if (check?.[4]?.[0]?.[8]?.[0] === 2) {
                    innerData = check;
                }
            }
        });

        objectbody.cid = innerData[1][0];
        objectbody.rid = innerData[1][1];
        objectbody.rcid = innerData[4][0][0];
        objectbody.cookies = filterCookies(cookiess) || convo;

        response = innerData[4]?.[0]?.[1]?.[0] || null;
    } catch (e) {
        response = null;
    }

    const responseBody = {
        response: response,
        conversation: btoa(JSON.stringify(objectbody)),
        model: 'gemini-3-flash'
    }

    return responseBody;
}

exports.Translate = async function Translate(que, from, to) {
    if (!que) return null;

    const listcodes = [
        { "name": "Abkhaz", "code": "ab" },
        { "name": "Acehnese", "code": "ace" },
        { "name": "Acholi", "code": "ach" },
        { "name": "Afar", "code": "aa" },
        { "name": "Afrikaans", "code": "af" },
        { "name": "Albanian", "code": "sq" },
        { "name": "Alur", "code": "alz" },
        { "name": "Amharic", "code": "am" },
        { "name": "Arabic", "code": "ar" },
        { "name": "Armenian", "code": "hy" },
        { "name": "Assamese", "code": "as" },
        { "name": "Avar", "code": "av" },
        { "name": "Awadhi", "code": "awa" },
        { "name": "Aymara", "code": "ay" },
        { "name": "Azerbaijani", "code": "az" },
        { "name": "Balinese", "code": "ban" },
        { "name": "Bambara", "code": "bm" },
        { "name": "Bashkir", "code": "ba" },
        { "name": "Basque", "code": "eu" },
        { "name": "Batak Karo", "code": "btx" },
        { "name": "Batak Simalungun", "code": "bts" },
        { "name": "Batak Toba", "code": "bbc" },
        { "name": "Belarusian", "code": "be" },
        { "name": "Bengali", "code": "bn" },
        { "name": "Bhojpuri", "code": "bho" },
        { "name": "Bikol", "code": "bik" },
        { "name": "Bosnian", "code": "bs" },
        { "name": "Breton", "code": "br" },
        { "name": "Bulgarian", "code": "bg" },
        { "name": "Buryat", "code": "bua" },
        { "name": "Cantonese", "code": "yue" },
        { "name": "Catalan", "code": "ca" },
        { "name": "Cebuano", "code": "ceb" },
        { "name": "Chamorro", "code": "ch" },
        { "name": "Chechen", "code": "ce" },
        { "name": "Chichewa", "code": "ny" },
        { "name": "Chinese (Simplified)", "code": "zh-CN" },
        { "name": "Chinese (Traditional)", "code": "zh-TW" },
        { "name": "Chuvash", "code": "cv" },
        { "name": "Corsican", "code": "co" },
        { "name": "Crimean Tatar", "code": "crh" },
        { "name": "Croatian", "code": "hr" },
        { "name": "Czech", "code": "cs" },
        { "name": "Danish", "code": "da" },
        { "name": "Dhivehi", "code": "dv" },
        { "name": "Dininkka", "code": "din" },
        { "name": "Dogri", "code": "doi" },
        { "name": "Dombe", "code": "dom" },
        { "name": "Dutch", "code": "nl" },
        { "name": "Dyula", "code": "dyu" },
        { "name": "Dzongkha", "code": "dz" },
        { "name": "English", "code": "en" },
        { "name": "Esperanto", "code": "eo" },
        { "name": "Estonian", "code": "et" },
        { "name": "Ewe", "code": "ee" },
        { "name": "Faroese", "code": "fo" },
        { "name": "Fijian", "code": "fj" },
        { "name": "Filipino", "code": "fil" },
        { "name": "Finnish", "code": "fi" },
        { "name": "French", "code": "fr" },
        { "name": "French (Canada)", "code": "fr-CA" },
        { "name": "Frisian", "code": "fy" },
        { "name": "Friulian", "code": "fur" },
        { "name": "Fulani", "code": "ff" },
        { "name": "Ga", "code": "gaa" },
        { "name": "Galician", "code": "gl" },
        { "name": "Georgian", "code": "ka" },
        { "name": "German", "code": "de" },
        { "name": "Greek", "code": "el" },
        { "name": "Guarani", "code": "gn" },
        { "name": "Gujarati", "code": "gu" },
        { "name": "Haitian Creole", "code": "ht" },
        { "name": "Hakha Chin", "code": "cnh" },
        { "name": "Hausa", "code": "ha" },
        { "name": "Hawaiian", "code": "haw" },
        { "name": "Hebrew", "code": "he" },
        { "name": "Hindi", "code": "hi" },
        { "name": "Hmong", "code": "hmn" },
        { "name": "Hungarian", "code": "hu" },
        { "name": "Hunsrik", "code": "hrx" },
        { "name": "Iban", "code": "iba" },
        { "name": "Icelandic", "code": "is" },
        { "name": "Igbo", "code": "ig" },
        { "name": "Ilocano", "code": "ilo" },
        { "name": "Indonesian", "code": "id" },
        { "name": "Irish", "code": "ga" },
        { "name": "Italian", "code": "it" },
        { "name": "Japanese", "code": "ja" },
        { "name": "Javanese", "code": "jv" },
        { "name": "Jingpo", "code": "kac" },
        { "name": "Kalaallisut", "code": "kl" },
        { "name": "Kannada", "code": "kn" },
        { "name": "Kanuri", "code": "kr" },
        { "name": "Kapampangan", "code": "pam" },
        { "name": "Kazakh", "code": "kk" },
        { "name": "Khasi", "code": "kha" },
        { "name": "Khmer", "code": "km" },
        { "name": "Kiga", "code": "cgg" },
        { "name": "Kikongo", "code": "kg" },
        { "name": "Kinyarwanda", "code": "rw" },
        { "name": "Kituba", "code": "ktu" },
        { "name": "Kokborok", "code": "trp" },
        { "name": "Konkani", "code": "gom" },
        { "name": "Korean", "code": "ko" },
        { "name": "Krio", "code": "kri" },
        { "name": "Kurdish (Kurmanji)", "code": "ku" },
        { "name": "Kurdish (Sorani)", "code": "ckb" },
        { "name": "Kyrgyz", "code": "ky" },
        { "name": "Lao", "code": "lo" },
        { "name": "Latavian", "code": "lv" },
        { "name": "Ligurian", "code": "lij" },
        { "name": "Limburgish", "code": "li" },
        { "name": "Lingala", "code": "ln" },
        { "name": "Lithuanian", "code": "lt" },
        { "name": "Lombard", "code": "lmo" },
        { "name": "Luganda", "code": "lg" },
        { "name": "Luo", "code": "luo" },
        { "name": "Luxembourgish", "code": "lb" },
        { "name": "Macedonian", "code": "mk" },
        { "name": "Madurese", "code": "mad" },
        { "name": "Magahi", "code": "mag" },
        { "name": "Maithili", "code": "mai" },
        { "name": "Makassar", "code": "mak" },
        { "name": "Malagasy", "code": "mg" },
        { "name": "Malay", "code": "ms" },
        { "name": "Malayalam", "code": "ml" },
        { "name": "Maltese", "code": "mt" },
        { "name": "Mam", "code": "mam" },
        { "name": "Manx", "code": "gv" },
        { "name": "Maori", "code": "mi" },
        { "name": "Marathi", "code": "mr" },
        { "name": "Marshallese", "code": "mh" },
        { "name": "Marwadi", "code": "mwr" },
        { "name": "Mauritian Creole", "code": "mfe" },
        { "name": "Meiteilon (Manipuri)", "code": "mni-Mtei" },
        { "name": "Minangkabau", "code": "min" },
        { "name": "Mizo", "code": "lus" },
        { "name": "Mongolian", "code": "mn" },
        { "name": "Myanmar (Burmese)", "code": "my" },
        { "name": "Nahuatl", "code": "nah" },
        { "name": "Ndau", "code": "ndc" },
        { "name": "Ndebele (South)", "code": "nr" },
        { "name": "Nepalbhasha (Newari)", "code": "new" },
        { "name": "Nepali", "code": "ne" },
        { "name": "NKo", "code": "nko" },
        { "name": "Norwegian", "code": "no" },
        { "name": "Nuer", "code": "nus" },
        { "name": "Occitan", "code": "oc" },
        { "name": "Odia (Oriya)", "code": "or" },
        { "name": "Oromo", "code": "om" },
        { "name": "Ossetian", "code": "os" },
        { "name": "Pangasinan", "code": "pag" },
        { "name": "Papiamento", "code": "pap" },
        { "name": "Pashto", "code": "ps" },
        { "name": "Persian", "code": "fa" },
        { "name": "Polish", "code": "pl" },
        { "name": "Portuguese (Brazil)", "code": "pt-BR" },
        { "name": "Portuguese (Portugal)", "code": "pt-PT" },
        { "name": "Punjabi (Gurmukhi)", "code": "pa" },
        { "name": "Punjabi (Shahmukhi)", "code": "pa-Arab" },
        { "name": "Quechua", "code": "qu" },
        { "name": "Qʼeqchiʼ", "code": "kek" },
        { "name": "Romani", "code": "rom" },
        { "name": "Romanian", "code": "ro" },
        { "name": "Rundi", "code": "rn" },
        { "name": "Russian", "code": "ru" },
        { "name": "Samoan", "code": "sm" },
        { "name": "Sango", "code": "sg" },
        { "name": "Sanskrit", "code": "sa" },
        { "name": "Santali", "code": "sat" },
        { "name": "Scots Gaelic", "code": "gd" },
        { "name": "Sepedi", "code": "nso" },
        { "name": "Serbian", "code": "sr" },
        { "name": "Sesotho", "code": "st" },
        { "name": "Seychellois Creole", "code": "crs" },
        { "name": "Shan", "code": "shn" },
        { "name": "Shona", "code": "sn" },
        { "name": "Sicilian", "code": "scn" },
        { "name": "Silesian", "code": "szl" },
        { "name": "Sindhi", "code": "sd" },
        { "name": "Sinhala", "code": "si" },
        { "name": "Slovak", "code": "sk" },
        { "name": "Slovenian", "code": "sl" },
        { "name": "Somali", "code": "so" },
        { "name": "Spanish", "code": "es" },
        { "name": "Sundanese", "code": "su" },
        { "name": "Susu", "code": "sus" },
        { "name": "Swahili", "code": "sw" },
        { "name": "Swati", "code": "ss" },
        { "name": "Swedish", "code": "sv" },
        { "name": "Tahitian", "code": "ty" },
        { "name": "Tajik", "code": "tg" },
        { "name": "Tamazight", "code": "tzm" },
        { "name": "Tamazight (Tifinagh)", "code": "ber-Tfng" },
        { "name": "Tamil", "code": "ta" },
        { "name": "Tatar", "code": "tt" },
        { "name": "Telugu", "code": "te" },
        { "name": "Tetum", "code": "tet" },
        { "name": "Thai", "code": "th" },
        { "name": "Tibetan", "code": "bo" },
        { "name": "Tigrinya", "code": "ti" },
        { "name": "Tiv", "code": "tiv" },
        { "name": "Tok Pisin", "code": "tpi" },
        { "name": "Tongan", "code": "to" },
        { "name": "Tsonga", "code": "ts" },
        { "name": "Tswana", "code": "tn" },
        { "name": "Tulu", "code": "tcy" },
        { "name": "Tumbuka", "code": "tum" },
        { "name": "Turkish", "code": "tr" },
        { "name": "Turkmen", "code": "tk" },
        { "name": "Tuvan", "code": "tyv" },
        { "name": "Twi", "code": "ak" },
        { "name": "Udmurt", "code": "udm" },
        { "name": "Ukrainian", "code": "uk" },
        { "name": "Urdu", "code": "ur" },
        { "name": "Uyghur", "code": "ug" },
        { "name": "Uzbek", "code": "uz" },
        { "name": "Venda", "code": "ve" },
        { "name": "Venetian", "code": "vec" },
        { "name": "Vietnamese", "code": "vi" },
        { "name": "Waray", "code": "war" },
        { "name": "Welsh", "code": "cy" },
        { "name": "Wolof", "code": "wo" },
        { "name": "Xhosa", "code": "xh" },
        { "name": "Yakut", "code": "sah" },
        { "name": "Yiddish", "code": "yi" },
        { "name": "Yoruba", "code": "yo" },
        { "name": "Yucatec Maya", "code": "yua" },
        { "name": "Zapotec", "code": "zap" },
        { "name": "Zulu", "code": "zu" }
    ];

    const lFrom = from?.toLowerCase();
    const lTo = to?.toLowerCase();

    const findLangCode = (input) => {
        if (!input) return null;
        const lower = input.toLowerCase();
        const byCode = listcodes.find(l => l.code.toLowerCase() === lower);
        if (byCode) return byCode.code;
        const byName = listcodes.find(l => l.name.toLowerCase() === lower);
        if (byName) return byName.code;
        const byPartial = listcodes.find(l => l.name.toLowerCase().includes(lower));
        if (byPartial) return byPartial.code;
        return null;
    };

    const sourceLang = findLangCode(lFrom) || 'auto';
    const targetLang = findLangCode(lTo) || 'en';

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&dt=bd&dj=1&q=${encodeURIComponent(que)}`;

    try {
        const response = await request(url, {
            method: 'GET',
            headers: {
                ...commonHeaders
            }
        });

        const data = await response.body.json();

        let translatedText = '';
        if (data.sentences) {
            translatedText = data.sentences.map(s => s.trans).join('');
        }

        return {
            response: translatedText,
            data: {
                query: que,
                fromLang: [data.src || sourceLang, listcodes.find(l => l.code === (data.src || sourceLang))?.name || sourceLang],
                toLang: [targetLang, listcodes.find(l => l.code === targetLang)?.name || targetLang]
            }
        };
    } catch {
        return null;
    }
}

exports.infoYoutube = async function infoYoutube(que) {
    let videoId = que.match(/(?:[?&]v(?:i)?=|(?:^|\/)(?:youtu\.be|v|vi|u\/\w|embed|shorts|watch|live|source)\/)([A-Za-z0-9_-]{11})(?=$|[?#&/])/)?.[1];
    videoId = videoId || null;
    if (!videoId) return null;

    try {
        const bodyhttp = { videoId: videoId, context: { client: { clientName: 1, clientVersion: "1.20261231" } } }
        const bodyhttp2 = { videoId: videoId, context: { client: { clientName: 67, clientVersion: "1.20261231" } } }

        const [res, res2, res3] = await Promise.all([
                request('https://www.youtube.com/youtubei/v1/player?prettyPrint=false&fields=videoDetails', {
                method: "POST",
                body: JSON.stringify(bodyhttp),
                headers: {
                    ...commonHeaders
                }
            }),
                request(`https://www.youtube.com/watch?v=${videoId}`, {
                method: "GET",
                headers: {
                ...commonHeaders,
                'User-Agent': 'Bot'
                }
            }),
            request('https://www.youtube.com/youtubei/v1/player?prettyPrint=false&fields=videoDetails', {
                method: "POST",
                body: JSON.stringify(bodyhttp2),
                headers: {
                    ...commonHeaders
                }
            }),
        ]);

        console.log(await res.body.text());

        const pull = await res.body.json();
        const pull2 = await res2.body.text();
        const pull3 = await res3.body.json();
        let testpar = null;
        try {
            testpar = JSON.parse(pull2.split('ytInitialData =')[1].split(';')[0]);
        }
        catch { }

        return {
            "innerTube": pull?.videoDetails || {
                "error": "Google asking to verify you're not a bot"
            },
            "youtubeWeb": {
                "videoDetails": testpar?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.videoPrimaryInfoRenderer || testpar?.videoDetails,
                "nextVideosList": testpar?.contents?.twoColumnWatchNextResults?.secondaryResults?.secondaryResults?.results?.map(e => Object.fromEntries(Object.entries(e || {}).filter(([key]) => ['lockupViewModel'].includes(key)))?.lockupViewModel?.metadata?.lockupMetadataViewModel).filter(Boolean)
            },
            "youtubeMusicWeb": {
                "musicDetails": pull3?.videoDetails || {
                "error": "Google asking to verify you're not a bot"
            }
            }
        };
    }
    catch (e) {
        return null;
    }
}

exports.infoSoundcloud = async function infoSoundcloud(que, refresh_auth = false) {
    if(!que) return null;
    if(refresh_auth) {
        keysc = await soundcloudKey();
    }
    try {
        const test = new URL(que);
        if(test.host !== 'soundcloud.com') return null;
        const res = await request(`https://api-v2.soundcloud.com/resolve?client_id=${keysc}&url=${que}`, {
            method: 'GET',
            headers: {
                ...commonHeaders
            }
        });
        if([400, 401].includes(res.statusCode)) {
            return await infoSoundcloud(que, true);
        }
        const pull = await res.body.json();
        return Object.fromEntries(Object.entries(pull).filter(([key]) => !['media', 'track_authorization'].includes(key)));
    }
    catch {
        return null;
    }
}

exports.infoSpotify = async function infoSpotify(que) {
    if(!que) return null;
    try {
        const test = new URL(que);
        if(test.host !== 'open.spotify.com') return null;

        const res = await request(`https://open.spotify.com/oembed?url=${que}`, {
            method: 'GET',
            headers: {
                ...commonHeaders
            }
        });

        const pull = await res.body.json();

        const res2 = await request(pull.iframe_url, {
            method: 'GET',
            headers: {
                ...commonHeaders,
                'User-Agent': 'Bot'
            }
        });

        const pull2 = await res2.body.text();
        const test2 = JSON.parse(pull2.split('type="application/json">')[1].split('</script>')[0]);
        return test2.props.pageProps.state.data.entity;
    }
    catch {
        return null;
    }   
}

exports.infoITunes = async function infoITunes(que) {
    if(!que) return null;
    try {
        const test = new URL(que);
        if(test.host !== 'music.apple.com') return null;

        const res = await request(que, {
            method: 'GET',
            headers: {
                ...commonHeaders,
                'User-Agent': 'Bot'
            }
        });

        const pull = await res.body.text();
        const trypar = JSON.parse(pull.split('id="serialized-server-data">')[1].split('</script>')[0]);

        return trypar[0].data.sections;
    }
    catch {
        return null;
    }
}

exports.setKeys = (sc, sp, tidal, deezer) => { keysc = sc; keysp = sp; keytidal = tidal; keydeezer = deezer; };