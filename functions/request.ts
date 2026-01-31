import { request as undiciRequest, Agent, interceptors } from 'undici';

const request = (url: string | URL, options?: any) => {
    const { maxRedirections, ...rest } = options || {};
    return undiciRequest(url, { 
        ...rest, 
        interceptors: { 
            Client: [interceptors.redirect({ maxRedirections: maxRedirections ?? 5 })] 
        } 
    });
};
// @ts-ignore
import { CurlImpersonateHttpClient, CurlImpersonate } from 'apify-node-curl-impersonate';
// @ts-ignore
import { ClientTransaction } from "x-client-transaction-id";
import { parseHTML } from 'linkedom';
import { decodeHTML, decodeXML } from 'entities';
import crypto from 'crypto';
import { Buffer } from 'buffer';

const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;


const userAgent = 'Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0';

export const commonHeaders = {
    'Accept': 'text/html, application/json, */*',
    'Accept-Language': 'en-US',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'User-Agent': userAgent
}

const listcodes: {name: string, code: string}[] = [
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

let keysc: string | undefined;
let keysp: string | undefined;
let keysptoken: string | undefined;
let keytidal: string | undefined;
let keydeezer: string | undefined;

let twitterDocument: any;
let twitterTransaction: any;
let twitterAuth: string | undefined;
let twitterObj: any = {};

function filterCookies(cookie: string | string[]) {
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

function filterSpecificCookies(cookie: string | string[], allowedKeys: string[] = []) {
    if (typeof cookie !== 'string' && !Array.isArray(cookie)) return '';
    const cookieStr = Array.isArray(cookie) ? cookie.join('; ') : cookie;
    return cookieStr
        .split(';')
        .map(c => c.trim())
        .filter(c => allowedKeys.includes(c.split('=')[0]))
        .join('; ');
}

export const soundcloudKey = async function soundcloudKey() {
    const rest = await request('https://m.soundcloud.com', {
        method: 'GET',
        headers: {
            ...commonHeaders,
        }
    })
        .then(a => a.body.text())
        .then(b => b.split('"clientId":"')[1].split('"')[0])
        .catch(() => undefined);
    return rest;
}

export const spotifyKey = async function spotifyKey() {
    const rest = await request(`https://open.spotify.com/embed/track/${["4PTG3Z6ehGkBFwjybzWkR8", "2yR2sziCF4WEs3klW1F38d", "0IuVhCflrQPMGRrOyoY5RW", "2yWlGEgEfPot0lv3OAjuG3", "4Xfp9BcKrKYmxJPxn68Yb8", "7uuJqaRjSXzja6VGgDpWem", "3BP1klbHxsOf6IxscNIX0r", "6BYzwbWg1Z2EB6VUXTYnhm"][Math.floor(Math.random() * 8)]}`, {
        headers: {
            ...commonHeaders,
        }
    })
        .then(a => a.body.text())
        .then(b => b.split('"accessToken":"')[1].split('"')[0])
        .catch(() => undefined);
    return rest;
}

export const spotifyKeyToken = async function spotifyKeyToken() {
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

    const res: any = await req.body.json();
    return res.granted_token.token;
    }
    catch {
        return undefined;
    }
}

export const tidalKeys = async function tidalKeys() {
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
    } catch { return undefined; }
}

export const deezerKeys = async function deezerKeys() {
    try {
        const rest = await request("https://auth.deezer.com/login/anonymous?jo=p&rto=p", {
            headers: {
                ...commonHeaders,
            }
        });
        let rest_get: any = await rest.body.text();
        rest_get = JSON.parse(rest_get);
        return rest_get.jwt;
    } catch { return undefined; }
}

export const twitterKey = async function twitterKey(typeName: string) {
    try {
        const response = await request("https://x.com/", {headers:{...commonHeaders}});
        const html = await response.body.text();
        const { document } = parseHTML(html);
        twitterDocument = document;

        twitterTransaction = new ClientTransaction(twitterDocument);
        await twitterTransaction.initialize();

        const pul1 = await request("https://abs.twimg.com/responsive-web/client-web/main" + html.split('client-web/main')[1].split('"')[0], {headers:{...commonHeaders}});

        const res1 = await pul1.body.text();
        twitterAuth = 'AAAAAAAAA' + res1.split('"AAAAAAAAA')[1].split('"')[0];
        const queryId_user = res1.split('e.exports={queryId:')
        .find(e => e.includes(`operationName:"${typeName}"`))
        ?.split('"')[1];
        const features_user = JSON.parse(res1.split('e.exports={queryId:')
        .find(e => e.includes(`operationName:"${typeName}"`))
        ?.split('featureSwitches:')[1].split(',field')[0] || '{}').reduce((acc: any, key: any) => {
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

export const YTVideo = async function YTVideo(que: string) {
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
        const [res, per] = await Promise.all([
            response.body.json() as Promise<any>,
            res2.body.text()
        ]);
        let testpar = null;
        try {
            testpar = JSON.parse(per.split('ytInitialData =')[1].split(';')[0]);
        }
        catch { }
        return { data: { innerTube: res?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer.contents?.filter((o: any) => Object.keys(o).length > 0)?.map((v: any) => v?.videoRenderer) || null, youtubeWeb: testpar?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.filter((o: any) => Object.keys(o).length > 0).map((v: any) => v?.videoRenderer)?.filter(Boolean) || null } };
    } catch (e) { console.error(e); return null; }
}

export const YTMusic = async function YTMusic(que: string) {
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
        const [res, per] = await Promise.all([
            response.body.json() as Promise<any>,
            res2.body.text()
        ]);

        let testper: any = null;
        try {
            const dataStr = per.split("data: '")[2]?.split("'")[0];
            if (dataStr) {
                const unescaped = dataStr.replace(/\\(x[0-9a-fA-F]{2}|.)/g, (match: string, p1: string) => {
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
        let youtubeMusicWebResults: any[] = [];
        if (testper) {
            const sections = testper?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
            // Find the section that actually contains the musicShelfRenderer
            const musicShelf = sections.find((section: any) => section.musicShelfRenderer)?.musicShelfRenderer;
            youtubeMusicWebResults = musicShelf?.contents || [];
        }

        return {
            data: {
                innerTube: innerTubeResults.filter((o: any) => o.musicResponsiveListItemRenderer).map((v: any) => v.musicResponsiveListItemRenderer) || null,
                youtubeMusicWeb: youtubeMusicWebResults.filter((o: any) => o.musicResponsiveListItemRenderer).map((v: any) => v.musicResponsiveListItemRenderer) || null
            }
        };
    } catch { return null; }
}

export const SCMusic = async function SCMusic(que: string, refresh_auth?: boolean): Promise<any> {
    if (!que) return null;

    if (refresh_auth || !keysc) {
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
        const [pes, pes2] = await Promise.all([
            per.body.json() as Promise<any>,
            per2.body.text()
        ]);
        let testpes: any = null;
        try {
            testpes = JSON.parse(pes2.split('type="application/json">')[1].split('</script>')[0]);
        }
        catch {}
        return { data: [pes?.collection || null, testpes?.props?.pageProps?.initialStoreState?.entities || null] };
    } catch (e) { console.error(e); return null; }
}

export const SPMusic = async function SPMusic(que: string, refresh_auth: boolean = false): Promise<any> {
    if (!que) return null;

    if (refresh_auth || !keysp || !keysptoken) {
        const [a, b] = await Promise.all([
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
            const [pes, pes2] = await Promise.all([
                per.body?.json() as Promise<any>,
                per2.body?.json() as Promise<any>
            ]);
            return { data: [pes?.tracks?.items || null, pes2?.data?.searchV2 || null] };
        }
    } catch { return null; }
}

export const YTLyrics = async function YTLyrics(url: string) {
    let videoId = url.match(/(?:[?&]v(?:i)?=|(?:^|\/)(?:youtu\.be|v|vi|u\/\w|embed|shorts|watch|live|source)\/)([A-Za-z0-9_-]{11})(?=$|[?#&/])/)?.[1];
    videoId = videoId || undefined;
    if (!videoId) return null;

    try {
        const responseBody: any = {
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
        const res: any = await response.body.json();

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

        const res2: any = await pull.body.json();

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

export const Shazam = async function Shazam(que: string) {
    if (!que) return null;
    try {
        const pull = await request(`https://www.shazam.com/services/amapi/v1/catalog/US/search?types=songs&limit=10&term=${que}`, {
            headers: {
                ...commonHeaders
            }
        });
        const res: any = await pull.body.json();
        return { data: res?.results?.songs?.data || null };
    } catch { return null; }
}

export const Deezer = async function Deezer(que: string) {
    if (!que) return null;
    try {
        const pull = await request(`https://api.deezer.com/search?limit=10&q=${que}`, {
            headers: {
                ...commonHeaders
            }
        });
        const res: any = await pull.body.json();
        return { data: res?.data || null };
    } catch { return null; }
}

export const deezerLyrics = async function deezerLyrics(que: string, refresh_auth: boolean = false): Promise<any> {
    if (!que) return null;

    try {
        if (refresh_auth || !keydeezer) {
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

        const responseBody: any = {
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

        const res: any = await pull.body.json();

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

        const res2: any = await pull2.body.json();

        if (res2?.errors?.[0]?.message.includes('Given jwt')) {
            return await deezerLyrics(que, true);
        }

        responseBody['lyrics'] = res2?.data?.track?.lyrics || null;

        return responseBody;
    } catch { return null; }
}

export const Tidal = async function Tidal(que: string, refresh?: boolean): Promise<any> {
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

        const res: any = await pull.body.json();
        return { data: res?.items || null };
    } catch { return null; }
}

export const Genius = async function Genius(que: string) {
    if (!que) return null;

    try {
        const client = await request(`https://genius.com/api/search/song?&per_page=10&q=${que}`, {
        method: 'GET',
        headers: {
            ...commonHeaders,
            'User-Agent': 'Mozilla/5.0 (compatible; Twitterbot/1.0)'
        }
        });

        if(client.statusCode === 403) {
            return {
                "error": "Cloudflare Turnstile asking to verify you're not a bot"
            }
        }

        const checkres: any = await client.body.text();

        const res = JSON.parse(checkres);
        return { data: res?.response?.sections?.[0]?.hits?.map((a: any) => a?.result) || null };
    } catch { return null; }
}

export const Gemini = async function Gemini(que: string, convo: any, retry: boolean = false) {
    if (!que) return null;

    let objectbody: any = { cid: null, rid: null, rcid: null, cookies: null };
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
    const qCid = objectbody.cid ? objectbody.cid : "";
    const qRid = objectbody.rid ? objectbody.rid : "";
    const qRcid = objectbody.rcid ? objectbody.rcid : "";
    const qCookies = objectbody.cookies ?? (filterSpecificCookies(objectbody.cookies, ['NID', '__Secure-ENID']) || null);

    const reqPayload = `f.req=%5Bnull%2C%22%5B%5B%5C%22${qQue}%5C%22%2C0%2Cnull%2Cnull%2Cnull%2Cnull%2C0%5D%2C%5B%5C%22en-US%5C%22%5D%2C%5B%5C%22${qCid}%5C%22%2C%5C%22${qRid}%5C%22%2C%5C%22${qRcid}%5C%22%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5C%22%5C%22%5D%2C%5C%22%5C%22%2C%5C%22%5C%22%2Cnull%2C%5B1%5D%2C1%2Cnull%2Cnull%2C1%2C0%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B%5B1%5D%5D%2C0%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C1%2Cnull%2Cnull%2C%5B4%5D%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B2%5D%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C0%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5C%22%5C%22%2Cnull%2C%5B%5D%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C2%5D%22%5D`;

    const req = await request(`https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?hl=en`, {
        dispatcher: new Agent({
            connectTimeout: 30000,
            bodyTimeout: 60000,
            headersTimeout: 60000
        }),
        method: 'POST',
        headers: {
            ...commonHeaders,
            ...(qCookies ? { 'Cookie': qCookies } : {}),
            'Content-Type': 'application/x-www-form-urlencoded',
            'x-goog-ext-525001261-jspb': '[1,null,null,null,"fbb127bbb056c959",null,null,0,[4],null,null,1]',
            'Referer': 'https://gemini.google.com',
            'Origin': 'https://gemini.google.com',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
        },
        body: reqPayload
    });

    if(req.statusCode === 302) {
        return {
            "error": "Google asking to verify you're not a bot"
        }
    }

    const cookiess: any = await req.headers?.['set-cookie'];
    const resText = await req.body.text();
    let response;

    let data;
    try {
        const cleanText = resText.split(")]}'\n\n")[1];
        data = JSON.parse(cleanText);

        let innerData;

        data.forEach((dt: any) => {
            let check;
            if (dt?.[0] === 'wrb.fr') {
                check = JSON.parse(dt[2]);
                if (check?.[4]?.[0]?.[8]?.[0] === 2) {
                    innerData = check;
                }
            }
        });

        if(!innerData) {
            if (retry) return { error: "Rate-limited" };
            return await Gemini(que, convo, true);
        }

        objectbody.cid = (innerData as any)[1][0];
        objectbody.rid = (innerData as any)[1][1];
        objectbody.rcid = (innerData as any)[4][0][0];
        objectbody.cookies = filterCookies(cookiess) || convo;

        response = (innerData as any)[4]?.[0]?.[1]?.[0] || null;
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

export const Translate = async function Translate(que: string, from?: string, to?: string) {
    if (!que) return null;

    const lFrom = from?.toLowerCase();
    const lTo = to?.toLowerCase();

    const findLangCode = (input?: string) => {
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

        const data: any = await response.body.json();

        let translatedText = '';
        if (data.sentences) {
            translatedText = data.sentences.map((s: any) => s.trans).join('');
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

export const infoYoutube = async function infoYoutube(que: string) {
    let videoId = que.match(/(?:[?&]v(?:i)?=|(?:^|\/)(?:youtu\.be|v|vi|u\/\w|embed|shorts|watch|live|source)\/)([A-Za-z0-9_-]{11})(?=$|[?#&/])/)?.[1];
    videoId = videoId || undefined;
    if (!videoId) return null;

    try {
        const bodyhttp = { videoId: videoId, context: { client: { clientName: 2, clientVersion: "2.20261231" } } }
        const bodyhttp2 = { videoId: videoId, context: { client: { clientName: 67, clientVersion: "1.20261231" } } }

        const [res, res2, res3] = await Promise.all([
                request('https://m.youtube.com/youtubei/v1/player?prettyPrint=false&fields=videoDetails,microformat,playabilityStatus', {
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
            request('https://m.youtube.com/youtubei/v1/player?prettyPrint=false&fields=videoDetails,microformat,playabilityStatus', {
                method: "POST",
                body: JSON.stringify(bodyhttp2),
                headers: {
                    ...commonHeaders,
                    'User-Agent': 'Bot'
                }
            }),
        ]);

        const [pull, pull2, pull3] = await Promise.all([
            res.body.json() as Promise<any>,
            res2.body.text(),
            res3.body.json() as Promise<any>
        ]);
        let testpar: any = null;
        try {
            testpar = JSON.parse(pull2.split('ytInitialData =')[1].split(';')[0]);
        }
        catch { }
        
        return {
            "data": { 
            "innerTube": [
                pull?.videoDetails || pull?.microformat ? { "videoDetails": pull } : {
                    "error": pull?.playabilityStatus ? (({ errorScreen, contextParams, ...rest }: any) => rest)(pull.playabilityStatus) : "Google asking to verify you're not a bot"
                },
                {
                    ...(pull3?.videoDetails || pull3?.microformat ? { "musicDetails": pull3 } : {
                        "error": pull3?.playabilityStatus ? (({ errorScreen, contextParams, ...rest }: any) => rest)(pull3.playabilityStatus) : "Google asking to verify you're not a bot"
                    })
                }
            ],
            "youtubeWeb": {
                ...(testpar?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.reduce((acc: any, obj: any) => Object.assign(acc, obj), {}) || { "videoDetails": null }),
                "nextVideosList": testpar?.contents?.twoColumnWatchNextResults?.secondaryResults?.secondaryResults?.results || null
                }
            }
        };
    }
    catch (e) {
        return null;
    }
}

export const infoYoutubeChannel = async function infoYoutubeChannel(url: string) {
    if (!url) return null;

    const match = url.match(/^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(channel\/|c\/|user\/|@)([a-zA-Z0-9_\-.]+)/);
    if (!match) return null;

    const prefix = match[1];
    const identifier = match[2];
    const requestUrl = `https://www.youtube.com/${prefix}${identifier}`;

    try {
        const response = await request(requestUrl, {
            method: "GET",
            headers: {
                ...commonHeaders
            }
        });
        const html = await response.body.text();
        let data: any;
        try {
            data = JSON.parse(html.split('ytInitialData =')[1].split(';')[0]);
        } catch {}

        const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.map((t: any) => t.tabRenderer).filter(Boolean) || [];
        
        const results = await Promise.all(tabs.map(async (tab: any) => {
             if (tab.content) return { title: tab.title, content: tab.content };
             if (!tab.endpoint?.browseEndpoint) return null;

             const { browseId, params } = tab.endpoint.browseEndpoint;
             
             try {
                 const bodyload = JSON.stringify({
                    browseId: browseId,
                    params: params,
                    context: {
                        client: {
                            clientName: "WEB",
                            clientVersion: "2.20251212",
                            hl: "en",
                            gl: "US"
                        }
                    }
                });
                
                const req = await request('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
                     method: "POST",
                     headers: {
                         ...commonHeaders,
                         'Content-Type': 'application/json'
                     },
                     body: bodyload
                });
                
                const res: any = await req.body.json();
                return { 
                    title: tab.title, 
                    content: res?.contents?.twoColumnBrowseResultsRenderer?.tabs?.find((t: any) => t?.tabRenderer?.selected)?.tabRenderer?.content || res 
                };
             } catch {
                 return { title: tab.title, error: "Failed to fetch" };
             }
        }));

        const finalres = results.filter(Boolean);
        
        return {
            data: finalres?.[0] ? finalres : null
        };
    } catch { return null; }
}

export const infoSoundcloud = async function infoSoundcloud(que: string, refresh_auth: boolean = false): Promise<any> {
    if(!que) return null;
    if(refresh_auth || !keysc) {
        keysc = await soundcloudKey();
    }
    try {
        const test = new URL(que);
        if(!test.host.endsWith('soundcloud.com')) return null;
        const [res, res2] = await Promise.all([
            request(`https://api-v2.soundcloud.com/resolve?client_id=${keysc}&url=https://soundcloud.com${test.pathname}`, {
            method: 'GET',
            headers: {
                ...commonHeaders
            }
        }),
            request("https://mobi.soundcloud.com" + test.pathname, {
            method: 'GET',
            headers: {
                ...commonHeaders
            }
        })    
        ]);
        if(res.statusCode === 401 || res.statusCode === 400) {
            return await infoSoundcloud(que, true);
        }
        const [pull, pull2Text] = await Promise.all([
            res.body.json() as Promise<any>,
            res2.body.text()
        ]);
        
        let pull2: any = null;
        try {
            pull2 = JSON.parse(pull2Text.split('type="application/json">')[1].split('</script>')[0]);
        } catch {}

        return { data: [pull || null, pull2?.props?.pageProps?.initialStoreState?.entities || null] };
    }
    catch (e) {
        console.error("infoSoundcloud error:", e);
        return null;
    }
}

export const infoSpotify = async function infoSpotify(que: string) {
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

        const pull: any = await res.body.json();

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

export const infoITunes = async function infoITunes(que: string) {
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

export const pinterest = async function pinterest(que: string) {
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

        const res: any = await req.body.json();
        return res.resource_response.data.results[0] ? { data: res.resource_response.data.results } : {
            'error': 'Looks like your search violate our terms of service'
        };
    }
    catch {
        return null;
    }
}

export const Discord = async (token: string, guildId: string, payload: any, payloadError: any, reasonAudit?: string) => {
    if (!token || token === 'null') return { error: 'Missing token' };
    if (!guildId) return { error: 'Missing guildId' };
    const url = `https://discord.com/api/v10/guilds/${guildId}`;

    try {
        // First try to fetch current info (GET) to verify access/token
        const req = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)'
            }
        });

        let currentInfo: any = null;
        try {
            currentInfo = await req.json();
        } catch {
            // If we can't parse the body, it might be an empty or error response
        }

        if(req.status !== 200) {
            return { 
                data: [null, null], 
                error: currentInfo || { status: req.status, statusText: req.statusText }
            };   
        }

        if (Object.keys(payload).length === 0) {
            return { data: [currentInfo, null] };
        }

        // Use fetch for the PATCH request
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)',
                ...(reasonAudit && { 'X-Audit-Log-Reason': reasonAudit })
            },
            body: JSON.stringify(payload)
        });

        let patchResponse: any = null;
        try {
            patchResponse = await response.json();
        } catch (e) {}

        if (response.status < 200 || response.status >= 300) {
            return { 
                data: [currentInfo.code === 0 ? null : currentInfo, null], 
                error: patchResponse || { status: response.status }
            };
        }

        const checkSpecificFields = (a: any, b: any) => {
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

export const DiscordWebhook = async (token: string, guildId: string, payload: any, payloadError?: any) => {
    const action = payload.action;

    if (payload.webhookUrl) {
        const match = payload.webhookUrl.match(/webhooks\/(\d+)(?:\/([a-zA-Z0-9_-]+))?(?:[/?]|$)/);
        if (match) {
            payload.webhookId = match[1];
            if (match[2]) payload.webhookToken = match[2];
        }
    }

    const webhookId = payload.webhookId || (action !== 'create' && action !== 'list' ? guildId : null);
    const channelId = payload.channelId || ((action === 'create' || action === 'list') ? guildId : null);
    const botUserAgent = 'DiscordBot (https://github.com/discord-bot, 1.0.0)';

    let url = '';
    let method = 'GET';

    const webhookToken = payload.webhookToken;

    if (action === 'create') {
        if (!token || token === 'null') return { error: 'Missing token' };
        if (!channelId) return { error: 'Missing channelId' };
        url = `https://discord.com/api/v10/channels/${channelId}/webhooks`;
        method = 'POST';

        if (payload.avatar && payload.avatar.startsWith('http')) {
            try {
                const res = await fetch(payload.avatar, { headers: { ...commonHeaders } });
                if (res.ok) {
                    const contentType = res.headers.get('content-type');
                    if (contentType?.startsWith('image/') || contentType?.startsWith('video/')) {
                        const arrayBuffer = await res.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        payload.avatar = `data:${contentType};base64,${buffer.toString('base64')}`;
                    }
                }
            } catch (e) { }
        }
    } else if (action === 'info') {
        if (!webhookId) return { error: 'Missing webhookId' };
        url = `https://discord.com/api/v10/webhooks/${webhookId}${(!token && webhookToken) ? `/${webhookToken}` : ''}`;
        method = 'GET';
    } else if (action === 'delete') {
        if (!webhookId) return { error: 'Missing webhookId' };
        url = `https://discord.com/api/v10/webhooks/${webhookId}${(!token && webhookToken) ? `/${webhookToken}` : ''}`;
        method = 'DELETE';
    } else if (action === 'send') {
        if (!webhookId) return { error: 'Missing webhookId' };
        if (!webhookToken) return { error: 'Missing webhookToken' };
        url = `https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}`;
        method = 'POST';
    } else if (action === 'list') {
        if (!token || token === 'null') return { error: 'Missing token' };
        if (!channelId) return { error: 'Missing channelId' };
        url = `https://discord.com/api/v10/channels/${channelId}/webhooks`;
        method = 'GET';
    } else {
        return { error: 'Nothing to do' };
    }

    try {
        const headers: any = {
            'Content-Type': 'application/json',
            'User-Agent': botUserAgent
        };

        if (token && token !== 'null') {
            headers['Authorization'] = `Bot ${token}`;
        }

        let bodyPayload: any = null;
        let checkUserFill: boolean = false;
        if (method === 'POST') {
            if (action === 'create') {
                bodyPayload = {
                    name: payload.name || 'New Webhook',
                    avatar: payload.avatar || null
                };
            } else if (action === 'send') {
                bodyPayload = {
                    content: payload.content || '',
                    username: payload.username || null,
                    avatar_url: payload.avatar_url || null
                };
                // Clean null values
                Object.keys(bodyPayload).forEach(key => bodyPayload[key] === null && delete bodyPayload[key]);
            }
        }

        let response = await fetch(url, {
            method: method,
            headers: headers,
            ...(bodyPayload && { body: JSON.stringify(bodyPayload) })
        });

        let result: any = null;
        if (response.status !== 204) {
            try {
                result = await response.json();
            } catch (e) {}
        }

        // Fallback logic for info/delete if bot token fails but webhook token is available
        if (token && webhookToken && (action === 'info' || action === 'delete') && (response.status === 403 || result?.code === 50013)) {
            const fallbackUrl = `https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}`;
            const fallbackHeaders = { ...headers };
            delete fallbackHeaders['Authorization'];
            
            response = await fetch(fallbackUrl, {
                method: method,
                headers: fallbackHeaders,
                ...(bodyPayload && { body: JSON.stringify(bodyPayload) })
            });

            if (response.status !== 204) {
                try {
                    result = await response.json();
                    checkUserFill = true;
                } catch (e) {
                    result = null;
                }
            } else {
                result = null;
            }
        }

        if (action === 'info' && result && typeof result === 'object') {
            if (result.user === undefined) {
                if (checkUserFill && response.status === 200) {
                    result.user = {
                        error: "Cannot access to this channel, " + result.channel_id
                    };
                } else {
                    result.user = null;
                }
            }
        }

        if (response.status < 200 || response.status >= 300) {
            return {
                data: null,
                error: result || { status: response.status }
            };
        }

        return { data: [result || true, null, response.status] };
    } catch (e: any) {
        return { error: e.message };
    }
};

export const GettyImage = async function GettyImage(que: string) {
    if(!que) return null;
    try {
        const req = await request(`https://www.istockphoto.com/en/search/2/image?phrase=${que}&page=1`, {
            headers: {
                ...commonHeaders,
                'Accept': 'application/json'
            }
        });

        const res: any = await req.body.json();
        return {
            data: [res?.gallery?.assets ?? null, res?.relatedTerms ?? null]
        };
    }
    catch {
        return null;
    }

};

export const Unsplash = async function Unsplash(que: string) {
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

    const res: any = await pull.body.json();
    return { data: res?.results?.[0] ? {
        non_premium: res?.results.filter((a: any) => !a.premium),
        premium: res?.results.filter((a: any) => a.premium)
    } : null
    };
    } catch { return null; }
}

export const Pixiv = async function Pixiv(que: string) {
    if(!que) return null;

    try {
        const per = await request(`https://www.pixiv.net/ajax/search/artworks/${que}?word=${que}&order=date_d&mode=safe&p=1&csw=0&s_mode=s_tag&type=all&ai_type=0&lang=en`, {
        headers: {
            ...commonHeaders
            }
        });

        const res: any = await per.body.json();
        const items = res?.body?.illust?.data || res?.body?.illustManga?.data || [];
        return {
            data: {
                data: items?.map((item: any) => {
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

export const DiscordServers = async function DiscordServers(que: string) {
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

        const res: any = await per.body.json();
        return { data: res?.hits || null }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const Bilibili = async function Bilibili(que: string) {
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

        const res: any = await per.body.json();
        return { data: (res?.data?.modules?.[0]?.items || res?.data?.modules?.[1]?.items) || null }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const DiscordApps = async function DiscordApps(que: string) {
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

        const res: any = await per.body.json();
        return { data: res?.results || null }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const Jiosaavn = async function Jiosaavn(que: string) {
    if(!que) return null;

    try {
        const per = await request(`https://www.jiosaavn.com/api.php?_format=json&n=10&__call=search.getResults&q=${que}`, {
        headers: {
            ...commonHeaders
            }
        });

        const res: any = await per.body.json();
        const items = res?.results || [];

        return { data: items?.map((item: any) => {
                const { encrypted_media_url, encrypted_drm_media_url, encrypted_media_path, ...rest } = item;
                return rest;
            }) || null }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const Twitch = async function Twitch(que: string) {
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

        const res: any = await per.body.json();

        return { data: res?.data?.searchFor || null };
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const InstagramUser = async function InstagramUser(que: string) {
    if(!que) return null;

    try {
        const bodyhttp = {"data":{"include_reel":"true","query":que},"hasQuery":true};
        const per = await request(`https://i.instagram.com/graphql/query/?doc_id=24146980661639222&variables=${JSON.stringify(bodyhttp)}`, {
        headers: {
            ...commonHeaders
            }
        });

        const res: any = await per.body.json();

        return { data: res?.data?.xdt_api__v1__fbsearch__topsearch_connection?.users || null }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const ThreadUser = async function ThreadUser(que: string) {
    if(!que) return null;

    try {
        const bodyhttp = {"query":que,"first":50,"should_fetch_ig_inactive_on_text_app":true,"should_fetch_friendship_status":false,"should_fetch_fediverse_profiles":true,"hide_unconnected_private":false,"__relay_internal__pv__BarcelonaIsLoggedInrelayprovider":false,"__relay_internal__pv__BarcelonaIsCrawlerrelayprovider":false,"__relay_internal__pv__BarcelonaHasDisplayNamesrelayprovider":false};
        const per = await request(`https://www.threads.com/graphql/query?doc_id=24871030029227550&variables=${JSON.stringify(bodyhttp)}`, {
        headers: {
            ...commonHeaders,
            'Origin': 'https://www.threads.com',
            'X-IG-App-ID': '1412234116260832',
            'X-LOGGED-OUT-THREADS-MIGRATED-REQUEST': 'true'
            }
        });

        const res: any = await per.body.json();

        return { data: res?.data?.xdt_api__v1__users__search_connection?.edges?.map((a: any) => a?.node) || null }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const Pexels = async function Pexels(que: string) {
    if(!que) return null;

    try {
        const response = await request(`https://www.pexels.com/search/${encodeURIComponent(que)}`, {
            headers: {
                ...commonHeaders,
                'User-Agent': 'Mozilla/5.0 (compatible; Twitterbot/1.0)'
            }
        });
        if(response.statusCode === 403) {
            return {
                "error": "Cloudflare Turnstile asking to verify you're not a bot"
            };
        }
        const html = await response.body.text();
        let pull = null;
        try {
            pull = JSON.parse(html.split('"application/json">')?.[1]?.split('</script>')?.[0]);
        }
        catch {}
        return { data: pull?.props?.pageProps?.initialData || null };
    }
    catch (e) {
        console.error(e);
        return null;
    }
};

export const TiktokVideo = async function TiktokVideo(que: string) {
    if(!que) return null;

    try {
        const pul = await request(`https://api-boot.tiktokv.com/aweme/v1/search/item/?count=10&keyword=${que}&version_code=3.2.0&app_name=musical_ly&channel=App+Store&device_id=7386407102867523334&aid=1233&os_version=16.2&device_platform=iphone&iid=7386407102867523334&device_brand=iphone&device_type=iPhone10,6`, {
        headers: {
            ...commonHeaders,
            'X-Khronos': Math.floor(Date.now() / 1000).toString()
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

export const TiktokMusic = async function TiktokMusic(que: string) {
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

export const TiktokUser = async function TiktokUser(que: string) {
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
        return { data: testres?.user_list?.map((a: any) => a.user_info) || null };
    }
    catch {
        return null;
    }
}

export const infoTwitterUser = async function infoTwitterUser(que: string, refresh_auth?: boolean): Promise<any> {
    if(!que) return null;
    if (refresh_auth || !twitterAuth || !twitterObj?.UserByScreenName) {
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
        let res2: any = {};
        if(res?.data?.user?.result?.rest_id) {
            pul2 = await request(`https://syndication.twitter.com/srv/timeline-profile/user-id/${res?.data?.user?.result?.rest_id}`, {
                headers: {
                    ...commonHeaders
                }
            });
            try {
            const body2 = await pul2.body.text();
            res2 = JSON.parse(body2.split('type="application/json">')[1].split('</script>')[0]);
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

export const infoTwitterTweet = async function infoTwitterTweet(que: string, refresh_auth?: boolean): Promise<any> {
    if(!que) return null;
    if (refresh_auth || !twitterAuth || !twitterObj?.TweetResultByRestId) {
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

        if(pul.statusCode === 401 || pul.statusCode === 400) return await infoTwitterTweet(que, true);

        const tryParseJson = async (p: any) => {
            if (p.statusCode !== 200) return null;
            try { return await p.body.json(); } catch { return null; }
        };

        const [res, res2] = await Promise.all([
             pul.statusCode === 403 ? Promise.resolve({ "error": "Bad auth" }) : tryParseJson(pul),
             tryParseJson(pul2)
        ]);

        return { data: [res?.data?.tweetResult?.result || null, res2 || null] };
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const redditMedia = async function redditMedia(que: string) {
    if(!que) return null;

    try {
        const req = await request(`https://old.reddit.com/search/.json?q=${que}&sort=relevance&type=media`, {
            headers: {
                ...commonHeaders,
                'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.1; +https://discordapp.com)'
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

        const res: any = await req.body?.json();
        return { data: res?.data?.children?.map((a: any) => a?.data) || null }
    }
    catch {
        return null;
    }
}

export const robloxGames = async function robloxGames(que: string) {
    if(!que) return null;

    try {
        const pul1 = await request(`https://apis.roblox.com/search-api/omni-search?searchQuery=${que}&sessionId=abc`, {
            headers: {
                ...commonHeaders
            }
        });

        const res1: any = await pul1.body.json();
        const gamesList = res1.searchResults?.flatMap((group: any) => group.contents) || [];
        const restIds = gamesList.filter((b: any) => b?.universeId).map((b: any) => b.universeId).join(',');

        if(!restIds) return { data: gamesList };

        const pul2 = await request(`https://games.roblox.com/v1/games?universeIds=${restIds}`, {
            headers: {
                ...commonHeaders
            }
        });

        const res2: any = await pul2.body.json();
        const detailsMap = new Map(res2.data.map((game: any) => [game.id, game]));

        return {
            data: gamesList.map((b: any) => ({
                ...b,
                details: b.universeId ? (detailsMap.get(b.universeId) || null) : null
            }))
        };
    }
    catch {
        return null;
    }
}

export const YTChannel = async function YTChannel(que: string) {
    if (!que) return null;
    try {
        const bodyload = JSON.stringify({
            query: que,
            params: "EgIQAg%3D%3D",
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
        request('https://m.youtube.com/youtubei/v1/search?prettyPrint=false&fields=contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents.itemSectionRenderer.contents.channelRenderer', {
            headers: {
                ...commonHeaders,
                'content-type': 'application/json'
            },
            body: bodyload,
            method: "POST"
        }),
        request(`https://www.youtube.com/results?search_query=${que}&sp=EgIQAg%3D%3D`, {
            method: "GET",
            headers: {
                ...commonHeaders,
            }
        })
        ]);
        const [res, per] = await Promise.all([
            response.body.json() as Promise<any>,
            res2.body.text()
        ]);
        let testpar: any = null;
        try {
            testpar = JSON.parse(per.split('ytInitialData =')[1].split(';')[0]);
        }
        catch { }
        return { data: { innerTube: res?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer.contents?.filter((o: any) => Object.keys(o).length > 0)?.map((v: any) => v?.channelRenderer) || null, youtubeWeb: testpar?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.filter((o: any) => Object.keys(o).length > 0).map((v: any) => v?.channelRenderer)?.filter(Boolean) || null } };
    } catch { return null; }
}

export const robloxAudio = async function robloxAudio(que: string) {
    if(!que) return null;

    try {
        const pul1 = await request(`https://apis.roblox.com/toolbox-service/v1/marketplace/3?limit=40&keyword=${encodeURIComponent(que)}`, {
            headers: {
                ...commonHeaders
            }
        });

        const res1: any = await pul1.body.json();
        const assetList = res1.data || [];
        const assetIds = assetList.map((b: any) => b.id).join(',');

        if(!assetIds) return { data: null };

        const [pul2, pul3] = await Promise.all([
            request(`https://apis.roblox.com/toolbox-service/v1/items/details?assetIds=${assetIds}`, {
                headers: {
                    ...commonHeaders
                }
            }),
            request(`https://thumbnails.roblox.com/v1/assets?assetIds=${assetIds}&size=420x420&format=Png`, {
                headers: {
                    ...commonHeaders
                }
            })
        ]);

        const [res2, res3] = await Promise.all([
            pul2.body.json() as Promise<any>,
            pul3.body.json() as Promise<any>
        ]);

        const thumbnails = res3.data || [];
        const details = res2.data || [];

        return {
            data: details.map((item: any) => {
                const thumb = thumbnails.find((t: any) => t.targetId === item.asset.id);
                return {
                    title: item.asset.audioDetails?.title || item.asset.name,
                    duration: item.asset.duration || 0,
                    thumbnail: thumb?.imageUrl || "https://prod.docsiteassets.roblox.com/assets/feeds/robloxYoutubeAvatar.webp",
                    url: `https://create.roblox.com/store/asset/${item.asset.id}`,
                    ...item
                };
            })
        };
    }
    catch {
        return null;
    }
}

export const Bandcamp = async function Bandcamp(que: string) {
    if(!que) return null;

    try {
        const body = {
            "search_text": que,
            "search_filter": "t",
            "full_page": false
        };

        const pul = await request(`https://bandcamp.com/api/bcsearch_public_api/1/autocomplete_elastic`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                ...commonHeaders,
                'Content-Type': 'application/json',
                'Origin': 'https://bandcamp.com'
            }
        });

        const res: any = await pul.body.json();
        const results = res?.auto?.results || [];

        return {
            data: results.map((b: any) => ({
                title: b.name,
                thumbnail: b.img_id === null ? (b.img ? b.img.replace('/img/', '/img/a') : null) : `https://f4.bcbits.com/img/a${b.art_id || b.img_id}_10.jpg`,
                url: b.item_url_path,
                ...b
            }))
        };
    }
    catch (e) {
        return null;
    }
}

export const Capcut = async function Capcut(que: string) {
    if(!que) return null;

    try {
        const time = Math.round(Date.now() / 1000);
        const linkhost = "https://edit-api-sg.capcut.com/lv/v1/cc_web/replicate/search_templates";
        
        // $cropText[$get[linkhost];-7] implementation: taking last 7 characters
        const croppedHost = linkhost.slice(-7);
        
        const signStr = `9e2c|${croppedHost}|7|5.8.0|${time}||11ac`;
        const sign = crypto.createHash('md5').update(signStr).digest('hex');

        const body = {
            "sdk_version": "100.0.0",
            "count": 10,
            "cursor": "0",
            "query": que,
            "scene": 1,
            "search_version": 2
        };

        const pul = await request(linkhost, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
                ...commonHeaders,
                'Sign': sign,
                'Sign-Ver': '1',
                'Device-Time': time.toString(),
                'Pf': '7',
                'Appvr': '5.8.0',
                'App-Sdk-Version': '48.0.0',
                'Lan': 'en',
                'Loc': 'sg',
                'Origin': 'https://www.capcut.com',
                'Referer': 'https://www.capcut.com',
                'sec-fetch-site': 'same-site'
            }
        });

        const res: any = await pul.body.json();
        const templates = res?.data?.video_templates || [];

        return {
            data: templates.map((tp: any) => ({
                title: tp.short_title || tp.title,
                duration: tp.duration,
                thumbnail: tp.optimized_cover_url?.cover_url_large || tp.cover_url,
                url: `https://capcut.com/templates/${tp.web_id}`,
                ...tp
            }))
        };
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const redditSubreddit = async function redditSubreddit(que: string) {
    if(!que) return null;

    try {
        const req = await request(`https://old.reddit.com/r/${que.toLowerCase()}/.json`, {
            headers: {
                ...commonHeaders,
                'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.1; +https://discordapp.com)'
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

        const res: any = await req.body?.json();
        return { data: res?.data?.children?.map((a: any) => a?.data) || null }
    }
    catch {
        return null;
    }
}

export const instagramUser = async function instagramUser(que: string) {
    if(!que) return null;

    try {
        const testreq = await request(`https://www.instagram.com/${que}/embed`, {
            headers: {
                ...commonHeaders,
                'Sec-Fetch-Dest': 'iframe'
            }
        });

        if(testreq.statusCode === 302) {
            return {
                error: "Please sign in"
            }
        }

        const resreq = await testreq.body.text();
        const profile_id = resreq.split('owner-id="')[1]?.split('"')?.[0];

        if(!profile_id) {
            return {
                data: null
            }
        }

        const bodyhttp = {"enable_integrity_filters":true,"id":profile_id,"render_surface":"PROFILE","__relay_internal__pv__PolarisCannesGuardianExperienceEnabledrelayprovider":true,"__relay_internal__pv__PolarisCASB976ProfileEnabledrelayprovider":false,"__relay_internal__pv__PolarisRepostsConsumptionEnabledrelayprovider":false};

        const [req, req2] = await Promise.all([
            request(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${que}`, {
                headers: {
                    ...commonHeaders,
                    'User-Agent': `Instagram ${getRandomInt(400, 450)}.${getRandomInt(0, 9)}.${getRandomInt(0, 9)}.${getRandomInt(10, 99)}.${getRandomInt(100, 999)} Android (36/16; 540dpi; 1080x2340; samsung; SM-S928U; e3q; qcom; en_US; ${getRandomInt(100000000, 999999999)})`,
                    'Origin': 'https://www.instagram.com',
                    'X-Ig-App-Id': "936619743392459",
                    'X-Asbd-Id': "198387",
                    'X-Ig-Www-Claim': "0"
                }
            }),
            request(`https://www.instagram.com/graphql/query/?doc_id=25980296051578533&variables=${JSON.stringify(bodyhttp)}`, {
                headers: {
                    ...commonHeaders,
                    'Origin': 'https://www.instagram.com',
                    'X-Ig-App-Id': "936619743392459",
                    'X-Asbd-Id': "198387",
                    'X-Ig-Www-Claim': "0"
                }
            })
        ]);

        let a: any = null;
        let b: any = null;

        const [res, res2]: any = await Promise.all([
            req.body.json().catch(() => null),
            req2.body.json().catch(() => null)
        ]);

        a = res?.data?.user;
        b = res2?.data?.user || res2?.data || res2;

        if (!a && req.statusCode !== 200 && req.statusCode !== 404) {
            a = {
                ...res
            };
        }

        const source = (a && a.id) ? a : (b?.user ? b.user : b);
        const formatted = (source && source.id) ? {
            avatar_url: source.profile_pic_url_hd || source.profile_pic_url,
            userid: source.id,
            username: source.username,
            nickname: source.full_name,
            profile_url: "https://www.instagram.com/" + source.username,
            description: source.biography,
            category: source.category_name || null,
            external_links: source.bio_links,
            followed_count: source.edge_follow?.count || source.following_count,
            follower_count: source.edge_followed_by?.count || source.follower_count,
            post_count: source.edge_owner_to_timeline_media?.count || source.media_count,
            verified: source.is_verified,
            private: source.is_private,
            pronouns: source.pronouns?.[0] ? source.pronouns : null 
        } : null;

        return { data: [formatted || null, a || null, b || null] };
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const infoThreadUser = async function infoThreadUser(que: string) {
    if(!que) return null;

    try {
        const bodyhttp = {"username":que,"__relay_internal__pv__BarcelonaIsInternalUserrelayprovider":false,"__relay_internal__pv__BarcelonaIsLoggedInrelayprovider":false,"__relay_internal__pv__BarcelonaHasSpoilerStylingInforelayprovider":false,"__relay_internal__pv__BarcelonaShouldShowFediverseM1Featuresrelayprovider":false,"__relay_internal__pv__BarcelonaHasEventBadgerelayprovider":false};
        let bodyhttp2: any = {"allow_page_info_for_lox_user":true,"first":50,"skipGhostPosts":false,"userID":null,"__relay_internal__pv__BarcelonaIsLoggedInrelayprovider":false,"__relay_internal__pv__BarcelonaHasProfileSelfReplyContextrelayprovider":false,"__relay_internal__pv__BarcelonaHasInlineReplyComposerrelayprovider":false,"__relay_internal__pv__BarcelonaIsReplyApprovalEnabledrelayprovider":false,"__relay_internal__pv__BarcelonaIsReplyApprovalsConsumptionEnabledrelayprovider":false,"__relay_internal__pv__BarcelonaHasDearAlgoConsumptionrelayprovider":true,"__relay_internal__pv__BarcelonaHasEventBadgerelayprovider":false,"__relay_internal__pv__BarcelonaIsSearchDiscoveryEnabledrelayprovider":false,"__relay_internal__pv__BarcelonaHasPodcastConsumptionrelayprovider":true,"__relay_internal__pv__BarcelonaHasCommunitiesrelayprovider":false,"__relay_internal__pv__BarcelonaHasSelfThreadCountrelayprovider":false,"__relay_internal__pv__IsTagIndicatorEnabledrelayprovider":true,"__relay_internal__pv__BarcelonaHasDeepDiverelayprovider":false,"__relay_internal__pv__BarcelonaHasGhostPostConsumptionrelayprovider":true,"__relay_internal__pv__BarcelonaHasSpoilerStylingInforelayprovider":false,"__relay_internal__pv__BarcelonaHasGhostPostEmojiActivationrelayprovider":false,"__relay_internal__pv__BarcelonaOptionalCookiesEnabledrelayprovider":true,"__relay_internal__pv__BarcelonaHasDearAlgoWebProductionrelayprovider":false,"__relay_internal__pv__BarcelonaQuotedPostUFIEnabledrelayprovider":true,"__relay_internal__pv__BarcelonaHasTopicTagsrelayprovider":true,"__relay_internal__pv__BarcelonaIsCrawlerrelayprovider":false,"__relay_internal__pv__BarcelonaHasDisplayNamesrelayprovider":false,"__relay_internal__pv__BarcelonaHasCommunityTopContributorsrelayprovider":false,"__relay_internal__pv__BarcelonaCanSeeSponsoredContentrelayprovider":false,"__relay_internal__pv__BarcelonaShouldShowFediverseM075Featuresrelayprovider":false,"__relay_internal__pv__BarcelonaImplicitTrendsGKrelayprovider":false,"__relay_internal__pv__BarcelonaIsInternalUserrelayprovider":false};
        
        const [per, per2] = await Promise.all([
            request(`https://www.threads.com/graphql/query?doc_id=26203769429220861&variables=${JSON.stringify(bodyhttp)}`, {
                headers: {
                    ...commonHeaders,
                    'User-Agent': `Barcelona ${getRandomInt(400, 450)}.${getRandomInt(0, 9)}.${getRandomInt(0, 9)}.${getRandomInt(10, 99)}.${getRandomInt(100, 999)} Android (35/15; 480dpi; 1220x2712; Xiaomi/Redmi; 23090RA98G; zircon; mt6886; fr_FR; ${getRandomInt(100000000, 999999999)})`,
                    'Origin': 'https://www.threads.com',
                    'X-IG-App-ID': '1412234116260832',
                    'X-LOGGED-OUT-THREADS-MIGRATED-REQUEST': 'true'
                }
            }),
            request(`https://www.threads.com/@${que}`, {
                headers: { ...commonHeaders }
            })
        ]);

        const [res, resText2]: [any, string] = await Promise.all([
            per.statusCode === 200 ? per.body.json().catch(() => null) : Promise.resolve(null),
            per2.statusCode === 200 ? per2.body.text().catch(() => "") : Promise.resolve("")
        ]);

        let webData: any[] = [];
        try {
            if (resText2) {
                const sjsParts = resText2.split('data-sjs>');
                sjsParts.shift(); // Remove first part before script tags
                
                for (const part of sjsParts) {
                    if (part.includes('RelayPrefetchedStreamCache')) {
                        try {
                            const jsonStr = part.split('</script>')[0];
                            const parsed = JSON.parse(jsonStr);
                            
                            // Traverse the specific path: require►0►3►0►__bbox►require►0►3►1►__bbox►result►data
                            const reqs = parsed?.require || [];
                            for (const req of reqs) {
                                // req = ["ScheduledServerJS", "handle", null, [...]]
                                const args = req?.[3] || [];
                                for (const arg of args) {
                                    const innerReqs = arg?.__bbox?.require || [];
                                    for (const innerReq of innerReqs) {
                                        // innerReq = ["RelayPrefetchedStreamCache", "next", [], [...]]
                                        if (innerReq?.[0] === 'RelayPrefetchedStreamCache') {
                                            const data = innerReq?.[3]?.[1]?.__bbox?.result?.data;
                                            if (data) webData.push(data);
                                        }
                                    }
                                }
                            }
                        } catch {}
                    }
                }
            }
        } catch (e) {}

        let finalres: any = res?.data?.user || null;
        let edges: any = null;

        if (finalres) { 
            bodyhttp2.userID = finalres.id;
            const per3 = await request(`https://www.threads.com/graphql/query?doc_id=33773912952222602&variables=${JSON.stringify(bodyhttp2)}`, {
                headers: {
                    ...commonHeaders,
                    'User-Agent': `Barcelona ${getRandomInt(400, 450)}.${getRandomInt(0, 9)}.${getRandomInt(0, 9)}.${getRandomInt(10, 99)}.${getRandomInt(100, 999)} Android (35/15; 480dpi; 1220x2712; Xiaomi/Redmi; 23090RA98G; zircon; mt6886; fr_FR; ${getRandomInt(100000000, 999999999)})`,
                    'Origin': 'https://www.threads.com',
                    'X-IG-App-ID': '1412234116260832',
                    'X-LOGGED-OUT-THREADS-MIGRATED-REQUEST': 'true'
                }
            });

            if (per3.statusCode === 200) {
                const res3 = await per3.body.json() as any;
                edges = res3?.data?.mediaData?.edges?.map((a: any) => a?.node?.thread_items?.[0]?.post) || null;
            }

            finalres = {
                ...finalres,
                edges: edges || finalres.edges || null
            };
        }
        else if (res?.status !== 'ok') {
            finalres = {
                error: "Cannot process this",
                raw: res?.data || res
            }
        }

        return { data: [finalres || null, { user: webData[0]?.user || null, edges: webData[1]?.mediaData?.edges?.map((a: any) => a?.node) || null }] };
    } catch (e) {
        console.error(e);
        return null;
    }
}

export const setKeys = (sc: string, sp: string, tidal: string, deezer: string) => { keysc = sc; keysp = sp; keytidal = tidal; keydeezer = deezer; };
