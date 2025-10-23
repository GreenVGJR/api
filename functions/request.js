async function YTVideo(que) {
    if(!que) return null;
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
    const response = await fetch('https://youtubei.googleapis.com/youtubei/v1/search?prettyPrint=false&fields=contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents.itemSectionRenderer.contents.videoRenderer(videoId,title(runs/text),richThumbnail(movingThumbnailRenderer/movingThumbnailDetails/thumbnails/url),lengthText(simpleText),ownerText(runs/navigationEndpoint/browseEndpoint))', {
        headers: {
            'Accept-Encoding': 'gzip',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
        },
        body: bodyload,
        method: "POST"
    });
    const res = await response.json();
    return res.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents.filter(o => Object.keys(o).length > 0).map(v => v.videoRenderer);
}

async function YTMusic(que) {
    if(!que) return null;
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
    const response = await fetch('https://youtubei.googleapis.com/youtubei/v1/search?prettyPrint=false&fields=contents.tabbedSearchResultsRenderer.tabs.tabRenderer.content.sectionListRenderer.contents.musicShelfRenderer.contents.musicResponsiveListItemRenderer(flexColumns(musicResponsiveListItemFlexColumnRenderer(text(runs(text,navigationEndpoint(watchEndpoint/videoId))))),thumbnail(musicThumbnailRenderer(thumbnail(thumbnails(url)))))', {
        headers: {
            'Accept-Encoding': 'gzip',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
        },
        body: bodyload,
        method: "POST"
    });
    const res = await response.json();
    return res.contents.tabbedSearchResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].musicShelfRenderer.contents.filter(o => Object.keys(o).length > 0).map(v => v.musicResponsiveListItemRenderer);
}

let keysc;
async function SCMusic(que) {
    if (!que) return null;

    keysc = keysc ? keysc : await fetch('https://m.soundcloud.com', {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
            }
        })
    .then(a => a.text())
    .then(b => b.split('"clientId":"')[1].split('"')[0])
    .catch(() => null);

    const per = await fetch(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(que)}&client_id=${keysc}&limit=10`, { 
        headers: {
            'Accept-Encoding': 'gzip',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
        }
    });
    const pes = await per.json();
    return pes.collection;
}

let keysp;
async function SPMusic(que, refresh_auth = false) {
    if (!que) return null;

    if(refresh_auth) {
        keysp = await fetch(`https://open.spotify.com/embed/track/${["4PTG3Z6ehGkBFwjybzWkR8","2yR2sziCF4WEs3klW1F38d","0IuVhCflrQPMGRrOyoY5RW","2yWlGEgEfPot0lv3OAjuG3","4Xfp9BcKrKYmxJPxn68Yb8","7uuJqaRjSXzja6VGgDpWem","3BP1klbHxsOf6IxscNIX0r","6BYzwbWg1Z2EB6VUXTYnhm"][Math.floor(Math.random()*8)]}`, {
        headers: {
            'Accept-Encoding': 'gzip',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
            }
        })
        .then(a => a.text())
        .then(b => b.split('"accessToken":"')[1].split('"')[0])
        .catch(() => null);
    }

    const per = await fetch(`https://api.spotify.com/v1/search?q=${que}&type=track&offset=0&limit=10`, {
        headers: {
            'Accept-Encoding': 'gzip',
            'Authorization': 'Bearer ' + keysp,
            'App-Platform': 'WebPlayer',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
        }
    });

    if(per.status === 401 || per.status === 400) {
        return await SPMusic(que, true);
    }
    else {
        const pes = await per.json();
        return pes.tracks.items;
    }
}

async function YTLyrics(url) {
    let videoId = url.match(/(?:[?&]v(?:i)?=|(?:^|\/)(?:youtu\.be|v|vi|u\/\w|embed|shorts|watch|live|source)\/)([A-Za-z0-9_-]{11})(?=$|[?#&/])/)?.[1];
    videoId = videoId || null;
    if(!videoId) return null;
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
    const response = await fetch('https://youtubei.googleapis.com/youtubei/v1/next?prettyPrint=false&fields=contents.singleColumnMusicWatchNextResultsRenderer.tabbedRenderer.watchNextTabbedResultsRenderer(tabs.tabRenderer.endpoint.browseEndpoint.browseId)', {
        headers: {
            'Accept-Encoding': 'gzip',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
        },
        body: bodyload,
        method: "POST"
    });
    const res = await response.json();

    const bodyload2 = JSON.stringify({
        browseId: res.contents.singleColumnMusicWatchNextResultsRenderer.tabbedRenderer.watchNextTabbedResultsRenderer.tabs[1].tabRenderer.endpoint.browseEndpoint.browseId,
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

    const pull = await fetch('https://youtubei.googleapis.com/youtubei/v1/browse?prettyPrint=false&fields=contents', {
        headers: {
            'Accept-Encoding': 'gzip',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
        },
        body: bodyload2,
        method: "POST"
    });

    const res2 = await pull.json();

    return res2.contents;
}

module.exports = { 
    YTVideo,
    YTMusic,
    SCMusic,
    SPMusic,
    YTLyrics
};