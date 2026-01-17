"use strict";

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
const commonHeaders = {
    'Accept': 'text/html, application/json, video/*, image/*, */*',
    'Accept-Encoding': 'identify',
    'Accept-Language': 'en',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'User-Agent': userAgent
}

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

const { request } = require('undici');
const { CurlImpersonateHttpClient, CurlImpersonate } = require('apify-node-curl-impersonate');
const { ClientTransaction } = require("x-client-transaction-id");
const { parseHTML } = require('linkedom');

let keysc;
let keysp;
let keysptoken;
let keytidal;
let keydeezer;

let twitterDocument;
let twitterTransaction;
let twitterAuth;
let twitterObj = {};

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

const spotifyKeyToken = exports.spotifyKeyToken = async function spotifyKeyToken() {
    const bodyhttp = {"client_data":{"client_version":"1.0","client_id":"d8a5ed958d274c2e8ee717e6a4b0971d","js_sdk_data":{}}};

    try {
    const req = await request(`https://clienttoken.spotify.com/v1/clienttoken`, {
        method: "POST",
        body: JSON.stringify(bodyhttp),
        headers: {
            ...commonHeaders,
            'Origin': 'https://clienttoken.spotify.com',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        }
    });

    const res = await req.body.json();
    return res.granted_token.token;
    }
    catch {
        return null;
    }
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

const twitterKey = exports.twitterKey = async function twitterKey(typeName) {
    try {
        const response = await request("https://x.com/", {headers:{...commonHeaders}});
        const html = await response.body.text();
        const { document } = parseHTML(html);
        twitterDocument = document;

        twitterTransaction = new ClientTransaction(twitterDocument);
        await twitterTransaction.initialize();

        const pul1 = await request("https://abs.twimg.com/responsive-web/client-web/main" + html.split('client-web/main')[1].split('"')[0], {headers:{...commonHeaders}});

        const res1 = await pul1.body.text();
        twitterAuth = res1.split('return"Bearer ')[1].split('"')[0];
        const queryId_user = res1.split('e.exports={queryId:')
        .find(e => e.includes(`operationName:"${typeName}"`))
        .split('"')[1];
        const features_user = JSON.parse(res1.split('e.exports={queryId:')
        .find(e => e.includes(`operationName:"${typeName}"`))
        .split('featureSwitches:')[1].split(',field')[0]).reduce((acc, key) => {
            acc[key] = true;
            return acc;
        }, {});

        twitterObj[typeName] = [
            queryId_user,
            features_user,
            await twitterTransaction.generateTransactionId(
                "GET",
                "/graphql/" + queryId_user + "/" + typeName,
            )
        ];
    }
    catch (e) { 
        console.error(e);
    }
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
        const [response, res2] = await Promise.all([
        request('https://m.youtube.com/youtubei/v1/search?prettyPrint=false&fields=contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents.itemSectionRenderer.contents.videoRenderer', {
            headers: {
                ...commonHeaders,
                'content-type': 'application/json'
            },
            body: bodyload,
            method: "POST"
        }),
        request(`https://www.youtube.com/results?search_query=${que}`, {
            method: "GET",
            headers: {
                ...commonHeaders,
            }
        })
        ]);
        const res = await response.body.json();
        const per = await res2.body.text();
        let testpar = null;
        try {
            testpar = JSON.parse(per.split('ytInitialData =')[1].split(';')[0]);
        }
        catch { }
        return { data: { innerTube: res?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer.contents?.filter(o => Object.keys(o).length > 0)?.map(v => v?.videoRenderer) || null, youtubeWeb: testpar?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.filter(o => Object.keys(o).length > 0).map(v => v?.videoRenderer)?.filter(Boolean) || null } };
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
        const [response, res2] = await Promise.all([
        request('https://m.youtube.com/youtubei/v1/search?prettyPrint=false&fields=contents.tabbedSearchResultsRenderer.tabs.tabRenderer.content.sectionListRenderer.contents.musicShelfRenderer.contents.musicResponsiveListItemRenderer', {
            headers: {
                ...commonHeaders,
                'Content-Type': 'application/json'
            },
            body: bodyload,
            method: "POST"
        }),
        request(`https://music.youtube.com/search?q=${que}`, {
            method: "GET",
            headers: {
                ...commonHeaders,
            }
        })
        ]);
        const res = await response.body.json();
        const per = await res2.body.text();

        let testper = null;
        try {
            const dataStr = per.split("data: '")[2]?.split("'")[0];
            if (dataStr) {
                const unescaped = dataStr.replace(/\\(x[0-9a-fA-F]{2}|.)/g, (match, p1) => {
                    if (p1.startsWith('x')) return String.fromCharCode(parseInt(p1.slice(1), 16));
                    if (p1 === '\\') return '\\';
                    if (p1 === "'") return "'";
                    return match;
                });
                testper = JSON.parse(unescaped);
            }
        } catch {}

        // 1. Safely extract InnerTube results
        const innerTubeResults = res?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicShelfRenderer?.contents || [];

        // 2. Safely extract YouTube Music Web results
        let youtubeMusicWebResults = [];
        if (testper) {
            const sections = testper?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
            // Find the section that actually contains the musicShelfRenderer
            const musicShelf = sections.find(section => section.musicShelfRenderer)?.musicShelfRenderer;
            youtubeMusicWebResults = musicShelf?.contents || [];
        }

        return {
            data: {
                innerTube: innerTubeResults.filter(o => o.musicResponsiveListItemRenderer).map(v => v.musicResponsiveListItemRenderer) || null,
                youtubeMusicWeb: youtubeMusicWebResults.filter(o => o.musicResponsiveListItemRenderer).map(v => v.musicResponsiveListItemRenderer) || null
            }
        };
    } catch { return null; }
}

exports.SCMusic = async function SCMusic(que, refresh_auth) {
    if (!que) return null;

    if(refresh_auth) {
        keysc = await soundcloudKey();
    }

    try {

        const [per, per2] = await Promise.all([
        request(`https://api-v2.soundcloud.com/search/tracks?q=${que}&client_id=${keysc}&limit=10&linked_partitioning=0`, {
            headers: {
                ...commonHeaders,
            }
        }),
        request(`https://mobi.soundcloud.com/search/tracks?q=${que}`, {
            headers: {
                ...commonHeaders,
            }
        })
        ]);
        if(per.statusCode === 401) {
            return await SCMusic(que, true);
        }
        const pes = await per.body.json();
        const pes2 = await per2.body.text();
        let testpes = null;
        try {
            testpes = JSON.parse(pes2.split('type="application/json">')[1].split('</script>')[0]);
        }
        catch {}
        return { data: [pes?.collection || null, testpes?.props?.pageProps?.initialStoreState?.entities || null] };
    } catch (e) { console.error(e); return null; }
}

exports.SPMusic = async function SPMusic(que, refresh_auth = false) {
    if (!que) return null;

    if (refresh_auth) {
        const [a,b] = await Promise.all([
            spotifyKeyToken(),
            spotifyKey()
        ]);
        keysptoken = a;
        keysp = b;
    }

    try {
        const perbody = {"variables":{"searchTerm":que,"offset":0,"limit":20,"numberOfTopResults":20,"includeAudiobooks":true,"includeArtistHasConcertsField":true,"includePreReleases":true,"includeAuthors":true},"operationName":"searchDesktop","extensions":{"persistedQuery":{"version":1,"sha256Hash":"fcad5a3e0d5af727fb76966f06971c19cfa2275e6ff7671196753e008611873c"}}};
        const [per, per2] = await Promise.all([
        request(`https://api.spotify.com/v1/search?q=${que}&type=track&offset=0&limit=20&market=US`, {
            headers: {
                'Authorization': 'Bearer ' + keysp,
                'App-Platform': 'WebPlayer',
                ...commonHeaders,
            }
        }),
        request(`https://api-partner.spotify.com/pathfinder/v2/query`, {
            method: "POST",
            body: JSON.stringify(perbody),
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://open.spotify.com',
                'Authorization': 'Bearer ' + keysp,
                'App-Platform': 'WebPlayer',
                'Client-Token': keysptoken,
                ...commonHeaders,
            }
        })
        ]);

        if (per.statusCode === 401 || per.statusCode === 400 || per2.statusCode === 401 || per2.statusCode === 400) {
            return await SPMusic(que, true);
        }
        else {
            const pes = await per.body?.json();
            const pes2 = await per2.body?.json();
            return { data: [pes?.tracks?.items || null, pes2?.data?.searchV2 || null] };
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
        return { data: res?.results?.songs?.data || null };
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
        return { data: res?.data || null };
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

        if (res2?.errors?.[0]?.message.includes('Given jwt')) {
            return await deezerLyrics(que, true);
        }

        responseBody['lyrics'] = res2?.data?.track?.lyrics || null;

        return responseBody;
    } catch { return null; }
}

exports.Tidal = async function Tidal(que, refresh) {
    if (!que) return null;
    if(refresh) {
        keytidal = await tidalKeys();
    }

    try {
        const pull = await request(`https://api.tidal.com/v1/search/tracks?countryCode=US&locale=en_US&limit=10&offset=0&query=${que}`, {
            headers: {
                ...commonHeaders,
                'X-Tidal-Token': keytidal
            }
        });

        if(pull.statusCode === 400 || pull.statusCode === 401) {
            return await Tidal(que, true);
        }

        const res = await pull.body.json();
        return { data: res?.items || null };
    } catch { return null; }
}

exports.Genius = async function Genius(que) {
    if (!que) return null;

    try {
        const client = new CurlImpersonate(`https://genius.com/api/search/song?&per_page=10&q=${que}`, {
        method: 'GET',
        impersonate: 'edge-101',
        debugLogger: () => {}
        });
        const checkres = await client.makeRequest();

        if(checkres.statusCode === 403) {
            return {
                "error": "Cloudflare Turnstile asking to verify you're not a bot"
            }
        }

        const res = JSON.parse(checkres.response);
        return { data: res?.response?.sections?.[0]?.hits?.map(a => a?.result) || null };
    } catch { return null; }
}

exports.Gemini = async function Gemini(que, convo) {
    if (!que) return null;

    let objectbody = { cid: null, rid: null, rcid: null, cookies: null };
    let parsebody = null;

    if (convo) {
        try {
            parsebody = JSON.parse(
                Buffer.from(convo.split('').reverse().join(''), 'base64url').toString('utf-8')
            );
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
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://gemini.google.com'
        },
        body: reqPayload,
        bodyTimeout: 60000,
        headersTimeout: 60000
    });

    if(req.statusCode === 302) {
        return {
            "error": "Google asking to verify you're not a bot"
        }
    }

    const cookiess = await req.headers?.['set-cookie'];
    const resText = await req.body.text();
    let response;

    let data;
    try {
        const cleanText = resText.split(")]}'\n\n")[1];
        data = JSON.parse(cleanText);
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

        if(!innerData) {
            return {
                error: "Rate-limited"
            }
        }

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
        data: {
        conversation: Buffer.from(JSON.stringify(objectbody)).toString('base64url').split('').reverse().join(''),
        model: 'gemini-3-flash'
        }
    }

    return responseBody;
}

exports.Translate = async function Translate(que, from, to) {
    if (!que) return null;

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
                toLang: [targetLang, listcodes.find(l => l.code === targetLang)?.name || targetLang],
                translateType: [
                    (lFrom && lTo) ? "specific" : "auto",
                    "flash"
                ],
                accuracy: data?.ld_result?.srclangs_confidences?.[0] ? new String(data?.ld_result?.srclangs_confidences?.[0] * 100) : null
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
        const bodyhttp = { videoId: videoId, context: { client: { clientName: 2, clientVersion: "2.20261231" } } }
        const bodyhttp2 = { videoId: videoId, context: { client: { clientName: 67, clientVersion: "1.20261231" } } }

        const [res, res2, res3] = await Promise.all([
                request('https://m.youtube.com/youtubei/v1/player?prettyPrint=false&fields=videoDetails', {
                method: "POST",
                body: JSON.stringify(bodyhttp),
                headers: {
                    ...commonHeaders,
                    'User-Agent': 'Bot'
                }
            }),
                request(`https://www.youtube.com/watch?v=${videoId}`, {
                method: "GET",
                headers: {
                ...commonHeaders,
                'User-Agent': 'Bot'
                }
            }),
            request('https://m.youtube.com/youtubei/v1/player?prettyPrint=false&fields=videoDetails', {
                method: "POST",
                body: JSON.stringify(bodyhttp2),
                headers: {
                    ...commonHeaders,
                    'User-Agent': 'Bot'
                }
            }),
        ]);

        const pull = await res.body.json();
        const pull2 = await res2.body.text();
        const pull3 = await res3.body.json();
        let testpar = null;
        try {
            testpar = JSON.parse(pull2.split('ytInitialData =')[1].split(';')[0]);
        }
        catch { }
        
        return {
            "data": { 
            "innerTube": [
                pull?.videoDetails ? { "videoDetails": pull?.videoDetails } : {
                    "error": "Google asking to verify you're not a bot"
                },
                {
                    ...(pull3?.videoDetails ? { "musicDetails": pull3?.videoDetails } : {
                        "error": "Google asking to verify you're not a bot"
                    })
                }
            ],
            "youtubeWeb": {
                ...(testpar?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.reduce((acc, obj) => Object.assign(acc, obj), {}) || { "videoDetails": null }),
                "nextVideosList": testpar?.contents?.twoColumnWatchNextResults?.secondaryResults?.secondaryResults?.results || null
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
        if(res.statusCode === 401 || res.statusCode === 400) {
            return await infoSoundcloud(que, true);
        }
        const pull = await res.body.json();

        return { data: pull || null };
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
        return { data: test2?.props?.pageProps?.state?.data?.entity || null };
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

        return { data: trypar[0]?.data?.sections || null };
    }
    catch {
        return null;
    }
}

exports.pinterest = async function pinterest(que) {
    if(!que) return null;
    try {
        const feat = {"options":{"query":que,"scope":"pins"},"context":{}};
        const req = await request(`https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=/search/pins/?q=${que}&data=${encodeURIComponent(JSON.stringify(feat))}`,{
            method: 'GET',
            headers: {
                ...commonHeaders,
                'X-Pinterest-PWS-Handler': 'www/search/[scope].js'
            }
        });

        const res = await req.body.json();
        return res.resource_response.data.results[0] ? { data: res.resource_response.data.results } : {
            'error': 'Looks like your search violate our terms of service'
        };
    }
    catch {
        return null;
    }
}

exports.Discord = async (token, guildId, payload, payloadError, reasonAudit) => {
    const url = `https://discord.com/api/v10/guilds/${guildId}`;

    try {
        // First try to fetch current info (GET) to verify access/token
        const req = await request(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)'
            }
        });

        let currentInfo = null;
        try {
            currentInfo = await req.body.json();
        } catch {
            // If we can't parse the body, it might be an empty or error response
        }

        if(req.statusCode !== 200) {
            return { 
                data: [null, null], 
                error: currentInfo || { status: req.statusCode, statusText: req.statusText }
            };   
        }

        if (Object.keys(payload).length === 0) {
            return { data: [currentInfo, null] };
        }

        // Use request for the PATCH request
        const response = await request(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)',
                ...(reasonAudit && { 'X-Audit-Log-Reason': reasonAudit })
            },
            body: JSON.stringify(payload)
        });

        let patchResponse = null;
        try {
            patchResponse = await response.body.json();
        } catch (e) {}

        if (response.statusCode < 200 || response.statusCode >= 300) {
            return { 
                data: [currentInfo.code === 0 ? null : currentInfo, null], 
                error: patchResponse || { status: response.statusCode }
            };
        }

        const checkSpecificFields = (a, b) => {
            if (!a || !b) return false;
            const fields = ['name', 'icon', 'splash', 'banner', 'description', 'verification_level'];
            return fields.every(field => a[field] === b[field]);
        };

        return { 
            data: [currentInfo, patchResponse, checkSpecificFields(currentInfo, patchResponse) ? 204 : response.status, ...(reasonAudit ? [reasonAudit] : [])],
            ...(payloadError?.[0] && {
                error: payloadError,
                errorMessage: 'Continuing anyways'
            })
        };
    } catch {
        return { error: 'Something just happened' };
    }
};

exports.DiscordWebhook = async (token, guildId, payload, payloadError) => {
    const action = payload.action;
    const webhookId = payload.webhookId || (action !== 'create' ? guildId : null);
    const channelId = payload.channelId || (action === 'create' ? guildId : null);
    const botUserAgent = 'DiscordBot (https://github.com/discord-bot, 1.0.0)';

    let url = '';
    let method = 'GET';

    const webhookToken = payload.webhookToken;

    if (action === 'create') {
        if (!channelId) return { error: 'Missing channelId' };
        url = `https://discord.com/api/v10/channels/${channelId}/webhooks`;
        method = 'POST';
    } else if (action === 'info') {
        if (!webhookId) return { error: 'Missing webhookId' };
        url = `https://discord.com/api/v10/webhooks/${webhookId}${webhookToken ? `/${webhookToken}` : ''}`;
        method = 'GET';
    } else if (action === 'delete') {
        if (!webhookId) return { error: 'Missing webhookId' };
        url = `https://discord.com/api/v10/webhooks/${webhookId}${webhookToken ? `/${webhookToken}` : ''}`;
        method = 'DELETE';
    } else {
        return { error: 'Nothing to do' };
    }

    try {
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': botUserAgent
        };

        if (token && token !== 'null') {
            headers['Authorization'] = `Bot ${token}`;
        }

        const response = await request(url, {
            method: method,
            headers: headers,
            ...(method === 'POST' && {
                body: JSON.stringify({
                    name: payload.name || 'New Webhook',
                    avatar: payload.avatar || null
                })
            })
        });

        let result = null;
        if (response.statusCode !== 204) {
            try {
                result = await response.body.json();
            } catch (e) {}
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
            return {
                data: null,
                error: result || { status: response.statusCode }
            };
        }

        return { data: [result || true, null, response.statusCode] };
    } catch (e) {
        return { error: e.message };
    }
};

exports.GettyImage = async function GettyImage(que) {
    if(!que) return null;
    try {
        const req = await request(`https://www.istockphoto.com/en/search/2/image?phrase=${que}&page=1`, {
            headers: {
                ...commonHeaders,
                'Accept': 'application/json'
            }
        });

        const res = await req.body.json();
        return {
            data: [res?.gallery?.assets ?? null, res?.relatedTerms ?? null]
        };
    }
    catch {
        return null;
    }

};

exports.Unsplash = async function Unsplash(que) {
    if(!que) return null;

    try {
    const pull = await request(`https://unsplash.com/napi/search/photos?page=1&per_page=20&query=${que}`, {
        headers: {
            ...commonHeaders,
            'client-geo-region': 'global'
        }
    });

    if(pull.statusCode === 403) {
        return {
            "error": "IP Blocked"
        }
    }

    const res = await pull.body.json();
    return { data: res?.results?.[0] ? {
        non_premium: res?.results.filter(a => !a.premium),
        premium: res?.results.filter(a => a.premium)
    } : null
    };
    } catch { return null; }
}

exports.Pixiv = async function Pixiv(que) {
    if(!que) return null;

    try {
        const per = await request(`https://www.pixiv.net/ajax/search/top/${que}?lang=en`, {
        headers: {
            ...commonHeaders
            }
        });

        const res = await per.body.json();
        const items = res?.body?.illust?.data || res?.body?.illustManga?.data || [];
        return {
            data: {
                data: items?.map(item => {
                const { url, profileImageUrl, ...rest } = item;
                return rest;
            }) || null,
            relatedTags: res?.body?.relatedTags || null,
            tagTranslation: res?.body?.tagTranslation || null,
            }
        }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

exports.DiscordServers = async function DiscordServers(que) {
    if(!que) return null;

    try {
        const per = await request(`https://discord.com/api/v10/discovery/search?query=${que}&limit=10`, {
        headers: {
            ...commonHeaders
            }
        });

        if(per.statusCode === 403) {
            return {
                "error": "Cloudflare Turnstile asking to verify you're not a bot"
            }
        }

        const res = await per.body.json();
        return { data: res?.hits || null }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

exports.Bilibili = async function Bilibili(que) {
    if(!que) return null;

    try {
        const per = await request(`https://api.bilibili.tv/intl/gateway/web/v2/search_v2?s_locale=en_US&platform=web&keyword=${que}&highlight=1&pn=1&ps=10&qid=&sort=0`, {
        headers: {
            ...commonHeaders
            }
        });

        if(per.statusCode === 403) {
            return {
                "error": "Akamai Captcha asking to verify you're not a bot"
            }
        }

        const res = await per.body.json();
        return { data: (res?.data?.modules?.[0]?.items || res?.data?.modules?.[1]?.items) || null }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

exports.DiscordApps = async function DiscordApps(que) {
    if(!que) return null;

    try {
        const per = await request(`https://discord.com/api/v10/application-directory/search?query=${que}&page=1&page_size=10&category_id=1&locale=en-US&source=0`, {
        headers: {
            ...commonHeaders
            }
        });

        if(per.statusCode === 403) {
            return {
                "error": "Cloudflare Turnstile asking to verify you're not a bot"
            }
        }

        const res = await per.body.json();
        return { data: res?.results || null }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

exports.Jiosaavn = async function Jiosaavn(que) {
    if(!que) return null;

    try {
        const per = await request(`https://www.jiosaavn.com/api.php?_format=json&n=10&__call=search.getResults&q=${que}`, {
        headers: {
            ...commonHeaders
            }
        });

        const res = await per.body.json();

        const items = res?.results || [];

        return { data: items?.map(item => {
                const { encrypted_media_url, encrypted_drm_media_url, encrypted_media_path, ...rest } = item;
                return rest;
            }) || null }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

exports.Twitch = async function Twitch(que) {
    if(!que) return null;

    try {
        const bodyhttp = {"operationName":"SearchResultsPage_SearchResults","variables":{"query":que,"includeIsDJ":true},"extensions":{"persistedQuery":{"version":1,"sha256Hash":"7f3580f6ac6cd8aa1424cff7c974a07143827d6fa36bba1b54318fe7f0b68dc5"}}}
        const per = await request(`https://gql.twitch.tv/gql`, {
        method: "POST",
        body: JSON.stringify(bodyhttp),
        headers: {
            ...commonHeaders,
            'Client-Id': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
            'Content-Type': 'application/json'
            }
        });

        const res = await per.body.json();

        return { data: res?.data?.searchFor || null };
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

exports.InstagramUser = async function InstagramUser(que) {
    if(!que) return null;

    try {
        const bodyhttp = {"data":{"include_reel":"true","query":que},"hasQuery":true};
        const per = await request(`https://i.instagram.com/graphql/query/?doc_id=24146980661639222&variables=${JSON.stringify(bodyhttp)}`, {
        headers: {
            ...commonHeaders
            }
        });

        const res = await per.body.json();

        return { data: res?.data?.xdt_api__v1__fbsearch__topsearch_connection?.users || null }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

exports.ThreadUser = async function ThreadUser(que) {
    if(!que) return null;

    try {
        const bodyhttp = {"query":que,"first":50,"should_fetch_ig_inactive_on_text_app":true,"should_fetch_friendship_status":false,"should_fetch_fediverse_profiles":true,"hide_unconnected_private":false,"__relay_internal__pv__BarcelonaIsLoggedInrelayprovider":false,"__relay_internal__pv__BarcelonaIsCrawlerrelayprovider":false,"__relay_internal__pv__BarcelonaHasDisplayNamesrelayprovider":false};
        const per = await request(`https://www.threads.com/graphql/query?doc_id=24871030029227550&variables=${JSON.stringify(bodyhttp)}`, {
        headers: {
            ...commonHeaders,
            'Origin': 'https://www.threads.com',
            'X-IG-App-ID': '1412234116260832',
            'X-LOGGED-OUT-THREADS-MIGRATED-REQUEST': true
            }
        });

        const res = await per.body.json();

        return { data: res?.data?.xdt_api__v1__users__search_connection?.edges?.map(a => a?.node) || null }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

exports.Pexels = async function Pexels(que) {
    if(!que) return null;

    try {
        const client = new CurlImpersonate(`https://www.pexels.com/search/${encodeURIComponent(que)}`, {
            method: 'GET',
            impersonate: 'edge-101',
            debugLogger: () => {}
        });
        const res = await client.makeRequest();
        if(res.statusCode === 403) {
            return {
                "error": "Cloudflare Turnstile asking to verify you're not a bot"
            }
        }
        let pull = null;
        try {
        pull = JSON.parse(res.response?.split('"application/json">')?.[1]?.split('</script>')?.[0]);
        }
        catch {}
        return { data: pull?.props?.pageProps?.initialData || null };
    }
    catch (e) {
        console.error(e);
        return null;
    }
};

exports.TiktokVideo = async function TiktokVideo(que) {
    if(!que) return null;

    try {
        const pul = await request(`https://api-boot.tiktokv.com/aweme/v1/search/item/?count=10&keyword=${que}&version_code=3.2.0&app_name=musical_ly&channel=App+Store&device_id=7386407102867523334&aid=1233&os_version=16.2&device_platform=iphone&iid=7386407102867523334&device_brand=iphone&device_type=iPhone10,6`, {
        headers: {
            ...commonHeaders,
            'X-Khronos': Math.floor(Date.now() / 1000)
            }
        });

        const res = await pul.body.text();
        if(res === '') {
            return {
                "error": "Akamai Captcha asking to verify you're not a bot"
            }
        }
        let testres;
        try {
            testres = JSON.parse(res);
        }
        catch {}
        return { data: testres?.aweme_list || null };
    }
    catch {
        return null;
    }
}

exports.TiktokMusic = async function TiktokMusic(que) {
    if(!que) return null;

    try {
        const pul = await request(`https://api-boot.tiktokv.com/aweme/v1/music/search/?count=10&cursor=0&aid=1233&device_id=7386407102867523334&region=&referer=&keyword=${que}`, {
        headers: {
            ...commonHeaders
            }
        });

        const res = await pul.body.text();
        if(res === '') {
            return {
                "error": "Akamai Captcha asking to verify you're not a bot"
            }
        }
        let testres;
        try {
            testres = JSON.parse(res);
        }
        catch {}
        return { data: [testres?.music || null, testres?.music_info_list || null] };
    }
    catch {
        return null;
    }
}

exports.TiktokUser = async function TiktokUser(que) {
    if(!que) return null;

    try {
        const pul = await request(`https://api-boot.tiktokv.com/aweme/v1/discover/search/?keyword=${que}&cursor=0&count=10&hot_search=0&search_source=discover&aid=1180&app=musically&region=&referer=&device_id=7386407102867523334&type=1`, {
        headers: {
            ...commonHeaders
            }
        });

        const res = await pul.body.text();
        if(res === '') {
            return {
                "error": "Akamai Captcha asking to verify you're not a bot"
            }
        }
        let testres;
        try {
            testres = JSON.parse(res);
        }
        catch {}
        return { data: testres?.user_list?.map(a => a.user_info) || null };
    }
    catch {
        return null;
    }
}

exports.infoTwitterUser = async function infoTwitterUser(que, refresh_auth) {
    if(!que) return null;
    if(refresh_auth) {
        await twitterKey("UserByScreenName");
    }

    try {
        const queryId = twitterObj?.UserByScreenName?.[0];
        const features = JSON.stringify(twitterObj?.UserByScreenName?.[1]);
        const variables = JSON.stringify({ screen_name: que, withGrokTranslatedBio: true });
        const fieldToggles = JSON.stringify({ withPayments: true, withAuxiliaryUserLabels: true });

        const pul = await request(`https://api.x.com/graphql/${queryId}/UserByScreenName?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}&fieldToggles=${encodeURIComponent(fieldToggles)}`, {
            headers: {
                ...commonHeaders,
                'content-type': 'application/json',
                'authorization': 'Bearer ' + twitterAuth,
                'x-client-transaction-id': twitterObj?.UserByScreenName?.[2],
            }
        });

        if(pul.statusCode === 403) {
            return {
                "error": "Bad auth"
            }
        }

        if(pul.statusCode === 401 || pul.statusCode === 400) return await infoTwitterUser(que, true);

        const responseText = await pul.body.text();
        let res;
        try {
            res = JSON.parse(responseText);
        } catch {
            return null;
        }
        let pul2;
        let res2 = {};
        if(res?.data?.user?.result?.rest_id) {
            pul2 = await request(`https://syndication.twitter.com/srv/timeline-profile/user-id/${res?.data?.user?.result?.rest_id}`, {
                headers: {
                    ...commonHeaders
                }
            });
            try {
            res2 = await pul2.body.text();
            res2 = JSON.parse(res2.split('type="application/json">')[1].split('</script>')[0]);
            }
            catch {}
        }

        const finalres = {
            ...(res?.data?.user?.result || null),
            timeline: res2?.props?.pageProps?.timeline?.entries?.[0] ? res2?.props?.pageProps?.timeline?.entries : null
        }
        
        return { data: finalres?.rest_id ? finalres : null };
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

exports.infoTwitterTweet = async function infoTwitterTweet(que, refresh_auth) {
    if(!que) return null;
    if(refresh_auth) {
        await twitterKey("TweetResultByRestId");
    }

    try {
        const queryId = twitterObj?.TweetResultByRestId?.[0];
        const features = JSON.stringify(twitterObj?.TweetResultByRestId?.[1]);
        const variables = JSON.stringify({tweetId: que,includePromotedContent:true,withBirdwatchNotes:true,withVoice:true,withCommunity:true});

        const [pul, pul2] = await Promise.all([
            request(`https://api.x.com/graphql/${queryId}/TweetResultByRestId?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`, {
            headers: {
                ...commonHeaders,
                'content-type': 'application/json',
                'authorization': 'Bearer ' + twitterAuth,
                // 'x-client-transaction-id': twitterObj?.TweetResultByRestId?.[2],
            }
        }),
            request(`https://cdn.syndication.twimg.com/tweet-result?id=${que}&lang=en&token=abc`, {
                headers: {
                    ...commonHeaders,
                }
            })
        ]);

        let res = null;

        if(pul.statusCode === 403) {
            res = {
                "error": "Bad auth"
            }
        }
        else {
            res = await pul.body.json();
        }

        if(pul.statusCode === 401 || pul.statusCode === 400) return await infoTwitterTweet(que, true);

        const res2 = await pul2.body.json();

        return { data: [res?.data?.tweetResult?.result || null, res2 || null] };
    }
    catch {
        return null;
    }
}

exports.redditMedia = async function redditMedia(que) {
    if(!que) return null;

    try {
        const req = await request(`https://old.reddit.com/search/.json?q=${que}&sort=relevance&type=media`, {
            headers: {
                ...commonHeaders,
                'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'
            }
        });

        if(req.statusCode === 403) {
            return {
                "error": "IP Blocked"
            }
        }

        if(req.statusCode === 302) {
            return {
                "error": "Google asking to verify you're not a bot"
            }
        }

        const res = await req.body?.json();
        return { data: res?.data?.children?.map(a => a?.data) || null }
    }
    catch {
        return null;
    }
}

exports.robloxGames = async function robloxGames(que) {
    if(!que) return null;

    try {
        const pul1 = await request(`https://apis.roblox.com/search-api/omni-search?searchQuery=${que}&sessionId=abc`, {
            headers: {
                ...commonHeaders
            }
        });

        const res1 = await pul1.body.json();
        const gamesList = res1.searchResults?.flatMap(group => group.contents) || [];
        const restIds = gamesList.filter(b => b?.universeId).map(b => b.universeId).join(',');

        if(!restIds) return { data: gamesList };

        const pul2 = await request(`https://games.roblox.com/v1/games?universeIds=${restIds}`, {
            headers: {
                ...commonHeaders
            }
        });

        const res2 = await pul2.body.json();
        const detailsMap = new Map(res2.data.map(game => [game.id, game]));

        return {
            data: gamesList.map(b => ({
                ...b,
                details: b.universeId ? (detailsMap.get(b.universeId) || null) : null
            }))
        };
    }
    catch {
        return null;
    }
}

exports.setKeys = (sc, sp, tidal, deezer) => { keysc = sc; keysp = sp; keytidal = tidal; keydeezer = deezer; };