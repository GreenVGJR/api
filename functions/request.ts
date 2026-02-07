import { request as undiciRequest, Agent, interceptors } from 'undici';
import { Session } from 'httpcloak';

const DEFAULT_TIMEOUT_MS = 60000; // 1 minute

const request: typeof undiciRequest = (url, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    
    return undiciRequest(url, {
        ...options,
        signal: controller.signal,
    }).finally(() => {
        clearTimeout(timeoutId);
    });
};

import { ClientTransaction } from "x-client-transaction-id";
import { parseHTML } from 'linkedom';
import { decodeHTML, decodeXML } from 'entities';
import crypto from 'crypto';
import { Buffer } from 'buffer';

const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const userAgent = 'Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0';

export const commonHeaders = {
    'Accept': 'text/html, application/json, */*',
    'Accept-Language': 'en',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'User-Agent': userAgent
}

const parseAbbreviatedNumber = (str: string | null | undefined): number | null => {
    if (!str) return null;
    const cleanStr = str.replace(/,/g, '').replace(/subscribers|videos|video|views|view|watching/gi, '').trim();
    const match = cleanStr.match(/^(\d+\.?\d*)([KMB]?)$/i);
    if (!match) {
        const n = parseFloat(cleanStr);
        return isNaN(n) ? null : Math.floor(n);
    }
    
    let num = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    switch (unit) {
        case 'K': num *= 1000; break;
        case 'M': num *= 1000000; break;
        case 'B': num *= 1000000000; break;
    }
    return Math.floor(num);
};

const listcodes: { name: string, code: string }[] = [
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
    try {
        const res = await request('https://m.soundcloud.com', {
            method: 'GET',
            headers: {
                ...commonHeaders,
            }
        });
        const text = await res.body.text();
        return text.split('"clientId":"')[1].split('"')[0];
    } catch {
        return undefined;
    }
}

export const spotifyKey = async function spotifyKey() {
    try {
        const res = await request(`https://open.spotify.com/embed/track/${["4PTG3Z6ehGkBFwjybzWkR8", "2yR2sziCF4WEs3klW1F38d", "0IuVhCflrQPMGRrOyoY5RW", "2yWlGEgEfPot0lv3OAjuG3", "4Xfp9BcKrKYmxJPxn68Yb8", "7uuJqaRjSXzja6VGgDpWem", " BP1klbHxsOf6IxscNIX0r", "6BYzwbWg1Z2EB6VUXTYnhm"][Math.floor(Math.random() * 8)]}`, {
            headers: {
                ...commonHeaders,
            }
        });
        const text = await res.body.text();
        return text.split('"accessToken":"')[1].split('"')[0];
    } catch {
        return undefined;
    }
}

export const spotifyKeyToken = async function spotifyKeyToken() {
    const bodyhttp = { "client_data": { "client_version": "1.0", "client_id": "d8a5ed958d274c2e8ee717e6a4b0971d", "js_sdk_data": {} } };

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
        const rest = await request(`https://embed.tidal.com/tracks/${[406956243, 1550546][Math.floor(Math.random() * 2)]}`, {
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
        const response = await request("https://x.com/", { headers: { ...commonHeaders } });
        const html = await response.body.text();
        const { document } = parseHTML(html);
        twitterDocument = document;

        twitterTransaction = new ClientTransaction(twitterDocument);
        await twitterTransaction.initialize();

        const pul1 = await request("https://abs.twimg.com/responsive-web/client-web/main" + html.split('client-web/main')[1].split('"')[0], { headers: { ...commonHeaders } });

        const res1 = await pul1.body.text();
        twitterAuth = 'AAAAAAAAA' + res1.split('"AAAAAAAAA')[1].split('"')[0];
        const queryId_user = res1.split('e.exports={queryId:')
            .find((e: any) => e.includes(`operationName:"${typeName}"`))
            ?.split('"')[1];
        const features_user = JSON.parse(res1.split('e.exports={queryId:')
            .find((e: any) => e.includes(`operationName:"${typeName}"`))
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
        const response = await request('https://m.youtube.com/youtubei/v1/search?prettyPrint=false&fields=contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents.itemSectionRenderer.contents.videoRenderer', {
                headers: {
                    ...commonHeaders,
                    'content-type': 'application/json'
                },
                body: bodyload,
                method: "POST"
        });

        const res: any = await response.body.json();
        let alk: any[] = [];
        const inrtubeContents = res?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
        
        inrtubeContents.forEach((item: any) => {
            const a = item.videoRenderer;
            if (!a) return;

            try {
                const chnl = a.longBylineText?.runs?.[0];
                const chnl2 = chnl?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url;
                const fom = {
                    videoId: a.videoId,
                    url: "https://www.youtube.com/watch?v=" + a.videoId,
                    thumbnails: [
                        ...(a.thumbnail?.thumbnails || []).map((t: any) => ({ ...t, url: t.url?.startsWith('//') ? 'https:' + t.url : t.url })),
                        ...(a.richThumbnail?.movingThumbnailRenderer?.movingThumbnailDetails?.thumbnails || []).map((t: any) => ({ ...t, url: t.url?.startsWith('//') ? 'https:' + t.url : t.url }))
                    ],
                    title: a.title?.runs?.[0]?.text,
                    description: a.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((b: any) => b.text).join('') || "",
                    owner: {
                        name: a.ownerText?.runs?.[0]?.text,
                        url: chnl2 ? ["https://www.youtube.com" + chnl2] : chnl?.navigationEndpoint?.showDialogCommand?.panelLoadingStrategy?.inlineContent?.dialogViewModel?.customContent?.listViewModel?.listItems?.map((d: any) => "https://www.youtube.com" + d.listItemViewModel.rendererContext.commandContext.onTap.innertubeCommand.commandMetadata.webCommandMetadata.url),
                        thumbnails: a.avatar?.avatarStackViewModel?.avatars?.map((e: any) => e?.avatarViewModel?.image?.sources?.[0]) || (a.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails || [])
                    },
                    isLive: a?.viewCountText?.runs?.[1]?.text?.endsWith('watching') || false,
                    viewCount: parseAbbreviatedNumber(a?.viewCountText?.simpleText?.split(' ')?.[0] || a.viewCountText?.runs?.[0]?.text),
                    duration: a.lengthText?.simpleText || a.lengthText?.runs?.[0]?.text || null
                };
                alk.push(fom);
            } catch (err) {
                console.error("Error parsing YouTube Video item:", err);
            }
        });

        return { data: alk };
    } catch (e) { console.error("YTSearch Global Error:", e); return null; }
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
        const response = await request('https://m.youtube.com/youtubei/v1/search?prettyPrint=false&fields=contents.tabbedSearchResultsRenderer.tabs.tabRenderer.content.sectionListRenderer.contents.musicShelfRenderer.contents.musicResponsiveListItemRenderer', {
                headers: {
                    ...commonHeaders,
                    'Content-Type': 'application/json'
                },
                body: bodyload,
                method: "POST"
        });

        const res: any = await response.body.json();

        const innerTubeResults = res?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicShelfRenderer?.contents || [];

        let alk: any[] = [];
        innerTubeResults.forEach((item: any) => {
            const a = item.musicResponsiveListItemRenderer;
            if (!a) return;

            try {
                const flexColumn1 = a.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
                const flexColumn0 = a.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
                
                const artistRun = flexColumn1.find((r: any) => r?.navigationEndpoint?.browseEndpoint?.browseId && !r.navigationEndpoint.browseEndpoint.browseId.startsWith('MPRE'));
                const albumRun = flexColumn1.find((r: any) => r?.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('MPRE'));
                const durationRun = flexColumn1.filter((r: any) => r?.text?.includes(':')).pop() || flexColumn1[flexColumn1.length - 1];

                const kas = {
                    browseId: artistRun?.navigationEndpoint?.browseEndpoint?.browseId || null,
                    albumBrowseId: albumRun?.navigationEndpoint?.browseEndpoint?.browseId || null,
                    playlistId: a.menu?.menuRenderer?.items?.find((e: any) => e.menuNavigationItemRenderer?.navigationEndpoint?.watchEndpoint)?.menuNavigationItemRenderer?.navigationEndpoint?.watchEndpoint?.playlistId,
                    videoId: a.playlistItemData?.videoId || a.navigationEndpoint?.watchEndpoint?.videoId,
                    url: (a.playlistItemData?.videoId || a.navigationEndpoint?.watchEndpoint?.videoId) ? "https://music.youtube.com/watch?v=" + (a.playlistItemData?.videoId || a.navigationEndpoint?.watchEndpoint?.videoId) : null,
                    thumbnails: (a.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || []).map((t: any) => ({ ...t, url: t.url?.startsWith('//') ? 'https:' + t.url : t.url })),
                    title: flexColumn0[0]?.text,
                    owner: {
                        name: artistRun?.text || flexColumn1[0]?.text || "Unknown",
                        url: artistRun?.navigationEndpoint?.browseEndpoint?.browseId ? "https://music.youtube.com/channel/" + artistRun.navigationEndpoint.browseEndpoint.browseId : null
                    },
                    duration: durationRun?.text || null
                };
                alk.push(kas);
            } catch (err) {
                console.error("Error parsing YouTube Music item:", err);
            }
        });

        return {
            data: alk
        };
    } catch (e) { 
        console.error("YTMusic Global Error:", e);
        return null; 
    }
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
        if (per.statusCode === 401) {
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
        catch { }
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
        const perbody = { "variables": { "searchTerm": que, "offset": 0, "limit": 20, "numberOfTopResults": 20, "includeAudiobooks": true, "includeArtistHasConcertsField": true, "includePreReleases": true, "includeAuthors": true }, "operationName": "searchDesktop", "extensions": { "persistedQuery": { "version": 1, "sha256Hash": "fcad5a3e0d5af727fb76966f06971c19cfa2275e6ff7671196753e008611873c" } } };
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
                (per.statusCode === 403 || per.statusCode === 429) ? Promise.resolve(null) : per.body?.json() as Promise<any>,
                (per2.statusCode === 403 || per2.statusCode === 429) ? Promise.resolve(null) : per2.body?.json() as Promise<any>
            ]);
            return { data: [pes === null ? { error: "Rate-limited" } : (pes?.tracks?.items || null), pes2 === null ? { error: "Rate-limited" } : (pes2?.data?.searchV2 || null)] };
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
    if (refresh) {
        keytidal = await tidalKeys();
    }

    try {
        const pull = await request(`https://api.tidal.com/v1/search/tracks?countryCode=US&locale=en_US&limit=10&offset=0&query=${que}`, {
            headers: {
                ...commonHeaders,
                'X-Tidal-Token': keytidal
            }
        });

        if (pull.statusCode === 400 || pull.statusCode === 401) {
            return await Tidal(que, true);
        }

        const res: any = await pull.body.json();
        return { data: res?.items || null };
    } catch { return null; }
}

export const Genius = async function Genius(que: string) {
    if (!que) return null;
    let session: any;

    try {
        session = new Session({ 
            preset: 'chrome-144',
            httpVersion: 'h1' 
        });

        const [reqSong, reqMulti] = await Promise.all([
            session.get(`https://genius.com/api/search/song?&per_page=10&q=${encodeURIComponent(que)}`, {
                headers: {
                    ...commonHeaders,
                    'Accept': 'application/json, text/plain, */*',
                    'Referer': 'https://genius.com/',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin'
                }
            }),
            session.get(`https://genius.com/api/search/multi?q=${encodeURIComponent(que)}`, {
                headers: {
                    ...commonHeaders,
                    'Accept': 'application/json, text/plain, */*',
                    'Referer': 'https://genius.com/',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin'
                }
            })
        ]);

        const resSong = reqSong.statusCode === 200 ? reqSong.json() : (reqSong.statusCode === 403 ? { error: "Cloudflare Turnstile asking to verify you're not a bot" } : null);
        const resMulti = reqMulti.statusCode === 200 ? reqMulti.json() : (reqMulti.statusCode === 403 ? { error: "Cloudflare Turnstile asking to verify you're not a bot" } : null);

        const songs = resSong?.error ? resSong : (resSong?.response?.sections?.[0]?.hits?.map((a: any) => a?.result) || null);
        const multi = resMulti?.error ? resMulti : (resMulti?.response?.sections || null);

        if (session) session.close();

        return {
            data: [
                songs,
                multi
            ]
        };
    } catch (e) {
        console.error(e);
        if (session) session.close();
        return null;
    }
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

    const req = await request(`https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?hl=en&rt=c`, {
        dispatcher: new Agent({
            keepAliveTimeout: 30000,
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
            'x-goog-ext-73010989-jspb': '[0]',
            'Referer': 'https://gemini.google.com',
            'Origin': 'https://gemini.google.com',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'X-Same-Domain': '1'
        },
        body: reqPayload
    });

    if (req.statusCode === 302) {
        return {
            "error": "Google asking to verify you're not a bot"
        }
    }

    const cookiess: any = await req.headers?.['set-cookie'];
    const resText = await req.body.text();
    let response;

    let data: any[] = [];
    try {
        const lines = resText.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('[')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) {
                        if (Array.isArray(parsed[0])) {
                            data.push(...parsed);
                        } else {
                            data.push(parsed);
                        }
                    }
                } catch { }
            }
        }

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

        if (!innerData) {
            if (retry) return { error: "Rate-limited" };
            return await Gemini(que, convo, true);
        }

        objectbody.cid = (innerData as any)[1][0];
        objectbody.rid = (innerData as any)[1][1];
        objectbody.rcid = (innerData as any)[4][0][0];
        objectbody.cookies = filterCookies(cookiess) || convo;

        response = (innerData as any)[4]?.[0]?.[1]?.[0] || null;
    } catch (e) {
        console.error(e);
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

export const Chatplus = async function Chatplus(que: string) {
    if (!que) return null;
    return {
        response: null,
        data: null
    }
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
        const bodyhttp = { videoId: videoId, context: { client: { clientName: 5, clientVersion: "20.40.45" } } }
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
            request('https://m.youtube.com/youtubei/v1/next?prettyPrint=false&fields=contents.singleColumnMusicWatchNextResultsRenderer.tabbedRenderer.watchNextTabbedResultsRenderer.tabs.tabRenderer.content.musicQueueRenderer.content.playlistPanelRenderer.contents.playlistPanelVideoRenderer(videoId,title,longBylineText,thumbnail,shortBylineText,badges)', {
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

        const finalpull3: any = pull3.contents.singleColumnMusicWatchNextResultsRenderer.tabbedRenderer.watchNextTabbedResultsRenderer.tabs[0].tabRenderer.content.musicQueueRenderer.content.playlistPanelRenderer.contents[0].playlistPanelVideoRenderer;

        return {
            "data": {
                "innerTube": [
                    pull?.videoDetails || pull?.microformat ? { "videoDetails": pull } : {
                        "error": pull?.playabilityStatus ? (({ errorScreen, contextParams, ...rest }: any) => rest)(pull.playabilityStatus) : "Google asking to verify you're not a bot"
                    },
                    {
                        ...(finalpull3 ? { "musicDetails": finalpull3 } : {
                            "error": null
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
            // Robust parsing of ytInitialData
            const dataParts = html.split(/ytInitialData\s*=\s*/);
            if (dataParts.length < 2) return { data: null };
            
            let jsonStr = dataParts[1];
            // Find the end of the script tag or the next variable assignment
            const endIdx = jsonStr.indexOf(';</script>') !== -1 ? jsonStr.indexOf(';</script>') : 
                           jsonStr.indexOf('</script>') !== -1 ? jsonStr.indexOf('</script>') : 
                           jsonStr.length;
            
            jsonStr = jsonStr.substring(0, endIdx).trim();
            if (jsonStr.endsWith(';')) jsonStr = jsonStr.substring(0, jsonStr.length - 1).trim();
            
            data = JSON.parse(jsonStr);
        } catch (e) {
            console.error("YouTube Parse Error:", e);
            return null; 
        }

        if (!data) return { data: null };

        const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.map((t: any) => t.tabRenderer || t.expandableTabRenderer).filter(Boolean) || [];
        
        const header = data?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel;
        const channelMetadataRenderer = data?.metadata?.channelMetadataRenderer;
        const microformatRenderer = data?.microformat?.microformatDataRenderer;
        const channelDescription = channelMetadataRenderer?.description || microformatRenderer?.description;
        
        const channelLinks: any[] = [];
        const metadataRows = header?.metadata?.contentMetadataViewModel?.metadataRows || [];
        metadataRows.forEach((row: any) => {
            row?.metadataParts?.forEach((part: any) => {
                const linkModel = part?.text?.contentMetadataAndSelectedTextViewModel?.selectedText?.contentMetadataSelectedTextModel?.linkViewModel ||
                                part?.text?.contentMetadataAndSelectedTextViewModel?.text?.contentMetadataSelectedTextModel?.linkViewModel;
                if (linkModel) {
                    channelLinks.push({
                        title: linkModel.text || part?.text?.contentMetadataAndSelectedTextViewModel?.text?.content,
                        url: linkModel.href || linkModel.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url
                    });
                }
            });
        });

        const channelMetadata: any = {};

        const extractData = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;

            const link = obj.aboutChannelExternalLinkViewModel || obj.channelExternalLinkViewModel;
            if (link) {
                const title = link.title?.content || link.text;
                const url = link.link?.content || link.href;
                if (url && !channelLinks.some(l => l.url === url)) {
                    channelLinks.push({ title: title || 'Link', url });
                }
            }

            const meta = obj.aboutChannelViewModel || obj.aboutChannelRenderer?.metadata?.aboutChannelViewModel;
            if (meta) {
                if (meta.country) channelMetadata['location'] = meta.country;
                if (meta.joinedDateText?.content || meta.joinedDateText) {
                    const dateStr = (meta.joinedDateText.content || meta.joinedDateText).replace(/^Joined\s+/i, '').trim();
                    const timestamp = Date.parse(dateStr);
                    if (!isNaN(timestamp)) {
                        channelMetadata['joinTimestamp'] = String(Math.floor(timestamp / 1000));
                    } else {
                        channelMetadata['joinTimestamp'] = meta.joinedDateText.content || meta.joinedDateText;
                    }
                }
                if (meta.subscriberCountText) channelMetadata['subscriberCount'] = String(parseAbbreviatedNumber(meta.subscriberCountText));
                if (meta.videoCountText) channelMetadata['videoCount'] = String(parseAbbreviatedNumber(meta.videoCountText));
                if (meta.viewCountText) channelMetadata['viewCount'] = String(parseAbbreviatedNumber(meta.viewCountText));
                if (meta.canonicalChannelUrl) channelMetadata['canonicalUrl'] = meta.canonicalChannelUrl.replace(/^http:\/\//i, 'https://');
            }

            if (obj.primaryLinks || obj.secondaryLinks) {
                const links = [...(obj.primaryLinks || []), ...(obj.secondaryLinks || [])];
                links.forEach((l: any) => {
                    const title = l.title?.simpleText;
                    const url = l.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url;
                    if (url && !channelLinks.some(lk => lk.url === url)) {
                        channelLinks.push({ title: title || 'Link', url });
                    }
                });
            }

            const banner = obj.banner?.thumbnails || 
                           obj.imageBannerViewModel?.image?.thumbnail?.thumbnails ||
                           obj.imageBannerViewModel?.image?.sources;
            if (banner && !channelMetadata['banner']) {
                channelMetadata['banner'] = banner;
            }

            if (Array.isArray(obj)) {
                obj.forEach(item => extractData(item));
            } else {
                for (const key in obj) extractData(obj[key]);
            }
        };

        const getBadgeType = (badgeId: string): string | null => {
            if (!badgeId) return null;
            const validBadges = [
                'CHECK_CIRCLE_THICK', 'CHECK_CIRCLE_FILLED', 'VERIFIED', 'VERIFIED_BADGE',
                'OFFICIAL_ARTIST', 'AUDIO_BADGE', 'MUSIC_OFFICIAL_ARTIST', 'OFFICIAL_ARTIST_BADGE'
            ];
            return validBadges.includes(badgeId) ? badgeId : null;
        };

        const c4Header = data?.header?.c4TabbedHeaderRenderer;
        if (c4Header) {
            if (c4Header.avatar?.thumbnails) channelMetadata['avatar'] = c4Header.avatar.thumbnails;
            if (c4Header.banner?.thumbnails) channelMetadata['banner'] = c4Header.banner.thumbnails;
            if (c4Header.channelHandleText?.runs?.[0]?.text) channelMetadata['handle'] = c4Header.channelHandleText.runs[0].text;
            
            const badge = c4Header.badges?.map((b: any) => b.metadataBadgeRenderer?.icon?.iconType).find((id: string) => getBadgeType(id));
            if (badge) {
                channelMetadata['verified'] = true;
                channelMetadata['verified_type'] = getBadgeType(badge);
            }
        }

        const modernHeader = data?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel;
        if (modernHeader) {
            const avatar = modernHeader.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.thumbnail?.thumbnails;
            if (avatar) channelMetadata['avatar'] = avatar;
            
            const banner = data?.header?.pageHeaderRenderer?.banner?.imageBannerViewModel?.image?.thumbnail?.thumbnails ||
                           data?.header?.pageHeaderRenderer?.banner?.heroBannerViewModel?.banner?.imageBannerViewModel?.image?.thumbnail?.thumbnails;
            if (banner) channelMetadata['banner'] = banner;
            
            const title = modernHeader.title?.dynamicTextViewModel?.text?.content;
            if (title) channelMetadata['name'] = title;

            // Check for verification in modern header
            if (!channelMetadata['verified']) {
                const headerRows = modernHeader.metadata?.contentMetadataViewModel?.metadataRows || [];
                let detectedType: string | null = null;

                headerRows.some((row: any) => 
                    row.metadataParts?.some((part: any) => {
                        const vm = part.text?.contentMetadataAndSelectedTextViewModel || part.text?.contentMetadataViewModel;
                        const renderer = vm?.selectedText?.contentMetadataSelectedTextModel?.badgeViewModel?.badgeViewModel?.badge?.metadataBadgeRenderer ||
                                         vm?.text?.contentMetadataSelectedTextModel?.badgeViewModel?.badgeViewModel?.badge?.metadataBadgeRenderer;
                        const type = getBadgeType(renderer?.icon?.iconType);
                        if (type) {
                            detectedType = type;
                            return true;
                        }
                        return false;
                    })
                );

                if (!detectedType) {
                    // Check title attachment runs
                    const attachmentBadge = modernHeader.title?.dynamicTextViewModel?.text?.attachmentRuns?.map((run: any) => 
                        run.element?.type?.imageType?.image?.sources?.[0]?.clientResource?.imageName
                    ).find((name: string) => getBadgeType(name));
                    
                    if (attachmentBadge) detectedType = getBadgeType(attachmentBadge);
                }

                if (!detectedType) {
                    // Fallback to broader string check
                    const headerStr = JSON.stringify(modernHeader);
                    const match = headerStr.match(/CHECK_CIRCLE_THICK|CHECK_CIRCLE_FILLED|VERIFIED_BADGE|VERIFIED|OFFICIAL_ARTIST|AUDIO_BADGE|MUSIC_OFFICIAL_ARTIST|OFFICIAL_ARTIST_BADGE/i);
                    if (match) detectedType = match[0].toUpperCase();
                }

                if (detectedType) {
                    channelMetadata['verified'] = true;
                    channelMetadata['verified_type'] = detectedType;
                }
            }
        }

        if (channelMetadata['verified'] === undefined) {
            channelMetadata['verified'] = false;
            channelMetadata['verified_type'] = null;
        }

        // Additional banner check
        if (!channelMetadata['banner']) {
            const b1 = data?.header?.pageHeaderRenderer?.banner?.imageBannerViewModel?.image?.thumbnail?.thumbnails || 
                       data?.header?.pageHeaderRenderer?.banner?.imageBannerViewModel?.image?.sources;
            const b2 = modernHeader?.banner?.imageBannerViewModel?.image?.thumbnail?.thumbnails ||
                       modernHeader?.banner?.imageBannerViewModel?.image?.sources;
            const b3 = data?.header?.c4TabbedHeaderRenderer?.banner?.thumbnails;
            
            if (b1) channelMetadata['banner'] = b1;
            else if (b2) channelMetadata['banner'] = b2;
            else if (b3) channelMetadata['banner'] = b3;
        }

        // Additional avatar check
        if (!channelMetadata['avatar']) {
            const a1 = channelMetadataRenderer?.avatar?.thumbnails;
            const a2 = microformatRenderer?.thumbnail?.thumbnails;
            if (a1) channelMetadata['avatar'] = a1;
            else if (a2) channelMetadata['avatar'] = a2;
        }

        // Additional title check
        if (!channelMetadata['name']) {
            const t1 = channelMetadataRenderer?.title;
            const t2 = microformatRenderer?.title;
            if (t1) channelMetadata['name'] = t1;
            else if (t2) channelMetadata['name'] = t2;
        }

        // Extract additional channel info from channelMetadataRenderer
        if (channelMetadataRenderer) {
            if (channelMetadataRenderer.externalId) channelMetadata['channelId'] = channelMetadataRenderer.externalId;
            if (channelMetadataRenderer.vanityChannelUrl) channelMetadata['vanityChannelUrl'] = channelMetadataRenderer.vanityChannelUrl.replace(/^http:\/\//i, 'https://');
            if (channelMetadataRenderer.channelUrl) channelMetadata['channelUrl'] = channelMetadataRenderer.channelUrl;
            if (typeof channelMetadataRenderer.isFamilySafe === 'boolean') channelMetadata['familySafe'] = channelMetadataRenderer.isFamilySafe;
            if (channelMetadataRenderer.availableCountryCodes) channelMetadata['availableCountries'] = channelMetadataRenderer.availableCountryCodes;
            if (channelMetadataRenderer.keywords) {
                // Parse the keywords string into an array
                const keywordsStr = channelMetadataRenderer.keywords;
                const keywordsArray = keywordsStr.match(/"[^"]+"|[^\s]+/g)?.map((k: string) => k.replace(/^"|"$/g, '')) || [];
                if (keywordsArray.length > 0) channelMetadata['keywords'] = keywordsArray;
            }
            if (channelMetadataRenderer.avatar?.thumbnails && !channelMetadata['avatar']) {
                channelMetadata['avatar'] = channelMetadataRenderer.avatar.thumbnails;
            }
        }

        // Fallback to microformat for tags/keywords
        if (microformatRenderer) {
            if (microformatRenderer.tags && !channelMetadata['keywords']) {
                channelMetadata['keywords'] = microformatRenderer.tags;
            }
            if (typeof microformatRenderer.familySafe === 'boolean' && channelMetadata['familySafe'] === undefined) {
                channelMetadata['familySafe'] = microformatRenderer.familySafe;
            }
            if (microformatRenderer.availableCountries && !channelMetadata['availableCountries']) {
                channelMetadata['availableCountries'] = microformatRenderer.availableCountries;
            }
        }

        // Final fallback for channelId
        if (!channelMetadata['channelId'] && identifier && prefix === 'channel/') {
            channelMetadata['channelId'] = identifier;
        } else if (!channelMetadata['channelId'] && microformatRenderer?.urlCanonical) {
            const idMatch = microformatRenderer.urlCanonical.match(/\/channel\/([^\/?#]+)/);
            if (idMatch) channelMetadata['channelId'] = idMatch[1];
        }

        extractData(data);

        let continuationToken = null;

        function findAboutToken(obj: any): string | null {
            if (!obj || typeof obj !== 'object') return null;
            if (obj.showEngagementPanelEndpoint) {
                const token = searchToken(obj.showEngagementPanelEndpoint);
                if (token) return token;
            }
            if (Array.isArray(obj)) {
                for (const item of obj) {
                    const res = findAboutToken(item);
                    if (res) return res;
                }
            } else {
                for (const key in obj) {
                    const res = findAboutToken(obj[key]);
                    if (res) return res;
                }
            }
            return null;
        }

        function searchToken(obj: any): string | null {
            if (!obj || typeof obj !== 'object') return null;
            if (obj.continuationItemRenderer) {
                return obj.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token;
            }
            if (Array.isArray(obj)) {
                for (const item of obj) {
                    const res = searchToken(item);
                    if (res) return res;
                }
            } else {
                for (const key in obj) {
                    const res = searchToken(obj[key]);
                    if (res) return res;
                }
            }
            return null;
        }

        continuationToken = findAboutToken(data?.header) || findAboutToken(data);
        const visitorData = data?.responseContext?.visitorData;

        if (continuationToken) {
            try {
                const continuationReq = await request('https://m.youtube.com/youtubei/v1/browse?prettyPrint=false', {
                    method: "POST",
                    headers: { ...commonHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        continuation: continuationToken,
                        context: { 
                            client: { 
                                clientName: "WEB", 
                                clientVersion: "2.20260204.01.00", 
                                hl: "en", 
                                gl: "US",
                                visitorData: visitorData
                            } 
                        }
                    })
                });
                const continuationRes: any = await continuationReq.body.json();
                
                extractData(continuationRes);
            } catch { }
        }

        // Search for dedicated Community button/link in header
        const extraEndpoints: any[] = [];
        
        // Helper to recursively find all buttonViewModels/buttonRenderers in header actions
        const findAllButtons = (obj: any): any[] => {
            const buttons: any[] = [];
            if (!obj || typeof obj !== 'object') return buttons;
            
            if (obj.buttonViewModel || obj.buttonRenderer) {
                buttons.push(obj.buttonViewModel || obj.buttonRenderer);
            }
            
            if (Array.isArray(obj)) {
                obj.forEach(item => buttons.push(...findAllButtons(item)));
            } else {
                for (const key of Object.keys(obj)) {
                    if (['trackingParams', 'loggingDirectives', 'rendererContext'].includes(key)) continue;
                    buttons.push(...findAllButtons(obj[key]));
                }
            }
            return buttons;
        };

        const vm = data?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel;
        const allButtons = findAllButtons(vm?.actions || data?.header?.c4TabbedHeaderRenderer?.buttons);

        allButtons.forEach((btn: any) => {
            const endpoint = btn?.command?.browseEndpoint || 
                             btn?.onTap?.innertubeCommand?.browseEndpoint || 
                             btn?.navigationEndpoint?.browseEndpoint;
            
            if (endpoint && endpoint.browseId === 'FEcommunity_page') {
                if (!tabs.some((t: any) => t.endpoint?.browseEndpoint?.browseId === endpoint.browseId)) {
                    extraEndpoints.push({
                        title: 'Community',
                        endpoint: { browseEndpoint: endpoint }
                    });
                }
            }
        });

        const combinedTabs = [...tabs, ...extraEndpoints];

        const results = await Promise.all(combinedTabs.map(async (tab: any) => {
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
                            clientVersion: "2.20260204.01.00",
                            hl: "en",
                            gl: "US",
                            visitorData: visitorData
                        }
                    }
                });

                const req = await request('https://m.youtube.com/youtubei/v1/browse?prettyPrint=false', {
                    method: "POST",
                    headers: {
                        ...commonHeaders,
                        'Content-Type': 'application/json'
                    },
                    body: bodyload
                });

                const res: any = await req.body.json();
                const tabContent = res?.contents?.twoColumnBrowseResultsRenderer?.tabs?.find((t: any) => t?.tabRenderer?.selected)?.tabRenderer?.content || 
                                   res?.contents?.sectionListRenderer || 
                                   res?.contents || 
                                   res;
                
                return {
                    title: tab.title,
                    content: tabContent
                };
            } catch {
                return { title: tab.title, error: "Failed to fetch" };
            }
        }));

        const finalResults = results.filter(Boolean);
        const tabsObj: any = {
            home: null,
            videos: null,
            shorts: null,
            live: null,
            playlists: null,
            community: null,
            posts: null,
            podcasts: null,
            releases: null,
            store: null,
            courses: null,
            about: null,
            playables: null
        };

        const flatten = (obj: any): any => {
            if (!obj || typeof obj !== 'object') return obj;

            if (Array.isArray(obj)) {
                return obj.flatMap(item => {
                    const res = flatten(item);
                    if (res === null || res === undefined) return [];
                    return Array.isArray(res) ? res : [res];
                });
            }

            const keys = Object.keys(obj);
            const metadata = [
                'trackingParams', 'accessibility', 'accessibilityData', 
                'clickTrackingParams', 'commandMetadata', 'loggingContext', 
                'loggingDirectives', 'type', 'style', 'targetId', 'identifier', 
                'entityId', 'onTap', 'command', 'navigationEndpoint', 'params',
                'menu', 'title'
            ];
            const dataKeys = keys.filter(k => !metadata.includes(k));
            
            if (dataKeys.length === 0) return null;

            if (Array.isArray(obj.contents)) return flatten(obj.contents);
            if (Array.isArray(obj.items)) return flatten(obj.items);
            if (Array.isArray(obj.content)) return flatten(obj.content);

            if (obj.post && typeof obj.post === 'object' && dataKeys.includes('post')) {
                return flatten(obj.post);
            }

            if (dataKeys.length === 1) {
                const key = dataKeys[0];
                if (key.endsWith('Renderer') || key.endsWith('ViewModel') || 
                    ['content', 'item', 'contents', 'items', 'post', 'posts'].includes(key)) {
                    return flatten(obj[key]);
                }
            }

            const res: any = {};
            for (const key of dataKeys) {
                res[key] = flatten(obj[key]);
            }
            return res;
        };

        finalResults.forEach((r: any) => {
            const title = typeof r.title === 'string' ? r.title.toLowerCase() : (r.title?.runs?.[0]?.text?.toLowerCase() || '');
            if (title && title !== 'search') {
                const flattened = flatten(r.content);
                if (title === 'posts') {
                    tabsObj['posts'] = flattened;
                } else if (title === 'community') {
                    tabsObj['community'] = flattened;
                } else {
                    tabsObj[title] = flattened;
                }
            }
        });

        const normalizedLinks = channelLinks.map(link => ({
            title: link.title,
            url: link.url && !link.url.match(/^https?:\/\//i) ? `https://${link.url}` : link.url
        }));

        const processBanner = (images: any[]) => {
            if (!Array.isArray(images) || images.length === 0) return null;
            const sorted = [...images].sort((a, b) => (b.width || 0) - (a.width || 0));
            const highestUrl = sorted[0]?.url || null;
            
            if (!highestUrl) return null;
            
            // Generate the three banner variants
            const baseUrl = highestUrl.split('=')[0];
            
            return {
                highest: `${baseUrl}=w2560-fcrop64=1,0000000ffffffff`,
                highest_cropped: `${baseUrl}=w2560-fcrop64=1,00005a57ffffa5a8`,
                original: `${baseUrl}=s0`
            };
        };

        const processAvatar = (images: any[]) => {
            if (!Array.isArray(images) || images.length === 0) return null;
            const sorted = [...images].sort((a, b) => (b.width || 0) - (a.width || 0));
            const highestUrl = sorted[0]?.url || null;
            
            if (!highestUrl) return null;
            
            // Extract base URL (before the parameters)
            const baseUrl = highestUrl.split('=')[0];
            
            // Preserve the parameter format from the original URL
            const urlParts = highestUrl.split('=');
            let suffix = 'c-k-c0x00ffffff-no-rj';
            
            // Try to extract the suffix from original URL
            if (urlParts.length > 1) {
                const params = urlParts.slice(1).join('=');
                const match = params.match(/[sc]\d+-(.+)/);
                if (match) suffix = match[1];
            }
            
            return {
                normal: `${baseUrl}=s900-${suffix}`,
                highest: `${baseUrl}=s2160-${suffix}`,
                original: `${baseUrl}=s0`
            };
        };

        const processedMetadata = { ...channelMetadata };
        if (processedMetadata['banner']) processedMetadata['banner'] = processBanner(processedMetadata['banner']);
        if (processedMetadata['avatar']) processedMetadata['avatar'] = processAvatar(processedMetadata['avatar']);

        return {
            data: {
                links: normalizedLinks.length > 0 ? normalizedLinks : null,
                metadata: {
                    description: channelDescription || null,
                    ...processedMetadata
                },
                tabs: tabsObj
            }
        };
    } catch (e) { console.error(e); return null; }
}

export const infoSoundcloud = async function infoSoundcloud(que: string, refresh_auth: boolean = false): Promise<any> {
    if (!que) return null;
    if (refresh_auth || !keysc) {
        keysc = await soundcloudKey();
    }
    try {
        const test = new URL(que);
        if (!test.host.endsWith('soundcloud.com')) return null;
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
        if (res.statusCode === 401 || res.statusCode === 400) {
            return await infoSoundcloud(que, true);
        }
        const [pull, pull2Text] = await Promise.all([
            res.body.json() as Promise<any>,
            res2.body.text()
        ]);

        let pull2: any = null;
        try {
            pull2 = JSON.parse(pull2Text.split('type="application/json">')[1].split('</script>')[0]);
        } catch { }

        return { data: [pull || null, pull2?.props?.pageProps?.initialStoreState?.entities || null] };
    }
    catch (e) {
        console.error("infoSoundcloud error:", e);
        return null;
    }
}

export const infoSpotify = async function infoSpotify(que: string) {
    if (!que) return null;
    try {
        const test = new URL(que);
        if (test.host !== 'open.spotify.com') return null;

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
    if (!que) return null;
    try {
        const test = new URL(que);
        if (test.host !== 'music.apple.com') return null;

        const res = await fetch(que, {
            method: 'GET',
            headers: {
                ...commonHeaders,
                'User-Agent': 'Bot'
            }
        });

        const pull = await res.text();
        const serverDataMatch = pull.match(/<script[^>]*id=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/);
        if (!serverDataMatch) {
            return { data: null };
        }
        const trypar = JSON.parse(serverDataMatch[1]);
        const sections = trypar[0]?.data?.sections;
        if(!sections?.[0]) {
            return { data: null }
        }

        const target = sections[0]?.items?.[0] || null;
        const other = sections.slice(1).map((s: any) => s?.items).filter(Boolean);

        return { data: { target, other } };
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const pinterest = async function pinterest(que: string) {
    if (!que) return null;
    try {
        const feat = { "options": { "query": que, "scope": "pins" }, "context": {} };
        const req = await request(`https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=/search/pins/?q=${que}&data=${encodeURIComponent(JSON.stringify(feat))}`, {
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
        }

        if (req.status !== 200) {
            return {
                data: [null, null],
                error: currentInfo || { status: req.status, statusText: req.statusText }
            };
        }

        if (Object.keys(payload).length === 0) {
            return { data: [currentInfo, null] };
        }

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
        } catch (e) { }

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
            } catch (e) { }
        }

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
    if (!que) return null;
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
    if (!que) return null;

    try {
        const pull = await request(`https://unsplash.com/napi/search/photos?page=1&per_page=20&query=${que}`, {
            headers: {
                ...commonHeaders,
                'client-geo-region': 'global'
            }
        });

        if (pull.statusCode === 403) {
            return {
                "error": "IP Blocked"
            }
        }

        const res: any = await pull.body.json();
        return {
            data: res?.results?.[0] ? {
                non_premium: res?.results.filter((a: any) => !a.premium),
                premium: res?.results.filter((a: any) => a.premium)
            } : null
        };
    } catch { return null; }
}

export const Pixiv = async function Pixiv(que: string) {
    if (!que) return null;

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
    if (!que) return null;

    try {
        const per = await request(`https://discord.com/api/v10/discovery/search?query=${que}&limit=10`, {
            headers: {
                ...commonHeaders
            }
        });

        if (per.statusCode === 403) {
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
    if (!que) return null;

    try {
        const per = await request(`https://api.bilibili.tv/intl/gateway/web/v2/search_v2?s_locale=en_US&platform=web&keyword=${que}&highlight=1&pn=1&ps=10&qid=&sort=0`, {
            headers: {
                ...commonHeaders
            }
        });

        if (per.statusCode === 403) {
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
    if (!que) return null;

    try {
        const per = await request(`https://discord.com/api/v10/application-directory/search?query=${que}&page=1&page_size=10&category_id=1&locale=en-US&source=0`, {
            headers: {
                ...commonHeaders
            }
        });

        if (per.statusCode === 403) {
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
    if (!que) return null;

    try {
        const per = await request(`https://www.jiosaavn.com/api.php?_format=json&n=10&__call=search.getResults&q=${que}`, {
            headers: {
                ...commonHeaders
            }
        });

        const res: any = await per.body.json();
        const items = res?.results || [];

        return {
            data: items?.map((item: any) => {
                const { encrypted_media_url, encrypted_drm_media_url, encrypted_media_path, ...rest } = item;
                return rest;
            }) || null
        }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const Twitch = async function Twitch(que: string) {
    if (!que) return null;

    try {
        const bodyhttp = { "operationName": "SearchResultsPage_SearchResults", "variables": { "query": que, "includeIsDJ": true }, "extensions": { "persistedQuery": { "version": 1, "sha256Hash": "7f3580f6ac6cd8aa1424cff7c974a07143827d6fa36bba1b54318fe7f0b68dc5" } } }
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
    if (!que) return null;

    try {
        const bodyhttp = { "data": { "include_reel": "true", "query": que }, "hasQuery": true };
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
    if (!que) return null;

    try {
        const bodyhttp = { "query": que, "first": 50, "should_fetch_ig_inactive_on_text_app": true, "should_fetch_friendship_status": false, "should_fetch_fediverse_profiles": true, "hide_unconnected_private": false, "__relay_internal__pv__BarcelonaIsLoggedInrelayprovider": false, "__relay_internal__pv__BarcelonaIsCrawlerrelayprovider": false, "__relay_internal__pv__BarcelonaHasDisplayNamesrelayprovider": false };
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
    if (!que) return null;

    let session: any;

    try {
        session = new Session({ httpVersion: 'h3' });
        const response = await session.get(`https://www.pexels.com/search/${que}`, {
            headers: {
                ...commonHeaders,
                'User-Agent': 'Mozilla/5.0 (compatible; Twitterbot/1.0; +http://help.twitter.com/bots)'
            }
        });

        if (response.statusCode === 403) {
            return {
                "error": "Cloudflare Turnstile asking to verify you're not a bot"
            };
        }
        const html = response.text;
        let pull = null;
        try {
            pull = JSON.parse(html.split('"application/json">')?.[1]?.split('</script>')?.[0]);
        }
        catch { }
        if (session) session.close();
        return { data: pull?.props?.pageProps?.initialData || null };
    }
    catch (e) {
        console.error(e);
        if (session) session.close();
        return null;
    }
};

export const TiktokVideo = async function TiktokVideo(que: string) {
    if (!que) return null;

    try {
        const pul = await request(`https://api-boot.tiktokv.com/aweme/v1/search/item/?count=10&keyword=${que}&version_code=3.2.0&app_name=musical_ly&channel=App+Store&device_id=7386407102867523334&aid=1233&os_version=16.2&device_platform=iphone&iid=7386407102867523334&device_brand=iphone&device_type=iPhone10,6`, {
            headers: {
                ...commonHeaders,
                'X-Khronos': Math.floor(Date.now() / 1000).toString()
            }
        });

        const res = await pul.body.text();
        if (res === '') {
            return {
                "error": "Akamai Captcha asking to verify you're not a bot"
            }
        }
        let testres;
        try {
            testres = JSON.parse(res);
        }
        catch { }
        return { data: testres?.aweme_list || null };
    }
    catch {
        return null;
    }
}

export const TiktokMusic = async function TiktokMusic(que: string) {
    if (!que) return null;

    try {
        const pul = await request(`https://api-boot.tiktokv.com/aweme/v1/music/search/?count=10&cursor=0&aid=1233&device_id=7386407102867523334&region=&referer=&keyword=${que}`, {
            headers: {
                ...commonHeaders
            }
        });

        const res = await pul.body.text();
        if (res === '') {
            return {
                "error": "Akamai Captcha asking to verify you're not a bot"
            }
        }
        let testres;
        try {
            testres = JSON.parse(res);
        }
        catch { }
        return { data: [testres?.music || null, testres?.music_info_list || null] };
    }
    catch {
        return null;
    }
}

export const TiktokUser = async function TiktokUser(que: string) {
    if (!que) return null;

    try {
        const pul = await request(`https://api-boot.tiktokv.com/aweme/v1/discover/search/?keyword=${que}&cursor=0&count=10&hot_search=0&search_source=discover&aid=1180&app=musically&region=&referer=&device_id=7386407102867523334&type=1`, {
            headers: {
                ...commonHeaders
            }
        });

        const res = await pul.body.text();
        if (res === '') {
            return {
                "error": "Akamai Captcha asking to verify you're not a bot"
            }
        }
        let testres;
        try {
            testres = JSON.parse(res);
        }
        catch { }
        return { data: testres?.user_list?.map((a: any) => a.user_info) || null };
    }
    catch {
        return null;
    }
}

export const infoTwitterUser = async function infoTwitterUser(que: string, refresh_auth?: boolean): Promise<any> {
    if (!que) return null;
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

        if (pul.statusCode === 403) {
            return {
                "error": "Bad auth"
            }
        }

        if (pul.statusCode === 401 || pul.statusCode === 400) return await infoTwitterUser(que, true);

        const responseText = await pul.body.text();
        let res;
        try {
            res = JSON.parse(responseText);
        } catch {
            return null;
        }
        let pul2;
        let res2: any = {};
        if (res?.data?.user?.result?.rest_id) {
            pul2 = await request(`https://syndication.twitter.com/srv/timeline-profile/user-id/${res?.data?.user?.result?.rest_id}`, {
                headers: {
                    ...commonHeaders
                }
            });
            try {
                const body2 = await pul2.body.text();
                res2 = JSON.parse(body2.split('type="application/json">')[1].split('</script>')[0]);
            }
            catch { }
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
    if (!que) return null;
    if (refresh_auth || !twitterAuth || !twitterObj?.TweetResultByRestId) {
        await twitterKey("TweetResultByRestId");
    }

    try {
        const queryId = twitterObj?.TweetResultByRestId?.[0];
        const features = JSON.stringify(twitterObj?.TweetResultByRestId?.[1]);
        const variables = JSON.stringify({ tweetId: que, includePromotedContent: true, withBirdwatchNotes: true, withVoice: true, withCommunity: true });

        const [pul, pul2] = await Promise.all([
            request(`https://api.x.com/graphql/${queryId}/TweetResultByRestId?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`, {
                headers: {
                    ...commonHeaders,
                    'content-type': 'application/json',
                    'authorization': 'Bearer ' + twitterAuth,
                }
            }),
            request(`https://cdn.syndication.twimg.com/tweet-result?id=${que}&lang=en&token=abc`, {
                headers: {
                    ...commonHeaders,
                }
            })
        ]);

        if (pul.statusCode === 401 || pul.statusCode === 400) return await infoTwitterTweet(que, true);

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
    if (!que) return null;

    try {
        const req = await request(`https://old.reddit.com/search/.json?q=${que}&sort=relevance&type=media`, {
            headers: {
                ...commonHeaders,
                'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.1; +https://discordapp.com)'
            }
        });

        if (req.statusCode === 403) {
            return {
                "error": "IP Blocked"
            }
        }

        if (req.statusCode === 302) {
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
    if (!que) return null;

    try {
        const pul1 = await request(`https://apis.roblox.com/search-api/omni-search?searchQuery=${que}&sessionId=abc`, {
            headers: {
                ...commonHeaders
            }
        });

        const res1: any = await pul1.body.json();
        const gamesList = res1.searchResults?.flatMap((group: any) => group.contents) || [];
        const restIds = gamesList.filter((b: any) => b?.universeId).map((b: any) => b.universeId).join(',');

        if (!restIds) return { data: gamesList };

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
                client: {
                    clientName: "WEB",
                    clientVersion: "2.20251212",
                    hl: "en",
                    gl: "US"
                }
            }
        });

        const response = await request('https://m.youtube.com/youtubei/v1/search?prettyPrint=false&fields=contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents.itemSectionRenderer.contents.channelRenderer', {
            headers: {
                ...commonHeaders,
                'content-type': 'application/json'
            },
            body: bodyload,
            method: "POST"
        });

        const res: any = await response.body.json();
        const contents = res?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

        let alk: any[] = [];
        contents.forEach((item: any) => {
            const a = item.channelRenderer;
            if (!a) return;

            try {
                const subRuns = a.subscriberCountText?.runs?.map((r: any) => r.text) || [];
                const videoRuns = a.videoCountText?.runs?.map((r: any) => r.text) || [];
                const allMetadata = [...subRuns, ...videoRuns, a.subscriberCountText?.simpleText, a.videoCountText?.simpleText].filter(Boolean);

                const handle = allMetadata.find(t => t.startsWith('@'));
                const subs = allMetadata.find(t => t.toLowerCase().includes('subscriber'));
                const videos = allMetadata.find(t => t.toLowerCase().includes('video') || (t.match(/^\d+/) && !t.includes('subscriber') && !t.startsWith('@')));

                const fom = {
                    channelId: a.channelId,
                    url: "https://www.youtube.com/channel/" + a.channelId,
                    handle: handle || null,
                    thumbnails: (a.thumbnail?.thumbnails || []).map((t: any) => ({ ...t, url: t.url?.startsWith('//') ? 'https:' + t.url : t.url })),
                    name: a.title?.simpleText || a.title?.runs?.[0]?.text,
                    description: a.descriptionSnippet?.runs?.map((r: any) => r.text).join('') || "",
                    subscriberCount: parseAbbreviatedNumber(subs),
                    videoCount: parseAbbreviatedNumber(videos),
                    verified: !!a.ownerBadges?.find((b: any) => 
                        b.metadataBadgeRenderer?.style === "BADGE_STYLE_TYPE_VERIFIED" || 
                        b.metadataBadgeRenderer?.style === "BADGE_STYLE_TYPE_VERIFIED_ARTIST"
                    )
                };
                alk.push(fom);
            } catch (err) {
                console.error("Error parsing YouTube Channel item:", err);
            }
        });

        return { data: alk };
    } catch (e) { 
        console.error("YTChannel Global Error:", e);
        return null; 
    }
}

export const robloxAudio = async function robloxAudio(que: string) {
    if (!que) return null;

    try {
        const pul1 = await request(`https://apis.roblox.com/toolbox-service/v1/marketplace/3?limit=40&keyword=${encodeURIComponent(que)}`, {
            headers: {
                ...commonHeaders
            }
        });

        const res1: any = await pul1.body.json();
        const assetList = res1.data || [];
        const assetIds = assetList.map((b: any) => b.id).join(',');

        if (!assetIds) return { data: null };

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
    if (!que) return null;

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
    if (!que) return null;

    try {
        const time = Math.round(Date.now() / 1000);
        const linkhost = "https://edit-api-sg.capcut.com/lv/v1/cc_web/replicate/search_templates";

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
    if (!que) return null;

    try {
        const req = await request(`https://old.reddit.com/r/${que.toLowerCase()}/.json`, {
            headers: {
                ...commonHeaders,
                'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.1; +https://discordapp.com)'
            }
        });

        if (req.statusCode === 403) {
            return {
                "error": "IP Blocked"
            }
        }

        if (req.statusCode === 302) {
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
    if (!que) return null;
    let session: any;

    try {
        const testreq = await request(`https://www.instagram.com/${que}/embed`, {
            headers: {
                ...commonHeaders,
                'Sec-Fetch-Dest': 'iframe'
            }
        });

        if (testreq.statusCode === 302) {
            return {
                error: "Please sign in"
            }
        }

        const resreq = await testreq.body.text();
        const profile_id = resreq.split('owner-id="')[1]?.split('"')?.[0];

        if (!profile_id) {
            return {
                data: null
            }
        }

        session = new Session({ preset: 'chrome-143', httpVersion: 'h3' });

        const bodyhttp = { "enable_integrity_filters": true, "id": profile_id, "render_surface": "PROFILE", "__relay_internal__pv__PolarisCannesGuardianExperienceEnabledrelayprovider": true, "__relay_internal__pv__PolarisCASB976ProfileEnabledrelayprovider": false, "__relay_internal__pv__PolarisRepostsConsumptionEnabledrelayprovider": false };

        const [req, req2] = await Promise.all([
            session.get(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${que}`, {
                headers: {
                    'X-IG-App-ID': "936619743392459",
                    'X-ASBD-ID': "198387",
                    'X-IG-WWW-Claim': "0",
                    'Origin': 'https://www.instagram.com'
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
            Promise.resolve().then(() => {
                if (!req.text || req.text.trim() === "") return null;
                try { return req.json(); } catch { return null; }
            }),
            req2.body.json().catch(() => null)
        ]);

        a = res?.data?.user;
        b = res2?.data?.user || res2?.data || res2;

        if (!a && req.statusCode !== 200 && req.statusCode !== 404) {
            try { a = req.json(); } catch { a = { body: req.text }; }
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

        if (session) session.close();

        return { data: [formatted || null, a || null, b || null] };
    } catch (e) {
        console.error(e);
        if (session) session.close();
        return null;
    }
}

export const infoThreadUser = async function infoThreadUser(que: string) {
    if (!que) return null;

    try {
        const bodyhttp = { "username": que, "__relay_internal__pv__BarcelonaIsInternalUserrelayprovider": false, "__relay_internal__pv__BarcelonaIsLoggedInrelayprovider": false, "__relay_internal__pv__BarcelonaHasSpoilerStylingInforelayprovider": false, "__relay_internal__pv__BarcelonaShouldShowFediverseM1Featuresrelayprovider": false, "__relay_internal__pv__BarcelonaHasEventBadgerelayprovider": false };
        let bodyhttp2: any = { "allow_page_info_for_lox_user": true, "first": 50, "skipGhostPosts": false, "userID": null, "__relay_internal__pv__BarcelonaIsLoggedInrelayprovider": false, "__relay_internal__pv__BarcelonaHasProfileSelfReplyContextrelayprovider": false, "__relay_internal__pv__BarcelonaHasInlineReplyComposerrelayprovider": false, "__relay_internal__pv__BarcelonaIsReplyApprovalEnabledrelayprovider": false, "__relay_internal__pv__BarcelonaIsReplyApprovalsConsumptionEnabledrelayprovider": false, "__relay_internal__pv__BarcelonaHasDearAlgoConsumptionrelayprovider": true, "__relay_internal__pv__BarcelonaHasEventBadgerelayprovider": false, "__relay_internal__pv__BarcelonaIsSearchDiscoveryEnabledrelayprovider": false, "__relay_internal__pv__BarcelonaHasPodcastConsumptionrelayprovider": true, "__relay_internal__pv__BarcelonaHasCommunitiesrelayprovider": false, "__relay_internal__pv__BarcelonaHasSelfThreadCountrelayprovider": false, "__relay_internal__pv__IsTagIndicatorEnabledrelayprovider": true, "__relay_internal__pv__BarcelonaHasDeepDiverelayprovider": false, "__relay_internal__pv__BarcelonaHasGhostPostConsumptionrelayprovider": true, "__relay_internal__pv__BarcelonaHasSpoilerStylingInforelayprovider": false, "__relay_internal__pv__BarcelonaHasGhostPostEmojiActivationrelayprovider": false, "__relay_internal__pv__BarcelonaOptionalCookiesEnabledrelayprovider": true, "__relay_internal__pv__BarcelonaHasDearAlgoWebProductionrelayprovider": false, "__relay_internal__pv__BarcelonaQuotedPostUFIEnabledrelayprovider": true, "__relay_internal__pv__BarcelonaHasTopicTagsrelayprovider": true, "__relay_internal__pv__BarcelonaIsCrawlerrelayprovider": false, "__relay_internal__pv__BarcelonaHasDisplayNamesrelayprovider": false, "__relay_internal__pv__BarcelonaHasCommunityTopContributorsrelayprovider": false, "__relay_internal__pv__BarcelonaCanSeeSponsoredContentrelayprovider": false, "__relay_internal__pv__BarcelonaShouldShowFediverseM075Featuresrelayprovider": false, "__relay_internal__pv__BarcelonaImplicitTrendsGKrelayprovider": false, "__relay_internal__pv__BarcelonaIsInternalUserrelayprovider": false };

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

                            const reqs = parsed?.require || [];
                            for (const req of reqs) {
                                const args = req?.[3] || [];
                                for (const arg of args) {
                                    const innerReqs = arg?.__bbox?.require || [];
                                    for (const innerReq of innerReqs) {
                                        if (innerReq?.[0] === 'RelayPrefetchedStreamCache') {
                                            const data = innerReq?.[3]?.[1]?.__bbox?.result?.data;
                                            if (data) webData.push(data);
                                        }
                                    }
                                }
                            }
                        } catch { }
                    }
                }
            }
        } catch (e) { }

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

export const Tenor = async function Tenor(que: string, type?: string) {
    if (!que) return null;

    const getSearchFilter = (t?: string) => {
        if (!t || t === 'all') return '&searchfilter=none';
        if (t === 'sticker') return '&searchfilter=sticker';
        if (t === 'meme') return '&searchfilter=static,-sticker';
        return '&searchfilter=none';
    };

    const getFormatQuery = (t?: string) => {
        if (t === 'gif') return '?format=gifs';
        if (t === 'sticker') return '?format=stickers';
        if (t === 'meme') return '?format=memes';
        return '';
    };

    try {
        const apiRes = await request(`https://tenor.googleapis.com/v2/search?prettyPrint=false&q=${encodeURIComponent(que.toLowerCase())}&fields=results&limit=50&client_key=tenor_web&locale=en${getSearchFilter(type)}`, {
            headers: {
                ...commonHeaders,
                'Referer': 'https://tenor.com',
                'Origin': 'https://tenor.com',
                'X-Goog-Api-Key': 'AIzaSyC-P6_qz3FzCoXGLk6tgitZo4jEJ5mLzD8'
            }
        });

        if (apiRes.statusCode === 200) {
            const apiData: any = await apiRes.body.json();
            return {
                data: {
                    suggestion: null,
                    data: apiData?.results || []
                }
            };
        }
    } catch {}

    try {
        const formatQuery = getFormatQuery(type);
        const webRes = await request(`https://tenor.com/search/${encodeURIComponent(que.toLowerCase())}-gifs${formatQuery}`, {
            headers: {
                ...commonHeaders
            }
        });

        if (webRes.statusCode !== 200) {
            return { error: `${webRes.statusCode} - Can't process this` };
        }

        const html = await webRes.body.text();

        if (html.includes('form id="captcha-form"')) {
            return { error: 'Blocked recaptcha' };
        }

        const storeMatch = html.match(/<script id="store-cache"[^>]*>([\s\S]*?)<\/script>/);
        if (!storeMatch) {
            return { error: 'Failed to parse webpage data' };
        }

        const storeData = JSON.parse(storeMatch[1]);
        const searchKeys = Object.keys(storeData?.universal?.search || {});
        const suggestionKeys = Object.keys(storeData?.searchSuggestions || {});

        return {
            data: {
                suggestion: suggestionKeys.length > 0 ? storeData.searchSuggestions[suggestionKeys[0]]?.results : null,
                data: searchKeys.length > 0 ? storeData.universal.search[searchKeys[0]]?.results : []
            }
        };
    } catch (e) {
        console.error(e);
        return { error: 'Failed to fetch Tenor data' };
    }
}

export const infoTenor = async function infoTenor(url: string) {
    if (!url) return null;

    try {
        const urlObj = new URL(url);
        if (!urlObj.hostname.endsWith('tenor.com')) {
            return { error: 'Invalid Tenor URL' };
        }

        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1] || '';
        const postId = lastPart.split('-').pop();

        if (!postId || !/^\d+$/.test(postId)) {
            return { error: 'Invalid Tenor post ID' };
        }

        const res = await request(`https://tenor.com/embed/${postId}`, {
            headers: {
                ...commonHeaders
            }
        });

        if (res.statusCode !== 200) {
            return { error: `${res.statusCode} - Can't process this` };
        }

        const html = await res.body.text();
        const gifMatch = html.match(/<script id="gif-json"[^>]*>([\s\S]*?)<\/script>/);

        if (!gifMatch) {
            return { error: 'Failed to parse GIF data' };
        }

        const gifData = JSON.parse(gifMatch[1]);
        return { data: gifData };
    } catch (e) {
        console.error(e);
        return { error: 'Failed to fetch Tenor info' };
    }
}

export const infoGiphy = async function infoGiphy(url: string) {
    if (!url) return null;
    let session: any;

    try {
        const urlObj = new URL(url);
        if (!urlObj.hostname.endsWith('giphy.com')) {
            return { error: 'Invalid Giphy URL' };
        }

        session = new Session({ preset: 'chrome-143', httpVersion: 'h2' });
        const res = await session.get(url, {
            headers: {
                ...commonHeaders
            }
        });

        if (res.statusCode !== 200) {
            if (session) session.close();
            return { error: `${res.statusCode} - Can't process this` };
        }

        const html = res.text;
        if (session) session.close();
        const chunks = html.split('self.__next_f.push(');
        chunks.shift();

        const ldJsonChunk = chunks.find((chunk: string) => chunk.includes('application/ld+json'));
        if (!ldJsonChunk) {
            return { error: 'Failed to parse Giphy data' };
        }

        const scriptEnd = ldJsonChunk.indexOf(')</script>');
        const jsonStr = ldJsonChunk.substring(0, scriptEnd);
        const parsed = JSON.parse(jsonStr);
        
        const firstPart = parsed[1];
        if (!firstPart) return { error: 'Invalid Giphy data structure' };
        
        const colonIndex = firstPart.indexOf(':');
        const dataStr = firstPart.substring(colonIndex + 1);
        const c = JSON.parse(dataStr);

        return {
            data: {
                suggestion: c?.[1]?.[3]?.geoTargetedRequest?.keywords,
                data: c?.[1]?.[3]?.children?.[1]?.[3]?.children?.[3]?.children?.[0]?.[3]?.children?.[0]?.[3]?.children?.[1]?.[3]?.children?.[1]?.[3]?.children?.[1]?.[3]?.gif,
                user: c?.[1]?.[3]?.children?.[1]?.[3]?.children?.[3]?.children?.[0]?.[3]?.children?.[0]?.[3]?.children?.[0]?.[3]?.children?.[0]?.[3]?.user
            }
        };
    } catch (e) {
        if (session) session.close();
        console.error(e);
        return { error: 'Failed to fetch Giphy info' };
    }
}


export const Giphy = async function Giphy(que: string, type?: string) {
    if (!que) return null;
    let session: any;

    const getTypeQuery = (t?: string) => {
        if (t === 'sticker') return '-stickers';
        if (t === 'clip') return '-clips';
        return '';
    };

    try {
        session = new Session({ preset: 'chrome-143', httpVersion: 'h2' });
        const res = await session.get(`https://www.giphy.com/search/${encodeURIComponent(que)}${getTypeQuery(type)}`, {
            headers: {
                ...commonHeaders
            }
        });

        if (res.statusCode !== 200) {
            if (session) session.close();
            return { error: `${res.statusCode} - Can't process this` };
        }

        const html = res.text;
        if (session) session.close();
        const chunks = html.split('self.__next_f.push(');
        chunks.shift();

        const ldJsonChunk = chunks.find((chunk: string) => chunk.includes('application/ld+json'));
        if (!ldJsonChunk) {
            return { error: 'Failed to parse Giphy data' };
        }

        const scriptEnd = ldJsonChunk.indexOf(')</script>');
        const jsonStr = ldJsonChunk.substring(0, scriptEnd);
        const parsed = JSON.parse(jsonStr);
        const innerData = JSON.parse(parsed[1].substring(parsed[1].indexOf(':') + 1));
        const initialGifs = innerData?.[1]?.[3]?.children?.[1]?.[3]?.children?.[1]?.[3]?.initialGifs;

        return { data: initialGifs || [] };
    } catch (e) {
        if (session) session.close();
        console.error(e);
        return { error: 'Failed to fetch Giphy data' };
    }
}

export const setKeys = (sc: string, sp: string, tidal: string, deezer: string) => { keysc = sc; keysp = sp; keytidal = tidal; keydeezer = deezer; };

// Meta AI Token Cache
let metaAICache: {
    valid: boolean;
    access_token: string;
    lsd: string;
    cookies: string;
    docid: { tos: string; message: string };
} | null = null;

async function fetchWithRetry(url: string, options: any, retries = 5): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, { ...options, verbose: false } as any);
            return res;
        } catch (e: any) {
            const isSocketError = e.message?.includes('socket') 
                               || e.message?.includes('closed')
                               || e.message?.includes('connection error')
                               || e.code === 'ECONNRESET';
            
            console.log(`[MetaAI] Retry ${i+1}/${retries} for ${url} due to: ${e.message}`);

            if (i < retries - 1 && isSocketError) {
                await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Increased backoff
                continue;
            }
            throw e;
        }
    }
    throw new Error('Network error');
}

async function sendMessage(q: string, cache: any) {
    const threadId = ((BigInt(Date.now()) << 22n) | (BigInt('0x' + crypto.randomBytes(8).toString('hex')) & ((1n << 22n) - 1n)) & ((1n << 64n) - 1n)).toString();
    const conversationId = crypto.randomUUID();

    const variables = {
        "message": { "sensitive_string_value": q },
        "externalConversationId": conversationId,
        "offlineThreadingId": threadId,
        "suggestedPromptIndex": null,
        "flashVideoRecapInput": { "images": [] },
        "flashPreviewInput": null,
        "promptPrefix": null,
        "entrypoint": "ABRA__CHAT__TEXT",
        "icebreaker_type": "TEXT",
        "__relay_internal__pv__WebPixelRatiorelayprovider": 1
    };

    const msgBody = new URLSearchParams({
        'av': '0',
        '__user': '0',
        '__a': '1',
        'dpr': '1',
        'lsd': cache.lsd,
        'access_token': cache.access_token,
        'fb_api_caller_class': 'RelayModern',
        'fb_api_req_friendly_name': 'useKadabraSendMessageMutation',
        'variables': JSON.stringify(variables),
        'server_timestamps': 'true',
        'doc_id': cache.docid.message
    }).toString();

    const msgRes = await fetchWithRetry('https://graph.meta.ai/graphql?locale=user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cache.cookies,
            'Origin': 'https://www.meta.ai',
            'Referer': 'https://www.meta.ai',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Site': 'same-site',
            'User-Agent': userAgent,
            'x-fb-friendly-name': 'useKadabraSendMessageMutation'
        },
        body: msgBody
    });

    const msgText = await msgRes.text();

    const lines = msgText.split('\n').filter((l: string) => l.trim());
    const lastLine = lines[lines.length - 1];
    
    try {
        const data = JSON.parse(lastLine);
        const botResponse = data?.data?.node?.bot_response_message;
        const snippet = botResponse?.snippet;
        const composedText = botResponse?.content?.agent_steps?.[0]?.composed_text?.content?.[0]?.text;
        const response = snippet || composedText || null;
        
        if (!response) {
            return { error: 'Empty response from Meta AI' };
        }
        
        return { response: response, data: null };
    } catch {
        return { error: 'Failed to parse response' };
    }
}


export async function MetaAI(query: string, forceRefresh: boolean = false): Promise<any> {
    if (forceRefresh) {
        metaAICache = null;
    }

    // Fast Path: Check if we have valid cache
    if (metaAICache?.valid && metaAICache.access_token && metaAICache.lsd && metaAICache.docid.message && !forceRefresh) {
        try {
            const result = await sendMessage(query, metaAICache);
            if (!result.error) return result;
            // If fast path fails, clear cache and proceed to slow path
            metaAICache = null;
        } catch {
            metaAICache = null;
        }
    }

    try {
        // Helper to extract value between patterns
        const extractBetween = (text: string, start: string, end: string): string => {
            const startIdx = text.indexOf(start);
            if (startIdx === -1) return '';
            const valueStart = startIdx + start.length;
            const endIdx = text.indexOf(end, valueStart);
            if (endIdx === -1) return '';
            return text.substring(valueStart, endIdx);
        };

        // Extract cookies from response headers
        const extractCookiesFromResponse = (res: Response, existing: string): string => {
            const setCookieHeader = res.headers.get('set-cookie');
            if (!setCookieHeader) return existing;
            
            // Parse multiple cookies (they may be comma-separated or in multiple headers)
            const newCookies = setCookieHeader.split(/,(?=\s*\w+=)/)
                .map(c => c.trim().split(';')[0])
                .join('; ');
            
            if (!existing) return newCookies;
            if (!newCookies) return existing;
            
            const cookieMap = new Map<string, string>();
            existing.split('; ').forEach(c => {
                const [k, ...v] = c.split('=');
                if (k) cookieMap.set(k, v.join('='));
            });
            newCookies.split('; ').forEach(c => {
                const [k, ...v] = c.split('=');
                if (k) cookieMap.set(k, v.join('='));
            });
            return Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
        };

        // Fetch Meta.ai webpage using native fetch
        let cookies = metaAICache?.cookies || '';
        
        let res = await fetchWithRetry('https://www.meta.ai', {
            method: 'GET',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                ...(cookies ? { 'Cookie': cookies } : {}),
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': userAgent
            }
        });
        
        let html = await res.text();
        cookies = extractCookiesFromResponse(res, cookies);

        // Check for bot challenge
        if (html && html.includes('/__rd_verify_')) {
            const challengeMatch = html.match(/fetch\('(\/__rd_verify_[^']+)'/);
            if (challengeMatch) {
                const challengeUrl = 'https://www.meta.ai' + challengeMatch[1];
                
                // POST to challenge URL
                const challengeRes = await fetchWithRetry(challengeUrl, {
                    method: 'POST',
                    headers: {
                        'Accept': '*/*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cookie': cookies,
                        'Origin': 'https://www.meta.ai',
                        'Referer': 'https://www.meta.ai/',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-origin',
                        'User-Agent': userAgent
                    }
                });
                
                // Extract cookies from challenge response
                cookies = extractCookiesFromResponse(challengeRes, cookies);
                await challengeRes.text(); // Consume body
                
                // Retry main request with new cookies
                res = await fetchWithRetry('https://www.meta.ai', {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cookie': cookies,
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'none',
                        'Sec-Fetch-User': '?1',
                        'Upgrade-Insecure-Requests': '1',
                        'User-Agent': userAgent
                    }
                });
                html = await res.text();
                cookies = extractCookiesFromResponse(res, cookies);
            }
        }

        const geoBlocked = html.includes('KadabraGeoBlockedError');
        if (geoBlocked) {
            return { error: "Meta AI isn't available in your region" };
        }

        const lsd = extractBetween(html, '"LSD",[],{"token":"', '"');
        let access_token = extractBetween(html, '"accessToken":"', '"');
        const abra_csrf = extractBetween(html, 'abra_csrf" value="', '"');

        // Find doc_ids from scripts
        let tosDocId = '';
        let messageDocId = '';

        const scriptRegex = /script src="([^"]+)"/g;
        const scriptUrls: string[] = [];
        let match;
        while ((match = scriptRegex.exec(html)) !== null) {
            const url = match[1];
            if (url.startsWith('http') || url.startsWith('//')) {
                scriptUrls.push(url.startsWith('//') ? 'https:' + url : url);
            }
        }

        // Aggressively find ALL fbcdn script URLs in the HTML (handling escaped slashes)
        // Matches: https:\/\/static.xx.fbcdn.net\/rsrc.php\/...
        const allFbcdnMatches = html.matchAll(/https?:\\?\/\\?\/static\.xx\.fbcdn\.net\\?\/rsrc\.php\\?\/[a-zA-Z0-9_\-\/\\.]+\.js/g);
        for (const m of allFbcdnMatches) {
            const cleanUrl = m[0].replace(/\\\//g, '/');
            if (!scriptUrls.includes(cleanUrl)) {
                scriptUrls.push(cleanUrl);
            }
        }

        // Fetch scripts to find doc_ids
        // Fetch scripts in parallel with concurrency limit
        const BATCH_SIZE = 10;
        const targetUrls = scriptUrls.slice(0, 100);
        
        for (let i = 0; i < targetUrls.length; i += BATCH_SIZE) {
            if (tosDocId && messageDocId) break;
            
            const batch = targetUrls.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (url) => {
                if (tosDocId && messageDocId) return;
                try {
                    const scriptRes = await fetchWithRetry(url, {
                        method: 'GET',
                        headers: {
                            'User-Agent': userAgent,
                            'Cookie': cookies,
                            'Sec-Fetch-Site': 'cross-site'
                        }
                    });
                    const scriptText = await scriptRes.text();

                    if (!tosDocId) {
                        const tosMatch = scriptText.match(/useKadabraAcceptTOSForTempUserMutation.*?exports="(\d+)"/);
                        if (tosMatch) tosDocId = tosMatch[1];
                    }
                    if (!messageDocId) {
                        const msgMatch = scriptText.match(/useKadabraSendMessageMutation.*?exports="(\d+)"/);
                        if (msgMatch) messageDocId = msgMatch[1];
                    }
                } catch {}
            }));
        }

        // If no access token, accept TOS
        if (!access_token && tosDocId) {
            const finalCookies = cookies + (abra_csrf ? `; abra_csrf=${abra_csrf}` : '');
            
            const tosBody = new URLSearchParams({
                'av': '0',
                '__user': '0',
                '__a': '1',
                'dpr': '1',
                'lsd': lsd,
                'fb_api_caller_class': 'RelayModern',
                'fb_api_req_friendly_name': 'useKadabraAcceptTOSForTempUserMutation',
                'server_timestamps': 'true',
                'doc_id': tosDocId,
                'variables': JSON.stringify({
                    "dob": "2000-01-01",
                    "__relay_internal__pv__AbraQPDocUploadNuxTriggerNamerelayprovider": "meta_dot_ai_abra_web_doc_upload_nux_tour",
                    "__relay_internal__pv__AbraSurfaceNuxIDrelayprovider": "0"
                })
            }).toString();

            const tosRes = await fetchWithRetry('https://www.meta.ai/api/graphql/', {
                method: 'POST',
                headers: {
                    'User-Agent': userAgent,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': '*/*',
                    'Accept-Language': 'en',
                    'Cookie': finalCookies,
                    'Referer': 'https://www.meta.ai',
                    'Origin': 'https://www.meta.ai',
                    'Sec-Fetch-Site': 'same-origin',
                    'x-asbd-id': '359341',
                    'x-fb-friendly-name': 'useKadabraAcceptTOSForTempUserMutation',
                    'x-fb-lsd': lsd
                },
                body: tosBody
            });

            try {
                const tosData = JSON.parse(await tosRes.text());
                access_token = tosData?.data?.xab_abra_accept_terms_of_service?.new_temp_user_auth?.access_token || '';
                cookies = finalCookies;
            } catch {}
        }

        if (!access_token) {
            return { 
                error: 'Failed to get access token',
                debug: {
                    htmlLength: html?.length || 0,
                    hasLsd: !!lsd,
                    hasTosDocId: !!tosDocId,
                    hasMessageDocId: !!messageDocId,
                    scriptUrlsFound: scriptUrls.length,
                    firstScripts: scriptUrls.slice(0, 5),
                    hasChallenge: html?.includes?.('/__rd_verify_') || false,
                    htmlPreview: html?.substring?.(0, 500) || 'empty'
                }
            };
        }

        if (!messageDocId) {
            return { error: 'Could not find message doc_id' };
        }

        // Store cache
        metaAICache = {
            valid: true,
            access_token,
            lsd,
            cookies,
            docid: { tos: tosDocId, message: messageDocId }
        };

        // Send message
        return await sendMessage(query, metaAICache);
    } catch (e: any) {
        return { error: e.message || 'Unknown error' };
    }
}
