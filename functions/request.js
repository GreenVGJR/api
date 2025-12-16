"use strict";

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36';
const commonHeaders = {
    'Accept': '*/*',
    'Accept-Language': 'en',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'User-Agent': userAgent
}

const { request } = require('undici');

let keysc;
let keysp;
let keytidal;
let keydeezer;

async function soundcloudKey() {
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

async function spotifyKey() {
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

async function tidalKeys() {
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
}

async function deezerKeys() {
    const rest = await request("https://auth.deezer.com/login/anonymous?jo=p&rto=p", {
        headers: {
            ...commonHeaders,
        }
    });
    let rest_get = await rest.body.text();
    rest_get = JSON.parse(rest_get);
    return rest_get.jwt;
}

async function YTVideo(que) {
    if (!que) return null;
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
}

async function tidalKey() {
}

async function YTMusic(que) {
    if (!que) return null;
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
}

async function SCMusic(que) {
    if (!que) return null;

    const per = await request(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(que)}&client_id=${keysc}&limit=10&linked_partitioning=false`, {
        headers: {
            ...commonHeaders,
        }
    });
    const pes = await per.body.json();
    return pes.collection;
}

async function SPMusic(que, refresh_auth = false) {
    if (!que) return null;

    if (refresh_auth) {
        keysp = await spotifyKey();
    }

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
}

async function YTLyrics(url) {
    let videoId = url.match(/(?:[?&]v(?:i)?=|(?:^|\/)(?:youtu\.be|v|vi|u\/\w|embed|shorts|watch|live|source)\/)([A-Za-z0-9_-]{11})(?=$|[?#&/])/)?.[1];
    videoId = videoId || null;
    if (!videoId) return null;

    const responseBody = {
        "data": null,
        "lyrics": null
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
    const response = await request('https://m.youtube.com/youtubei/v1/next?prettyPrint=false&fields=contents.singleColumnMusicWatchNextResultsRenderer.tabbedRenderer.watchNextTabbedResultsRenderer(tabs.tabRenderer.endpoint.browseEndpoint.browseId)', {
        headers: {
            ...commonHeaders,
            'Content-Type': 'application/json',
        },
        body: bodyload,
        method: "POST"
    });
    const res = await response.body.json();
    responseBody['data'] = res?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[1]?.tabRenderer?.endpoint;

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

    responseBody['lyrics'] = res2?.contents?.sectionListRenderer?.contents?.[0]?.musicDescriptionShelfRenderer?.description?.runs?.[0]?.text;
    responseBody['footer'] = res2?.contents?.sectionListRenderer?.contents?.[0]?.musicDescriptionShelfRenderer?.footer?.runs?.[0]?.text;

    return responseBody;
}

async function Shazam(que) {
    if (!que) return null;
    const pull = await request(`https://www.shazam.com/services/amapi/v1/catalog/US/search?types=songs&limit=10&term=${que}`, {
        headers: {
            ...commonHeaders
        }
    });
    const res = await pull.body.json();
    return res.results.songs.data;
}

async function Deezer(que) {
    if (!que) return null;
    const pull = await request(`https://api.deezer.com/search?limit=10&q=${que}`, {
        headers: {
            ...commonHeaders
        }
    });
    const res = await pull.body.json();
    return res.data;
}

async function deezerLyrics(que, refresh_auth = false) {
    if (!que) return null;

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

    if ([401,400].includes(pull.statusCode)) {
        return await deezerLyrics(que, true);
    }

    const res = await pull.body.json();
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

    if ([401,400].includes(pull2.statusCode)) {
        return await deezerLyrics(que, true);
    }

    const res2 = await pull2.body.json();
    responseBody['lyrics'] = res2?.data?.track?.lyrics || null;

    return responseBody;
}

async function Tidal(que) {
    if (!que) return null;

    const pull = await request(`https://api.tidal.com/v1/search/tracks?countryCode=US&locale=en_US&limit=10&offset=0&query=${que}`, {
        headers: {
            ...commonHeaders,
            'X-Tidal-Token': keytidal
        }
    });

    const res = await pull.body.json();
    return res.items;
}

async function Genius(que) {
    if (!que) return null;

    const pull = await request(`https://genius.com/api/search/song?&per_page=10&q=${que}`, {
        headers: {
            ...commonHeaders
        }
    });

    const res = await pull.body.json();
    return res.response.sections[0].hits.map(a => a?.result);
}

module.exports = {
    YTVideo,
    YTMusic,
    SCMusic,
    SPMusic,
    YTLyrics,
    deezerLyrics,
    Shazam,
    Deezer,
    Tidal,
    Genius,
    soundcloudKey,
    spotifyKey,
    tidalKeys,
    deezerKeys,
    setKeys: (sc, sp, tidal, deezer) => { keysc = sc; keysp = sp; keytidal = tidal; keydeezer = deezer; }
};