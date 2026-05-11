import httpcloak from 'httpcloak';
import { type Context } from 'hono';
import dns from 'dns';
import { promises as dnsPromises } from 'dns';
import net from 'net';

dns.setServers(['1.1.1.1', '1.0.0.1']);

const DEFAULT_TIMEOUT_MS = 60000;

const FIREFOX_150_JA3 = process.env.TLS_JA3;
const FIREFOX_150_AKAMAI = process.env.TLS_AKAMAI;

export const request = async (url: string, options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | Buffer;
    signal?: AbortSignal;
    useH2?: boolean;
    useH3?: boolean;
    echConfigDomain?: string;
    tlsOnly?: boolean;
    allowRedirects?: boolean;
    retries?: number;
    timeout?: number;
    useOwnTLS?: boolean;
} = {}) => {
    const maxRetries = options.retries ?? 2;
    const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const parentSignal = options.signal;
        const signal = parentSignal
            ? AbortSignal.any([controller.signal, parentSignal])
            : controller.signal;

        let connectTo: Record<string, string> | undefined;
        // Alternate between pinned IP and standard routing on retries
        if (attempt % 2 === 0) {
            try {
                const urlObj = new URL(url);
                if (!net.isIP(urlObj.hostname)) {
                    const ips = await dnsPromises.resolve4(urlObj.hostname);
                    if (ips && ips.length > 0) {
                        const resolvedIp = ips[Math.floor(Math.random() * ips.length)];
                        if (resolvedIp) {
                            connectTo = { [urlObj.hostname]: resolvedIp };
                        }
                    }
                }
            } catch { }
        }

        const activeSession = new httpcloak.Session({
            preset: options.useOwnTLS ? "firefox-133" : undefined,
            ja3: options.useOwnTLS ? FIREFOX_150_JA3 : undefined,
            akamai: options.useOwnTLS ? FIREFOX_150_AKAMAI : undefined,
            preferIpv4: true,
            tlsOnly: options.tlsOnly ?? false,
            httpVersion: options.useH3 ? "h3" : (options.useH2 ? "h2" : undefined),
            echConfigDomain: options.echConfigDomain,
            allowRedirects: options.allowRedirects ?? true,
            connectTo,
        });

        try {
            const method = (options.method?.toLowerCase() ?? 'get') as 'get' | 'post' | 'put' | 'delete' | 'patch';
            const headers: any = { ...options.headers };
            if (url.includes('discord.com/api/')) {
                headers['User-Agent'] = headers['User-Agent'] || 'DiscordBot (https://github.com/discord-bot, 1.0.0)';
            }
            const res = await activeSession[method](url, {
                headers: headers,
                body: options.body,
                timeout: timeoutMs / 1000
            });
            return res;
        } catch (e: any) {
            lastError = e;
            if (attempt === maxRetries) break;
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        } finally {
            try { activeSession.close(); } catch { }
            clearTimeout(timeoutId);
        }
    }
    throw lastError;
};

import { ClientTransaction } from "x-client-transaction-id";
import { parseHTML } from 'linkedom';
import { decodeHTML, decodeXML } from 'entities';
import crypto from 'crypto';
import { Buffer } from 'buffer';
import { resolve6 } from 'dns';
import emojibaseData from 'emojibase-data/en/data.json' with { type: 'json' };
import emojibaseGroups from 'emojibase-data/meta/groups.json' with { type: 'json' };

const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const userAgent = 'Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0';

export const commonHeaders = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Priority': 'u=0, i',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': "1",
    'User-Agent': userAgent
}

let keyYoutubeVisitor: string | null = null;

export async function youtubeVisitorKey(): Promise<string | null> {
    try {
        const res = await request('https://www.youtube.com/', {
            headers: commonHeaders,
            useH2: true
        });
        const text = await res.text;
        return text.split('"visitorData":"')[1]?.split('"')[0] || null;
    } catch (e) {
        console.error("Error fetching visitorData:", e);
        return null;
    }
}

export const getQuery = (c: Context, key: string) => {
    const val = c.req.query(key);
    if (val === undefined) return undefined;
    if (val === 'null') return null;
    return val;
};

export const getToken = (c: Context) => {
    try {
        const token = c.req.query('token');
        if (!token) return null;
        const checktoken = Number.isInteger(parseInt(atob(token.split('.')[0])));
        return checktoken ? token : null;
    } catch {
        return null;
    }
};

const parseAbbreviatedNumber = (str: string | null | undefined): number | null => {
    if (!str) return null;
    const cleanStr = str.replace(/,/g, '').replace(/subscribers|videos|video|views|view|watching/gi, '').trim();
    const match = cleanStr.match(/^(\d+\.?\d*)([KMB]?)$/i);
    if (!match) {
        const n = parseFloat(cleanStr);
        return isNaN(n) ? null : Math.floor(n);
    }

    let num = parseFloat(match[1]!);
    const unit = match[2]!.toUpperCase();

    switch (unit) {
        case 'K': num *= 1000; break;
        case 'M': num *= 1000000; break;
        case 'B': num *= 1000000000; break;
    }
    return Math.floor(num);
};

const formatAbbreviatedNumber = (num: number | string | null | undefined): string => {
    if (num === null || num === undefined) return '0';
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(n)) return '0';

    if (n >= 1000000000) return (n / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toString();
};

const parseYtInitial = (html: any) => {
    try {
        // Robust parsing of ytInitialData
        const dataParts = html.split(/ytInitialData\s*=\s*/);
        if (dataParts.length < 2) return null;

        let jsonStr = dataParts[1];
        // Find the end of the script tag or the next variable assignment
        const endIdx = jsonStr.indexOf(';</script>') !== -1 ? jsonStr.indexOf(';</script>') :
            jsonStr.indexOf('</script>') !== -1 ? jsonStr.indexOf('</script>') :
                jsonStr.length;

        jsonStr = jsonStr.substring(0, endIdx).trim();
        if (jsonStr.endsWith(';')) jsonStr = jsonStr.substring(0, jsonStr.length - 1).trim();

        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("YouTube Parse Error:", e);
        return null;
    }
}

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
let keytidal: string | undefined = "txNoH4kkV41MfH25";
let keytidalopen: string = "txNoH4kkV41MfH25";
let keyflickr: string | undefined;
let keybearer: string | undefined;
let keydeezer: string | undefined;
let keyimgur: string | undefined;
let keygiphy: string | undefined;
let keycrunchy: string | undefined;
let keytumblr: string | undefined = process.env.TUMBLR;
let saweriaBuildId: string | undefined;
let twitterDocument: any;
let twitterTransaction: any;
let twitterAuth: string | undefined = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
let twitterObj: any = {};
let konaSummary: any;

let googleImgSpAuth: any = {};

function deepFind(obj: unknown, key: string): unknown | null {
    if (!obj || typeof obj !== 'object') return null;
    if (Array.isArray(obj)) {
        for (const item of obj) {
            const result = deepFind(item, key);
            if (result != null) return result;
        }
        return null;
    }
    const record = obj as Record<string, unknown>;
    if (key in record) return record[key];
    for (const val of Object.values(record)) {
        const result = deepFind(val, key);
        if (result != null) return result;
    }
    return null;
}

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

export const googleAuthKey = async function googleAuthKey() {
    try {
        const res = await request(`https://cse.google.com/cse.js?hpg=1&cx=${process.env.GOOG_CX}`, {
            headers: {
                ...commonHeaders,
            },
            useH2: true
        });
        if (res.statusCode !== 200) return undefined;
        const text = await res.text;
        const extractObject = text?.split('})(')?.[1]?.slice(0, -2);
        return JSON.parse(extractObject);
    } catch {
        return undefined;
    }
}

export const giphyKey = async function giphyKey() {
    try {
        const res = await request('https://giphy.com/', {
            headers: {
                ...commonHeaders,
            },
            useH2: true
        });
        const text = await res.text;
        const extractHash = text?.split('app/layout-')?.[1]?.split('"')?.[0];
        if (!extractHash) return undefined;
        const res2 = await request(`https://giphy.com/_next/static/chunks/app/layout-${extractHash}`, {
            headers: {
                ...commonHeaders
            },
            useH2: true
        });
        const text2 = await res2.text;
        return text2.split('mobileApiKey:"')[1].split('"')[0];
    } catch {
        return undefined;
    }
}

export const flickrKey = async function flickrKey() {
    try {
        const res = await request('https://flickr.com/photos/', {
            headers: {
                ...commonHeaders,
            }
        });
        const text = await res.text;
        return text.split('flickr.api.site_key =')[1].split('"')[1];
    } catch {
        return undefined;
    }
}

export const soundcloudKey = async function soundcloudKey() {
    try {
        const res = await request('https://m.soundcloud.com', {
            method: 'GET',
            headers: {
                ...commonHeaders,
            }
        });
        const text = await res.text;
        return text.split('"clientId":"')[1].split('"')[0];
    } catch {
        return undefined;
    }
}

function decodeSpotifySecret(encoded: string): Buffer {
    const t = 33;
    const n = 9;

    const byteValues = encoded.split('').map((char, index) => {
        return char.charCodeAt(0) ^ ((index % t) + n);
    });

    const joined = byteValues.join('');
    const asciiBuffer = Buffer.from(joined, 'utf8');
    const hexString = asciiBuffer.toString('hex');

    return Buffer.from(hexString, 'hex');
}

function generateSpotifyTOTP(secretHex: string, timestampMs: number, step = 30): string {
    const counter = Math.floor(timestampMs / 1000 / step);
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', Buffer.from(secretHex, 'hex'));
    hmac.update(buf);
    const digest = hmac.digest();

    const offset = (digest[digest.length - 1] ?? 0) & 0xf;
    const code = ((((digest[offset] ?? 0) & 0x7f) << 24) |
        (((digest[offset + 1] ?? 0) & 0xff) << 16) |
        (((digest[offset + 2] ?? 0) & 0xff) << 8) |
        ((digest[offset + 3] ?? 0) & 0xff)) % 1000000;

    return code.toString().padStart(6, '0');
}

let currentTotpSecret: string | null = null;
let currentTotpVersion: string | null = null;
let lastSecretFetchTime = 0;
const SECRET_FETCH_INTERVAL = 60 * 60 * 1000;

async function ensureTotpSecrets(): Promise<void> {
    const now = Date.now();
    if (currentTotpSecret && now - lastSecretFetchTime < SECRET_FETCH_INTERVAL) return;

    try {
        const res = await request('https://raw.githubusercontent.com/xyloflake/spot-secrets-go/refs/heads/main/secrets/secretDict.json', {
            headers: { Accept: 'application/json' },
            useH2: true
        });

        if (res.statusCode !== 200) throw new Error('Failed to fetch secrets');

        const secrets: any = await res.json();
        const versions = Object.keys(secrets).map(Number);
        const newestVersion = Math.max(...versions).toString();
        const secretData = secrets[newestVersion];

        if (!secretData) throw new Error('Missing newest secret entry');

        const mappedData = secretData.map(
            (value: number, index: number) => value ^ ((index % 33) + 9)
        );

        currentTotpSecret = Buffer.from(mappedData.join(''), 'utf8').toString('hex');
        currentTotpVersion = newestVersion;
        lastSecretFetchTime = now;
    } catch {
        if (!currentTotpSecret) {
            const fallbackData = [
                99, 111, 47, 88, 49, 56, 118, 65, 52, 67, 50, 104, 117, 101, 55, 94, 95,
                75, 94, 49, 69, 36, 85, 64, 74, 60
            ];
            const mapped = fallbackData.map((value, index) => value ^ ((index % 33) + 9));
            currentTotpSecret = Buffer.from(mapped.join(''), 'utf8').toString('hex');
            currentTotpVersion = '19';
        }
    }
}

async function performSpotifyTokenRequest(secretHex: string, version: string) {
    let serverTimeMs = Date.now();
    try {
        const timeRes = await request('https://open.spotify.com/api/server-time', { headers: { 'User-Agent': userAgent }, useH2: true });
        if (timeRes.statusCode === 200) {
            const timeData: any = await timeRes.json();
            serverTimeMs = timeData.serverTime || Date.now();
        }
    } catch { }

    const localTimeMs = Date.now();
    const totpLocal = generateSpotifyTOTP(secretHex, localTimeMs, 30);
    const totpServer = generateSpotifyTOTP(secretHex, serverTimeMs, 900);

    const url = new URL('https://open.spotify.com/api/token');
    url.searchParams.append('reason', 'init');
    url.searchParams.append('productType', 'mobile-web-player');
    url.searchParams.append('totp', totpLocal);
    url.searchParams.append('totpServer', totpServer);
    url.searchParams.append('totpVer', version);

    const res = await request(url.toString(), {
        method: 'GET',
        headers: {
            ...commonHeaders,
            ...(process.env.SPOTIFY_COOKIES ? { cookie: process.env.SPOTIFY_COOKIES } : {}),
            'User-Agent': userAgent,
            'Origin': 'https://open.spotify.com/',
            'Referer': 'https://open.spotify.com/',
            'Accept': 'application/json'
        },
        useH2: true
    });

    if (res.statusCode !== 200) throw new Error(`Spotify Auth Error: ${res.statusCode}`);

    const data: any = await res.json();
    const token = data.accessToken;
    if (!token) throw new Error('Missing token');

    return data.accessToken;
}

const CONSUMER_KEY_MACK = 'audiomack-web';
const CONSUMER_SECRET_MACK = 'bd8a07e9f23fbe9d808646b730f89b8e';
const STRICT_URI_RE = /[!'()*]/g;

type OAuthParamValue = string | number | boolean;

function strictEncodeURIComponent(value: OAuthParamValue): string {
    return encodeURIComponent(String(value)).replace(
        STRICT_URI_RE,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
    )
}

function buildParamString(params: Record<string, OAuthParamValue>): string {
    return Object.keys(params)
        .sort()
        .map((key) => `${strictEncodeURIComponent(key)}=${strictEncodeURIComponent(params[key] ?? '')}`)
        .join('&')
}

export const mackOauth = async function mackOauth(
    method: string,
    url: string,
    additionalParams: Record<string, OAuthParamValue> = {}
): Promise<{ signature: string; params: Record<string, OAuthParamValue> }> {
    const params: Record<string, OAuthParamValue> = {
        ...additionalParams,
        oauth_consumer_key: CONSUMER_KEY_MACK,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000),
        oauth_version: '1.0'
    }

    const paramString = buildParamString(params)
    const signatureBase = `${method.toUpperCase()}&${strictEncodeURIComponent(url)}&${strictEncodeURIComponent(paramString)}`
    const signingKey = `${strictEncodeURIComponent(CONSUMER_SECRET_MACK)}&`
    const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64')

    return { signature, params }
}

export const spotifyKey = async function spotifyKey() {
    try {
        const primarySecret = { secret: ',7/*F("rLJ2oxaKL^f+E1xvP@N', version: 61 };
        const secretHex = decodeSpotifySecret(primarySecret.secret).toString('hex');
        const version = String(primarySecret.version);

        return await performSpotifyTokenRequest(secretHex, version);
    } catch {
        try {
            await ensureTotpSecrets();
            if (currentTotpSecret && currentTotpVersion) {
                return await performSpotifyTokenRequest(currentTotpSecret, currentTotpVersion);
            }
        } catch { }

        // Final fallback to original embed scraping
        try {
            const res = await request(`https://open.spotify.com/embed/track/${["4PTG3Z6ehGkBFwjybzWkR8", "2yR2sziCF4WEs3klW1F38d", "0IuVhCflrQPMGRrOyoY5RW", "2yWlGEgEfPot0lv3OAjuG3", "4Xfp9BcKrKYmxJPxn68Yb8", "7uuJqaRjSXzja6VGgDpWem", " BP1klbHxsOf6IxscNIX0r", "6BYzwbWg1Z2EB6VUXTYnhm"][Math.floor(Math.random() * 8)]}`, {
                headers: { ...commonHeaders, ...(process.env.SPOTIFY_COOKIES ? { cookie: process.env.SPOTIFY_COOKIES } : {}), },
                useH2: true
            });
            const text = await res.text;
            return text.split('"accessToken":"')[1].split('"')[0];
        } catch {
            return undefined;
        }
    }
}

export const spotifyKeyToken = async function spotifyKeyToken() {
    const clientId = {
        "web_player": "d8a5ed958d274c2e8ee717e6a4b0971d",
        "mobile_web_player": "f6a40776580943a7bc5173125a1e8832",
        "embeds": "ab9ad0d96a624805a7d51e8868df1f97"
    };

    const bodyhttp = { "client_data": { "client_version": "1.0", "client_id": clientId.mobile_web_player, "js_sdk_data": {} } };

    try {
        const req = await request(`https://clienttoken.spotify.com/v1/clienttoken`, {
            method: "POST",
            body: JSON.stringify(bodyhttp),
            headers: {
                ...commonHeaders,
                ...(process.env.SPOTIFY_COOKIES ? { cookie: process.env.SPOTIFY_COOKIES } : {}), // optional but whatever
                'Origin': 'https://clienttoken.spotify.com',
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            useH2: true
        });

        const res: any = await req.json();
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
        const rest_get = await rest.text;
        const rest2 = await request("https://embed.tidal.com" + rest_get.split('type="module"')[0].split('script src="')[1].split('"')[0], {
            headers: {
                ...commonHeaders,
            }
        });
        const rest2_get = await rest2.text;
        return rest2_get.split('"X-Tidal-Token","')[1].split('"')[0];
    } catch { return undefined; }
}

export const tidalKeysToken = async function tidalKeysToken(refresh: boolean = false) {
    try {
        if (!keytidal || refresh) {
            keytidal = await tidalKeys();
        }

        const rt = new URLSearchParams();
        rt.append('client_id', 'txNoH4kkV41MfH25');
        rt.append('client_secret', decodeURIComponent('dQjy0MinCEvxi1O4UmxvxWnDjt4cgHBPw8ll6nYBk98%3D'));
        rt.append('grant_type', 'client_credentials');

        const rest = await request(`https://auth.tidal.com/v1/oauth2/token`, {
            method: "POST",
            body: rt.toString(),
            headers: {
                ...commonHeaders,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (rest.statusCode === 400 || rest.statusCode === 401) {
            return await tidalKeysToken(true);
        }

        const res: any = await rest.json();
        return res.access_token;
    } catch { return undefined; }
}

export const deezerKeys = async function deezerKeys() {
    try {
        const rest = await request("https://auth.deezer.com/login/anonymous?jo=p&rto=p", {
            headers: {
                ...commonHeaders,
            }
        });
        let rest_get: any = await rest.text;
        rest_get = JSON.parse(rest_get);
        return rest_get.jwt;
    } catch { return undefined; }
}

export const twitterKey = async function twitterKey(typeName: string) {
    try {
        const response = await request("https://x.com/", { headers: { ...commonHeaders }, useH2: true });
        const html = await response.text;
        const { document } = parseHTML(html);
        twitterDocument = document;

        twitterTransaction = new ClientTransaction(twitterDocument);
        await twitterTransaction.initialize();

        const pul1 = await request("https://abs.twimg.com/responsive-web/client-web/main" + html.split('client-web/main')[1].split('"')[0], { headers: { ...commonHeaders }, useH2: true });

        const res1 = await pul1.text;

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

export const imgurKey = async function imgurKey() {
    try {
        const req = await request('https://imgur.com', { headers: { ...commonHeaders }, useH2: true });
        const res = await req.text;

        const mainAssetPath = res.split("desktop-assets/js/main")[1]?.split('>')[0];
        if (!mainAssetPath) return undefined;

        const req2 = await request('https://s.imgur.com/desktop-assets/js/main' + mainAssetPath, { headers: { ...commonHeaders }, useH2: true });
        const res2 = await req2.text;
        return res2.split('apiClientId:"')[1]?.split('"')[0];
    }
    catch (e) {
        console.error("Imgur Key Error:", e);
    }
}

export const crunchyKey = async function crunchyKey() {
    try {
        const req = await request(atob("aHR0cHM6Ly93d3cuY3J1bmNoeXJvbGwuY29tL2F1dGgvdjEvdG9rZW4="), {
            headers: {
                ...commonHeaders,
                'Accept': 'application/json',
                'Authorization': 'Basic Y3Jfd2ViOg==',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': `device_id=${crypto.randomUUID()}; c_locale=en`,
                'Origin': 'https://www.crunchyroll.com'
            },
            method: "POST",
            body: "grant_type=client_id",
            useH2: true
        });
        if (req.statusCode !== 200) return;
        const res = await req.json();
        return res.access_token;
    }
    catch (e) {
        console.error(e);
    }
}

export const Flickr = async function Flickr(que: string, refresh_auth?: boolean, limit_number: number = 10): Promise<any> {
    if (!que) return null;

    if (refresh_auth || !keyflickr) {
        keyflickr = await flickrKey();
    }

    try {
        const per = await request(`https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=${keyflickr}&format=json&nojsoncallback=1&tags=${encodeURIComponent(que)}&per_page=${limit_number}`, {
            headers: commonHeaders,
            useH2: true
        });

        if (per.statusCode === 403) {
            return { "error": "Cloudflare Turnstile asking to verify you're not a bot" }
        }

        if (per.statusCode === 401) {
            return await Flickr(que, true);
        }

        const pes = await per.json();

        if (!pes?.photos?.photo?.[0]) {
            return { data: null }
        }

        const listids: string[] = pes.photos.photo.map((a: any) => a.id);

        // getInfo bulk + getSizes per-photo in parallel
        const [per2, sizesResults] = await Promise.all([
            request(`https://api.flickr.com/services/rest/?method=flickr.photos.getInfo&photo_ids=${listids}&api_key=${keyflickr}&format=json&nojsoncallback=1`, {
                headers: commonHeaders,
                useH2: true
            }),
            Promise.all(listids.map(id =>
                request(`https://api.flickr.com/services/rest/?method=flickr.photos.getSizes&photo_id=${id}&api_key=${keyflickr}&format=json&nojsoncallback=1`, {
                    headers: commonHeaders,
                    useH2: true
                }).then(r => r.json()).then(j => ({ id, sizes: j?.sizes?.size ?? [] }))
            ))
        ]);

        if (per2.statusCode === 403) {
            return { "error": "Cloudflare Turnstile asking to verify you're not a bot" }
        }

        const pes2 = await per2.json();

        const sizesMap: Record<string, any[]> = {};
        for (const { id, sizes } of sizesResults) {
            sizesMap[id] = sizes;
        }

        const pulpes: any = pes2.photos.photo.map((a: any) => {
            const sizes: any[] = sizesMap[a.id] ?? [];
            const original = sizes.find((s: any) => s.label === 'Original');

            const sizeMap = Object.fromEntries(
                sizes.map((s: any) => [s.label, {
                    url: s.source,
                    width: Number(s.width),
                    height: Number(s.height)
                }])
            );

            const highest = sizes.length > 0 ? (original && sizes.length > 1 ? sizes[sizes.length - 2] : sizes[sizes.length - 1]) : null;

            const originalUrl = original?.source ?? (a.originalsecret && a.originalformat ? `https://live.staticflickr.com/${a.server}/${a.id}_${a.originalsecret}_o.${a.originalformat}` : null);

            return {
                ...a,
                media: {
                    type: a.media,
                    canDownload: originalUrl != null,
                    sizes: sizeMap,
                    preview: sizeMap['Large']?.url ?? sizeMap['Medium 800']?.url ?? null,
                    highest: highest?.source ?? null,
                    original: originalUrl,
                    width: original ? Number(original.width) : (a.originalwidth ? Number(a.originalwidth) : (highest ? Number(highest.width) : 0)),
                    height: original ? Number(original.height) : (a.originalheight ? Number(a.originalheight) : (highest ? Number(highest.height) : 0)),
                }
            };
        });

        return { data: pulpes };
    } catch (e) { console.error(e); return null; }
}

export const YTVideo = async function YTVideo(que: string, deepSearch: boolean = false) {
    if (!que) return null;
    try {
        /*
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
        */

        const response = await request(`https://www.youtube.com/results?search_query=${encodeURIComponent(que)}`, {
            headers: {
                ...commonHeaders
            },
            useH2: true
        });

        let res: any = await response.text;

        res = parseYtInitial(res);
        if (!res) {
            return { data: null }
        }

        let alk: any[] = [];
        const inrtubeContents = res?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
        const queryId: any = inrtubeContents?.find((m: any) => !!m.videoRenderer?.searchVideoResultEntityKey)?.videoRenderer?.searchVideoResultEntityKey;

        const videoItems = inrtubeContents.flatMap((item: any) => {
            if (item.shelfRenderer?.content?.verticalListRenderer?.items) {
                return item.shelfRenderer.content.verticalListRenderer.items;
            }
            if (item.shelfRenderer?.content?.horizontalListRenderer?.items) {
                return item.shelfRenderer.content.horizontalListRenderer.items;
            }
            return item;
        });

        const mappedTasks = videoItems.map(async (item: any) => {
            const a = item.videoRenderer;
            if (!a) return null;
            const checkmix = a?.navigationEndpoint?.watchEndpoint?.playlistId;
            let mixData: any = null;

            if (checkmix && deepSearch) {
                try {
                    const rlkreq = await request(`https://www.youtube.com/watch?v=&list=${checkmix}`, {
                        headers: { ...commonHeaders },
                        useH2: true
                    });

                    let rlkresText = await rlkreq.text;
                    let rlkres: any = parseYtInitial(rlkresText);

                    if (rlkres) {
                        const kkmvytmx = rlkres?.contents?.twoColumnWatchNextResults?.playlist?.playlist;
                        if (kkmvytmx) {
                            const kkmvytfd = rlkres?.contents?.twoColumnWatchNextResults?.secondaryResults?.secondaryResults?.results?.[0]?.itemSectionRenderer?.contents;
                            let getmgcf: any = null;
                            try {
                                getmgcf = new URL(kkmvytmx.playlistShareUrl);
                                getmgcf = getmgcf.searchParams.get("list");
                            }
                            catch { }
                            mixData = {
                                playlistId: getmgcf,
                                title: kkmvytmx.title,
                                shareUrl: kkmvytmx.playlistShareUrl,
                                data: kkmvytmx.contents?.map((c: any) => ({
                                    videoId: c.playlistPanelVideoRenderer?.videoId,
                                    url: "https://www.youtube.com/watch?v=" + c.playlistPanelVideoRenderer?.videoId,
                                    altUrl: "https://www.youtube.com" + c.playlistPanelVideoRenderer?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url,
                                    title: c.playlistPanelVideoRenderer?.title?.simpleText,
                                    duration: c.playlistPanelVideoRenderer?.lengthText?.simpleText,
                                    thumbnail: "https://s.ytimg.com/vi/" + c.playlistPanelVideoRenderer?.videoId + "/hq720.jpg",
                                    owner: {
                                        name: c.playlistPanelVideoRenderer?.longBylineText?.runs?.[0]?.text,
                                        url: "https://www.youtube.com" + c.playlistPanelVideoRenderer?.longBylineText?.runs?.[0]?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url
                                    }
                                })) || [],
                                altData: kkmvytfd?.filter((c: any) => c.lockupViewModel)?.map((c: any) => {
                                    const lvm = c.lockupViewModel;
                                    const nUrl = lvm?.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url || "";
                                    const rId = nUrl.includes("v=") ? nUrl.split("v=")[1].split("&")[0] : lvm?.contentId;
                                    return {
                                        videoId: rId,
                                        url: "https://www.youtube.com/watch?v=" + rId,
                                        altUrl: "https://www.youtube.com" + nUrl,
                                        title: lvm?.metadata?.lockupMetadataViewModel?.title?.content,
                                        thumbnail: "https://s.ytimg.com/vi/" + rId + "/hq720.jpg",
                                        owner: {
                                            name: lvm?.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content,
                                            url: lvm?.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url ? "https://www.youtube.com" + lvm?.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url : null,
                                            avatar: lvm?.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources?.[0]?.url?.replace(/=s\d+.*/, "=s0"),
                                        }
                                    };
                                }) || []
                            };
                        }
                    }
                } catch (e) { console.error("Mix fetch error:", e); }
            }

            try {
                const chnl = a.longBylineText?.runs?.[0];
                const chnl2 = chnl?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url;
                const fom = {
                    type: "videoRenderer",
                    videoId: a.videoId,
                    url: "https://www.youtube.com/watch?v=" + a.videoId,
                    altUrl: "https://www.youtube.com" + a.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url,
                    thumbnail: "https://s.ytimg.com/vi/" + a.videoId + "/maxresdefault.jpg",
                    movingThumbnail: a.richThumbnail?.movingThumbnailRenderer?.movingThumbnailDetails?.thumbnails?.[0]?.url || null,
                    previewThumbnail: a?.expandableMetadata?.expandableMetadataRenderer?.expandedContent?.horizontalCardListRenderer?.cards?.[0]?.macroMarkersListItemRenderer?.thumbnail?.thumbnails?.[0]?.url || (a.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url?.startsWith('/shorts') ? "https://s.ytimg.com/vi/" + a.videoId + "/oardefault.jpg" : null),
                    title: a.title?.runs?.[0]?.text,
                    description: a.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((b: any) => b.text)?.join('') || "",
                    owners: {
                        name: a.ownerText?.runs?.[0]?.text,
                        url: (chnl2 ? ["https://www.youtube.com" + chnl2] : chnl?.navigationEndpoint?.showDialogCommand?.panelLoadingStrategy?.inlineContent?.dialogViewModel?.customContent?.listViewModel?.listItems?.map((d: any) => {
                            const u = d.listItemViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url ||
                                d.listItemViewModel?.leadingAccessory?.avatarViewModel?.endpoint?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url ||
                                d.listItemViewModel?.title?.commandRuns?.[0]?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url;
                            return u ? "https://www.youtube.com" + u : null;
                        }).filter(Boolean)) || [],
                        avatar: (a.avatar?.avatarStackViewModel?.avatars?.map((e: any) => e?.avatarViewModel?.image?.sources?.[0]?.url) || [a.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails?.[0]?.url]?.map((k: any) => k))?.map((k: any) => k?.replace(/=s\d+.*/, "=s0"))
                    },
                    timeChapters: a?.expandableMetadata?.expandableMetadataRenderer?.expandedContent?.horizontalCardListRenderer?.cards?.map((k: any) => ({
                        text: k?.macroMarkersListItemRenderer?.title?.runs?.[0]?.text,
                        time: k?.macroMarkersListItemRenderer?.timeDescription?.runs?.[0]?.text,
                        thumbnail: k?.macroMarkersListItemRenderer?.thumbnail?.thumbnails?.[0]?.url,
                        isHighlighted: k?.macroMarkersListItemRenderer?.isHighlighted,
                        url: "https://www.youtube.com/" + k?.macroMarkersListItemRenderer?.onTap?.commandMetadata?.webCommandMetadata?.url
                    })) || null,
                    isLive: a?.badges?.some((bad: any) => bad?.metadataBadgeRenderer?.icon?.iconType === 'LIVE') || false,
                    isATV: ((a.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((b: any) => b.text).join('') || "")?.startsWith("Provided to YouTube by ") && a.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer.icon.iconType === "MUSIC") || false,
                    isMix: !!a?.navigationEndpoint?.watchEndpoint?.playlistId,
                    isShorts: a.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url?.startsWith('/shorts'),
                    mixPlaylist: mixData,
                    viewCount: parseAbbreviatedNumber(a?.viewCountText?.simpleText?.split(' ')?.[0] || a.viewCountText?.runs?.[0]?.text),
                    duration: a.lengthText?.simpleText || a.lengthText?.runs?.[0]?.text || null
                };
                return fom;
            } catch (err) {
                console.error("Error parsing YouTube Video item:", err);
                return null;
            }
        });

        alk = (await Promise.all(mappedTasks)).filter(Boolean);

        const mappedTasks2 = inrtubeContents.map((item: any) => {
            const a = item.gridShelfViewModel;
            if (!a) return null;
            return a.contents.map((e: any) => ({
                type: "shortsGrid",
                videoId: e?.shortsLockupViewModel?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId,
                url: "https://www.youtube.com/watch?v=" + e?.shortsLockupViewModel?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId,
                altUrl: "https://www.youtube.com" + e?.shortsLockupViewModel?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url,
                thumbnail: "https://s.ytimg.com/vi/" + e?.shortsLockupViewModel?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId + "/maxresdefault.jpg",
                movingThumbnail: null,
                previewThumbnail: "https://s.ytimg.com/vi/" + e?.shortsLockupViewModel?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId + "/oardefault.jpg",
                title: e?.shortsLockupViewModel?.overlayMetadata?.primaryText?.content || null,
                description: "",
                owners: {},
                timeChapters: null,
                isLive: false,
                isATV: false,
                isMix: false,
                isShorts: true,
                mixPlaylist: null,
                viewCount: parseAbbreviatedNumber(e?.shortsLockupViewModel?.overlayMetadata?.secondaryText?.content?.split(' ')?.[0]),
                duration: null
            }));
        });
        const finalTask2 = mappedTasks2.filter(Boolean).flat();

        return { searchParams: queryId, data: alk?.concat(finalTask2) };
    } catch (e) { console.error("YTSearch Global Error:", e); return null; }
}

export const YTMusic = async function YTMusic(que: string, deepSearch: boolean = false) {
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
        const response = await request('https://m.youtube.com/youtubei/v1/search?prettyPrint=false&fields=contents', {
            headers: {
                ...commonHeaders,
                'Content-Type': 'application/json'
            },
            body: bodyload,
            method: "POST",
            useH2: true
        });

        const res: any = await response.json();

        if (!res?.contents?.tabbedSearchResultsRenderer) {
            return {
                error: "YouTube Music is not available in your area"
            }
        }

        const sectionContents = res?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
        const musicShelf = sectionContents.find((c: any) => c.musicShelfRenderer)?.musicShelfRenderer;
        const innerTubeResults = musicShelf?.contents || [];

        const mappedTasks = innerTubeResults.map(async (item: any) => {
            const a = item.musicResponsiveListItemRenderer;
            if (!a) return null;

            try {
                const flexColumn1 = a.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
                const flexColumn0 = a.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
                const flexColumn2 = a.flexColumns?.[2]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];

                const artistRuns = flexColumn1.filter((r: any) =>
                    r?.navigationEndpoint?.browseEndpoint
                        ?.browseEndpointContextSupportedConfigs
                        ?.browseEndpointContextMusicConfig
                        ?.pageType?.startsWith('MUSIC_PAGE_TYPE_ARTIST')
                );

                const artistRunsFallback = artistRuns.length > 0 ? artistRuns : flexColumn1.filter((r: any) =>
                    r?.navigationEndpoint?.browseEndpoint?.browseId &&
                    !r?.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('MPRE')
                );

                const artistRunsFinal = artistRunsFallback.length > 0 ? artistRunsFallback : (() => {
                    const plainRun = flexColumn1[0];
                    if (!plainRun?.text || plainRun.navigationEndpoint) return [];
                    return plainRun.text
                        .replace(/,\s*&\s*/g, ' & ')
                        .split(/,\s*|\s+&\s+|\s+and\s+/)
                        .map((name: string) => name.trim())
                        .filter(Boolean)
                        .map((name: string) => ({ text: name, navigationEndpoint: null }));
                })();

                const albumRun = flexColumn1.find((r: any) => r?.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('MPRE'));
                const durationRun = flexColumn1.filter((r: any) => r?.text?.includes(':')).pop() || flexColumn1[flexColumn1.length - 1];

                const musch = a.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url?.replace(/=w\d+.*/, "=s0");
                const muspl = a.menu?.menuRenderer?.items?.find((e: any) => e.menuNavigationItemRenderer?.navigationEndpoint?.watchEndpoint)?.menuNavigationItemRenderer?.navigationEndpoint?.watchEndpoint?.playlistId;
                const videoId = a.playlistItemData?.videoId || a.navigationEndpoint?.watchEndpoint?.videoId;

                let mixData: any = null;
                if (muspl && deepSearch) {
                    try {
                        const rlkreq = await request(`https://www.youtube.com/watch?v=&list=${muspl}`, {
                            headers: { ...commonHeaders },
                            useH2: true
                        });

                        let rlkresText = await rlkreq.text;
                        let rlkres: any = parseYtInitial(rlkresText);

                        if (rlkres) {
                            const kkmvytmx = rlkres?.contents?.twoColumnWatchNextResults?.playlist?.playlist;
                            if (kkmvytmx) {
                                const kkmvytfd = rlkres?.contents?.twoColumnWatchNextResults?.secondaryResults?.secondaryResults?.results?.[0]?.itemSectionRenderer?.contents;
                                let getmgcf: any = null;
                                try {
                                    getmgcf = new URL(kkmvytmx.playlistShareUrl);
                                    getmgcf = getmgcf.searchParams.get("list");
                                } catch { }
                                mixData = {
                                    playlistId: getmgcf,
                                    title: kkmvytmx.title,
                                    shareUrl: kkmvytmx.playlistShareUrl,
                                    data: kkmvytmx.contents?.map((c: any) => ({
                                        videoId: c.playlistPanelVideoRenderer?.videoId,
                                        url: "https://www.youtube.com/watch?v=" + c.playlistPanelVideoRenderer?.videoId,
                                        altUrl: "https://www.youtube.com" + c.playlistPanelVideoRenderer?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url,
                                        title: c.playlistPanelVideoRenderer?.title?.simpleText,
                                        duration: c.playlistPanelVideoRenderer?.lengthText?.simpleText,
                                        thumbnail: "https://s.ytimg.com/vi/" + c.playlistPanelVideoRenderer?.videoId + "/hq720.jpg",
                                        owner: {
                                            name: c.playlistPanelVideoRenderer?.longBylineText?.runs?.[0]?.text,
                                            url: "https://www.youtube.com" + c.playlistPanelVideoRenderer?.longBylineText?.runs?.[0]?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url
                                        }
                                    })) || [],
                                    altData: kkmvytfd?.filter((c: any) => c.lockupViewModel)?.map((c: any) => {
                                        const lvm = c.lockupViewModel;
                                        const nUrl = lvm?.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url || "";
                                        const rId = nUrl.includes("v=") ? nUrl.split("v=")[1].split("&")[0] : lvm?.contentId;
                                        return {
                                            videoId: rId,
                                            url: "https://www.youtube.com/watch?v=" + rId,
                                            altUrl: "https://www.youtube.com" + nUrl,
                                            title: lvm?.metadata?.lockupMetadataViewModel?.title?.content,
                                            thumbnail: "https://s.ytimg.com/vi/" + rId + "/hq720.jpg",
                                            owner: {
                                                name: lvm?.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content,
                                                url: lvm?.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url ? "https://www.youtube.com" + lvm?.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url : null,
                                                avatar: lvm?.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources?.[0]?.url?.replace(/=s\d+.*/, "=s0"),
                                            }
                                        };
                                    }) || []
                                };
                            }
                        }
                    } catch (e) { console.error("YTMusic mix fetch error:", e); }
                }

                return {
                    duration: durationRun?.text || null,
                    browseId: artistRunsFinal[0]?.navigationEndpoint?.browseEndpoint?.browseId || null,
                    albumBrowseId: albumRun?.navigationEndpoint?.browseEndpoint?.browseId || null,
                    playlistId: muspl,
                    videoId,
                    url: videoId ? "https://music.youtube.com/watch?v=" + videoId : null,
                    altUrl: videoId ? "https://music.youtube.com/watch?v=" + videoId + "&list=" + muspl : null,
                    baseUrl: videoId ? "https://www.youtube.com/watch?v=" + videoId : null,
                    shortUrl: videoId ? "https://youtu.be/" + videoId : null,
                    thumbnail: musch?.startsWith('//') ? 'https:' + musch : musch,
                    title: flexColumn0[0]?.text,
                    listenCount: String(parseAbbreviatedNumber(flexColumn2[0]?.text?.split(' ')?.[0])),
                    isATV: flexColumn0[0].navigationEndpoint.watchEndpoint.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig.musicVideoType === 'MUSIC_VIDEO_TYPE_ATV',
                    isExplicit: a?.badges?.[0]?.musicInlineBadgeRenderer?.icon?.iconType?.startsWith('MUSIC_EXPLICIT') || false,
                    isCollab: artistRunsFinal.length > 1,
                    mixPlaylist: mixData,
                    artists: artistRunsFinal.length > 0
                        ? artistRunsFinal.map((r: any) => ({
                            name: r.text,
                            browseId: r.navigationEndpoint?.browseEndpoint?.browseId || null,
                            url: r.navigationEndpoint?.browseEndpoint?.browseId
                                ? "https://music.youtube.com/channel/" + r.navigationEndpoint.browseEndpoint.browseId
                                : null
                        }))
                        : [{ name: flexColumn1[0]?.text || "Unknown", browseId: null, url: null }]
                };
            } catch (err) {
                console.error("Error parsing YouTube Music item:", err);
                return null;
            }
        });

        const alk = (await Promise.all(mappedTasks)).filter(Boolean);

        return { data: alk };
    } catch (e) {
        console.error("YTMusic Global Error:", e);
        return null;
    }
}

export const YTPlaylist = async function YTPlaylist(que: string) {
    if (!que) return null;
    try {
        const bodyload = JSON.stringify({
            query: que,
            params: "EgIQAw==",
            context: {
                client: {
                    clientName: "WEB",
                    clientVersion: "2.20251212",
                    hl: "en",
                    gl: "US"
                }
            }
        });

        const response = await request('https://m.youtube.com/youtubei/v1/search?prettyPrint=false', {
            headers: {
                ...commonHeaders,
                'content-type': 'application/json'
            },
            body: bodyload,
            method: "POST",
            useH2: true
        });

        const res: any = await response.json();
        const contents = res?.contents?.twoColumnSearchResultsRenderer?.primaryContents
            ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

        const alk: any[] = [];

        contents.forEach((item: any) => {
            const a = item.lockupViewModel;
            if (!a || a.contentType !== 'LOCKUP_CONTENT_TYPE_PLAYLIST') return;

            try {
                const meta = a.metadata?.lockupMetadataViewModel;
                const metadataRows = meta?.metadata?.contentMetadataViewModel?.metadataRows || [];

                // owner
                const ownerPart = metadataRows[0]?.metadataParts?.[0]?.text;
                const ownerRun = ownerPart?.commandRuns?.[0];
                const ownerUrl = ownerRun?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url;
                const browseId = ownerRun?.onTap?.innertubeCommand?.browseEndpoint?.browseId;

                // thumbnail: pick highest width source, ensure hq720
                const sources: any[] = a.contentImage?.collectionThumbnailViewModel?.primaryThumbnail
                    ?.thumbnailViewModel?.image?.sources || [];
                const bestThumb = sources.reduce((best: any, s: any) => (!best || s.width > best.width) ? s : best, null);
                const thumbnail = bestThumb
                    ? (bestThumb.url?.startsWith('//') ? 'https:' + bestThumb.url : bestThumb.url)
                    : null;

                // video count badge
                const badge = a.contentImage?.collectionThumbnailViewModel?.primaryThumbnail
                    ?.thumbnailViewModel?.overlays?.[0]?.thumbnailOverlayBadgeViewModel
                    ?.thumbnailBadges?.[0]?.thumbnailBadgeViewModel?.text;

                // target videos: rows that have metadataParts with commandRuns to a watch endpoint
                const targetVideo = metadataRows
                    .filter((row: any) => !row.isSpacerRow && row.metadataParts?.[0]?.text?.commandRuns?.length)
                    .map((row: any) => {
                        const part = row.metadataParts[0].text;
                        const run = part.commandRuns?.[0];
                        const webUrl = run?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url;
                        if (!webUrl?.startsWith('/watch')) return null;

                        const watchEndpoint = run?.onTap?.innertubeCommand?.watchEndpoint;
                        const videoId = watchEndpoint?.videoId;

                        // split "title · duration" from content
                        const raw: string = part.content || '';
                        const sepIdx = raw.lastIndexOf(' · ');
                        const title = sepIdx !== -1 ? raw.slice(0, sepIdx) : raw;
                        const duration = sepIdx !== -1 ? raw.slice(sepIdx + 3) : null;

                        // url without list, altUrl with list
                        const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
                        const altUrl = webUrl ? `https://www.youtube.com${webUrl}` : null;

                        const videoThumb = videoId
                            ? `https://i.ytimg.com/vi/${videoId}/hq720.jpg`
                            : null;

                        return { title, url, altUrl, duration, thumbnail: videoThumb };
                    })
                    .filter(Boolean);

                const fom = {
                    playlistId: a.contentId,
                    url: "https://www.youtube.com/playlist?list=" + a.contentId,
                    title: meta?.title?.content,
                    videoCount: badge ? parseInt(badge.replace(/[^0-9]/g, '')) || null : null,
                    thumbnail,
                    targetVideo,
                    owner: {
                        name: ownerPart?.content,
                        browseId: browseId || null,
                        url: ownerUrl ? "https://www.youtube.com" + ownerUrl : null
                    }
                };
                alk.push(fom);
            } catch (err) {
                console.error("Error parsing YouTube Playlist item:", err);
            }
        });

        return { data: alk };
    } catch (e) { console.error("YTPlaylist Global Error:", e); return null; }
}

export const SCMusic = async function SCMusic(que: string, refresh_auth?: boolean, limit_number: number = 10): Promise<any> {
    if (!que) return null;

    if (refresh_auth || !keysc) {
        keysc = await soundcloudKey();
    }

    try {
        const [per, per2] = await Promise.all([
            request(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(que)}&client_id=${keysc}&limit=${limit_number}&linked_partitioning=0`, {
                headers: {
                    ...commonHeaders,
                }
            }),
            request(`https://mobi.soundcloud.com/search/tracks?q=${encodeURIComponent(que)}`, {
                headers: {
                    ...commonHeaders,
                }
            })
        ]);

        if (per.statusCode === 401) {
            return await SCMusic(que, true);
        }
        const pes = per.statusCode === 200 ? await per.json() : null;
        let testpes: any = null;
        try {
            const per2Text = await per2.text;
            testpes = JSON.parse(per2Text.split('type="application/json">')[1].split('</script>')[0]);
        }
        catch { }
        return { data: [pes?.collection || null, testpes?.props?.pageProps?.initialStoreState?.entities || null] };
    } catch (e) { console.error(e); return null; }
}

export const SPMusic = async function SPMusic(que: string, refresh_auth: boolean = false, limit_number: number = 20): Promise<any> {
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
        const perbody = { "variables": { "searchTerm": que, "offset": 0, "limit": limit_number, "numberOfTopResults": limit_number, "includeAudiobooks": true, "includeArtistHasConcertsField": true, "includePreReleases": true, "includeAuthors": true }, "operationName": "searchDesktop", "extensions": { "persistedQuery": { "version": 1, "sha256Hash": "fcad5a3e0d5af727fb76966f06971c19cfa2275e6ff7671196753e008611873c" } } };
        const per2 = await request(`https://api-partner.spotify.com/pathfinder/v2/query`, {
            method: "POST",
            body: JSON.stringify(perbody),
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://open.spotify.com',
                'Authorization': 'Bearer ' + (keysp || ''),
                'App-Platform': 'WebPlayer',
                'Client-Token': keysptoken || '',
                ...commonHeaders,
            },
            useH2: true
        });

        if (per2.statusCode === 403) {
            return {
                error: "IP Blocked"
            }
        }

        if (per2.statusCode === 429) {
            return {
                error: "Rate-limited"
            }
        }

        if ((per2.statusCode === 401 || per2.statusCode === 400) && !refresh_auth) {
            return await SPMusic(que, true);
        }
        else {
            const pes2: any = await per2.json();
            const finalpes: any = pes2?.data?.searchV2;
            return {
                data: {
                    albums: finalpes.albumsV2.items?.map((a: any) => a.data) || null,
                    artists: finalpes.artists.items?.map((a: any) => a.data) || null,
                    audiobooks: finalpes.audiobooks.items?.map((a: any) => a.data) || null,
                    featured: finalpes.topResultsV2.itemsV2?.map((a: any) => a.item.data) || null,
                    episodes: finalpes.episodes.items?.map((a: any) => a.data) || null,
                    genres: finalpes.genres.items?.map((a: any) => a.data) || null,
                    playlists: finalpes.playlists.items?.map((a: any) => a.data) || null,
                    podcasts: finalpes.podcasts.items?.map((a: any) => a.data) || null,
                    tracks: finalpes.tracksV2.items?.map((a: any) => a.item.data) || null,
                    users: finalpes.users.items?.map((a: any) => a.data) || null,
                }
            };
        }
    } catch { return null; }
}

export const YTLyrics = async function YTLyrics(url: string, container?: any) {
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
                    clientVersion: "1.20261212",
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
        const res: any = await response.json();

        const bodyload2 = JSON.stringify({
            browseId: res?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[1]?.tabRenderer?.endpoint?.browseEndpoint?.browseId,
            context: {
                client:
                {
                    clientName: "WEB_REMIX",
                    clientVersion: "1.20261212",
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

        const [res2, otherinfo] = await Promise.all([
            pull.json(),
            infoYoutube(url)
        ]);
        const covermusic: any = res?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.musicQueueRenderer?.content?.playlistPanelRenderer.contents?.[0]?.playlistPanelVideoRenderer?.thumbnail?.thumbnails?.[0]?.url?.replace(/=w\d+.*/, "=s0");

        responseBody['data'] = [
            { ...(container || {}) },
            { musicThumbnail: covermusic, ...(otherinfo?.data || {}) },
        ];
        responseBody['lyrics'] = (res2 as any)?.contents?.sectionListRenderer?.contents?.[0]?.musicDescriptionShelfRenderer?.description?.runs?.[0]?.text || null;
        responseBody['footer'] = (res2 as any)?.contents?.sectionListRenderer?.contents?.[0]?.musicDescriptionShelfRenderer?.footer?.runs?.[0]?.text || null;

        return responseBody;
    } catch (e) {
        console.error("YTLyrics Error:", e);
        return null;
    }
}

export const Shazam = async function Shazam(que: string) {
    if (!que) return null;
    try {
        const pull = await request(`https://www.shazam.com/services/amapi/v1/catalog/US/search?types=songs&limit=10&term=${encodeURIComponent(que)}`, {
            headers: {
                ...commonHeaders
            },
            useH2: true
        });
        const res: any = await pull.json();
        return { data: res?.results?.songs?.data || null };
    } catch { return null; }
}

export const Deezer = async function Deezer(que: string, limits: number = 10) {
    if (!que) return null;
    try {
        const pull = await request(`https://api.deezer.com/search?limit=${limits}&q=${encodeURIComponent(que)}`, {
            headers: {
                ...commonHeaders
            }
        });
        const res: any = await pull.json();
        return { data: res?.data || null };
    } catch { return null; }
}

export const TiktokVideo = async function TiktokVideo(url: string) {
    if (!url) return null;

    let videoId: string | null = null;
    let finalUrl = url;

    // Handle short links (mobile)
    if (url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com')) {
        try {
            const redirectParams = {
                method: 'HEAD',
                redirect: 'manual' as const
            };
            const res = await request(url, redirectParams);
            if (res.statusCode === 301 || res.statusCode === 302) {
                const location = res.headers['location'];
                if (typeof location === 'string') {
                    finalUrl = location;
                }
            }
        } catch (e) {
            console.error("TikTok redirect error:", e);
            return null;
        }
    }

    // Extract video ID regex
    const patterns = [
        /video\/(\d+)/,
        /v\/(\d+)/,
        /^(\d+)$/
    ];

    for (const pattern of patterns) {
        const match = finalUrl.match(pattern);
        if (match) {
            videoId = match[1];
            break;
        }
    }

    if (!videoId) return null;

    try {
        const targetUrl = `https://www.tiktok.com/@/video/${videoId}`;
        const [response, savetikData] = await Promise.all([
            request(targetUrl, {
                headers: {
                    ...commonHeaders
                }
            }),
            SavetikVideo(targetUrl)
        ]);

        const html = await response.text;
        const scriptContent = html.split('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">')[1]?.split('</script>')[0];

        if (!scriptContent) return { error: "WAF Challenge" };

        const json = JSON.parse(scriptContent);
        const videoDetail = json?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;

        if (!videoDetail?.video) return { data: null };

        const responseData: any = {
            aweme_id: videoDetail.id?.toString(),
            original_play_url: savetikData?.video_url || null,
        };

        if (videoDetail.video?.videoID) responseData.videoId = videoDetail.video?.videoID;

        const authorUniqueId = videoDetail.author?.uniqueId;
        if (authorUniqueId && authorUniqueId !== 'undefined') {
            responseData.url = "https://www.tiktok.com/@" + authorUniqueId + "/video/" + videoDetail.id;
            responseData.author = {
                url: "https://www.tiktok.com/@" + authorUniqueId,
                aweme_id: videoDetail.author?.id?.toString(),
                secUid: videoDetail.author?.secUid,
                uniqueId: videoDetail.author?.uniqueId,
                nickname: videoDetail.author?.nickname,
                desc: videoDetail.author?.signature,
                createTime: videoDetail.author?.createTime?.toString(),
                verified: videoDetail.author?.verified,
                tiktokSeller: videoDetail.author?.ttSeller,
                avatar: videoDetail.author?.avatarLarger,
                followerCount: videoDetail.authorStatsV2?.followerCount?.toString(),
                followingCount: videoDetail.authorStatsV2?.followingCount?.toString(),
                totalLikesCount: videoDetail.authorStatsV2?.heartCount?.toString(),
                likeCount: videoDetail.authorStatsV2?.diggCount?.toString(),
                videoCount: videoDetail.authorStatsV2?.videoCount?.toString(),
            };
        }

        if (videoDetail?.desc) responseData.desc = videoDetail.desc;
        if (videoDetail?.textLanguage) responseData.descLanguage = videoDetail.textLanguage;
        if (videoDetail.createTime && videoDetail.createTime !== '0') responseData.createTime = videoDetail.createTime;

        if (videoDetail.video?.cover) responseData.cover = videoDetail.video?.cover;
        if (videoDetail.video?.originCover) responseData.originCover = videoDetail.video?.originCover;
        if (videoDetail.video?.dynamicCover) responseData.dynamicCover = videoDetail.video?.dynamicCover;
        if (videoDetail.video?.duration) responseData.duration = videoDetail.video?.duration;

        const playUrl = videoDetail.video?.PlayAddrStruct?.UrlList?.[2]?.replace('?faid=1988', '?faid=1233');
        if (playUrl) responseData.play_url = playUrl;

        if (videoDetail.video?.bitrateInfo) {
            responseData.bit_rate = videoDetail.video?.bitrateInfo?.map((br: any) => ({
                gearName: br.GearName,
                bitrate: br.Bitrate,
                res: `${br.PlayAddr?.Width}x${br.PlayAddr?.Height}`,
                format: br.Format,
                codec: br.CodecType,
                play_url: br.PlayAddr?.UrlList?.[2]?.replace('1988', '1233')
            }));
        }

        if (videoDetail.statsV2?.diggCount) responseData.likeCount = videoDetail.statsV2?.diggCount?.toString();
        if (videoDetail.statsV2?.shareCount) responseData.shareCount = videoDetail.statsV2?.shareCount?.toString();
        if (videoDetail.statsV2?.commentCount) responseData.commentCount = videoDetail.statsV2?.commentCount?.toString();
        if (videoDetail.statsV2?.playCount) responseData.playCount = videoDetail.statsV2?.playCount?.toString();
        if (videoDetail.statsV2?.collectCount) responseData.favoriteCount = videoDetail.statsV2?.collectCount?.toString();

        if (videoDetail.suggestedWords) responseData.suggested_words = videoDetail.suggestedWords;
        const searchSuggest = videoDetail?.videoSuggestWordsList?.video_suggest_words_struct?.[0]?.words?.[0]?.word;
        if (searchSuggest) responseData.search_suggest = searchSuggest;

        if (videoDetail.locationCreated) responseData.location = videoDetail.locationCreated;

        const musicId = videoDetail.music?.id;
        if (musicId && musicId !== 'undefined') {
            responseData.music = {
                url: "https://www.tiktok.com/music/-" + musicId,
                aweme_id: videoDetail.music?.id?.toString(),
                title: videoDetail.music?.title,
                author: videoDetail.music?.authorName,
                cover: videoDetail.music?.coverLarge,
                play_url: videoDetail.music?.playUrl,
                duration: videoDetail.music?.duration,
                original: videoDetail.music?.original,
                private: videoDetail.music?.private
            };
        }

        return {
            data: responseData
        };

    } catch (e) {
        console.error(e);
        return null;
    }
}
async function SavetikVideo(url: string) {
    if (!url) return null;
    try {
        const response = await request('https://savetik.io/api/ajaxSearch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                ...commonHeaders
            },
            body: new URLSearchParams({
                q: url,
                cursor: '0',
                page: '0',
                lang: 'en'
            }).toString()
        });

        const json: any = await response.json();
        if (!json || !json.data) return null;

        const { document } = parseHTML(json.data);
        const hdLink = Array.from(document.querySelectorAll('a')).find((el: any) => el.textContent?.includes('Download MP4 HD'));

        if (!hdLink) return null;

        let finalUrl = (hdLink as any).getAttribute('href');
        if (!finalUrl) return null;

        if (finalUrl.includes('snapcdn.app') && finalUrl.includes('token=')) {
            try {
                const token = new URL(finalUrl).searchParams.get('token');
                if (token) {
                    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                    if (payload.url) {
                        finalUrl = payload.url;
                    }
                }
            } catch { }
        }

        const musicLink = Array.from(document.querySelectorAll('a')).find((el: any) => el.textContent?.includes('Download MP3'));
        let musicUrl: any = (musicLink as any)?.getAttribute('href') || null;

        if (musicUrl && musicUrl.includes('snapcdn.app') && musicUrl.includes('token=')) {
            try {
                const token = new URL(musicUrl).searchParams.get('token');
                if (token) {
                    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                    if (payload.url) {
                        musicUrl = payload.url;
                    }
                }
            } catch { }
        }

        return {
            video_url: finalUrl?.split('?')?.[0],
            music_url: musicUrl
        };
    } catch (e) {
        console.error("Savetik error:", e);
        return null;
    }
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
            "query": "query SearchFull($query: String!, $firstList: Int!) { instantSearch(query: $query) { results { tracks(first: $firstList) { edges { node { id title duration popularity isExplicit lyrics { id } media { id rights { ads { available availableAfter } sub { available availableAfter } } } album { id displayTitle releaseDate isExplicit tracksCount cover { large: urls(pictureRequest: {width: 500, height: 500}) } contributors { edges { roles node { ... on Artist { id name } } } } } contributors { edges { node { ... on Artist { id name } } } } credits: contributors(roles: [AUTHOR, COMPOSER]) { edges { roles node { ... on Artist { id name } } } } } } } } } }"
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

        const res: any = await pull.json();

        if (res?.errors?.[0]?.message.includes('Given jwt')) {
            return await deezerLyrics(que, true);
        }

        const edges = res?.data?.instantSearch?.results?.tracks?.edges;

        if (!edges || edges.length === 0) {
            return { data: null };
        }

        const trackNode = edges[0].node;
        responseBody['data'] = trackNode;

        if (trackNode.lyrics?.id) {

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

            const res2: any = await pull2.json();

            if (res2?.errors?.[0]?.message.includes('Given jwt')) {
                return await deezerLyrics(que, true);
            }

            responseBody['lyrics'] = res2?.data?.track?.lyrics || null;

        }

        return responseBody;
    } catch { return null; }
}


export const tidalLyrics = async function tidalLyrics(que: string, refresh_auth: boolean = false): Promise<any> {
    if (!que) return null;

    try {
        if (refresh_auth || !keybearer) {
            keybearer = await tidalKeysToken();
        }

        const findtrack: any = await Tidal(que, false, 1);
        const trackid = findtrack.data?.[0]?.id;
        if (!trackid) {
            return { data: null }
        }

        const pull = await request(`https://openapi.tidal.com/v2/tracks/${trackid}?countryCode=US&include=lyrics`, {
            headers: {
                ...commonHeaders,
                'Accept': 'application/vnd.api+json',
                'Origin': 'https://tidal.com',
                'Authorization': 'Bearer ' + keybearer
            }
        });

        if (pull.statusCode === 429) {
            return { error: "Rate-limited" }
        }

        if (pull.statusCode === 400 || pull.statusCode === 401) {
            return await tidalLyrics(que, true);
        }

        const res: any = await pull.json();
        return {
            data: [res?.data?.attributes || null, findtrack.data?.[0] || null],
            lyrics: res?.included?.[0]?.attributes?.text || null,
            syncLyrics: res?.included?.[0]?.attributes?.lrcText || null,
            ...res?.included?.[0]?.attributes?.provider
        };
    } catch { return null; }
}

export const SPLyrics = async function SPLyrics(que: string, refresh_auth: boolean = false): Promise<any> {
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
        let trackId = que;
        let trackData: any = null;

        if (que.includes('spotify.com/track/')) {
            trackId = que.split('track/')[1].split('?')[0];
        } else if (que.match(/^[a-zA-Z0-9]{22}$/)) {
            trackId = que;
        } else {
            const searchResult = await SPMusic(que, false, 1);
            const firstTrack = searchResult?.data?.tracks?.[0];
            if (!firstTrack) return { data: null, lyrics: null };
            trackId = firstTrack.id;
        }

        const l = await infoSpotify('https://open.spotify.com/track/' + trackId);
        trackData = l?.data;

        const pull = await request(`https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}?format=json&vnext=true`, {
            headers: {
                ...commonHeaders,
                'Authorization': 'Bearer ' + keysp,
                'App-Platform': 'WebPlayer'
            },
            useH2: true
        });

        if (pull.statusCode === 401 && !refresh_auth) {
            return await SPLyrics(que, true);
        }

        if (pull.statusCode === 400 && !process.env.SPOTIFY_COOKIES) {
            return {
                error: "Sign in to use this feature"
            }
        }
        else if (pull.statusCode === 403 || pull.statusCode === 400) {
            return {
                error: "IP Blocked / Cookies no longer active"
            }
        }

        let res: any = {};

        try {
            res = await pull.json();
        } catch { }

        if (!trackData) {
            return { data: null }
        }

        const plainLyric = res?.lyrics?.lines?.map((a: any) => a.words)?.join('\n')?.replaceAll('♪', '');
        const { lyrics, ...extraInfo } = res || {};
        const { lines, ...extraInfo2 } = res?.lyrics || {};

        return {
            data: trackData,
            lyrics: plainLyric || null,
            syncLyrics: lines || null,
            ...extraInfo2,
            ...extraInfo,
        };
    } catch (e) {
        console.error("SPLyrics Error:", e);
        return null;
    }
}

export const Tidal = async function Tidal(que: string, refresh?: boolean, limits: number = 20): Promise<any> {
    if (!que) return null;
    if (refresh) {
        keytidal = await tidalKeys();
    }

    try {
        const pull = await request(`https://api.tidal.com/v1/search/tracks?countryCode=US&locale=en_US&limit=${limits}&offset=0&query=${encodeURIComponent(que)}`, {
            headers: {
                ...commonHeaders,
                'X-Tidal-Token': keytidal || ''
            }
        });

        if (pull.statusCode === 400 || pull.statusCode === 401) {
            return await Tidal(que, true);
        }

        const res: any = await pull.json();
        return { data: res?.items || null };
    } catch { return null; }
}

export const TidalOpen = async function TidalOpen(que: string, refresh?: boolean, limits: number = 20): Promise<any> {
    if (!que) return null;

    if (!keybearer || refresh) {
        keybearer = await tidalKeysToken();
    }

    try {
        const pull = await request(`https://tidal.com/v2/client-search/?includeContributors=true&includeDidYouMean=true&includeUserPlaylists=true&limit=${limits}&query=${encodeURIComponent(que)}&supportsUserData=true&countryCode=US&locale=en_US&deviceType=BROWSER`, {
            headers: {
                ...commonHeaders,
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + keybearer,
                'x-tidal-token': keytidalopen
            }
        });

        if (pull.statusCode === 429) {
            return { error: "Rate-limited" }
        }

        if (pull.statusCode === 400 || pull.statusCode === 401) {
            return await TidalOpen(que, true);
        }

        const res: any = await pull.json();
        const data: any = {};
        for (const key in res) {
            if (['queryId', 'contentTypeFilters'].includes(key)) continue;
            data[key] = res[key]?.items || res[key];
        }
        return { data };
    } catch { return null; }
}

export const Genius = async function Genius(que: string) {
    if (!que) return null;
    try {

        const [per, per2] = await Promise.all([
            request(`https://genius.com/api/search/song?&per_page=10&q=${encodeURIComponent(que)}`, {
                headers: {
                    ...commonHeaders
                },
                useH2: true
            }),
            request(`https://genius.com/api/search/multi?q=${encodeURIComponent(que)}`, {
                headers: {
                    ...commonHeaders
                },
                useH2: true
            })
        ]);

        const [data, data2] = await Promise.all([
            per.statusCode === 200 ? per.json() : Promise.resolve(null),
            per2.statusCode === 200 ? per2.json() : Promise.resolve(null)
        ]);

        const hits = (data as any)?.response?.hits || (data as any)?.response?.sections?.[0]?.hits || [];
        const sections = (data2 as any)?.response?.sections || [];

        const results = hits.map((hit: any) => ({
            title: hit.result.title,
            fullTitle: hit.result.full_title,
            artist: hit.result.primary_artist.name,
            artistUrl: hit.result.primary_artist.url,
            thumbnail: hit.result.song_art_image_thumbnail_url,
            url: hit.result.url,
            id: hit.result.id
        }));

        return { data: results, sections };
    } catch (e) {
        console.error(e);
        return null;
    }
}

export function Number_random(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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

    const reqPayload = `f.req=%5Bnull%2C%22%5B%5B%5C%22${qQue}%5C%22%2C0%2Cnull%2Cnull%2Cnull%2Cnull%2C0%5D%2C%5B%5C%22en-US%5C%22%5D%2C%5B%5C%22${qCid}%5C%22%2C%5C%22${qRid}%5C%22%2C%5C%22${qRcid}%5C%22%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5C%22%5C%22%5D%5D%22%5D%26`;

    const req = await request(`https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?hl=en-US&rt=c`, {
        method: 'POST',
        headers: {
            ...commonHeaders,
            ...(qCookies ? { 'Cookie': qCookies } : {}),
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(reqPayload).toString(),
            'x-goog-ext-525001261-jspb': '[1,null,null,null,"56fdd199312815e2",null,null,0,[4],null,null,1]',
            'Referer': 'https://gemini.google.com',
            'Origin': 'https://gemini.google.com',
            'X-Same-Domain': '1'
        },
        body: reqPayload,
        useH2: true
    });

    if (req.url.includes('google.com/sorry')) {
        return {
            "error": "Google asking to verify you're not a bot"
        }
    }
    if (req.statusCode === 400) {
        return {
            "error": "Timeout / Bad Request"
        }
    }
    if (req.statusCode === 429) {
        return {
            "error": "Rate-limited"
        }
    }
    if (req.statusCode === 403) {
        return {
            "error": "Blocked / Geo-restricted"
        }
    }

    const cookiess: any = req.headers?.['set-cookie'];
    const resText = await req.text;
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

        const data: any = await response.json();

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
        const res2 = await request(`https://www.youtube.com/watch?v=${videoId}`, {
            method: "GET",
            headers: {
                ...commonHeaders,
                'User-Agent': 'Bot'
            },
            useH2: true
        });

        const pull2 = await res2.text;

        let testpar: any = parseYtInitial(pull2);

        // aka status not ok in innertube
        if (testpar?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.backgroundPromoRenderer) {
            return {
                error: testpar?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.backgroundPromoRenderer?.title?.runs?.[0]?.text || null
            }
        }

        let commentToken: string | null = null;
        let isLiveChat = false;
        const visitorData: any = testpar?.responseContext?.webResponseContextExtensionData?.ytConfigData?.visitorData;
        const findToken = (obj: any) => {
            if (!obj || (commentToken && isLiveChat)) return;
            if (typeof obj === "object") {
                if (obj.liveChatRenderer?.continuations?.[0]?.reloadContinuationData?.continuation) {
                    commentToken = obj.liveChatRenderer.continuations[0].reloadContinuationData.continuation;
                    isLiveChat = true;
                    return;
                }
                if (obj.liveChatRenderer?.continuations?.[0]?.liveChatReplayContinuationData?.continuation) {
                    commentToken = obj.liveChatRenderer.continuations[0].liveChatReplayContinuationData.continuation;
                    isLiveChat = true;
                    return;
                }
                if (!commentToken && obj.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token) {
                    commentToken = obj.continuationItemRenderer.continuationEndpoint.continuationCommand.token;
                }
                for (const k in obj) findToken(obj[k]);
            }
        };
        findToken(testpar);

        let comments: any[] = [];
        if (commentToken) {
            try {
                const endpoint = isLiveChat
                    ? 'https://m.youtube.com/youtubei/v1/live_chat/get_live_chat?prettyPrint=false'
                    : 'https://m.youtube.com/youtubei/v1/next?prettyPrint=false';

                const commentRes = await request(endpoint, {
                    method: "POST",
                    body: JSON.stringify({
                        context: { client: { clientName: 1, clientVersion: "2.20261231", visitorData: visitorData } },
                        continuation: commentToken
                    }),
                    headers: {
                        ...commonHeaders,
                        'Content-Type': 'application/json'
                    }
                });
                const commentData: any = await commentRes.json();

                if (isLiveChat) {
                    const actions = commentData?.continuationContents?.liveChatContinuation?.actions || [];
                    comments = actions.map((a: any) => {
                        const item = a.addChatItemAction?.item?.liveChatTextMessageRenderer;
                        if (!item) return null;
                        return {
                            author: item.authorName?.simpleText,
                            authorThumbnail: item.authorPhoto?.thumbnails?.[0]?.url?.replace(/=s\d+.*/, "=s0"),
                            text: item.message?.runs?.map((r: any) => r.text).join(""),
                            publishedTimeText: item.timestampUsec ? new Date(parseInt(item.timestampUsec) / 1000).toLocaleTimeString() : null,
                            commentId: item.id,
                            authorEndpoint: item.authorExternalChannelId,
                            channelUrl: "https://www.youtube.com/channel/" + item.authorExternalChannelId
                        };
                    }).filter((c: any) => c !== null);
                } else {
                    const endpoints = commentData.onResponseReceivedEndpoints || [];
                    const items = endpoints.flatMap((e: any) => {
                        const action = e.appendContinuationItemsAction || e.reloadContinuationItemsCommand;
                        return action?.continuationItems || [];
                    });

                    const mutations = commentData?.frameworkUpdates?.entityBatchUpdate?.mutations || [];
                    const entityMap: any = {};
                    mutations.forEach((m: any) => {
                        if (m.payload) {
                            entityMap[m.entityKey] = m.payload;
                        }
                    });

                    comments = items.map((i: any) => {
                        const ctr = i?.commentThreadRenderer;
                        if (!ctr) return null;

                        if (ctr.comment?.commentRenderer) {
                            const c = ctr.comment.commentRenderer;
                            return {
                                author: c.authorText?.simpleText || c.authorText?.runs?.[0]?.text,
                                authorThumbnail: c.authorThumbnail?.thumbnails?.[0]?.url?.replace(/=s\d+.*/, "=s0"),
                                text: c.contentText?.runs?.map((r: any) => r.text).join(""),
                                publishedTimeText: c.publishedTimeText?.runs?.[0]?.text,
                                likeCount: c.voteCount?.simpleText || "0",
                                commentId: c.commentId,
                                authorEndpoint: c.authorEndpoint?.browseEndpoint?.browseId,
                                channelUrl: c.authorEndpoint?.browseEndpoint?.browseId ? "https://www.youtube.com/channel/" + c.authorEndpoint.browseEndpoint.browseId : null
                            };
                        }

                        const cvm = ctr.commentViewModel?.commentViewModel;
                        if (cvm) {
                            const key = cvm.commentKey;
                            const entity = entityMap[key]?.commentEntityPayload;
                            if (entity) {
                                return {
                                    author: entity.author?.displayName,
                                    authorThumbnail: entity.author?.avatarThumbnailUrl?.replace(/=s\d+.*/, "=s0"),
                                    text: entity.properties?.content?.content,
                                    publishedTimeText: entity.properties?.publishedTime,
                                    likeCount: entity.toolbar?.likeCountNotliked || "0",
                                    commentId: entity.properties?.commentId,
                                    authorEndpoint: entity.author?.channelId,
                                    channelUrl: entity.author?.channelId ? "https://www.youtube.com/channel/" + entity.author.channelId : null
                                };
                            }
                        }

                        return null;
                    }).filter((c: any) => c !== null);
                }
            } catch (e) {
                console.error("Error fetching comments:", e);
            }
        }

        const first: any = testpar?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.find((a: any) => !!a?.videoPrimaryInfoRenderer)?.videoPrimaryInfoRenderer;
        const second: any = testpar?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.find((a: any) => !!a?.videoSecondaryInfoRenderer)?.videoSecondaryInfoRenderer;

        return {
            "data": {
                videoId: videoId,
                thumbnail: "https://s.ytimg.com/vi/" + videoId + "/maxresdefault.jpg",
                previewThumbnail: "https://s.ytimg.com/vi/" + videoId + "/maxres1.jpg",
                title: first?.title?.runs?.[0]?.text || null,
                description: second?.attributedDescription?.content || null,
                releaseDate: (first?.dateText?.simpleText?.split('streaming on ')?.[1] || first?.dateText?.simpleText?.split('live on ')?.[1] || first?.dateText?.simpleText?.split('started streaming on ')?.[1] || first?.dateText?.simpleText?.split('Started streaming on ')?.[1] || first?.dateText?.simpleText?.split('started streaming ')?.[1] || first?.dateText?.simpleText?.split('Started streaming ')?.[1] || first?.dateText?.simpleText?.split('Streamed live on ')?.[1] || first?.dateText?.simpleText?.split('streamed live on ')?.[1] || first?.dateText?.simpleText?.split('Premiered on ')?.[1] || first?.dateText?.simpleText?.split('Premiered ')?.[1] || first?.dateText?.simpleText?.split('Broadcast live on ')?.[1] || first?.dateText?.simpleText?.split('broadcast live on ')?.[1] || first?.dateText?.simpleText) || null,
                viewCount: String(parseAbbreviatedNumber(first?.viewCount?.videoViewCountRenderer?.viewCount?.simpleText?.split(' ')?.[0]) || 0),
                owners: {
                    name: (second?.owner?.videoOwnerRenderer?.title?.runs?.[0]?.text || second?.owner?.videoOwnerRenderer?.attributedTitle?.content) || null,
                    url: (second?.owner?.videoOwnerRenderer?.title?.runs?.[0]?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url
                        ? ["https://www.youtube.com" + second?.owner?.videoOwnerRenderer?.title?.runs?.[0]?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url]
                        : second?.owner?.videoOwnerRenderer?.navigationEndpoint?.showDialogCommand?.panelLoadingStrategy?.inlineContent?.dialogViewModel?.customContent?.listViewModel?.listItems?.map((d: any) => {
                            const u = d.listItemViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url ||
                                d.listItemViewModel?.leadingAccessory?.avatarViewModel?.endpoint?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url ||
                                d.listItemViewModel?.title?.commandRuns?.[0]?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url;
                            return u ? "https://www.youtube.com" + u : null;
                        }).filter(Boolean)) || [],
                    avatar: Array.from(new Set((second?.owner?.videoOwnerRenderer?.avatarStack?.avatarStackViewModel?.avatars?.map((e: any) => e?.avatarViewModel?.image?.sources?.[0]?.url) ||
                        (second?.owner?.videoOwnerRenderer?.thumbnail?.thumbnails || second?.owner?.videoOwnerRenderer?.avatar?.thumbnails)?.map((k: any) => k?.url))?.map((k: any) => k?.replace(/=s\d+.*/, "=s0")) || []))
                },
                tags: (first?.superTitleLink?.runs?.map((a: any) => {
                    const u = a.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url;
                    if (u) {
                        return {
                            text: a.text || "",
                            url: "https://www.youtube.com" + u
                        }
                    }
                    return null;
                }) || []).filter(Boolean),
                feeds: testpar?.contents?.twoColumnWatchNextResults?.secondaryResults?.secondaryResults?.results?.[0]?.itemSectionRenderer?.contents.filter((c: any) => c.lockupViewModel)?.map((c: any) => {
                    const lvm = c.lockupViewModel;
                    const meta = lvm?.metadata?.lockupMetadataViewModel;
                    const img = meta?.image;

                    const singleUrl = img?.decoratedAvatarViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url;
                    const stackItems = img?.avatarStackViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.showDialogCommand?.panelLoadingStrategy?.inlineContent?.dialogViewModel?.customContent?.listViewModel?.listItems;

                    const ownerUrls: string[] | null = singleUrl
                        ? ["https://www.youtube.com" + singleUrl]
                        : stackItems
                            ?.map((d: any) => {
                                const u = d.listItemViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url;
                                return u ? "https://www.youtube.com" + u : null;
                            }).filter(Boolean) || null;

                    const ownerAvatars: string[] | string | null = img?.decoratedAvatarViewModel
                        ? (img.decoratedAvatarViewModel.avatar?.avatarViewModel?.image?.sources?.[0]?.url?.replace(/=s\d+.*/, "=s0") ?? null)
                            ? [img.decoratedAvatarViewModel.avatar.avatarViewModel.image.sources[0].url.replace(/=s\d+.*/, "=s0")]
                            : null
                        : stackItems
                            ?.map((d: any) => {
                                const u = d.listItemViewModel?.leadingAccessory?.avatarViewModel?.image?.sources?.[0]?.url;
                                return u ? u.replace(/=s\d+.*/, "=s0") : null;
                            }).filter(Boolean) || null;

                    const nUrl = lvm?.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url || "";
                    const rId = nUrl.includes("v=") ? nUrl.split("v=")[1].split("&")[0] : lvm?.contentId;
                    return {
                        videoId: rId,
                        url: "https://www.youtube.com/watch?v=" + rId,
                        altUrl: "https://www.youtube.com" + nUrl,
                        title: meta?.title?.content,
                        thumbnail: "https://s.ytimg.com/vi/" + rId + "/hq720.jpg",
                        owner: {
                            name: meta?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content,
                            url: ownerUrls,
                            avatar: ownerAvatars,
                        }
                    };
                }) || [],
                "comments": comments
            }
        };
    }
    catch (e) {
        console.error(e);
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
        const html = await response.text;
        let data: any = parseYtInitial(html);

        if (!data) return { data: null };

        if (!keyYoutubeVisitor) {
            keyYoutubeVisitor = await youtubeVisitorKey();
        }

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
                const continuationRes: any = await continuationReq.json();

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

                const res: any = await req.json();
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
                headers: {
                    ...commonHeaders
                }
            }),
            request("https://mobi.soundcloud.com" + test.pathname, {
                headers: {
                    ...commonHeaders
                }
            })
        ]);

        if (res.statusCode === 401) {
            return await infoSoundcloud(que, true);
        }
        const pull = res.statusCode === 200 ? await res.json() : null;

        let pull2: any = null;
        try {
            const res2Text = await res2.text;
            pull2 = JSON.parse(res2Text.split('type="application/json">')[1].split('</script>')[0]);
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

        const res = await request(`https://open.spotify.com/oembed?url=${encodeURIComponent(que)}`, {
            method: 'GET',
            headers: {
                ...commonHeaders
            }
        });

        const pull: any = await res.json();

        const res2 = await request(pull.iframe_url, {
            method: 'GET',
            headers: {
                ...commonHeaders,
                'User-Agent': 'Bot'
            }
        });

        const pull2 = await res2.text;
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
        if (!sections?.[0]) {
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
        const req = await request(`https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=/search/pins/?q=${encodeURIComponent(que)}&data=${encodeURIComponent(JSON.stringify(feat))}`, {
            method: 'GET',
            headers: {
                ...commonHeaders,
                'X-Pinterest-PWS-Handler': 'www/search/[scope].js'
            }
        });

        const res: any = await req.json();
        return res.resource_response.data.results[0] ? { data: res.resource_response.data.results } : {
            'error': 'Looks like your search violate our terms of service'
        };
    }
    catch {
        return null;
    }
}

export const infoPinterest = async function infoPinterest(que: string) {
    if (!que) return null;
    try {
        const test = new URL(que);
        if (!test.host.includes('pinterest.') && !test.host.includes('pin.it')) return null;

        const res = await request(que, {
            headers: {
                ...commonHeaders
            }
        });

        const html = await res.text;

        const data: any[] = [];
        const scriptRegex = /<script\s+data-relay-completed-request="true"[^>]*>([\s\S]*?)<\/script>/g;
        let match;

        while ((match = scriptRegex.exec(html)) !== null) {
            const scriptContent = match[1];
            const funcMatch = scriptContent.match(/window\.__PWS_RELAY_REGISTER_COMPLETED_REQUEST__\("([^"]+)",\s*(\{[\s\S]*?\})\);?/);
            if (funcMatch) {
                try {
                    const api_query = JSON.parse(decodeURIComponent(funcMatch[1]));
                    const content = JSON.parse(funcMatch[2]);
                    let relayData = content;
                    if (relayData.data) relayData = relayData.data;

                    const entries = Object.entries(relayData);
                    if (entries.length > 0) {
                        const firstValue: any = entries[0][1];
                        const finalData = (firstValue && typeof firstValue === 'object' && 'data' in firstValue)
                            ? firstValue.data
                            : firstValue;

                        data.push({
                            api_query,
                            data: finalData
                        });
                    }
                } catch (e) {
                }
            }
        }

        return { data: data.length > 0 ? data.reverse() : null };
    } catch {
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

        const allSame = Object.keys(payload).every(key => {
            const currentVal = currentInfo[key] ?? null;
            const payloadVal = payload[key] ?? null;
            return currentVal === payloadVal;
        });

        if (allSame) {
            return { data: [false, null, 204] };
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

        return {
            data: [currentInfo, patchResponse, response.status, ...(reasonAudit ? [reasonAudit] : [])],
            ...(payloadError?.[0] && {
                error: payloadError,
                errorMessage: 'Continuing anyways'
            })
        };
    } catch {
        return { error: 'Something just happened' };
    }
};

export const DiscordMember = async (token: string, guildId: string, payload: any, payloadError: any, reasonAudit?: string, isReset: boolean = false) => {
    if (!token || token === 'null') return { error: 'Missing token' };
    if (!guildId) return { error: 'Missing guildId' };

    let userId = '@me';
    try {
        const decoded = atob(token.split('.')[0]);
        if (Number.isInteger(parseInt(decoded))) {
            userId = decoded;
        }
    } catch { }

    const url = `https://discord.com/api/v10/guilds/${guildId}/members/@me`;

    try {
        const req = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)'
            },
            body: JSON.stringify({})
        });

        let currentInfo: any = null;
        try {
            currentInfo = await req.json();
        } catch { }

        if (req.status !== 200) {
            return {
                data: [null, null],
                error: currentInfo || { status: req.status, statusText: req.statusText }
            };
        }

        if (Object.keys(payload).length === 0) {
            return { data: [currentInfo, null] };
        }

        // Normalize values for comparison (treat null, undefined, and empty string as the same "empty" state)
        const normalize = (v: any) => (v === '' || v === undefined || v === null) ? null : v;

        // Check if payload values already match current info — skip PATCH if nothing changed
        const allSame = Object.keys(payload).every(key => {
            const currentVal = normalize(currentInfo[key] !== undefined ? currentInfo[key] : currentInfo.user?.[key]);
            const payloadVal = normalize(payload[key]);
            return currentVal === payloadVal;
        });

        // Helper to generate changes object: all requested keys are present, true if successful AND actually changed state
        const getChanges = (requested: any, successful: any, current: any) => {
            return Object.keys(requested).reduce((acc: any, key) => {
                const newVal = normalize(successful[key] !== undefined ? successful[key] : successful.user?.[key]);
                const currentVal = normalize(current[key] !== undefined ? current[key] : current.user?.[key]);
                // It's a "change" if the new state is actually different from the previous state
                acc[key] = newVal !== currentVal;
                return acc;
            }, {});
        };

        const changes = (p?: any) => isReset ? getChanges(payload, p || payload, currentInfo) : null;

        if (allSame) {
            return { data: [false, null, 204, changes()] };
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

            // Retry logic: If 50013 (Missing Permissions) and we tried to change nickname, 
            // retry without 'nick' to allow bio/avatar/banner updates to proceed.
            if (response.status === 403 && patchResponse?.code === 50013 && payload.nick !== undefined) {
                const { nick, ...retryPayload } = payload;
                if (Object.keys(retryPayload).length > 0) {
                    const retryResponse = await fetch(url, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bot ${token}`,
                            'Content-Type': 'application/json',
                            'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)',
                            ...(reasonAudit && { 'X-Audit-Log-Reason': reasonAudit })
                        },
                        body: JSON.stringify(retryPayload)
                    });
                    const retryJson = await retryResponse.json();

                    if (retryResponse.status >= 200 && retryResponse.status < 300) {
                        return {
                            data: [currentInfo, retryJson, retryResponse.status, changes(retryJson), ...(reasonAudit ? [reasonAudit] : [])],
                            ...(payloadError?.[0] && {
                                error: payloadError,
                                errorMessage: 'Continuing anyways (Retried without nickname)'
                            })
                        };
                    } else {
                        // If it still fails, update patchResponse to reflect this new error
                        patchResponse = retryJson;
                        // And let the logic below return the error as usual
                    }
                }
            }

        } catch (e) { }

        if (response.status < 200 || response.status >= 300) {
            return {
                data: [currentInfo.code === 0 ? null : currentInfo, null, response.status, null],
                error: patchResponse || { status: response.status }
            };
        }

        return {
            data: [currentInfo, patchResponse, response.status, changes(patchResponse), ...(reasonAudit ? [reasonAudit] : [])],
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

        if (result) {
            if (Array.isArray(result)) {
                result = result.map((w: any) => ({
                    ...w,
                    created_at: w.id ? String(getSnowflakeDate(w.id)) : null
                }));
            } else if (typeof result === 'object' && result.id) {
                result.created_at = String(getSnowflakeDate(result.id));
            }
        }

        if (action === 'info' && result && typeof result === 'object' && !Array.isArray(result)) {
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
        const req = await request(`https://www.istockphoto.com/en/search/2/image?phrase=${encodeURIComponent(que)}&page=1`, {
            headers: {
                ...commonHeaders,
                'Accept': 'application/json'
            }
        });

        const res: any = await req.json();
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
        const pull = await request(`https://unsplash.com/napi/search/photos?page=1&per_page=20&query=${encodeURIComponent(que)}`, {
            headers: {
                ...commonHeaders
            },
            useH2: true
        });

        if (pull.statusCode === 403) {
            return {
                "error": "IP Blocked"
            }
        }

        const res: any = await pull.json();
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
        const per = await request(`https://www.pixiv.net/ajax/search/artworks/${encodeURIComponent(que)}?word=${encodeURIComponent(que)}&order=date_d&mode=safe&p=1&csw=0&s_mode=s_tag&type=all&ai_type=0&lang=en`, {
            headers: {
                ...commonHeaders
            }
        });

        const res: any = await per.json();
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
        const per = await request(`https://discord.com/api/v10/discovery/search?query=${encodeURIComponent(que)}&limit=10`, {
            headers: {
                ...commonHeaders
            }
        });

        if (per.statusCode === 403) {
            return {
                "error": "Cloudflare Turnstile asking to verify you're not a bot"
            }
        }

        const res: any = await per.json();
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
        const per = await request(`https://api.bilibili.tv/intl/gateway/web/v2/search_v2?s_locale=en_US&platform=web&keyword=${encodeURIComponent(que)}&highlight=1&pn=1&ps=10&qid=&sort=0`, {
            headers: {
                ...commonHeaders
            }
        });

        if (per.statusCode === 403) {
            return {
                "error": "Akamai Captcha asking to verify you're not a bot"
            }
        }

        const res: any = await per.json();
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
        const per = await request(`https://discord.com/api/v10/application-directory/search?query=${encodeURIComponent(que)}&page=1&page_size=10&category_id=1&locale=en-US&source=0`, {
            headers: {
                ...commonHeaders
            }
        });

        if (per.statusCode === 403) {
            return {
                "error": "Cloudflare Turnstile asking to verify you're not a bot"
            }
        }

        const res: any = await per.json();
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
        const per = await request(`https://www.jiosaavn.com/api.php?_format=json&n=10&__call=search.getResults&q=${encodeURIComponent(que)}`, {
            headers: {
                ...commonHeaders
            }
        });

        const res: any = await per.json();
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
        const bodyhttp = [{ "operationName": "SearchResultsPage_SearchResults", "variables": { "query": que, "includeIsDJ": true, "platform": "web" }, "extensions": { "persistedQuery": { "version": 1, "sha256Hash": "7f3580f6ac6cd8aa1424cff7c974a07143827d6fa36bba1b54318fe7f0b68dc5" } } }, { "operationName": "SearchTray_SearchSuggestions", "variables": { "queryFragment": que, "withOfflineChannelContent": true }, "extensions": { "persistedQuery": { "version": 1, "sha256Hash": "176dee782d1da7f1913242153c4abc4ef2a2b0b5ccb490d4a7b679e72bf1f45e" } } }];
        const per = await request(`https://gql.twitch.tv/gql`, {
            method: "POST",
            body: JSON.stringify(bodyhttp),
            headers: {
                ...commonHeaders,
                'Client-Id': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
                'Content-Type': 'application/json'
            }
        });

        const res: any = await per.json();
        const { __typename, ...finalres } = { ...res?.[1]?.data, ...res?.[0]?.data?.searchFor };

        return { data: finalres || null };
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

        const res: any = await per.json();

        return { data: res?.data?.xdt_api__v1__users__search_connection?.edges?.map((a: any) => a?.node) || null }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const Pexels = async function Pexels(que: string) {
    if (!que) return null;

    try {
        const response = await request(`https://api.pexels.com/en-us/api/v2/search?per_page=20&query=${encodeURIComponent(que)}`, {
            headers: {
                ...commonHeaders,
                'Secret-Key': process.env.PEXELS || ''
            },
            useH2: true
        });

        if (response.statusCode === 403) {
            return {
                "error": "Cloudflare Turnstile asking to verify you're not a bot"
            };
        }

        if (response.statusCode === 429) {
            return {
                "error": "Rate-limited"
            };
        }

        const html = await response.text;
        let pull = null;
        try {
            pull = JSON.parse(html);
        }
        catch { }
        return { data: pull || null };
    }
    catch (e) {
        console.error(e);
        return null;
    }
};

export const TiktokSearchVideo = async function TiktokSearchVideo(que: string) {
    if (!que) return null;

    try {
        const pul = await request(`https://api-boot.tiktokv.com/aweme/v1/search/item/?count=10&keyword=${encodeURIComponent(que)}&version_code=3.2.0&app_name=musical_ly&channel=App+Store&device_id=7386407102867523334&aid=1233&os_version=16.2&device_platform=iphone&iid=7386407102867523334&device_brand=iphone&device_type=iPhone10,6`, {
            headers: {
                ...commonHeaders,
                'X-Khronos': Math.floor(Date.now() / 1000).toString()
            }
        });

        const res = await pul.text;
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
        const pul = await request(`https://api-boot.tiktokv.com/aweme/v1/music/search/?count=10&cursor=0&aid=1233&device_id=7386407102867523334&region=&referer=&keyword=${encodeURIComponent(que)}`, {
            headers: {
                ...commonHeaders
            }
        });

        const res = await pul.text;
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
        const pul = await request(`https://api-boot.tiktokv.com/aweme/v1/discover/search/?keyword=${encodeURIComponent(que)}&cursor=0&count=10&hot_search=0&search_source=discover&aid=1180&app=musically&region=&referer=&device_id=7386407102867523334&type=1`, {
            headers: {
                ...commonHeaders
            }
        });

        const res = await pul.text;
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

export const TiktokFeed = async function TiktokFeed(cursor: any = 0, region_code: any = '') {
    const url = `https://www.tiktok.com/api/explore/item_list/?aid=1180&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=Linux%20x86_64&browser_version=5.0%20(X11)&categoryType=120&channel=tiktok_web&clientABVersions=&cookie_enabled=true&count=1&data_collection_enabled=false&device_id=7604255764756956689&device_platform=web_pc&enable_cache=false&is_fullscreen=true&is_page_visible=true&language=en&odinId=7604255384195531792&os=linux&priority_region=${region_code}&pullType=2&referer=&region=${region_code}&tz_name=&user_is_login=false&video_encoding=mp4&webcast_language=en`;
    const headers = {
        ...commonHeaders,
        'Accept-Language': 'en-US',
        'Referer': 'https://www.tiktok.com/explore'
    };

    for (let i = 0; i < 3; i++) {
        try {
            const pul = await request(url, { headers, useH2: true, useOwnTLS: true });
            const res = await pul.text;

            if (res === '' || pul.statusCode !== 200) {
                if (i === 2) return { "error": "Akamai Captcha asking to verify you're not a bot" };
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }

            let testres: any;
            try {
                testres = JSON.parse(res);
            } catch {
                if (i === 2) return { "data": null };
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }

            const itemList = testres?.itemList || [];
            if (itemList.length === 0 || !itemList?.[0]?.video?.playAddr) {
                if (i === 2) return { data: null };
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }

            const data = await Promise.all(itemList.map(async (item: any) => {
                const videoInfo = item.video || {};
                const bitrateInfo = videoInfo.bitrateInfo || [];

                const sortedBitrateAsc = [...bitrateInfo].sort((a: any, b: any) => (a.Bitrate || 0) - (b.Bitrate || 0));
                const sortedBitrateDesc = [...bitrateInfo].sort((a: any, b: any) =>
                    ((b.PlayAddr?.Width || 0) * (b.PlayAddr?.Height || 0)) -
                    ((a.PlayAddr?.Width || 0) * (a.PlayAddr?.Height || 0))
                );

                const videoUrl = (videoInfo.PlayAddrStruct?.UrlList || []).find((u: string) => u.includes('aweme/v1/play'))?.replace('faid=1988', 'faid=0') || null;
                const highestVideoUrl = sortedBitrateDesc[0]?.PlayAddr?.UrlList?.find((u: string) => u.includes('aweme/v1/play'))?.replace('faid=1988', 'faid=0') || null;
                const lowestVideoUrl = sortedBitrateAsc[0]?.PlayAddr?.UrlList?.find((u: string) => u.includes('aweme/v1/play'))?.replace('faid=1988', 'faid=0') || null;

                const extractRedirect = async (url: string) => {
                    try {
                        const res = await fetch(url, {
                            method: 'GET',
                            headers: headers,
                            redirect: 'manual'
                        });
                        return res.headers.get('location') || url;
                    } catch {
                        return url;
                    }
                };

                const [finalVideoUrl, finalLowestVideoUrl, finalHighestVideoUrl] = await Promise.all([
                    videoUrl ? extractRedirect(videoUrl) : Promise.resolve(null),
                    lowestVideoUrl ? extractRedirect(lowestVideoUrl) : Promise.resolve(null),
                    highestVideoUrl ? extractRedirect(highestVideoUrl) : Promise.resolve(null)
                ]);

                return {
                    aweme_id: item.id,
                    videoId: item.video?.videoID,
                    url: "https://www.tiktok.com/@" + item.author?.uniqueId + "/video/" + item.id,
                    desc: item.desc,
                    create_time: item.createTime.toString(),
                    duration: item.video?.duration,
                    author: {
                        url: "https://www.tiktok.com/@" + item.author?.uniqueId,
                        id: item.author?.id,
                        secUid: item.author?.secUid,
                        unique_id: item.author?.uniqueId,
                        nickname: item.author?.nickname,
                        desc: item.author?.signature,
                        createTime: item.author?.createTime?.toString(),
                        verified: item.author?.verified,
                        tiktokSeller: item.author?.ttSeller,
                        followerCount: item.authorStatsV2?.followerCount.toString(),
                        followingCount: item.authorStatsV2?.followingCount.toString(),
                        totalLikesCount: item.authorStatsV2?.heartCount.toString(),
                        likeCount: item.authorStatsV2?.diggCount.toString(),
                        videoCount: item.authorStatsV2?.videoCount.toString(),
                        avatar: item.author?.avatarLarger
                    },
                    music: {
                        url: "https://www.tiktok.com/music/-" + item.music?.id,
                        id: item.music?.id,
                        title: item.music?.title,
                        author: item.music?.authorName,
                        cover: item.music?.coverLarge,
                        duration: item.music?.duration,
                        play_url: item.music?.playUrl
                    },
                    statistics: {
                        comment_count: item.stats?.commentCount.toString(),
                        digg_count: item.stats?.diggCount.toString(),
                        play_count: item.stats?.playCount.toString(),
                        share_count: item.stats?.shareCount.toString()
                    },
                    video_url: finalVideoUrl,
                    lowest_video_url: finalLowestVideoUrl || finalVideoUrl,
                    highest_video_url: finalHighestVideoUrl || finalVideoUrl,
                    bit_rate: sortedBitrateDesc.map((br: any) => ({
                        gear: br.GearName,
                        bitrate: br.Bitrate,
                        res: `${br.PlayAddr?.Width}x${br.PlayAddr?.Height}`,
                        format: br.Format,
                        codec: br.CodecType,
                        play_url: br.PlayAddr?.UrlList?.[2]?.replace('faid=1988', 'faid=0')
                    })),
                    cover: item.video?.cover,
                    origin_cover: item.video?.originCover,
                    dynamic_cover: item.video?.dynamicCover
                };
            }));

            return { data: data?.[0] || null };
        } catch (err) {
            if (i === 2) return null;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    return null;
}


export const DiscordTiktokFeed = async function DiscordTiktokFeed(token: string, channelId: string, messageId?: string, region_code: string = '') {
    if (!token) return { error: "Missing token" };
    if (!channelId) return { error: "Missing channelId" };

    try {
        const channelCheck = await request(`https://discord.com/api/v10/channels/${channelId}`, {
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)'
            }
        });

        const channelData: any = await channelCheck.json();

        if (channelCheck.statusCode !== 200) {
            return { error: channelData || "Channel verification failed" };
        }

        if (messageId) {
            const messageCheck = await request(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
                headers: {
                    'Authorization': `Bot ${token}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)'
                }
            });

            const messageData: any = await messageCheck.json();

            if (messageCheck.statusCode !== 200) {
                return { error: messageData || "Message verification failed" };
            }
        }
    } catch (e: any) {
        return { error: e.message || "Failed to verify Discord resources" };
    }

    const feed = await TiktokFeed(0, region_code);
    if (!feed || !feed.data) return { error: "Akamai Captcha asking to verify you're not a bot" };

    const item = feed.data;
    const footerText = "TikTok • " + new Date(Number(item.create_time) * 1000).toLocaleString() + " • ❤️ " + formatAbbreviatedNumber(item.statistics.digg_count) + " 👁️ " + formatAbbreviatedNumber(item.statistics.play_count) + " 💬 " + formatAbbreviatedNumber(item.statistics.comment_count);

    const embed = {
        color: 0x000000,
        author: {
            name: item.author.unique_id,
            url: item.author.url,
            icon_url: item.author.avatar
        },
        description: item.desc,
        url: item.url,
        footer: {
            text: footerText,
            icon_url: "https://sf16-sg.tiktokcdn.com/obj/eden-sg/uvkuhyieh7lpqpbj/pwa/512x512.png"
        }
    };

    const MAX_DISCORD_SIZE = 8388608; // 8MB
    const urlsToTry = [item.highest_video_url, item.video_url].filter((u, i, a) => u && a.indexOf(u) === i);
    let videoBuffer: ArrayBuffer | null = null;

    for (const url of urlsToTry) {
        try {
            const vidReq = await fetch(url as string, {
                method: 'GET',
                headers: {
                    ...commonHeaders,
                    'Referer': 'https://www.tiktok.com/'
                }
            });

            const contentLength = parseInt(vidReq.headers.get('content-length') || '0');

            // Check size from headers before consuming the body
            if (contentLength > MAX_DISCORD_SIZE) {
                continue;
            }

            const buffer = await vidReq.arrayBuffer();
            if (buffer.byteLength <= MAX_DISCORD_SIZE) {
                videoBuffer = buffer as ArrayBuffer;
                break;
            }
        } catch (e) {
            continue;
        }
    }

    let filename = item.desc
        ?.replace(/[^a-z0-9 ]/gi, '_') // Replace non-alphanumeric chars with underscore
        .replace(/_{2,}/g, '_')        // Collapse multiple underscores
        .trim()
        .substring(0, 50)              // Truncate to 50 chars for safety and readability
        || "video-" + item.aweme_id;                     // Fallback

    filename += ".mp4";

    const form = new FormData();
    const payload: any = {
        embeds: [embed],
        content: ""
    };

    if (videoBuffer) {
        payload.attachments = [{
            id: 0,
            filename: filename
        }];
        // @ts-ignore
        form.append('files[0]', new Blob([videoBuffer]), filename);
    }

    form.append('payload_json', JSON.stringify(payload));

    try {
        const url = messageId
            ? `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`
            : `https://discord.com/api/v10/channels/${channelId}/messages`;

        const response = await fetch(url, {
            method: messageId ? 'PATCH' : 'POST',
            headers: {
                'Authorization': `Bot ${token}`,
                'User-Agent': 'DiscordBot (https://discord.com, 1.0)'
            },
            body: form
        });

        const resJson: any = await response.json();
        return { data: resJson };
    } catch (e: any) {
        return { error: e.message };
    }
}

export const DiscordStream = async function DiscordStream(token: string, channelId: string, messageId?: string, url?: string, clone?: boolean, onEmbed?: boolean, name?: string, fallbackEmbed?: boolean) {
    if (!token) return { error: "Missing token" };
    if (!channelId) return { error: "Missing channelId" };
    if (!url) return { error: "Missing url" };

    let messageData: any = null;

    try {
        const channelCheck = await request(`https://discord.com/api/v10/channels/${channelId}`, {
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const channelData: any = await channelCheck.json();

        if (channelCheck.statusCode !== 200) {
            return { error: channelData || "Channel verification failed" };
        }

        if (messageId) {
            const messageCheck = await request(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
                headers: {
                    'Authorization': `Bot ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            messageData = await messageCheck.json();

            if (messageCheck.statusCode !== 200) {
                return { error: messageData || "Message verification failed" };
            }
        }
    } catch (e: any) {
        return { error: e.message || "Failed to verify Discord resources" };
    }

    const MAX_DISCORD_SIZE = 8388608; // 8MB

    let videoBuffer: ArrayBuffer | null = null;
    let filename = "file";
    let contentType = "application/octet-stream";
    let fileTooLarge = false;

    try {
        const vidReq = await fetch(url, {
            method: 'GET',
            headers: {
                ...commonHeaders,
                'Referer': new URL(url).origin
            }
        });

        const contentLength = parseInt(vidReq.headers.get('content-length') || '0');
        contentType = vidReq.headers.get('content-type') || contentType;

        const contentDisposition = vidReq.headers.get('content-disposition');
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (fileNameMatch) {
                filename = fileNameMatch[1];
            }
        } else {
            try {
                const urlObj = new URL(url);
                const pathParts = urlObj.pathname.split('/');
                const lastPart = pathParts[pathParts.length - 1];
                if (lastPart && lastPart.includes('.')) {
                    filename = lastPart;
                }
            } catch { }
        }

        if (contentLength > MAX_DISCORD_SIZE) {
            await vidReq.body?.cancel();
            fileTooLarge = true;
        }

        if (!fileTooLarge) {
            videoBuffer = await vidReq.arrayBuffer();
            if (videoBuffer.byteLength > MAX_DISCORD_SIZE) {
                fileTooLarge = true;
                videoBuffer = null;
            }
        }
    } catch (e: any) {
        return { error: "Failed to download content: " + e.message };
    }

    if (!filename.includes('.') && contentType !== 'application/octet-stream') {
        if (contentType.includes('video/mp4')) filename += '.mp4';
        else if (contentType.includes('audio/mp4')) filename += '.m4a';
        else if (contentType.includes('audio/mpeg')) filename += '.mp3';
        else if (contentType.includes('video/')) filename += '.' + contentType.split('/')[1].split(';')[0];
        else if (contentType.includes('audio/')) filename += '.' + contentType.split('/')[1].split(';')[0];
        else if (contentType.includes('image/')) filename += '.' + contentType.split('/')[1].split(';')[0].replace('jpeg', 'jpg');
    }

    if (name) {
        const ext = filename.includes('.') ? filename.split('.').pop() : '';
        filename = ext ? `${name}.${ext}` : name;
    }

    const form = new FormData();
    const payload: any = {};

    if (clone && messageId && messageData) {
        if (onEmbed && messageData.embeds && messageData.embeds.length > 0) {
            payload.embeds = messageData.embeds;
            payload.embeds[0].image = { url: `attachment://${filename}` };
        }
    } else if (messageId) {
        payload.content = "";
        payload.embeds = [];
        payload.components = [];
        payload.attachments = [];
    } else {
        payload.content = "";
    }

    if (fileTooLarge) {
        if (fallbackEmbed && clone && messageData && messageData.embeds && messageData.embeds.length > 0) {
            payload.embeds = messageData.embeds;
            if (!payload.embeds[0].image) payload.embeds[0].image = {};
            payload.embeds[0].image.url = url;
            if (payload.content === undefined && messageData.content) payload.content = messageData.content;
            if (payload.components === undefined && messageData.components) payload.components = messageData.components;
        } else {
            let currentContent = payload.content;
            if (currentContent === undefined && clone && messageData) {
                currentContent = messageData.content;
            }
            currentContent = currentContent || "";

            const separator = (currentContent.length > 0) ? "\n" : "";
            payload.content = currentContent + separator + url;
        }
    }

    if (videoBuffer) {
        payload.attachments = [{
            id: 0,
            filename: filename
        }];
        // @ts-ignore
        form.append('files[0]', new Blob([videoBuffer]), filename);
    }

    form.append('payload_json', JSON.stringify(payload));

    try {
        const discordUrl = messageId
            ? `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`
            : `https://discord.com/api/v10/channels/${channelId}/messages`;

        const response = await fetch(discordUrl, {
            method: messageId ? 'PATCH' : 'POST',
            headers: {
                'Authorization': `Bot ${token}`,
                'User-Agent': 'DiscordBot (https://discord.com, 1.0)'
            },
            body: form
        });

        const resJson: any = await response.json();
        return { data: resJson };
    } catch (e: any) {
        return { error: "Failed to upload to Discord: " + e.message };
    }
}

export const infoTwitterUser = async function infoTwitterUser(que: string, refresh_auth?: boolean): Promise<any> {
    if (!que) return null;
    if (refresh_auth || !twitterAuth || !twitterObj?.UserByScreenName || !twitterObj?.UserTweets) {
        await twitterKey("UserByScreenName");
        await twitterKey("UserTweets");
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
            },
            useH2: true
        });

        if (pul.statusCode === 403) {
            return {
                "error": "Bad auth"
            }
        }

        if (pul.statusCode === 401 || pul.statusCode === 400) return await infoTwitterUser(que, true);

        const responseText = await pul.text;
        let res;
        try {
            res = JSON.parse(responseText);
        } catch {
            return null;
        }
        let pul2;
        let pul3;
        let res2: any = {};
        let res3: any = {};
        if (res?.data?.user?.result?.rest_id) {
            const queryId2 = twitterObj?.UserTweets?.[0];
            const features2 = JSON.stringify(twitterObj?.UserTweets?.[1]);
            const variables2 = JSON.stringify({ "userId": res?.data?.user?.result?.rest_id, "includePromotedContent": true, "withQuickPromoteEligibilityTweetFields": true, "withVoice": true });
            const fieldToggles2 = JSON.stringify({ "withArticlePlainText": true });
            const [pul2, pul3] = await Promise.all([
                fetch(`https://syndication.twitter.com/srv/timeline-profile/user-id/${res?.data?.user?.result?.rest_id}`, {
                    headers: {
                        ...commonHeaders
                    }
                }),
                fetch(`https://api.x.com/graphql/${queryId2}/UserTweets?variables=${encodeURIComponent(variables2)}&features=${encodeURIComponent(features2)}&fieldToggles=${encodeURIComponent(fieldToggles2)}`, {
                    headers: {
                        ...commonHeaders,
                        'content-type': 'application/json',
                        'authorization': 'Bearer ' + twitterAuth,
                        'x-client-transaction-id': twitterObj?.UserTweets?.[2],
                    }
                })
            ]);
            try {
                const body2 = await pul2.text();
                if (body2 && body2.includes('type="application/json">')) {
                    res2 = JSON.parse(body2.split('type="application/json">')[1].split('</script>')[0]);
                }
            }
            catch (e) { console.error("Twitter Syndication Parse Error:", e) }

            try {
                if (pul3.status === 200) {
                    const res3_raw: any = await pul3.json();
                    res3 = res3_raw?.data?.user?.result?.timeline?.timeline?.instructions?.flatMap((f: any) => f?.entries || (f?.entry ? [f.entry] : []));
                } else {
                    res3 = {
                        error: await pul3.text()
                    }
                }
            }
            catch (e) { console.error("Twitter API JSON Parse Error:", e) }
        }

        const finalres = {
            ...(res?.data?.user?.result || null),
            timeline: {
                page: res3?.[0] ? res3 : { error: "Not available / Geo-restrict" },
                embed: res2?.props?.pageProps?.timeline?.entries?.[0] ? res2?.props?.pageProps?.timeline?.entries?.map((k: any) => k.content.tweet) : (res2?.props?.pageProps?.contextProvider?.hasResults ? { error: "Not available / Geo-restrict" } : null)
            }
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
            request(`https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(que)}&lang=en&token=abc`, {
                headers: {
                    ...commonHeaders,
                }
            })
        ]);

        if (pul.statusCode === 401 || pul.statusCode === 400) return await infoTwitterTweet(que, true);

        const tryParseJson = async (p: any) => {
            if (p.statusCode !== 200) return null;
            try { return await p.json(); } catch { return null; }
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
        const req = await request(`https://old.reddit.com/search/.json?q=${encodeURIComponent(que)}&sort=relevance&type=media`, {
            headers: {
                ...commonHeaders,
                'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'
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

        const res: any = await req.json();
        return { data: res?.data?.children?.map((a: any) => a?.data) || null }
    }
    catch {
        return null;
    }
}

export const robloxGames = async function robloxGames(que: string) {
    if (!que) return null;

    try {
        const pul1 = await request(`https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(que)}&sessionId=abc`, {
            headers: {
                ...commonHeaders
            }
        });

        const res1: any = await pul1.json();
        const gamesList = res1.searchResults?.flatMap((group: any) => group.contents) || [];
        const restIds = gamesList.filter((b: any) => b?.universeId).map((b: any) => b.universeId).join(',');

        if (!restIds) return { data: gamesList };

        const pul2 = await request(`https://games.roblox.com/v1/games?universeIds=${restIds}`, {
            headers: {
                ...commonHeaders
            }
        });

        const res2: any = await pul2.json();
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
                    clientName: "MWEB",
                    clientVersion: "2.20251212",
                    hl: "en",
                    gl: "US"
                }
            }
        });

        const response = await request('https://m.youtube.com/youtubei/v1/search?prettyPrint=false&fields=contents.sectionListRenderer.contents.itemSectionRenderer.contents.compactChannelRenderer', {
            headers: {
                ...commonHeaders,
                'content-type': 'application/json'
            },
            body: bodyload,
            method: "POST",
            useH2: true
        });

        const res: any = await response.json();
        const contents = res?.contents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

        let alk: any[] = [];
        contents.forEach((item: any) => {
            const a = item.compactChannelRenderer;
            if (!a) return;

            try {
                const subRuns = a.subscriberCountText?.runs?.map((r: any) => r.text) || [];
                const videoRuns = a.videoCountText?.runs?.map((r: any) => r.text) || [];
                const allMetadata = [...subRuns, ...videoRuns, a.subscriberCountText?.simpleText, a.videoCountText?.simpleText].filter(Boolean);

                const handle = allMetadata.find(t => t.startsWith('@'));
                const subs = allMetadata.find(t => t.toLowerCase().includes('subscriber'));
                const videos = allMetadata.find(t => t.toLowerCase().includes('video') || (t.match(/^\d+/) && !t.includes('subscriber') && !t.startsWith('@')));

                const ava = a.thumbnail?.thumbnails?.[0]?.url?.replace(/=s\d+.*/, "=s0");
                const fom = {
                    channelId: a.channelId,
                    url: "https://www.youtube.com/channel/" + a.channelId,
                    handle: handle || null,
                    avatar: (ava?.startsWith('//') ? "https:" + ava : ava) || null,
                    banner: a.tvBanner?.thumbnails?.[0]?.url?.replace(/=w\d+.*/, "=s0") || null,
                    name: a.title?.simpleText || a.title?.runs?.[0]?.text,
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

        const res1: any = await pul1.json();
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
            pul2.json() as Promise<any>,
            pul3.json() as Promise<any>
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

        const res: any = await pul.json();
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

        const res: any = await pul.json();
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
        const req = await request(`https://old.reddit.com/r/${que.toLowerCase()}/new.json`, {
            headers: {
                ...commonHeaders,
                'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'
            }
        });

        if (req.statusCode === 451) {
            return {
                "error": "This subreddit is not available in your country"
            }
        }

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

        const res: any = await req.json();
        const finalres: any = res?.data?.children?.map((a: any) => a?.data);
        return { data: finalres?.[0] ? finalres : null }
    }
    catch {
        return null;
    }
}

export const instagramUser = async function instagramUser(que: string) {
    if (!que) return null;

    try {
        const testreq = await request(`https://www.instagram.com/${encodeURIComponent(que)}/embed`, {
            headers: {
                ...commonHeaders,
                'Sec-Fetch-Dest': 'iframe'
            }
        });

        if (!testreq.url.includes(`https://www.instagram.com/${encodeURIComponent(que)}`)) {
            return {
                error: "Please sign in"
            }
        }

        const resreq = await testreq.text;
        const profile_id = resreq.split('owner-id="')[1]?.split('"')?.[0];

        if (!profile_id) {
            return {
                data: null
            }
        }

        const bodyhttp = { "enable_integrity_filters": true, "id": profile_id, "render_surface": "PROFILE", "__relay_internal__pv__PolarisCannesGuardianExperienceEnabledrelayprovider": true, "__relay_internal__pv__PolarisCASB976ProfileEnabledrelayprovider": false, "__relay_internal__pv__PolarisRepostsConsumptionEnabledrelayprovider": false };

        const req = await request(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(que)}`, {
            headers: {
                ...commonHeaders,
                'X-IG-App-ID': "936619743392459",
                'X-ASBD-ID': "198387",
                'X-IG-WWW-Claim': "0",
                'Origin': 'https://www.instagram.com'
            },
            useH2: true
        });

        let a: any = null;
        let b: any = null;
        try {
            const text = await req.text;
            if (text && text.trim() !== "") {
                const res = await req.json();
                a = res?.data?.user;
            }
        } catch { }

        if (!a) {
            const req2 = await request(`https://www.instagram.com/graphql/query/?doc_id=25980296051578533&variables=${JSON.stringify(bodyhttp)}`, {
                headers: {
                    ...commonHeaders,
                    'Origin': 'https://www.instagram.com',
                    'X-Ig-App-Id': "936619743392459",
                    'X-Asbd-Id': "198387",
                    'X-Ig-Www-Claim': "0"
                }
            });
            try {
                const res2 = await req2.json();
                b = res2?.data?.user || res2?.data || res2;
                a = b?.user ? b.user : b;
            } catch { }
        }

        const source = a;
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

        return { data: [formatted || null, a || (b || null)] };
    } catch (e) {
        console.error(e);
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
            request(`https://www.threads.com/@${encodeURIComponent(que)}`, {
                headers: { ...commonHeaders }
            })
        ]);

        const [res, resText2]: [any, string] = await Promise.all([
            per.statusCode === 200 ? (async () => { try { return await per.json(); } catch { return null; } })() : Promise.resolve(null),
            per2.statusCode === 200 ? Promise.resolve(per2.text) : Promise.resolve("")
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
                const res3 = await per3.json() as any;
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
        const [apiRes, apiRes2, apiRes3] = await Promise.all([
            request(`https://tenor.googleapis.com/v2/search?prettyPrint=false&q=${encodeURIComponent(que.toLowerCase())}&fields=results&limit=50&client_key=tenor_web&locale=en${getSearchFilter(type)}`, {
                headers: {
                    ...commonHeaders,
                    'Referer': 'https://tenor.com',
                    'Origin': 'https://tenor.com',
                    'X-Goog-Api-Key': process.env.GOOG_TENOR || ''
                }
            }),
            request(`https://tenor.googleapis.com/v2/autocomplete?prettyPrint=false&q=${encodeURIComponent(que.toLowerCase())}&type=trending&profile_limit=0&limit=50&client_key=tenor_web&locale=en${getSearchFilter(type)}`, {
                headers: {
                    ...commonHeaders,
                    'Referer': 'https://tenor.com',
                    'Origin': 'https://tenor.com',
                    'X-Goog-Api-Key': process.env.GOOG_TENOR || ''
                }
            }),
            request(`https://tenor.googleapis.com/v2/search_suggestions?prettyPrint=false&client_key=tenor_web&locale=en&q=${encodeURIComponent(que.toLowerCase())}&limit=50`, {
                headers: {
                    ...commonHeaders,
                    'Referer': 'https://tenor.com',
                    'Origin': 'https://tenor.com',
                    'X-Goog-Api-Key': process.env.GOOG_TENOR || ''
                }
            })
        ]);

        if (apiRes.statusCode === 200) {
            const apiData: any = await apiRes.json();
            const apiData2: any = await apiRes2.json();
            const apiData3: any = await apiRes3.json();
            return {
                data: {
                    suggestion: apiData3?.results || [],
                    autocomplete: apiData2?.results || [],
                    data: apiData?.results || []
                }
            };
        }
    } catch { }

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

        const html = await webRes.text;

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
                autocomplete: null,
                data: searchKeys.length > 0 ? storeData.universal.search[searchKeys[0]]?.results : []
            }
        };
    } catch (e) {
        console.error(e);
        return null;
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

        const html = await res.text;
        const gifMatch = html.match(/<script id="gif-json"[^>]*>([\s\S]*?)<\/script>/);

        if (!gifMatch) {
            return { error: 'Failed to parse GIF data' };
        }

        const gifData = JSON.parse(gifMatch[1]);
        return { data: gifData };
    } catch (e) {
        console.error(e);
        return null;
    }
}

export const infoGiphy = async function infoGiphy(url: string) {
    if (!url) return null;

    try {
        const urlObj = new URL(url);
        if (!urlObj.hostname.endsWith('giphy.com')) {
            return { error: 'Invalid Giphy URL' };
        }

        const res = await request(url, {
            headers: {
                ...commonHeaders
            },
            useH2: true
        });

        if (res.statusCode !== 200) {
            return { error: `${res.statusCode} - Can't process this` };
        }

        const html = await res.text;

        // Extract keywords from meta tag
        const keywordsMatch = html.match(/<meta\s+name="keywords"\s+content="([^"]*)"/i);
        const keywords = keywordsMatch?.[1]?.split(',').map((k: string) => k.trim()).filter(Boolean) || null;

        const chunks = html.split('self.__next_f.push(');
        chunks.shift();

        let gifData: unknown = null;
        let userData: unknown = null;
        let relatedData: unknown = null;

        for (const chunk of chunks) {
            if (!chunk.includes('gif')) continue;

            try {
                let end = chunk.indexOf(')</script>');
                if (end === -1) end = chunk.indexOf(')\n');
                if (end === -1) end = chunk.lastIndexOf(')');

                const parsed = JSON.parse(chunk.substring(0, end));

                let innerData: unknown = parsed[1];
                if (typeof innerData === 'string') {
                    const colonIdx = innerData.indexOf(':');
                    if (colonIdx !== -1) {
                        try {
                            innerData = JSON.parse(innerData.substring(colonIdx + 1));
                        } catch { }
                    }
                }

                if (!gifData) gifData = deepFind(innerData, 'gif');
                if (!relatedData) relatedData = deepFind(innerData, 'initialGifs');
                if (!userData) {
                    const found = deepFind(innerData, 'user');
                    if (found && typeof found === 'object') userData = found;
                }

                if (gifData) break;
            } catch {
                continue;
            }
        }

        return {
            data: {
                suggestion: keywords,
                data: gifData,
                user: userData,
                related: relatedData,
            }
        };
    } catch (e) {
        console.error(e);
        return null;
    }
}

export const Giphy = async function Giphy(que: string, type?: string) {
    if (!que) return null;

    const getTypeQuery = (t?: string) => {
        if (t === 'sticker') return '-stickers';
        if (t === 'clip') return '-clips';
        return '';
    };

    try {
        const res = await request(`https://www.giphy.com/search/${encodeURIComponent(que)}${getTypeQuery(type)}`, {
            headers: { ...commonHeaders },
            useH2: true
        });

        if (res.statusCode !== 200) {
            return { error: `${res.statusCode} - Can't process this` };
        }

        const html = await res.text;
        const chunks = html.split('self.__next_f.push(');
        chunks.shift();

        for (const chunk of chunks) {
            if (!chunk.includes('initialGifs')) continue;

            try {
                let end = chunk.indexOf(')</script>');
                if (end === -1) end = chunk.indexOf(')\n');
                if (end === -1) end = chunk.lastIndexOf(')');

                const parsed = JSON.parse(chunk.substring(0, end));

                let innerData: unknown = parsed[1];
                if (typeof innerData === 'string') {
                    const colonIdx = innerData.indexOf(':');
                    if (colonIdx !== -1) {
                        try {
                            innerData = JSON.parse(innerData.substring(colonIdx + 1));
                        } catch { }
                    }
                }

                const gifs = deepFind(innerData, 'initialGifs');
                if (gifs) return { data: gifs };
            } catch {
                continue;
            }
        }

        return { data: null };
    } catch (e) {
        console.error(e);
        return null;
    }
};

export const GiphyAPI = async function GiphyAPI(que: string, type?: string, refresh_auth: boolean = false) {
    if (!que) return null;

    const getTypeQuery = (t?: string) => {
        if (t === 'sticker') return 'stickers';
        if (t === 'clip') return 'clips';
        if (t === 'gif' || !t) return 'gifs';
        return '';
    };

    try {
        if (refresh_auth || !keygiphy) {
            keygiphy = await giphyKey();
        }

        const [res, res2, res3] = await Promise.all([
            request(`https://api.giphy.com/v1/${getTypeQuery(type)}/search?api_key=${keygiphy}&q=${encodeURIComponent(que)}&limit=25`, {
                headers: { ...commonHeaders },
                useH2: true
            }),
            request(`https://api.giphy.com/v1/gifs/search/tags?api_key=${keygiphy}&q=${encodeURIComponent(que)}&limit=25`, {
                headers: { ...commonHeaders },
                useH2: true
            }),
            request(`https://api.giphy.com/v1/channels/search?api_key=${keygiphy}&q=${encodeURIComponent(que)}&limit=25`, {
                headers: { ...commonHeaders },
                useH2: true
            })
        ]);

        if (res.statusCode === 401) {
            return await GiphyAPI(que, type, true);
        }

        let jl: any = {};
        let jl2: any = {};
        let jl3: any = {};
        let jl4: any = {};
        try { jl = await res.json(); } catch { }
        try { jl2 = await res2.json(); } catch { }
        try {
            if (jl.data?.[0]?.id) {
                const fetchRelated = await request(`https://api.giphy.com/v1/${getTypeQuery(type)}/related?gif_id=${jl.data[0].id}&limit=25&api_key=${keygiphy}`, {
                    headers: { ...commonHeaders },
                    useH2: true
                });
                jl3 = await fetchRelated.json();
            }
        }
        catch { }
        try { jl4 = await res3.json(); } catch { }

        return {
            suggestion: jl2?.data?.map((b: any) => b.name) || null,
            data: jl?.data || null,
            related: jl3?.data || null,
            channel: jl4?.data || null,
            ...jl?.pagination
        };
    } catch (e) {
        console.error(e);
        return null;
    }
};

export const setKeys = (sc: string, sp: string, tidal: string, deezer: string) => { keysc = sc; keysp = sp; keytidal = tidal; keydeezer = deezer; };

export async function MetaAI(query: string, convo: any = null): Promise<any> {
    if (!query) return null;

    let messages: any[] = [];

    if (convo) {
        try {
            const parsed = JSON.parse(
                Buffer.from(convo.split('').reverse().join(''), 'base64url').toString('utf-8')
            );
            if (Array.isArray(parsed)) messages = parsed;
        } catch (e) {
            console.error("[MetaAI] Convo parse error:", e);
        }
    }

    messages.push({ role: "user", content: query });

    try {
        const body = JSON.stringify({
            "model": "meta-llama/llama-3.3-70b-instruct:free",
            "messages": messages
        });


        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            body: body,
            headers: {
                "Authorization": `Bearer ${process.env.OPEN}`,
                "Content-Type": "application/json"
            }
        });

        if (res.status === 429) {
            return {
                error: "Rate-limited"
            }
        }

        if (!res.ok) {
            return {
                error: "Service unavailable"
            }
        }

        const data: any = await res.json();
        const response = data.choices?.[0]?.message?.content;

        if (response) {
            messages.push({ role: "assistant", content: response });
        }

        if (messages.length > 20) {
            messages = messages.slice(-20);
        }

        return {
            response: response || null,
            data: {
                conversation: Buffer.from(JSON.stringify(messages)).toString('base64url').split('').reverse().join(''),
                model: "llama-3.3-70b-instruct"
            }
        }
    } catch (e: any) {
        return { error: e.message || null };
    }
}

export async function googleWeather(query: string): Promise<any> {
    if (!query) return null;

    try {
        const l = await request(`https://www.bing.com/api/v6/Places/AutoSuggest?q=${encodeURIComponent(query)}&appid=D41D8CD98F00B204E9800998ECF8427E1FBE79C2&count=1&structuredaddress=true`, {
            headers: { ...commonHeaders },
            useH2: true
        });

        let ls: any = await l.text;

        try {
            ls = JSON.parse(ls);
        }
        catch {
            return { data: null }
        }

        const datageo: any = ls?.value?.[0];

        if (!datageo) return { data: null }
        const coords = datageo.geo.latitude + "," + datageo.geo.longitude;

        const k = await request(`https://weather.googleapis.com/v1/currentConditions:lookup?location.latitude=${datageo.geo.latitude}&location.longitude=${datageo.geo.longitude}&prettyPrint=false`, {
            headers: {
                ...commonHeaders,
                'Referer': 'https://storage.googleapis.com/',
                'X-Goog-Api-Key': process.env.GOOG_WEATHER || ''
            },
            useH2: true
        });

        if (k.statusCode !== 200) return { data: null }

        const finalk = await k.json();
        return {
            data: [
                {
                    ...datageo.address,
                    ...datageo.geo,
                    mapsView: {
                        preview: `https://maps.googleapis.com/maps/api/staticmap?alt=media&center=${coords}&zoom=15&size=800x300&markers=${encodeURI("color:red|" + coords)}&key=${process.env.GOOG_MAPS}`,
                        highest: `https://maps.googleapis.com/maps/api/staticmap?alt=media&center=${coords}&zoom=15&size=2048x768&markers=${encodeURI("color:red|" + coords)}&key=${process.env.GOOG_MAPS}`
                    }
                },
                finalk
            ]
        }
    }
    catch {
        return null;
    }
}

export async function GrokAI(query: string): Promise<any> {
    if (!query) return null;
    const bodyhttp = { "id": "x-preview", "messages": [{ "id": crypto.randomBytes(12).toString('base64url'), "createdAt": new Date().toISOString(), "role": "user", "content": query, "parts": [{ "type": "text", "text": query }] }], "fp": "x-preview", "filter": { "version": "English" } };

    try {
        const req = await request("https://leaves.mintlify.com/api/assistant/x-preview/message", {
            method: "POST",
            body: JSON.stringify(bodyhttp),
            headers: { ...commonHeaders, 'Content-Type': 'application/json' }
        });

        if (req.statusCode === 429) {
            return {
                error: "Rate-limited"
            }
        }
        else if (req.statusCode === 403) {
            return {
                error: "Blocked"
            }
        }
        else if (req.statusCode !== 200) {
            return {
                data: null
            }
        }

        const res = await req.text;
        const response = res.split('\n')
            .filter((line: string) => line.startsWith('0:'))
            .map((line: string) => {
                try {
                    return JSON.parse(line.substring(line.indexOf(':') + 1));
                } catch {
                    return '';
                }
            })
            .join('');

        return {
            response: response || null,
            data: {
                model: "grok-4.1-fast-preview"
            }
        }
    }
    catch {
        return null;
    }
}

export async function OpenRouterGPT(query: string, convo: any = null): Promise<any> {
    if (!query) return null;

    let messages: any[] = [];

    if (convo) {
        try {
            const parsed = JSON.parse(
                Buffer.from(convo.split('').reverse().join(''), 'base64url').toString('utf-8')
            );
            if (Array.isArray(parsed)) messages = parsed;
        } catch {
            messages = [];
        }
    }

    messages.push({ role: "user", content: query });

    try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            body: JSON.stringify({
                "model": "openai/gpt-oss-120b:free",
                "messages": messages,
                "reasoning": { "enabled": true }
            }),
            headers: {
                "Authorization": `Bearer ${process.env.OPEN}`,
                "Content-Type": "application/json"
            }
        });

        if (res.status === 429) {
            return {
                error: "Rate-limited"
            }
        }

        if (!res.ok) {
            return {
                error: "Service unavailable"
            }
        }

        const data: any = await res.json();
        const response = data.choices?.[0]?.message?.content;
        const reasoning = data.choices?.[0]?.message?.reasoning;

        if (response) {
            messages.push({ role: "assistant", content: response });
        }

        if (messages.length > 20) {
            messages = messages.slice(-20);
        }

        return {
            reasoning: reasoning || null,
            response: response || null,
            data: {
                conversation: Buffer.from(JSON.stringify(messages)).toString('base64url').split('').reverse().join(''),
                model: "gpt-oss-120b"
            }
        }
    }
    catch {
        return null;
    }
}

export async function DriftProfile(query: string): Promise<any> {
    if (!query) return null;
    const username = query.split(/[?#]/)[0].split('/').filter(Boolean).pop();
    if (!username || ['robots.txt', 'favicon.ico', 'message', 'cdn-cgi', 'customize', 'login', 'join', 'auth', 'media', 'go'].includes(username.toLowerCase())) return null;
    const filterurl = new URL("https://drift.rip/" + username);
    let res: any;

    for (let attempts = 0; attempts < 3; attempts++) {
        try {
            res = await request(filterurl.toString(), {
                useH2: true,
                echConfigDomain: "cloudflare-ech.com",
                tlsOnly: true,
                headers: {
                    ...commonHeaders
                },
            });

            if (res.statusCode !== 403) {
                break; // Success or non-403 error, proceed
            }

            // It's a 403, we need to try again with a new session

            if (attempts === 2) { // Last attempt still gave 403
                return {
                    "error": "Cloudflare Turnstile asking to verify you're not a bot"
                };
            }
        } catch (e) {
            if (attempts === 2) throw e;
        }
    }

    try {
        const test = res.text;
        if (res.url?.includes('/message')) {
            return {
                data: null
            }
        }
        const { document } = parseHTML(test);
        let schemaJson: any = document.querySelector('script[type="application/ld+json"]')?.textContent;

        try {
            schemaJson = JSON.parse(schemaJson || '{}');
        }
        catch {
            schemaJson = null;
        }

        const styles = Array.from(document.querySelectorAll('style')).map((s: any) => s.textContent).join('');
        const myProfileId = test?.split('let currentProfileId =')?.[1]?.split(';')?.[0]?.trim() || null;

        return {
            data: {
                user: {
                    account_id: test?.split('let userSql = ')?.[1]?.split(';')?.[0]?.trim() || null,
                    profile_id: myProfileId,
                    name: schemaJson?.name?.split('|')?.[1]?.trim() || schemaJson?.mainEntity?.name || "",
                    display_name: {
                        text: document.querySelector('#bio-username')?.textContent?.trim() || "",
                        color: (styles.match(/#bio-username\s*\{[^}]*color:\s*([^;]+)/i)?.[1] || null)
                    },
                    description: {
                        text: document.querySelector('#bio-description')?.textContent?.trim() || null,
                        color: (styles.match(/#bio-description\s*\{[^}]*color:\s*([^;]+)/i)?.[1] || null)
                    },
                    label: {
                        text: document.querySelector('#bio-label')?.textContent?.trim() || null,
                        color: (styles.match(/#bio-label\s*\{[^}]*color:\s*([^;]+)/i)?.[1] || null)
                    },
                    about_me: {
                        text: document.querySelector('#bio-aboutMe')?.textContent?.trim() || null,
                        color: (styles.match(/.bio-aboutMe\s*\{[^}]*color:\s*([^;]+)/i)?.[1] || null)
                    },
                    startPage: {
                        text: document.querySelector('#bio-startText')?.textContent?.trim() || "",
                        color: (styles.match(/#bio-startText\s*\{[^}]*color:\s*([^;]+)/i)?.[1] || null)
                    },
                    views: document.querySelector('#profile-views-inner-container span.text-sm')?.textContent?.trim()?.replace(',', '') || null,
                    badges: [
                        ...Array.from(document.querySelectorAll('.bio-badge')).map((el: any) => {
                            const parent = el.parentElement;
                            const tippyContent = parent?.getAttribute('data-tippy-content');
                            return tippyContent ? { name: tippyContent, icon: el.getAttribute('icon') } : null;
                        }).filter(Boolean)
                    ],
                    assets: {
                        avatar: schemaJson?.mainEntity?.image ? (schemaJson?.mainEntity?.image?.startsWith('http') ? schemaJson.mainEntity.image : "https://drift.rip/" + schemaJson?.mainEntity?.image) : null,
                        banner: (styles.match(/.bio-banner-background\s*\{[^}]*background-image:\s*url\(['"]?([^'"]+)['"]?\)/i)?.[1] || null),
                        background: (() => {
                            const videoEl = document.querySelector('#video-background');
                            const bg = test?.split('staticBackground.src = "')?.[1]?.split('"')[0] ||
                                videoEl?.getAttribute('src') ||
                                videoEl?.querySelector('source')?.getAttribute('src') ||
                                null;

                            if (!bg) return null;
                            return bg.startsWith('http') ? bg : "https://drift.rip" + (bg.startsWith('/') ? '' : '/') + bg;
                        })(),
                        audio: (() => {
                            const aud = document.querySelector('#background-audio')?.getAttribute('src') ||
                                document.querySelector('#background-audio source')?.getAttribute('src') ||
                                (test?.includes('hasAudio = true') ? test?.split('audio.src = "')?.[1]?.split('"')[0] : null) ||
                                null;
                            if (!aud) return null;
                            return aud.startsWith('http') ? aud : "https://drift.rip" + (aud.startsWith('/') ? '' : '/') + aud;
                        })(),
                        cursor: styles.match(/cursor:\s*url\(['"]?([^'"]+)['"]?\)/i)?.[1] || null
                    },
                    connections: [
                        // Discord Users
                        ...Array.from(document.querySelectorAll('#profile-cards-section a[data-discord-user-json]')).map((el: any) => {
                            const href = el.getAttribute('href') || '';
                            const directUrl = href.includes('url=') ? decodeURIComponent(new URL(href).searchParams.get('url') || '') : href;
                            let richContent: any = null;
                            const rawJson = el.getAttribute('data-discord-user-json') || '';
                            try {
                                richContent = JSON.parse(rawJson);
                            } catch {
                                try {
                                    let fixed = rawJson;
                                    const openBraces = (fixed.match(/\{/g) || []).length - (fixed.match(/\}/g) || []).length;
                                    const openBrackets = (fixed.match(/\[/g) || []).length - (fixed.match(/\]/g) || []).length;
                                    if (!fixed.endsWith('"')) fixed += '"';
                                    for (let i = 0; i < openBrackets; i++) fixed += ']';
                                    for (let i = 0; i < openBraces; i++) fixed += '}';
                                    richContent = JSON.parse(fixed);
                                } catch { }
                            }
                            const discordUserId = el.getAttribute('data-discord-user-id') || richContent?.userId || null;
                            const imgEl = el.querySelector('img');
                            return {
                                type: 'discordUser',
                                text: richContent?.globalName || richContent?.username || el.querySelector('.module-titleText')?.textContent?.trim() || '',
                                url: discordUserId ? `https://discord.com/users/${discordUserId}` : (directUrl || null),
                                tracking_url: href || null,
                                icon_type: imgEl ? 'image' : null,
                                icon: imgEl?.getAttribute('src') || null,
                                richContent
                            };
                        }),
                        // Discord Servers
                        ...Array.from(document.querySelectorAll('#profile-cards-section a[data-guild-json]')).map((el: any) => {
                            const href = el.getAttribute('href') || '';
                            const directUrl = href.includes('url=') ? decodeURIComponent(new URL(href).searchParams.get('url') || '') : href;
                            let richContent: any = null;
                            try { richContent = JSON.parse(el.getAttribute('data-guild-json')); } catch { }
                            const imgEl = el.querySelector('img');
                            return {
                                type: 'discordServer',
                                text: richContent?.serverName || el.querySelector('.module-titleText')?.textContent?.trim() || '',
                                url: directUrl || null,
                                tracking_url: href || null,
                                icon_type: imgEl ? 'image' : null,
                                icon: imgEl?.getAttribute('src') || null,
                                richContent
                            };
                        }),
                        // FiveM Servers
                        ...Array.from(document.querySelectorAll('#profile-cards-section a[data-fivem-id]')).map((el: any) => {
                            const href = el.getAttribute('href') || '';
                            const directUrl = href.includes('url=') ? decodeURIComponent(new URL(href).searchParams.get('url') || '') : href;
                            const imgEl = el.querySelector('img');
                            return {
                                type: 'fiveM',
                                text: el.querySelector('.module-titleText')?.textContent?.trim() || '',
                                url: directUrl || null,
                                tracking_url: href || null,
                                icon_type: imgEl ? 'image' : null,
                                icon: imgEl?.getAttribute('src') || null,
                                richContent: { serverId: el.getAttribute('data-fivem-id') }
                            };
                        }),
                        // Roblox Users
                        ...Array.from(document.querySelectorAll('#profile-cards-section a[data-roblox-user-json]')).map((el: any) => {
                            const href = el.getAttribute('href') || '';
                            const directUrl = href.includes('url=') ? decodeURIComponent(new URL(href).searchParams.get('url') || '') : href;
                            let richContent: any = null;
                            try { richContent = JSON.parse(el.getAttribute('data-roblox-user-json')); } catch { }
                            const imgEl = el.querySelector('img');
                            return {
                                type: 'roblox',
                                text: richContent?.username || el.querySelector('.module-titleText')?.textContent?.trim() || '',
                                url: directUrl || (richContent?.profileId ? encodeURI("https://www.roblox.com/users/" + richContent?.profileId + "/profile") : null),
                                tracking_url: href || (richContent?.profileId ? "https://drift.rip/go?ref=moduleInner&p=" + myProfileId + "&url=" + encodeURIComponent("https://www.roblox.com/users/" + richContent?.profileId + "/profile") : null),
                                icon_type: imgEl ? 'image' : null,
                                icon: imgEl?.getAttribute('src') || null,
                                richContent
                            };
                        }),
                        // Social connections (Discord, YouTube, GitHub, etc.)
                        ...Array.from(document.querySelectorAll('#section-profile-connections > a')).map((el: any) => {
                            const href = el.getAttribute('href') || '';
                            const directUrl = href.includes('url=') ? decodeURIComponent(new URL(href).searchParams.get('url') || '') : href;
                            const iconEl = el.querySelector('iconify-icon');
                            const imgEl = el.querySelector('img');
                            const iconName = iconEl?.getAttribute('icon') || '';
                            const platform = iconName.split(':')[1] || imgEl?.getAttribute('alt') || 'unknown';
                            const colorSocialText = (iconEl || imgEl)?.getAttribute('style')?.match(/color:\s*(#[0-9a-fA-F]{3,8})/)?.[1] || null;

                            return {
                                type: 'social',
                                text: el.getAttribute('data-tippy-content')?.replace(/<[^>]*>/g, '')?.trim() || platform,
                                color: colorSocialText,
                                url: directUrl || null,
                                tracking_url: href || null,
                                icon_type: iconEl ? 'iconify' : imgEl ? 'image' : null,
                                icon: iconEl?.getAttribute('icon') || imgEl?.getAttribute('src') || null,
                                richContent: null
                            };
                        })
                    ],
                },
                web: {
                    webTitle: document.querySelector('head > title')?.textContent,
                    webDesc: document.querySelector('head > meta[name="description"]')?.getAttribute('content'),
                    title: document.querySelector('head > meta[property="og:title"]')?.getAttribute('content'),
                    desc: document.querySelector('head > meta[property="og:description"]')?.getAttribute('content'),
                    bannerUrl: document.querySelector('head > meta[property="og:image"]')?.getAttribute('content'),
                    canonicalTitle: document.querySelector('h1[class="hdn"]')?.textContent,
                    canonicalUrl: document.querySelector('head > link[rel="canonical"]')?.getAttribute('href')
                }
            }
        };
    }
    catch (e) {
        console.error(e);
        return null;
    }
}


export async function PatreonProfile(query: string): Promise<any> {
    if (!query) return null;
    const username = query.split(/[?#]/)[0].split('/').filter(Boolean).pop();
    if (!username) return null;

    try {
        const res = await request(`https://www.patreon.com/cw/${username}`, {
            useH2: true,
            headers: { ...commonHeaders }
        });


        if (res.statusCode === 404) {
            return { error: "User not found" };
        }

        if (res.statusCode !== 200) {
            return { data: null };
        }

        const html = res.text;
        const chunks = html.split('self.__next_f.push(');
        chunks.shift();

        let campaignData: any = null;
        let userData: any = null;
        let mediaData: any[] = [];

        for (const chunk of chunks) {
            try {
                const endIdx = chunk.lastIndexOf(')</script>');
                if (endIdx === -1) continue;

                const pushArg = chunk.substring(0, endIdx);
                const parsed = JSON.parse(pushArg);

                if (!Array.isArray(parsed) || parsed[0] !== 1 || typeof parsed[1] !== 'string') continue;

                const content = parsed[1];
                const lines = content.split('\n').filter((l: string) => l.trim());

                for (const line of lines) {
                    const colonIdx = line.indexOf(':');
                    if (colonIdx === -1) continue;

                    const jsonPart = line.substring(colonIdx + 1);

                    try {
                        const innerParsed = JSON.parse(jsonPart);

                        const traverse = (obj: any) => {
                            if (!obj || typeof obj !== 'object') return;

                            if (obj.campaign && obj.campaign.data) {
                                campaignData = obj.campaign.data;
                            }
                            if (obj.included && Array.isArray(obj.included)) {
                                obj.included.forEach((inc: any) => {
                                    if (inc.type === 'user') userData = inc;
                                    if (inc.type === 'media') mediaData.push(inc);
                                });
                            }

                            if (Array.isArray(obj)) {
                                obj.forEach(traverse);
                            } else {
                                Object.values(obj).forEach(traverse);
                            }
                        };

                        traverse(innerParsed);
                    } catch { }
                }
            } catch { }
        }

        return {
            data: {
                campaigns: campaignData,
                media: mediaData,
                user: userData
            }
        };
    } catch (e) {
        console.error("PatreonProfile Error:", e);
        return null;
    }
}

export async function SaweriaProfile(query: string): Promise<any> {
    if (!query) return null;
    const username = query.split(/[?#]/)[0].split('/').filter(Boolean).pop();
    if (!username) return null;

    try {
        let dataRes: any;
        if (saweriaBuildId) {
            dataRes = await request(`https://saweria.co/_next/data/${saweriaBuildId}/en/${username}.json`, {
                useH2: true, echConfigDomain: "cloudflare-ech.com", tlsOnly: false,
                headers: { ...commonHeaders }
            });

            if (dataRes.statusCode === 403) {
                return { error: "Cloudflare Turnstile asking to verify you're not a bot" };
            }

            if (dataRes.statusCode === 404) {
                saweriaBuildId = undefined;
            }
        }

        if (!saweriaBuildId) {
            const mainRes = await request('https://saweria.co', {
                useH2: true, echConfigDomain: "cloudflare-ech.com", tlsOnly: false,
                headers: { ...commonHeaders }
            });

            if (mainRes.statusCode === 403) {
                return { error: "Cloudflare Turnstile asking to verify you're not a bot" };
            }

            const mainText = mainRes.text;
            saweriaBuildId = mainText.split('"buildId":"')[1].split('"')[0];

            dataRes = await request(`https://saweria.co/_next/data/${saweriaBuildId}/en/${username}.json`, {
                useH2: true, echConfigDomain: "cloudflare-ech.com", tlsOnly: false,
                headers: { ...commonHeaders }
            });

            if (dataRes.statusCode === 403) {
                return { error: "Cloudflare Turnstile asking to verify you're not a bot" };
            }
        }


        if (dataRes.statusCode !== 200) {
            return { data: null };
        }

        const dataJson: any = dataRes.json();
        if (dataJson?.pageProps?.error) {
            return {
                error: dataJson.pageProps.error?.json?.message || null
            }
        }

        return { data: dataJson?.pageProps?.data || null };
    } catch (e) {
        console.error("SaweriaProfile Error:", e);
        return null;
    }
}

export async function TrakteerProfile(query: string): Promise<any> {
    if (!query) return null;
    const username = query.split(/[?#]/)[0].split('/').filter(Boolean).pop();
    if (!username || ['robots.txt', 'favicon.ico', 'login', 'register', 'forgot-password', 'cdn-cgi', 'terms', 'privacy-policy', 'auth', 'search', 'explore', 'feed', 'feature-and-pricing', 'career'].includes(username.toLowerCase())) return null;

    try {
        const res = await request(`https://trakteer.id/${username}`, {
            useH2: true,
            echConfigDomain: "cloudflare-ech.com",
            tlsOnly: false,
            headers: {
                ...commonHeaders,
            }
        });


        if (res.statusCode === 403) {
            return { error: "Cloudflare Turnstile asking to verify you're not a bot" };
        }

        if (res.statusCode === 404) {
            return { error: "User not found" };
        }

        if (res.statusCode !== 200) {
            return { data: null };
        }

        const html = res.text;
        const { document } = parseHTML(html);
        const appDiv = document.querySelector('#app');
        const dataPage = appDiv?.getAttribute('data-page');

        if (!dataPage) return { data: null };

        const decodedData = decodeHTML(dataPage);
        const dataJson = JSON.parse(decodedData);

        const creator = dataJson?.props?.creator;
        const extraCreator = dataJson?.props;
        return { data: creator ? { ...creator.data, ...creator.meta, ...extraCreator.extraCreatorData, ...extraCreator.payload } : null };
    } catch (e) {
        console.error("TrakteerProfile Error:", e);
        return null;
    }
}

export async function SociaBuzzProfile(query: string): Promise<any> {
    if (!query) return null;
    const username = query.split(/[?#]/)[0].split('/').filter(Boolean).pop();
    if (!username) return null;

    try {
        const res = await request(`https://sociabuzz.com/${username}/tribe`, {
            useH2: true,
            echConfigDomain: "cloudflare-ech.com",
            tlsOnly: false,
            allowRedirects: false,
            headers: {
                ...commonHeaders,
            }
        });


        if (res.statusCode === 403) {
            return { error: "Cloudflare Turnstile asking to verify you're not a bot" };
        }

        if (res.statusCode === 307) {
            return { error: "User not found" };
        }

        if (res.statusCode !== 200) {
            return { data: null };
        }

        const html = res.text;
        const match = html.match(/const userdata = (\{[\s\S]*?\});/);
        const userDataStr = match ? match[1] : null;
        if (!userDataStr) return { data: null };

        const dataJson = JSON.parse(userDataStr);
        return { data: dataJson || null };
    } catch (e) {
        console.error("SociaBuzzProfile Error:", e);
        return null;
    }
}





export async function GunsProfile(query: string): Promise<any> {
    if (!query) return null;
    const username = query.split(/[?#]/)[0].split('/').filter(Boolean).pop();
    if (!username || ['robots.txt', 'favicon.ico', 'register', 'pricing', 'login', 'reset', 'cdn-cgi', 'account', 'terms', 'privacy', 'dashboard', 'leaderboard', 'de', 'fr', 'es', 'tr', 'ru', 'pt', 'ar'].includes(username.toLowerCase())) return null;

    let res: any;

    for (let attempts = 0; attempts < 3; attempts++) {
        try {
            res = await request(`https://guns.lol/${username}`, {
                useH2: true,
                echConfigDomain: "cloudflare-ech.com",
                tlsOnly: true,
                headers: {
                    ...commonHeaders
                }
            });

            if (res.statusCode !== 401 && res.statusCode !== 403 && res.statusCode !== 429) {
                break;
            }

            if (attempts === 2) {
                return { error: "Guns.lol asking to verify you're not a bot" };
            }
        } catch (e) {
            if (attempts === 2) throw e;
        }
    }

    try {
        const html = res.text;
        if (res.statusCode !== 200) {
            return { data: null };
        }

        // Split on self.__next_f.push( to get all RSC chunks
        const chunks = html.split('self.__next_f.push(');
        chunks.shift(); // Remove the part before the first push

        const dataResults: any[] = [];

        for (const chunk of chunks) {
            try {
                // Each chunk looks like: [1,"ID:content\n"])</script>
                // Find the closing )
                const endIdx = chunk.lastIndexOf(')</script>');
                if (endIdx === -1) continue;

                const pushArg = chunk.substring(0, endIdx);
                const parsed = JSON.parse(pushArg);

                // parsed is [0] or [1, "string content"]
                if (!Array.isArray(parsed) || parsed[0] !== 1 || typeof parsed[1] !== 'string') continue;

                const content = parsed[1];

                // The content format is "ID:JSON_CONTENT\n" — may have multiple lines with different IDs
                // Split by newlines and process each line
                const lines = content.split('\n').filter((l: string) => l.trim());

                for (const line of lines) {
                    // Each line is like "5:[\"$\",\"$L18\",null,{\"data\":{...}}]"
                    const colonIdx = line.indexOf(':');
                    if (colonIdx === -1) continue;

                    const jsonPart = line.substring(colonIdx + 1);
                    if (!jsonPart.includes('"data"')) continue;

                    try {
                        const innerParsed = JSON.parse(jsonPart);

                        // It could be an array like ["$","$L18",null,{"data":{...}}]
                        if (Array.isArray(innerParsed)) {
                            for (const item of innerParsed) {
                                if (item && typeof item === 'object' && !Array.isArray(item) && 'data' in item) {
                                    dataResults.push(item.data);
                                }
                            }
                        }
                        // Or a direct object with "data"
                        else if (innerParsed && typeof innerParsed === 'object' && 'data' in innerParsed) {
                            dataResults.push(innerParsed.data);
                        }
                    } catch {
                        // Some lines may not be valid JSON, skip
                    }
                }
            } catch {
                // Skip malformed chunks
            }
        }

        if (dataResults.length === 0) {
            return { data: null };
        }

        const finalresult: any = dataResults[0];

        // The main profile data is the first data object found
        const { _gpp_ch, success, session: _session, ...rest } = finalresult;
        let secfinal: any = rest;
        if (secfinal?.config?.socials?.[0]) {
            secfinal.config.valid_socials = secfinal.config.socials?.map((a: any) => {
                try {
                    const lk = new URL(a.value);
                    return a;
                }
                catch { }
            })?.filter(Boolean);
        }

        // Return the cleaned-up profile data
        return { data: secfinal };
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export async function RageProfile(query: string): Promise<any> {
    if (!query) return null;
    const username = query.split(/[?#]/)[0].split('/').filter(Boolean).pop();
    if (!username || ['robots.txt', 'favicon.ico', 'leaderboards', 'pricing', 'docs', 'auth', 'cdn-cgi', 'terms', 'privacy', 'copyright', 'docs', 'dashboard', 'main_og.png', 'extra.css'].includes(username.toLowerCase())) return null;

    let res: any;

    for (let attempts = 0; attempts < 3; attempts++) {
        try {
            res = await request(`https://rage.wtf/${username}`, {
                useH2: true,
                echConfigDomain: "cloudflare-ech.com",
                tlsOnly: true,
                headers: {
                    ...commonHeaders
                }
            });

            if (res.statusCode !== 403) {
                break;
            }

            if (attempts === 2) {
                return { error: "Rage.wtf asking to verify you're not a bot" };
            }
        } catch (e) {
            if (attempts === 2) throw e;
        }
    }

    try {
        const html = res.text;
        if (res.statusCode !== 200) {
            return { data: null };
        }

        const chunks = html.split('self.__next_f.push(');
        chunks.shift();

        const dataResults: any[] = [];

        for (const chunk of chunks) {
            try {
                const endIdx = chunk.lastIndexOf(')</script>');
                if (endIdx === -1) continue;

                const pushArg = chunk.substring(0, endIdx);
                const parsed = JSON.parse(pushArg);

                if (!Array.isArray(parsed) || parsed[0] !== 1 || typeof parsed[1] !== 'string') continue;

                const content = parsed[1];
                const lines = content.split('\n').filter((l: string) => l.trim());

                for (const line of lines) {
                    const colonIdx = line.indexOf(':');
                    if (colonIdx === -1) continue;

                    const jsonPart = line.substring(colonIdx + 1);
                    if (!jsonPart.includes('"user"') || !jsonPart.includes('"customization"')) continue;

                    try {
                        const innerParsed = JSON.parse(jsonPart);

                        const findProfile = (obj: any): any => {
                            if (!obj || typeof obj !== 'object') return null;
                            if (obj.user && obj.customization) return obj;

                            if (Array.isArray(obj)) {
                                for (const item of obj) {
                                    const result = findProfile(item);
                                    if (result) return result;
                                }
                            } else {
                                for (const key in obj) {
                                    const result = findProfile(obj[key]);
                                    if (result) return result;
                                }
                            }
                            return null;
                        };

                        const profile = findProfile(innerParsed);
                        if (profile) {
                            dataResults.push(profile);
                        }
                    } catch { }
                }
            } catch { }
        }

        if (dataResults.length === 0) {
            return { data: null };
        }

        return { data: dataResults[0] };
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export async function HauntProfile(query: string): Promise<any> {
    if (!query) return null;
    const username = query.split(/[?#]/)[0].split('/').filter(Boolean).pop();
    if (!username || ['robots.txt', 'favicon.ico', 'login', 'register', 'pricing', 'cdn-cgi', 'terms', 'privacy', 'dashboard', 'settings', 'api'].includes(username.toLowerCase())) return null;

    let res: any;

    for (let attempts = 0; attempts < 3; attempts++) {
        try {
            res = await request(`https://haunt.gg/${username}`, {
                useH2: true,
                echConfigDomain: "cloudflare-ech.com",
                tlsOnly: true,
                headers: {
                    ...commonHeaders
                }
            });

            if (res.statusCode !== 403) {
                break;
            }

            if (attempts === 2) {
                return { error: "Haunt.gg asking to verify you're not a bot" };
            }
        } catch (e) {
            if (attempts === 2) throw e;
        }
    }

    try {
        const html = res.text;
        if (res.statusCode !== 200) {
            return { data: null };
        }

        const chunks = html.split('self.__next_f.push(');
        chunks.shift();

        const dataResults: any[] = [];

        for (const chunk of chunks) {
            try {
                const endIdx = chunk.lastIndexOf(')</script>');
                if (endIdx === -1) continue;

                const pushArg = chunk.substring(0, endIdx);
                const parsed = JSON.parse(pushArg);

                if (!Array.isArray(parsed) || parsed[0] !== 1 || typeof parsed[1] !== 'string') continue;

                const content = parsed[1];
                const lines = content.split('\n').filter((l: string) => l.trim());

                for (const line of lines) {
                    const colonIdx = line.indexOf(':');
                    if (colonIdx === -1) continue;

                    const jsonPart = line.substring(colonIdx + 1);
                    if (!jsonPart.includes('"user"') || !jsonPart.includes('"links"')) continue;

                    try {
                        const innerParsed = JSON.parse(jsonPart);

                        const findProfile = (obj: any): any => {
                            if (!obj || typeof obj !== 'object') return null;
                            if (obj.user && obj.links) return obj;

                            if (Array.isArray(obj)) {
                                for (const item of obj) {
                                    const result = findProfile(item);
                                    if (result) return result;
                                }
                            } else {
                                for (const key in obj) {
                                    const result = findProfile(obj[key]);
                                    if (result) return result;
                                }
                            }
                            return null;
                        };

                        const profile = findProfile(innerParsed);
                        if (profile) {
                            dataResults.push(profile);
                        }
                    } catch { }
                }
            } catch { }
        }

        if (dataResults.length === 0) {
            return { data: null };
        }

        const finalresult: any = dataResults[0];

        // The main profile data is the first data object found
        const { links, ...rest } = finalresult;

        // Return the cleaned-up profile data
        return { data: rest?.user || null };
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

const DISCORD_FLAGS: Record<number, string> = {
    0: 'Discord Staff',
    1: 'Partnered Server Owner',
    2: 'HypeSquad Events',
    3: 'Bug Hunter Level 1',
    6: 'HypeSquad Bravery',
    7: 'HypeSquad Brilliance',
    8: 'HypeSquad Balance',
    9: 'Early Nitro Supporter',
    10: 'Team User',
    12: 'System',
    14: 'Bug Hunter Level 2',
    16: 'Verified Bot',
    17: 'Early Verified Bot Developer',
    18: 'Moderator Programs Alumni',
    19: 'Bot HTTP Interactions',
    22: 'Active Developer',
};

function resolveFlags(flags: number | null | undefined): string[] {
    if (!flags) return [];
    const badges: string[] = [];
    for (const [bit, name] of Object.entries(DISCORD_FLAGS)) {
        if (flags & (1 << Number(bit))) {
            badges.push(name);
        }
    }
    return badges;
}

const DISCORD_PERMISSIONS: Record<string, bigint> = {
    "Create Instant Invite": 1n << 0n,
    "Kick Members": 1n << 1n,
    "Ban Members": 1n << 2n,
    "Administrator": 1n << 3n,
    "Manage Channels": 1n << 4n,
    "Manage Guild": 1n << 5n,
    "Add Reactions": 1n << 6n,
    "View Audit Log": 1n << 7n,
    "Priority Speaker": 1n << 8n,
    "Stream": 1n << 9n,
    "View Channel": 1n << 10n,
    "Send Messages": 1n << 11n,
    "Send TTS Messages": 1n << 12n,
    "Manage Messages": 1n << 13n,
    "Embed Links": 1n << 14n,
    "Attach Files": 1n << 15n,
    "Read Message History": 1n << 16n,
    "Mention Everyone": 1n << 17n,
    "Use External Emojis": 1n << 18n,
    "View Guild Insights": 1n << 19n,
    "Connect": 1n << 20n,
    "Speak": 1n << 21n,
    "Mute Members": 1n << 22n,
    "Deafen Members": 1n << 23n,
    "Move Members": 1n << 24n,
    "Use VAD": 1n << 25n,
    "Change Nickname": 1n << 26n,
    "Manage Nicknames": 1n << 27n,
    "Manage Roles": 1n << 28n,
    "Manage Webhooks": 1n << 29n,
    "Manage Guild Expressions": 1n << 30n,
    "Use Application Commands": 1n << 31n,
    "Request to Speak": 1n << 32n,
    "Manage Events": 1n << 33n,
    "Manage Threads": 1n << 34n,
    "Create Public Threads": 1n << 35n,
    "Create Private Threads": 1n << 36n,
    "Use External Stickers": 1n << 37n,
    "Send Messages in Threads": 1n << 38n,
    "Use Embedded Activities": 1n << 39n,
    "Moderate Members": 1n << 40n,
    "View Creator Monetization Analytics": 1n << 41n,
    "Use Soundboard": 1n << 42n,
    "Create Guild Expressions": 1n << 43n,
    "Use External Sounds": 1n << 44n,
    "Send Voice Messages": 1n << 45n,
    "Use Clyde AI": 1n << 47n,
    "Set Voice Channel Status": 1n << 48n,
    "Send Polls": 1n << 49n,
    "Use External Apps": 1n << 50n,
};

export const PERMISSION_KEYS: Record<string, bigint> = {
    addreactions: 1n << 6n,
    admin: 1n << 3n,
    attachfiles: 1n << 15n,
    ban: 1n << 2n,
    changenicknames: 1n << 26n,
    connect: 1n << 20n,
    createinstantinvite: 1n << 0n,
    createprivatethreads: 1n << 36n,
    createpublicthreads: 1n << 35n,
    embedlinks: 1n << 14n,
    externalemojis: 1n << 18n,
    externalstickers: 1n << 37n,
    kick: 1n << 1n,
    managechannels: 1n << 4n,
    manageemojis: 1n << 30n,
    manageevents: 1n << 33n,
    managemessages: 1n << 13n,
    managenicknames: 1n << 27n,
    manageroles: 1n << 28n,
    manageserver: 1n << 5n,
    managethreads: 1n << 34n,
    managewebhooks: 1n << 29n,
    mentioneveryone: 1n << 17n,
    moderatemembers: 1n << 40n,
    movemembers: 1n << 24n,
    priorityspeaker: 1n << 8n,
    readmessagehistory: 1n << 16n,
    readmessages: 1n << 10n,
    requesttospeak: 1n << 32n,
    sendmessages: 1n << 11n,
    sendmessagesinthreads: 1n << 38n,
    sendvoicemessages: 1n << 45n,
    setvoicechannelstatus: 1n << 48n,
    slashcommands: 1n << 31n,
    speak: 1n << 21n,
    stream: 1n << 9n,
    tts: 1n << 12n,
    usesoundboard: 1n << 42n,
    usevad: 1n << 25n,
    viewauditlog: 1n << 7n,
    viewguildinsights: 1n << 19n,
    voicedeafen: 1n << 23n,
    voicemute: 1n << 22n,
};

export const DISCORD_CHANNEL_TYPES: Record<number, string> = {
    0: 'text',
    2: 'voice',
    4: 'category',
    5: 'announcement',
    10: 'announcement_thread',
    11: 'public_thread',
    12: 'private_thread',
    13: 'stage',
    14: 'directory',
    15: 'forum',
    16: 'media'
};

function resolvePermissions(permissions: string | bigint | null | undefined): string[] {
    if (!permissions) return [];
    const p = typeof permissions === 'string' ? BigInt(permissions) : permissions;
    const resolved: string[] = [];

    if ((p & DISCORD_PERMISSIONS["Administrator"]!) === DISCORD_PERMISSIONS["Administrator"]!) {
        return ["Administrator"];
    }

    for (const [name, bit] of Object.entries(DISCORD_PERMISSIONS)) {
        if ((p & bit) === bit) {
            resolved.push(name);
        }
    }
    return resolved;
}

function getMemberPermissions(member: any, rolesData: any[], guildData: any, guildId: string): { permissions: string; permissions_resolved: { array: string[]; string: string } } {
    const ownerId = guildData?.owner_id;
    const everyoneRole = rolesData.find((r: any) => r.id === guildId);
    let permissions = BigInt(everyoneRole?.permissions || '0');

    const userId = member.user?.id || member.id;

    if (userId === ownerId) {
        permissions = 0x7FFFFFFFFFFFFFn;
    } else if (member.roles) {
        for (const roleId of member.roles) {
            const role = rolesData.find((r: any) => r.id === roleId);
            if (role) {
                permissions |= BigInt(role.permissions);
            }
        }
        if ((permissions & DISCORD_PERMISSIONS["Administrator"]!) === DISCORD_PERMISSIONS["Administrator"]!) {
            permissions = 0x7FFFFFFFFFFFFFn;
        }
    }

    const resolvedArray = resolvePermissions(permissions);
    return {
        permissions: permissions.toString(),
        permissions_resolved: {
            array: resolvedArray,
            string: resolvedArray.join(', ')
        }
    };
}

const getSnowflakeDate = (id: string) => {
    try {
        return Math.floor(Number((BigInt(id) >> 22n) + 1420070400000n) / 1000);
    } catch {
        return null;
    }
}

export const DiscordInfoMember = async (token: string, userId: string, guildId?: string) => {
    if (!token || token === 'null') return { error: 'Missing token' };
    if (!userId) return { error: 'Missing userId' };

    const botUserAgent = 'DiscordBot (https://github.com/discord-bot, 1.0.0)';
    const headers: any = {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': botUserAgent
    };

    try {
        const url = guildId
            ? `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`
            : `https://discord.com/api/v10/users/${userId}`;

        const urlRoles = guildId ? `https://discord.com/api/v10/guilds/${guildId}/roles` : null;
        const urlGuild = guildId ? `https://discord.com/api/v10/guilds/${guildId}` : null;

        const urlDMs = `https://discord.com/api/v10/users/@me/channels`;

        const [req, rolesReq, guildReq, dmReq] = await Promise.all([
            fetch(url, { method: 'GET', headers }),
            urlRoles ? fetch(urlRoles, { method: 'GET', headers }) : Promise.resolve(null),
            urlGuild ? fetch(urlGuild, { method: 'GET', headers }) : Promise.resolve(null),
            fetch(urlDMs, {
                method: 'POST',
                headers,
                body: JSON.stringify({ recipient_id: userId })
            })
        ]);

        let data: any = null;
        let rolesData: any = [];
        let guildData: any = null;
        let dmData: any = null;

        try { data = await req.json(); } catch { }
        try { if (rolesReq && rolesReq.status === 200) rolesData = await rolesReq.json(); } catch { }
        try { if (guildReq && guildReq.status === 200) guildData = await guildReq.json(); } catch { }
        try { if (dmReq && dmReq.status === 200) dmData = await dmReq.json(); } catch { }

        if (req.status !== 200) {
            return {
                data: null,
                error: data || { status: req.status, statusText: req.statusText }
            };
        }

        // Guild member response has user info nested under .user
        const userData = guildId ? data.user : data;

        // Resolve flags into badge names
        const flagsBadges = resolveFlags(userData?.flags);
        const publicFlagsBadges = resolveFlags(userData?.public_flags);

        // Build avatar & banner CDN URLs
        const avatarUrl = userData?.avatar
            ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.${userData.avatar.startsWith('a_') ? 'gif' : 'png'}?size=4096`
            : null;
        const bannerUrl = userData?.banner
            ? `https://cdn.discordapp.com/banners/${userData.id}/${userData.banner}.${userData.banner.startsWith('a_') ? 'gif' : 'png'}?size=4096`
            : null;

        // Guild-specific avatar
        const guildAvatarUrl = (guildId && data.avatar)
            ? `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/avatars/${data.avatar}.${data.avatar.startsWith('a_') ? 'gif' : 'png'}?size=4096`
            : null;

        const perms = guildId ? getMemberPermissions(data, rolesData, guildData, guildId) : {};

        const result: any = {
            dmChannelId: dmData?.id || null,
            ...data,
            ...perms,
            avatar_url: guildAvatarUrl || avatarUrl,
            banner_url: bannerUrl,
            badges: publicFlagsBadges,
            badges_raw: flagsBadges,
            joined_at: data.joined_at ? String(Math.floor(new Date(data.joined_at).getTime() / 1000)) : null,
            premium_since: data.premium_since ? String(Math.floor(new Date(data.premium_since).getTime() / 1000)) : null,
            created_at: userData?.id ? String(getSnowflakeDate(userData.id)) : null
        };

        return { data: result };
    } catch (e: any) {
        return { error: e.message || 'Something just happened' };
    }
};

export const DiscordListMember = async (token: string, guildId: string, limit: number = 10, type: string = 'all', permission: string = 'all') => {
    if (!token || token === 'null') return { error: 'Missing token' };
    if (!guildId) return { error: 'Missing guildId' };

    const headers: any = {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)'
    };

    try {
        const types = type.split(',').map(t => t.trim());
        const isBannedRequested = types.includes('banned');
        const isSpecial = types.some(t => ['oldest', 'newest', 'no_role', 'has_role'].includes(t));

        // If special sorting/filtering is requested, we need a larger pool (at least 1000)
        // unless the limit is already higher.
        const targetLimit = isSpecial ? Math.max(1000, limit) : (limit === -1 ? 1000 : limit);

        const urlRoles = `https://discord.com/api/v10/guilds/${guildId}/roles`;
        const urlGuild = `https://discord.com/api/v10/guilds/${guildId}`;
        const [rolesReq, guildReq] = await Promise.all([
            fetch(urlRoles, { method: 'GET', headers }),
            fetch(urlGuild, { method: 'GET', headers })
        ]);

        let rolesData: any = [];
        let guildData: any = null;
        try { if (rolesReq.status === 200) rolesData = await rolesReq.json(); } catch { }
        try { if (guildReq.status === 200) guildData = await guildReq.json(); } catch { }

        // Paginated fetch for members
        let data: any[] = [];
        let lastMemberId: string | null = null;
        let membersFetchRemaining = (isBannedRequested && types.length === 1) ? 0 : targetLimit;

        while (membersFetchRemaining > 0) {
            const currentFetchLimit = Math.min(membersFetchRemaining, 1000);
            let urlMembers = `https://discord.com/api/v10/guilds/${guildId}/members?limit=${currentFetchLimit}`;
            if (lastMemberId) urlMembers += `&after=${lastMemberId}`;

            const req = await fetch(urlMembers, { method: 'GET', headers });
            if (req.status !== 200) break;

            const batch = await req.json();
            if (!Array.isArray(batch) || batch.length === 0) break;

            data.push(...batch);
            lastMemberId = batch[batch.length - 1].user?.id;
            membersFetchRemaining -= batch.length;
            if (batch.length < currentFetchLimit) break;
        }

        // Paginated fetch for bans
        let bansData: any[] = [];
        if (isBannedRequested) {
            let lastBanId: string | null = null;
            let bansFetchRemaining = targetLimit;

            while (bansFetchRemaining > 0) {
                const currentFetchLimit = Math.min(bansFetchRemaining, 1000);
                let urlBans = `https://discord.com/api/v10/guilds/${guildId}/bans?limit=${currentFetchLimit}`;
                if (lastBanId) urlBans += `&after=${lastBanId}`;

                const req = await fetch(urlBans, { method: 'GET', headers });
                if (req.status !== 200) break;

                const batch = await req.json();
                if (!Array.isArray(batch) || batch.length === 0) break;

                bansData.push(...batch);
                lastBanId = batch[batch.length - 1].user?.id;
                bansFetchRemaining -= batch.length;
                if (batch.length < currentFetchLimit) break;
            }
        }

        if (data.length === 0 && bansData.length === 0 && !isBannedRequested) {
            return {
                data: null,
                error: { message: 'Failed to fetch members or bans' }
            };
        }

        // Map bans to member-like structure
        const mappedBans = bansData.map((ban: any) => ({
            ...ban.user,
            roles: [],
            joined_at: null,
            premium_since: null,
            is_banned: true,
            ban_reason: ban.reason,
            created_at: ban.user?.id ? String(getSnowflakeDate(ban.user.id)) : null
        }));

        // Merge data based on types
        if (types.length === 1 && types[0] === 'banned') {
            data = mappedBans;
        } else if (isBannedRequested) {
            data = [...data, ...mappedBans];
        }

        if (Array.isArray(data)) {
            data = data.map((member: any, index: number) => {
                // Skip permission check for banned users who aren't members
                const perms = member.is_banned ? { permissions: "0" } : getMemberPermissions(member, rolesData, guildData, guildId);
                return {
                    ...member,
                    position: index + 1,
                    ...perms,
                    joined_at: member.joined_at ? String(Math.floor(new Date(member.joined_at).getTime() / 1000)) : null,
                    created_at: member.user?.id ? String(getSnowflakeDate(member.user.id)) : null
                };
            });

            if (permission !== 'all') {
                const requestedPerms = permission.split(',').map(p => p.trim().toLowerCase());
                const permBits = requestedPerms.map(p => PERMISSION_KEYS[p]).filter(b => b !== undefined) as bigint[];

                if (permBits.length > 0) {
                    data = data.filter((member: any) => {
                        const memberPerms = BigInt(member.permissions);
                        // Administrator matches everything
                        if ((memberPerms & DISCORD_PERMISSIONS["Administrator"]!) === DISCORD_PERMISSIONS["Administrator"]!) return true;

                        // Check if member has ALL requested permissions
                        return permBits.every(bit => (memberPerms & bit) === bit);
                    });
                }
            }

            const botsCount = data.filter((member: any) => member.user?.bot || member.bot).length;
            const usersCount = data.filter((member: any) => !member.user?.bot && !member.bot).length;

            for (const t of types) {
                if (t === 'user') {
                    data = data.filter((member: any) => !member.user?.bot && !member.bot);
                } else if (t === 'bot') {
                    data = data.filter((member: any) => member.user?.bot || member.bot);
                } else if (t === 'no_role') {
                    data = data.filter((member: any) => !member.roles || member.roles.length === 0);
                } else if (t === 'has_role') {
                    data = data.filter((member: any) => member.roles && member.roles.length > 0);
                } else if (t === 'oldest') {
                    data.sort((a: any, b: any) => Number(a.joined_at || 0) - Number(b.joined_at || 0));
                } else if (t === 'newest') {
                    data.sort((a: any, b: any) => Number(b.joined_at || 0) - Number(a.joined_at || 0));
                }
            }

            if (isSpecial) {
                data = data.slice(0, limit);
            }

            return {
                botsCount,
                usersCount,
                limit: limit,
                data
            };
        }

        return { data };
    } catch (e: any) {
        return { error: e.message || 'Something just happened' };
    }
};

export const DiscordListRole = async (token: string, guildId: string, limit: number = 10, type: string = 'all', permission: string = 'all') => {
    if (!token || token === 'null') return { error: 'Missing token' };
    if (!guildId) return { error: 'Missing guildId' };

    const headers: any = {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)'
    };

    try {
        const urlRoles = `https://discord.com/api/v10/guilds/${guildId}/roles`;
        const urlMembers = `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`;

        const [rolesReq, membersReq] = await Promise.all([
            fetch(urlRoles, { method: 'GET', headers }),
            fetch(urlMembers, { method: 'GET', headers })
        ]);

        let rolesData: any = [];
        let membersData: any = [];

        try { if (rolesReq.status === 200) rolesData = await rolesReq.json(); } catch { }
        try { if (membersReq.status === 200) membersData = await membersReq.json(); } catch { }

        if (rolesReq.status !== 200) {
            return {
                data: null,
                error: rolesData || { status: rolesReq.status, statusText: rolesReq.statusText }
            };
        }

        if (Array.isArray(rolesData)) {
            const totalRoles = rolesData.length;

            // Map members to roles
            rolesData = rolesData.map((role: any) => {
                const members = membersData
                    .filter((m: any) => m.roles.includes(role.id))
                    .map((m: any) => m.user?.id);

                return {
                    ...role,
                    membersCount: members.length,
                    members,
                    created_at: role.id ? String(getSnowflakeDate(role.id)) : null
                };
            });

            // Filtering by permission
            if (permission !== 'all') {
                const requestedPerms = permission.split(',').map(p => p.trim().toLowerCase());
                const permBits = requestedPerms.map(p => PERMISSION_KEYS[p]).filter(b => b !== undefined) as bigint[];

                if (permBits.length > 0) {
                    rolesData = rolesData.filter((role: any) => {
                        const rolePerms = BigInt(role.permissions);
                        if ((rolePerms & DISCORD_PERMISSIONS["Administrator"]!) === DISCORD_PERMISSIONS["Administrator"]!) return true;
                        return permBits.every(bit => (rolePerms & bit) === bit);
                    });
                }
            }

            // Sorting by type
            const types = type.split(',').map(t => t.trim());
            for (const t of types) {
                if (t === 'oldest') {
                    rolesData.sort((a: any, b: any) => Number(a.created_at || 0) - Number(b.created_at || 0));
                } else if (t === 'newest') {
                    rolesData.sort((a: any, b: any) => Number(b.created_at || 0) - Number(a.created_at || 0));
                }
            }

            rolesData = rolesData.map((role: any) => {
                const resolvedArray = resolvePermissions(role.permissions);
                return {
                    ...role,
                    permissions_resolved: {
                        array: resolvedArray,
                        string: resolvedArray.join(', ')
                    },
                    created_at: role.id ? String(getSnowflakeDate(role.id)) : null
                };
            });

            rolesData = rolesData.slice(0, limit);

            return {
                rolesCount: totalRoles,
                limit: limit,
                data: rolesData
            };
        }

        return { data: rolesData };
    } catch (e: any) {
        return { error: e.message || 'Something just happened' };
    }
};

export const DiscordListChannel = async (token: string, guildId: string, limit: number = 10, type: string = 'all') => {
    if (!token || token === 'null') return { error: 'Missing token' };
    if (!guildId) return { error: 'Missing guildId' };

    const headers: any = {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)'
    };

    try {
        const urlChannels = `https://discord.com/api/v10/guilds/${guildId}/channels`;
        const urlThreads = `https://discord.com/api/v10/guilds/${guildId}/threads/active`;

        const [reqChannels, reqThreads] = await Promise.all([
            fetch(urlChannels, { method: 'GET', headers }),
            fetch(urlThreads, { method: 'GET', headers })
        ]);

        let channelsData: any = [];
        let threadsData: any = { threads: [] };

        if (reqChannels.status === 200) {
            try { channelsData = await reqChannels.json(); } catch { }
        }
        if (reqThreads.status === 200) {
            try { threadsData = await reqThreads.json(); } catch { }
        }

        let data = [...(Array.isArray(channelsData) ? channelsData : []), ...(Array.isArray(threadsData.threads) ? threadsData.threads : [])];

        if (data.length === 0 && reqChannels.status !== 200) {
            return {
                data: null,
                error: channelsData || { status: reqChannels.status, statusText: reqChannels.statusText }
            };
        }

        if (Array.isArray(data)) {
            data = data.map((channel: any) => ({
                ...channel,
                type: {
                    id: channel.type,
                    name: DISCORD_CHANNEL_TYPES[channel.type] || 'unknown'
                },
                permission_overwrites: Array.isArray(channel.permission_overwrites) ? channel.permission_overwrites.map((o: any) => {
                    const allowResolved = resolvePermissions(o.allow);
                    const denyResolved = resolvePermissions(o.deny);
                    return {
                        ...o,
                        allow_resolved: { array: allowResolved, string: allowResolved.join(', ') },
                        deny_resolved: { array: denyResolved, string: denyResolved.join(', ') }
                    };
                }) : channel.permission_overwrites,
                created_at: channel.id ? String(getSnowflakeDate(channel.id)) : null
            }));

            const types = type.split(',').map(t => t.trim().toLowerCase());

            const totalChannel: any = {
                text: 0,
                voice: 0,
                category: 0,
                announcement: 0,
                announcement_thread: 0,
                public_thread: 0,
                private_thread: 0,
                stage: 0,
                directory: 0,
                forum: 0,
                media: 0,
                all: data.length
            };

            data.forEach((channel: any) => {
                const typeName = channel.type.name;
                if (typeName && totalChannel[typeName] !== undefined) {
                    totalChannel[typeName]++;
                }
            });

            if (!types.includes('all')) {
                data = data.filter((channel: any) => {
                    const typeName = channel.type.name;
                    if (typeName && types.includes(typeName)) return true;
                    if (types.includes('threads') && [10, 11, 12].includes(channel.type.id)) return true;
                    return false;
                });
            }

            const sliceLimit = limit === -1 ? data.length : limit;
            data = data.slice(0, sliceLimit);

            return {
                data,
                totalChannel,
            };
        }
    } catch (e: any) {
        return { error: e.message || 'Something just happened' };
    }
};

export const DiscordInfoServer = async (token: string, guildId: string) => {
    if (!token || token === 'null') return { error: 'Missing token' };
    if (!guildId) return { error: 'Missing guildId' };

    const headers: any = {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)'
    };

    try {
        let botId: string | null = null;
        try {
            botId = Buffer.from(token.split('.')[0], 'base64').toString();
        } catch { }

        const url = `https://discord.com/api/v10/guilds/${guildId}?with_counts=true`;
        const urlWebhooks = `https://discord.com/api/v10/guilds/${guildId}/webhooks`;
        const urlChannels = `https://discord.com/api/v10/guilds/${guildId}/channels`;
        const urlClientMember = botId ? `https://discord.com/api/v10/guilds/${guildId}/members/${botId}` : null;

        const [req, webhooksReq, channelsReq, clientMemberReq] = await Promise.all([
            fetch(url, { method: 'GET', headers }),
            fetch(urlWebhooks, { method: 'GET', headers }),
            fetch(urlChannels, { method: 'GET', headers }),
            urlClientMember ? fetch(urlClientMember, { method: 'GET', headers }) : Promise.resolve(null)
        ]);

        let data: any = null;
        let webhooksData: any = [];
        let channelsData: any = [];
        let clientMemberData: any = null;

        try { data = await req.json(); } catch { }
        try { if (webhooksReq.status === 200) webhooksData = await webhooksReq.json(); } catch { }
        try { if (channelsReq.status === 200) channelsData = await channelsReq.json(); } catch { }
        try { if (clientMemberReq && clientMemberReq.status === 200) clientMemberData = await clientMemberReq.json(); } catch { }

        if (req.status !== 200) {
            return {
                data: null,
                error: data || { status: req.status, statusText: req.statusText }
            };
        }

        if (data.icon) {
            data.icon_url = `https://cdn.discordapp.com/icons/${data.id}/${data.icon}.${data.icon.startsWith('a_') ? 'gif' : 'png'}?size=4096`;
        }
        if (data.banner) {
            data.banner_url = `https://cdn.discordapp.com/banners/${data.id}/${data.banner}.${data.banner.startsWith('a_') ? 'gif' : 'png'}?size=4096`;
        }
        if (data.discovery_splash) {
            data.discovery_splash_url = `https://cdn.discordapp.com/discovery-splashes/${data.id}/${data.discovery_splash}.png?size=4096`;
        }
        if (data.splash) {
            data.splash_url = `https://cdn.discordapp.com/splashes/${data.id}/${data.splash}.png?size=4096`;
        }
        if (data.home_header) {
            data.home_header_url = `https://cdn.discordapp.com/home-headers/${data.id}/${data.home_header}.png?size=4096`;
        }

        if (data.roles) {
            data.roles = data.roles.map((r: any) => ({ ...r, created_at: r.id ? String(getSnowflakeDate(r.id)) : null }));
        }
        if (data.emojis) {
            data.emojis = data.emojis.map((e: any) => ({ ...e, created_at: e.id ? String(getSnowflakeDate(e.id)) : null }));
        }
        if (data.stickers) {
            data.stickers = data.stickers.map((s: any) => ({ ...s, created_at: s.id ? String(getSnowflakeDate(s.id)) : null }));
        }

        if (Array.isArray(webhooksData)) {
            data.webhooks = webhooksData.map((w: any) => ({
                ...w,
                created_at: w.id ? String(getSnowflakeDate(w.id)) : null
            }));
        } else {
            data.webhooks = [];
        }

        const totalChannel: any = {
            text: 0,
            voice: 0,
            category: 0,
            announcement: 0,
            announcement_thread: 0,
            public_thread: 0,
            private_thread: 0,
            stage: 0,
            directory: 0,
            forum: 0,
            media: 0,
            all: 0
        };

        if (Array.isArray(channelsData)) {
            totalChannel.all = channelsData.length;
            channelsData.forEach((channel: any) => {
                const typeName = DISCORD_CHANNEL_TYPES[channel.type];
                if (typeName) {
                    totalChannel[typeName]++;
                }
            });

            data.channels = {
                totalChannel,
                data: channelsData.map((channel: any) => ({
                    ...channel,
                    type: {
                        id: channel.type,
                        name: DISCORD_CHANNEL_TYPES[channel.type] || 'unknown'
                    },
                    permission_overwrites: Array.isArray(channel.permission_overwrites) ? channel.permission_overwrites.map((o: any) => {
                        const allowResolved = resolvePermissions(o.allow);
                        const denyResolved = resolvePermissions(o.deny);
                        return {
                            ...o,
                            allow_resolved: { array: allowResolved, string: allowResolved.join(', ') },
                            deny_resolved: { array: denyResolved, string: denyResolved.join(', ') }
                        };
                    }) : channel.permission_overwrites,
                    created_at: channel.id ? String(getSnowflakeDate(channel.id)) : null
                }))
            };
        } else {
            data.channels = {
                totalChannel,
                data: []
            };
        }

        if (clientMemberData) {
            const userData = clientMemberData.user;
            const flagsBadges = resolveFlags(userData?.flags);
            const publicFlagsBadges = resolveFlags(userData?.public_flags);

            const avatarUrl = userData?.avatar
                ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.${userData.avatar.startsWith('a_') ? 'gif' : 'png'}?size=4096`
                : null;
            const bannerUrl = userData?.banner
                ? `https://cdn.discordapp.com/banners/${userData.id}/${userData.banner}.${userData.banner.startsWith('a_') ? 'gif' : 'png'}?size=4096`
                : null;
            const guildAvatarUrl = (guildId && clientMemberData.avatar)
                ? `https://cdn.discordapp.com/guilds/${guildId}/users/${userData.id}/avatars/${clientMemberData.avatar}.${clientMemberData.avatar.startsWith('a_') ? 'gif' : 'png'}?size=4096`
                : null;

            const perms = getMemberPermissions(clientMemberData, data.roles, data, guildId);

            data.client = {
                ...clientMemberData,
                ...perms,
                avatar_url: guildAvatarUrl || avatarUrl,
                banner_url: bannerUrl,
                badges: publicFlagsBadges,
                badges_raw: flagsBadges,
                joined_at: clientMemberData.joined_at ? String(Math.floor(new Date(clientMemberData.joined_at).getTime() / 1000)) : null,
                premium_since: clientMemberData.premium_since ? String(Math.floor(new Date(clientMemberData.premium_since).getTime() / 1000)) : null,
                created_at: userData?.id ? String(getSnowflakeDate(userData.id)) : null
            };
        }

        data.created_at = data.id ? String(getSnowflakeDate(data.id)) : null;

        return { data };
    } catch (e: any) {
        return { error: e.message || 'Something just happened' };
    }
};


const stickerCache = new Map<string, any>();

export const DiscordInfoSticker = async (token: string, q: string) => {
    if (!token || token === 'null') return { error: 'Missing token' };
    if (!q) return { error: 'Missing sticker ID or URL' };

    const match = q.match(/(?:cdn\.discordapp\.com\/stickers\/|discord\.com\/stickers\/)?(\d+)/);
    const stickerId = match ? match[1] : q;

    if (stickerCache.has(stickerId)) return { data: stickerCache.get(stickerId) };

    const botUserAgent = 'DiscordBot (https://github.com/discord-bot, 1.0.0)';
    const headers: any = {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': botUserAgent
    };

    try {
        const url = `https://discord.com/api/v10/stickers/${stickerId}`;
        const req = await fetch(url, { method: 'GET', headers });

        let data: any = null;
        try { data = await req.json(); } catch { }

        if (req.status !== 200) {
            return {
                data: null,
                error: data || { status: req.status, statusText: req.statusText }
            };
        }

        if (data) {
            data.created_at = String(getSnowflakeDate(data.id));
            const ext = data.format_type === 4 ? 'gif' : (data.format_type === 3 ? 'json' : 'png');
            data.url = `https://cdn.discordapp.com/stickers/${data.id}.${ext}`;

            if (data.guild_id && token) {
                const guildRes = await DiscordInfoServer(token, data.guild_id);
                if (guildRes?.data) {
                    data.guild = guildRes.data;
                    data.guild.resultsType = "full";
                } else {
                    try {
                        const previewUrl = `https://discord.com/api/v10/guilds/${data.guild_id}/preview`;
                        const previewReq = await fetch(previewUrl, { method: 'GET', headers });
                        if (previewReq.status === 200) {
                            const previewData: any = await previewReq.json();
                            if (previewData) {
                                previewData.icon_url = previewData.icon ? `https://cdn.discordapp.com/icons/${previewData.id}/${previewData.icon}.${previewData.icon.startsWith('a_') ? 'gif' : 'png'}?size=4096` : null;
                                previewData.splash_url = previewData.splash ? `https://cdn.discordapp.com/splashes/${previewData.id}/${previewData.splash}.png?size=4096` : null;
                                previewData.discovery_splash_url = previewData.discovery_splash ? `https://cdn.discordapp.com/discovery-splashes/${previewData.id}/${previewData.discovery_splash}.png?size=4096` : null;
                                previewData.home_header_url = previewData.home_header ? `https://cdn.discordapp.com/home-headers/${previewData.id}/${previewData.home_header}.png?size=4096` : null;
                                previewData.created_at = String(getSnowflakeDate(previewData.id));
                                data.guild = previewData;
                                data.guild.resultsType = "preview";
                            }
                            else {
                                data.guild = {};
                            }
                        }
                        else {
                            data.guild = {};
                        }
                    } catch { }
                }

                if (!data.user) {
                    try {
                        const guildStickersUrl = `https://discord.com/api/v10/guilds/${data.guild_id}/stickers`;
                        const gsReq = await fetch(guildStickersUrl, { method: 'GET', headers });
                        if (gsReq.status === 200) {
                            const stickers: any[] = (await gsReq.json()) as any;
                            const found = stickers.find(st => st.id === data.id);
                            if (found && found.user) {
                                data.user = found.user;
                            }
                        }
                    } catch { }
                }
            }

            if (data.user) {
                const u = data.user;
                u.created_at = String(getSnowflakeDate(u.id));
                u.avatar_url = u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith('a_') ? 'gif' : 'png'}?size=4096` : null;
            }
            else {
                data.user = {};
            }
            stickerCache.set(stickerId, data);
        }

        return { data };
    } catch (e: any) {
        return { error: e.message || 'Something just happened' };
    }
};

const processDiscordMessage = async (m: any, token?: string) => {
    if (!m) return m;

    if (m.timestamp) {
        m.created_at = String(Math.floor(new Date(m.timestamp).getTime() / 1000));
        delete m.timestamp;
    }
    if (m.hasOwnProperty('edited_timestamp')) {
        if (m.edited_timestamp) {
            m.edited_at = String(Math.floor(new Date(m.edited_timestamp).getTime() / 1000));
        } else {
            m.edited_at = null;
        }
        delete m.edited_timestamp;
    }

    if (Array.isArray(m.sticker_items)) {
        for (let i = 0; i < m.sticker_items.length; i++) {
            const s = m.sticker_items[i];
            const ext = s.format_type === 4 ? 'gif' : (s.format_type === 3 ? 'json' : 'png');
            s.url = `https://cdn.discordapp.com/stickers/${s.id}.${ext}`;

            if (token) {
                const res = await DiscordInfoSticker(token, s.id);
                if (res?.data) {
                    m.sticker_items[i] = { ...s, ...res.data };
                }
            }
        }
    }
    else {
        m.sticker_items = [];
    }

    const emojiRegex = /<(a?):(\w+):(\d+)>/g;
    const emojiItems = [];
    let match;
    while ((match = emojiRegex.exec(m.content)) !== null) {
        const animated = match[1] === 'a';
        const name = match[2];
        const id = match[3];
        emojiItems.push({
            id,
            name,
            animated,
            url: `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=4096`
        });
    }
    m.emoji_items = emojiItems;

    const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
    const bareUrlRegex = /https?:\/\/[^\s<]+[^<.,:;"')\]\s]/g;
    const hyperlinkItems: any[] = [];
    const seenUrls = new Set();

    if (m.content) {
        let mdMatch;
        while ((mdMatch = mdLinkRegex.exec(m.content)) !== null) {
            const alt = mdMatch[1];
            const url = mdMatch[2];
            const normalizedUrl = url.replace(/\/$/, '');
            const richContent = m.embeds?.find((e: any) => e.url && e.url.replace(/\/$/, '') === normalizedUrl);
            hyperlinkItems.push({
                alt,
                url,
                richContent: richContent || null
            });
            seenUrls.add(url);
        }

        const bareUrlRegex = /(?:^|\s)(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
        let bareMatch;
        while ((bareMatch = bareUrlRegex.exec(m.content)) !== null) {
            const url = bareMatch[1];
            if (seenUrls.has(url)) continue;
            const normalizedUrl = url.replace(/\/$/, '');
            const richContent = m.embeds?.find((e: any) => e.url && e.url.replace(/\/$/, '') === normalizedUrl);
            hyperlinkItems.push({
                alt: null,
                url,
                richContent: richContent || null
            });
            seenUrls.add(url);
        }
    }
    m.hyperlink_items = hyperlinkItems;

    if (m.author && m.author.id) {
        m.author.created_at = String(getSnowflakeDate(m.author.id));
    }

    return m;
};

export const DiscordInfoMessages = async (token: string, channelId: string, sort: 'asc' | 'desc' = 'desc', limit: number = 50) => {
    if (!token || token === 'null') return { error: 'Missing token' };
    if (!channelId) return { error: 'Missing channelId' };

    const botUserAgent = 'DiscordBot (https://github.com/discord-bot, 1.0.0)';
    const headers: any = {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': botUserAgent
    };

    try {
        let url = `https://discord.com/api/v10/channels/${channelId}/messages`;
        const params: string[] = [];

        if (sort === 'asc') params.push('after=0');
        if (limit) params.push(`limit=${limit}`);

        if (params.length > 0) url += '?' + params.join('&');

        const req = await fetch(url, { method: 'GET', headers });

        let data: any = null;
        try { data = await req.json(); } catch { }

        if (req.status !== 200) {
            return {
                data: null,
                error: data || { status: req.status, statusText: req.statusText }
            };
        }

        if (Array.isArray(data)) {
            data = await Promise.all(data.map(m => processDiscordMessage(m, token)));
        }

        return { limit, data };
    } catch (e: any) {
        return { error: e.message || 'Something just happened' };
    }
};

export const DiscordInfoMessage = async (token: string, channelId: string, messageId: string) => {
    if (!token || token === 'null') return { error: 'Missing token' };
    if (!channelId) return { error: 'Missing channelId' };
    if (!messageId) return { error: 'Missing messageId' };

    const botUserAgent = 'DiscordBot (https://github.com/discord-bot, 1.0.0)';
    const headers: any = {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': botUserAgent
    };

    try {
        const url = `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`;
        const req = await fetch(url, { method: 'GET', headers });

        let data: any = null;
        try { data = await req.json(); } catch { }

        if (req.status !== 200) {
            return {
                data: null,
                error: data || { status: req.status, statusText: req.statusText }
            };
        }

        if (data) {
            data = await processDiscordMessage(data, token);
        }

        return { data };
    } catch (e: any) {
        return { error: e.message || 'Something just happened' };
    }
};

export const DiscordInfoInvite = async (token: string | null, q: string, guildId?: string) => {
    // Extract invite code from URL or bare code
    const match = q?.match(/(?:discord\.gg\/|discord\.com\/invite\/)([a-zA-Z0-9-]+)|^([a-zA-Z0-9-]+)$/);
    const code = match?.[1] ?? match?.[2] ?? null;

    // Validate: Discord invite codes are alphanumeric + hyphens, 2–30 chars
    if (!guildId && (!code || !/^[a-zA-Z0-9-]{2,30}$/.test(code))) {
        return { error: "Invalid or missing invite code" };
    }

    const headers: any = {
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)'
    };
    if (token) headers['Authorization'] = `Bot ${token}`;

    try {
        const url = guildId
            ? `https://discord.com/api/v10/guilds/${guildId}/invites`
            : `https://discord.com/api/v10/invites/${code}?with_counts=true&with_expiration=true`;

        const req = await fetch(url, { method: 'GET', headers });
        let data: any = null;
        try { data = await req.json(); } catch { }

        if (req.status !== 200) {
            return {
                data: null,
                error: data || { status: req.status, statusText: req.statusText }
            };
        }

        if (guildId && Array.isArray(data)) {
            const invite = data.find((i: any) => i.code === code);
            if (!invite) return { data: null, error: 'Invite not found in guild' };
            data = invite;
        }

        if (data) {
            if (data.id) {
                data.created_at = String(getSnowflakeDate(data.id));
            }
            if (data.expires_at) {
                data.expires_at = String(Math.floor(new Date(data.expires_at).getTime() / 1000));
            }
        }

        if (data && data.guild) {
            const g = data.guild;
            const guildId = g.id;

            data.guild.icon_url = g.icon ? `https://cdn.discordapp.com/icons/${guildId}/${g.icon}.${g.icon.startsWith('a_') ? 'gif' : 'png'}?size=4096` : null;
            data.guild.splash_url = g.splash ? `https://cdn.discordapp.com/splashes/${guildId}/${g.splash}.png?size=4096` : null;
            data.guild.banner_url = g.banner ? `https://cdn.discordapp.com/banners/${guildId}/${g.banner}.${g.banner.startsWith('a_') ? 'gif' : 'png'}?size=4096` : null;
            data.guild.created_at = guildId ? String(getSnowflakeDate(guildId)) : null;
        }

        if (data && data.inviter) {
            const u = data.inviter;
            const userId = u.id;

            data.inviter.avatar_url = u.avatar ? `https://cdn.discordapp.com/avatars/${userId}/${u.avatar}.${u.avatar.startsWith('a_') ? 'gif' : 'png'}?size=4096` : null;
            data.inviter.banner_url = u.banner ? `https://cdn.discordapp.com/banners/${userId}/${u.banner}.${u.banner.startsWith('a_') ? 'gif' : 'png'}?size=4096` : null;
            data.inviter.badges = resolveFlags(u.public_flags);
            data.inviter.badges_raw = resolveFlags(u.flags);
            data.inviter.created_at = userId ? String(getSnowflakeDate(userId)) : null;
        }

        return { data };
    } catch (e: any) {
        return { error: e.message || 'Something just happened' };
    }
};

export const DiscordListInvite = async (token: string, guildId: string, limit: number = 10, type: string = 'all', authorId: string = '') => {
    if (!token || token === 'null') return { error: 'Missing token' };
    if (!guildId) return { error: 'Missing guildId' };

    const headers: any = {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)'
    };

    try {
        const url = `https://discord.com/api/v10/guilds/${guildId}/invites`;
        const req = await fetch(url, { method: 'GET', headers });

        let data: any = null;
        try { data = await req.json(); } catch { }

        if (req.status !== 200) {
            return {
                data: null,
                error: data || { status: req.status, statusText: req.statusText }
            };
        }

        if (Array.isArray(data)) {
            data = data.map((invite: any) => {
                const enriched = { ...invite };
                if (enriched.inviter) {
                    const u = enriched.inviter;
                    enriched.inviter.avatar_url = u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith('a_') ? 'gif' : 'png'}?size=4096` : null;
                    enriched.inviter.banner_url = u.banner ? `https://cdn.discordapp.com/banners/${u.id}/${u.banner}.${u.banner.startsWith('a_') ? 'gif' : 'png'}?size=4096` : null;
                    enriched.inviter.badges = resolveFlags(u.public_flags);
                    enriched.inviter.badges_raw = resolveFlags(u.flags);
                    enriched.inviter.created_at = u.id ? String(getSnowflakeDate(u.id)) : null;
                }
                if (enriched.created_at) {
                    enriched.created_at = String(Math.floor(new Date(enriched.created_at).getTime() / 1000));
                }
                if (enriched.expires_at) {
                    enriched.expires_at = String(Math.floor(new Date(enriched.expires_at).getTime() / 1000));
                }
                return enriched;
            });

            const totalInvites = data.length;

            if (authorId) {
                data = data.filter((i: any) => i.inviter?.id === authorId);
            }

            const types = type.split(',').map(t => t.trim().toLowerCase());
            const filterTypes = ['temporary', 'permanent', 'has_expire', 'user', 'bot'];
            const hasFilterType = types.some(t => filterTypes.includes(t));

            if (!types.includes('all') && hasFilterType) {
                data = data.filter((i: any) => {
                    let keep = false;
                    if (types.includes('temporary') && i.temporary) keep = true;
                    if (types.includes('permanent') && !i.temporary && i.max_age === 0) keep = true;
                    if (types.includes('has_expire') && !!i.expires_at) keep = true;
                    if (types.includes('user') && i.inviter && !i.inviter.bot) keep = true;
                    if (types.includes('bot') && i.inviter && i.inviter.bot) keep = true;
                    return keep;
                });
            }

            for (const t of types) {
                if (t === 'oldest') {
                    data.sort((a: any, b: any) => Number(a.created_at || 0) - Number(b.created_at || 0));
                } else if (t === 'newest') {
                    data.sort((a: any, b: any) => Number(b.created_at || 0) - Number(a.created_at || 0));
                }
            }

            const sliceLimit = limit === -1 ? data.length : limit;
            data = data.slice(0, sliceLimit);

            return {
                invitesCount: totalInvites,
                limit,
                data
            };
        }

        return { data };
    } catch (e: any) {
        return { error: e.message || 'Something just happened' };
    }
};

export const DiscordInfoChannel = async (token: string, channelId: string, guildId?: string) => {
    if (!token || token === 'null') return { error: 'Missing token' };
    if (!channelId) return { error: 'Missing channelId' };

    const headers: any = {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)'
    };

    try {
        const url = guildId
            ? `https://discord.com/api/v10/guilds/${guildId}/channels`
            : `https://discord.com/api/v10/channels/${channelId}`;

        const req = await fetch(url, { method: 'GET', headers });
        let data: any = null;
        try { data = await req.json(); } catch { }

        if (req.status !== 200) {
            return {
                data: null,
                error: data || { status: req.status, statusText: req.statusText }
            };
        }

        if (guildId && Array.isArray(data)) {
            const channel = data.find((c: any) => c.id === channelId);
            if (!channel) return { data: null, error: 'Channel not found in guild' };
            data = channel;
        }

        if (data && !Array.isArray(data)) {
            data.type = {
                id: data.type,
                name: DISCORD_CHANNEL_TYPES[data.type] || 'unknown'
            };

            if (data.permission_overwrites) {
                data.permission_overwrites = data.permission_overwrites.map((o: any) => {
                    const allowResolved = resolvePermissions(o.allow);
                    const denyResolved = resolvePermissions(o.deny);
                    return {
                        ...o,
                        allow_resolved: {
                            array: allowResolved,
                            string: allowResolved.join(', ')
                        },
                        deny_resolved: {
                            array: denyResolved,
                            string: denyResolved.join(', ')
                        }
                    };
                });
            }
            data.created_at = data.id ? String(getSnowflakeDate(data.id)) : null;
        }

        return { data };
    } catch (e: any) {
        return { error: e.message || 'Something just happened' };
    }
};

export const DiscordInfoRole = async (token: string, roleId: string, guildId: string) => {
    if (!token || token === 'null') return { error: 'Missing token' };
    if (!roleId) return { error: 'Missing roleId' };
    if (!guildId) return { error: 'Missing guildId' };

    const headers: any = {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)'
    };

    try {
        const urlRoles = `https://discord.com/api/v10/guilds/${guildId}/roles`;
        const urlCounts = `https://discord.com/api/v9/guilds/${guildId}/roles/member-counts`;

        const [rolesReq, countsReq] = await Promise.all([
            fetch(urlRoles, { method: 'GET', headers }),
            fetch(urlCounts, { method: 'GET', headers })
        ]);

        let rolesData: any = [];
        let countsData: any = [];

        try { if (rolesReq.status === 200) rolesData = await rolesReq.json(); } catch { }
        try { if (countsReq.status === 200) countsData = await countsReq.json(); } catch { }

        if (rolesReq.status !== 200) {
            return {
                data: null,
                error: rolesData || { status: rolesReq.status, statusText: rolesReq.statusText }
            };
        }

        let data: any = null;
        if (Array.isArray(rolesData)) {
            const role = rolesData.find((r: any) => r.id === roleId);
            if (!role) return { data: null, error: 'Role not found' };
            data = role;
        }

        if (data && !Array.isArray(data)) {
            // Access member count directly from the object using roleId as key
            const membersCount = (countsData && typeof countsData === 'object') ? (countsData[roleId] || 0) : 0;

            const resolvedArray = resolvePermissions(data.permissions);
            data = {
                ...data,
                membersCount,
                permissions_resolved: {
                    array: resolvedArray,
                    string: resolvedArray.join(', ')
                },
                created_at: data.id ? String(getSnowflakeDate(data.id)) : null
            };
        }

        return { data };
    } catch (e: any) {
        return { error: e.message || 'Something just happened' };
    }
};

export const DiscordListWebhooks = async (token: string, guildId: string, type: string = 'all') => {
    if (!token || token === 'null') return { error: 'Missing token' };
    if (!guildId) return { error: 'Missing guildId' };

    const headers: any = {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)'
    };

    try {
        const url = `https://discord.com/api/v10/guilds/${guildId}/webhooks`;
        const req = await fetch(url, { method: 'GET', headers });
        let data: any = null;
        try { data = await req.json(); } catch { }

        if (req.status !== 200) {
            return {
                data: null,
                error: data || { status: req.status, statusText: req.statusText }
            };
        }

        if (Array.isArray(data)) {
            data = data.map((w: any) => ({
                ...w,
                created_at: w.id ? String(getSnowflakeDate(w.id)) : null
            }));

            const types = type.split(',').map(t => t.trim().toLowerCase());
            for (const t of types) {
                if (t === 'oldest') {
                    data.sort((a: any, b: any) => Number(a.created_at || 0) - Number(b.created_at || 0));
                } else if (t === 'newest') {
                    data.sort((a: any, b: any) => Number(b.created_at || 0) - Number(a.created_at || 0));
                }
            }
        }

        return { data };
    } catch (e: any) {
        return { error: e.message || 'Something just happened' };
    }
};

export const ImgurPost = async (query: string, refresh_auth: boolean = false): Promise<any> => {
    if (!query) return null;

    if (refresh_auth || !keyimgur) {
        keyimgur = await imgurKey();
    }

    try {
        const req = await request(`https://api.imgur.com/post/v1/posts/t/${encodeURIComponent(query)}?client_id=${keyimgur}&include=cover&page=1&sort=-time`, { headers: { ...commonHeaders }, timeout: 90000 });
        if (req.statusCode === 401 || req.statusCode === 400) return await ImgurPost(query, true);
        const res: any = await req.json();
        return { data: res?.posts || null };
    }
    catch {
        return null;
    }
}

export const Klipy = async function Klipy(que: string, type?: string) {
    if (!que) return null;

    const getQueryType = (t?: string) => {
        if (t === 'sticker') return 'stickers';
        if (t === 'clip') return 'clips';
        if (t === 'emoji') return 'emojis';
        if (t === 'ai_gif') return 'ai-gifs';
        return 'gifs';
    };

    try {
        const queryType = getQueryType(type);
        const [req, req2, req3] = await Promise.all([
            request(`https://api.klipy.com/api/v1/${process.env.KLIPY}/${queryType}/search?q=${encodeURIComponent(que)}&locale=en-US&per_page=100`, {
                headers: {
                    ...commonHeaders,
                    'Referer': 'https://klipy.com',
                    'Origin': 'https://klipy.com'
                },
                useH2: true
            }),
            request(`https://api.klipy.com/api/v1/${process.env.KLIPY}/search-suggestions/${encodeURIComponent(que)}?limit=50`, {
                headers: {
                    ...commonHeaders,
                    'Referer': 'https://klipy.com',
                    'Origin': 'https://klipy.com'
                },
                useH2: true
            }),
            request(`https://api.klipy.com/api/v1/${process.env.KLIPY}/autocomplete/${encodeURIComponent(que)}?limit=50`, {
                headers: {
                    ...commonHeaders,
                    'Referer': 'https://klipy.com',
                    'Origin': 'https://klipy.com'
                },
                useH2: true
            })
        ]);

        let res2: any;
        let res3: any;
        try {
            res2 = await req2.json();
        }
        catch { }
        try {
            res3 = await req3.json();
        }
        catch { }

        if (req.statusCode === 200) {
            const res: any = await req.json();
            return {
                suggestion: res2?.data || null,
                autocomplete: res3?.data || null,
                data: res?.data?.data || null
            };
        }

        return { error: `${req.statusCode} - Can't process this` };
    } catch (e) {
        console.error(e);
        return null;
    }
}

export const infoKlipy = async function infoKlipy(url: string) {
    if (!url) return null;

    try {
        const urlObj = new URL(url);
        if (!urlObj.hostname.endsWith('klipy.com')) {
            return { error: 'Invalid Klipy URL' };
        }

        const klipyPath = url.split('klipy.com/')[1];
        if (!klipyPath) {
            return { error: 'Invalid Klipy URL path' };
        }

        const req = await request(`https://api.klipy.com/api/v1/${process.env.KLIPY}/${klipyPath}`, {
            headers: {
                ...commonHeaders
            },
            useH2: true
        });

        if (req.statusCode === 404) {
            return { error: `${req.statusCode} - Not found` };
        }

        if (req.statusCode === 200) {
            const res: any = await req.json();
            return { data: res?.data || null };
        }

        return { error: `${req.statusCode} - Can't process this` };
    } catch (e) {
        console.error(e);
        return null;
    }
}


export const TimezoneInfo = async function TimezoneInfo(q: string) {
    if (!q) return { error: "Missing parameter 'q'" };

    const timezones = Intl.supportedValuesOf('timeZone');
    const query = q.toLowerCase().trim().replace(/\s+/g, '_');
    let exactMatches: string[] = [];
    let softMatches: string[] = [];
    const d = new Date();

    const gmtUtcMatch = query.match(/^(?:gmt|utc)\s*([+-]?)\s*(\d{1,2})(?::?(\d{2}))?$/);

    if (gmtUtcMatch) {
        const sign = gmtUtcMatch[1] === '-' ? -1 : 1;
        const hrs = parseInt(gmtUtcMatch[2], 10);
        const mins = gmtUtcMatch[3] ? parseInt(gmtUtcMatch[3], 10) : 0;
        const targetOffsetMinutes = sign * (hrs * 60 + mins);

        softMatches = timezones.filter(tz => {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                timeZoneName: 'longOffset',
            });
            const parts = formatter.formatToParts(d);
            const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT';

            let gmtStr = offsetPart.replace('GMT', '');
            if (gmtStr === '') gmtStr = '+00:00';

            const s = gmtStr.startsWith('-') ? -1 : 1;
            const m = gmtStr.match(/([+-])?(\d{2}):?(\d{2})/);
            let tzOffsetMinutes = 0;
            if (m) {
                tzOffsetMinutes = s * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
            }
            return tzOffsetMinutes === targetOffsetMinutes;
        });

        if (softMatches.length > 0) {
            softMatches.sort((a, b) => {
                const aPri = (a.startsWith('Antarctica/') || a.startsWith('Etc/')) ? 1 : 0;
                const bPri = (b.startsWith('Antarctica/') || b.startsWith('Etc/')) ? 1 : 0;
                return aPri - bPri;
            });
            exactMatches = [softMatches[0]];
            softMatches = softMatches.slice(1);
        }
    } else {
        exactMatches = timezones.filter(tz => tz.toLowerCase() === query || tz.toLowerCase().split('/').pop() === query);
        softMatches = timezones.filter(tz => tz.toLowerCase().includes(query));
    }

    const matches = exactMatches.length > 0 ? exactMatches.concat(softMatches.filter(tz => !exactMatches.includes(tz))) : softMatches;

    if (matches.length === 0) {
        return { error: "Timezone not found" };
    }

    const name = matches[0];
    const similarName = matches.slice(1);

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: name,
        timeZoneName: 'longOffset',
    });

    const dJan = new Date(d.getFullYear(), 0, 1);
    const dJul = new Date(d.getFullYear(), 6, 1);

    function getOffsetMinutes(date: Date) {
        const parts = formatter.formatToParts(date);
        const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT';
        let str = offsetPart.replace('GMT', '');
        if (str === '') str = '+00:00';

        const sign = str.startsWith('-') ? -1 : 1;
        const match = str.match(/([+-])?(\d{2}):?(\d{2})/);
        if (!match) return 0;
        return sign * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10));
    }

    const dNow = new Date();
    const currentOffsetMinutes = getOffsetMinutes(dNow);

    const LocaleDate = dNow.toLocaleDateString('en-US', { timeZone: name });
    const LocaleTime = dNow.toLocaleTimeString('en-US', { timeZone: name });
    const Locale = dNow.toLocaleString('en-US', { timeZone: name });
    const dateFormatted = dNow.toLocaleDateString('en-US', { timeZone: name, weekday: 'short', year: 'numeric', month: 'short', day: '2-digit' });

    const formatterRaw = new Intl.DateTimeFormat('en-US', {
        timeZone: name,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    });
    const partsRaw = formatterRaw.formatToParts(dNow);
    const p: any = {};
    partsRaw.forEach(part => { p[part.type] = part.value; });

    const isoOffsetStr = (currentOffsetMinutes >= 0 ? '+' : '-') +
        String(Math.abs(Math.floor(currentOffsetMinutes / 60))).padStart(2, '0') + ':' +
        String(Math.abs(currentOffsetMinutes % 60)).padStart(2, '0');

    const isoLocal = `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${isoOffsetStr}`;
    const utcLocal = dNow.toLocaleDateString('en-US', { timeZone: name, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) +
        ', ' + p.hour + ':' + p.minute + ':' + p.second + ' GMT' + isoOffsetStr;

    return {
        data: {
            name,
            conversion: {
                LocaleDate,
                LocaleTime,
                Locale,
                Date: dateFormatted,
                ISO: isoLocal,
                UTC: utcLocal,
                Time: `${p.hour}:${p.minute}:${p.second}`
            },
            offsetTimeM: String(currentOffsetMinutes),
            offsetTimeS: String(currentOffsetMinutes * 60),
            offsetTimeMS: String(currentOffsetMinutes * 60 * 1000),
            similarName
        }
    };
}

export const PatreonSearch = async (query: string): Promise<any> => {
    if (!query) return null;

    try {
        const res = await request(`https://www.patreon.com/api/search?q=${encodeURIComponent(query)}`, {
            headers: {
                ...commonHeaders
            }
        });

        const response = await res.json();

        if (!response?.data?.[0]) {
            return { data: null }
        }

        return {
            data: response.data
        }
    }
    catch {
        return null;
    }
}

export const Trakteer = async (query: string): Promise<any> => {
    if (!query) return null;

    try {
        const res = await request(`https://api.trakteer.id/v3/discover/search?limit=10&keywords=${encodeURIComponent(query)}`, {
            headers: {
                ...commonHeaders
            }
        });

        const response = await res.json();

        if (!response?.result?.data?.[0]) {
            return { data: null }
        }

        return {
            data: response.result.data
        }
    }
    catch {
        return null;
    }
}

export const IMDB = async (query: string): Promise<any> => {
    if (!query) return null;

    try {
        const resBody: any = { "includeAdult": true, "isExactMatch": false, "locale": "en-US", "numResults": 5, "originalTitleText": true, "searchTerm": query, "skipHasExact": true, "typeFilter": "TITLE" };
        const exter: any = { "persistedQuery": { "sha256Hash": "b6a7c673cfb2d2cc8d78570a7d5f6e0d65601021fcbbdc71cde7a53468641fa1", "version": 1 } };
        const res = await request(`https://caching.graphql.imdb.com/?operationName=FindPageSearch&variables=${encodeURIComponent(JSON.stringify(resBody))}&extensions=${encodeURIComponent(JSON.stringify(exter))}`, {
            headers: {
                ...commonHeaders,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        const response = await res.json();

        const finalres: any = response?.data?.results?.edges;

        return {
            data: finalres.map((a: any) => {
                const { __typename, ...node } = a?.node?.entity;
                return { url: "https://www.imdb.com/title/" + node?.id, ...node };
            })
        }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const ImgflipSearch = async (query: string): Promise<any> => {
    if (!query) return null;

    const resolveUrl = (raw: string | null | undefined): string => {
        if (!raw) return '';
        if (raw.startsWith('//')) return `https:${raw}`;
        if (raw.startsWith('/')) return `https://imgflip.com${raw}`;
        return raw;
    };

    const hasClass = (el: any, name: string): boolean =>
        el.getAttribute?.('class')?.split(' ').includes(name) ?? false;

    const text = (el: any): string =>
        String(el?.textContent ?? '').trim();

    // Parse subtitle string into structured metadata per section
    const parseMeta = (section: string, subtitle: string, description: string) => {
        switch (section) {
            case 'memes': {
                // e.g. "meme template, 200,000+ captions"
                const captions = subtitle.match(/([\d,]+\+?)\s+captions?/)?.[1] ?? null;
                return { subtitle: captions };
            }
            case 'images': {
                // e.g. "user-captioned meme, 3,132 views" / "user-generated gif, 22,183 views"
                const type = subtitle.split(',')[0]?.trim() ?? null;
                const views = subtitle.match(/([\d,]+)\s+views?/)?.[1] ?? null;
                return {
                    type,
                    views,
                    description: description || null,
                };
            }
            case 'tags': {
                // e.g. "view all 12,277 images tagged \"anime\""
                const count = subtitle.match(/([\d,]+)\s+images?/)?.[1] ?? null;
                return { count };
            }
            case 'streams': {
                // e.g. "60,773 submitted images"
                const count = subtitle.match(/([\d,]+)\s+submitted/)?.[1] ?? null;
                return {
                    count,
                    description: description || null,
                };
            }
            case 'users': {
                // e.g. "joined Aug 17 2014, 2,415 creations, 41 comments"
                const joined = subtitle.match(/joined\s+([^,]+)/)?.[1]?.trim() ?? null;
                const creations = subtitle.match(/([\d,]+)\s+creations?/)?.[1] ?? null;
                const comments = subtitle.match(/([\d,]+)\s+comments?/)?.[1] ?? null;
                return {
                    joined,
                    creations,
                    comments,
                };
            }
            default:
                return { subtitle };
        }
    };

    try {
        const res = await request(`https://imgflip.com/search?q=${encodeURIComponent(query)}`, {
            headers: { ...commonHeaders }
        });

        const html: string = await res.text;

        const { document } = parseHTML(html);
        const container = document.querySelector('#s-results');
        if (!container) return null;

        const data: Record<string, any[] | null> = {
            memes: null,
            images: null,
            tags: null,
            streams: null,
            users: null,
        };
        let currentSection = 'unknown';

        for (const child of container.children) {
            // Section heading — direct H2 or H2 inside a wrapper div (.s-results-title-wrap)
            const heading = child.tagName === 'H2'
                ? child
                : child.querySelector?.('h2');

            if (heading) {
                currentSection = text(heading).toLowerCase();
                if (data[currentSection] === null) data[currentSection] = [];
                continue;
            }

            // Skip non-result elements (buttons, dropdowns, etc.)
            if (!hasClass(child, 's-result') && !hasClass(child, 's-more-results')) {
                continue;
            }

            // Collect anchors — direct .s-result or nested inside .s-more-results
            const anchors: any[] = hasClass(child, 's-result')
                ? [child]
                : [...child.querySelectorAll('a.s-result')];

            for (const el of anchors) {
                const url = resolveUrl(el.getAttribute('href'));
                const title = text(el.querySelector('.s-result-title'));
                const subtitle = text(el.querySelector('.s-result-subtitle'));
                const rawCover = el.querySelector('img')?.getAttribute('src');
                const isGif = el.getAttribute('href')?.includes('/gif/') ?? false;
                const cover = resolveUrl(rawCover);
                const full_cover = isGif
                    ? cover.replace('/2/', '/').replace(/\.jpg$/, '.mp4')
                    : cover.replace('/2/', '/');
                const description = text(el.querySelector('.s-result-description'));

                const meta = parseMeta(currentSection, subtitle, description);

                const noCover = currentSection === 'users' || currentSection === 'streams';
                const entry: Record<string, any> = noCover
                    ? { url, title, ...meta }
                    : { url, title, cover: cover || null, full_cover: full_cover || null, ...meta };

                if (Array.isArray(data[currentSection])) {
                    data[currentSection]!.push(entry);
                }
            }
        }

        return { data };
    } catch {
        return null;
    }
};

export const OtoDB = async (query: string): Promise<any> => {
    if (!query) return null;

    try {
        const res = await request(
            `https://otodb.net/work/__data.json?query=${encodeURIComponent(query)}`,
            {
                headers: {
                    ...commonHeaders
                }
            }
        );

        const json = await res.json();

        const pageNode = json.nodes?.[1];
        if (!pageNode?.data) return { data: null };

        const data: any[] = pageNode.data;

        function resolve(index: number): any {
            const val = data[index];

            if (Array.isArray(val)) return val.map((i: number) => resolve(i));

            if (val !== null && typeof val === 'object') {
                const resolved: Record<string, any> = {};
                for (const [key, idx] of Object.entries(val)) {
                    resolved[key] = resolve(idx as number);
                }
                return resolved;
            }

            return val;
        }

        const root = data[0];
        const results = resolve(root.results);

        if (!results?.items?.[0]) return { data: null };

        return { data: results.items };
    } catch {
        return null;
    }
};

export const DiscordVoice = async (token: string, guildId: string, action: string, payload: any) => {

    if (action === 'setstatus') {
        const { channelId, content } = payload;
        const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/voice-status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)'
            },
            body: JSON.stringify({ status: content || '' })
        });

        if (!res.ok) {
            const body = await res.text();
            let parsed: any;
            try { parsed = JSON.parse(body); } catch { parsed = { message: body }; }
            return { error: parsed };
        }

        return {
            data: {
                channelId: channelId || null,
                content: content || null
            }
        };
    }

    if (!token || !guildId || !action) return { error: 'Missing required parameters' };

    const modifyMember = async (userId: string, data: any) => {
        const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'DiscordBot (https://github.com/discord-bot, 1.0.0)'
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const body = await res.text();
            let parsed: any;
            try { parsed = JSON.parse(body); } catch { parsed = { message: body }; }
            const err: any = new Error(parsed.message || 'Failed to modify member');
            err.json = parsed;
            err.status = res.status;
            throw err;
        }
        const body = res.status === 204 ? {} : await res.json();
        return { status: res.status, data: body };
    };

    const formatMemberData = (m: any) => {
        const { guild: _g, ...member } = m;
        const { guild: _vg, member: _vm, ...voiceState } = m.voice;
        return { member, voiceState };
    };

    try {
        const { getOrCreatePlayer } = await import('./musicPlayer.js');
        const { client } = await getOrCreatePlayer(token);
        const guild = await client.guilds.fetch(guildId);

        const formatMemberData = (m: any) => {
            // Deep clone to ensure old and new data are independent
            // We use JSON.parse/stringify to get a clean slice of the current state
            return JSON.parse(JSON.stringify({ member: m, voiceState: m.voice }));
        };

        const buildAllResult = (action: string, channelId: string, oldData: any[], results: PromiseSettledResult<any>[], totalVoiceMembers: number, excludeAuthors: string[], extra?: Record<string, any>) => {
            const newData = oldData.map((old, i) => {
                const result = results[i];
                const formatted = JSON.parse(JSON.stringify(old));
                if (result.status === 'fulfilled') {
                    const apiData = result.value.data;
                    if (apiData) {
                        if (apiData.deaf !== undefined) formatted.voiceState.serverDeaf = apiData.deaf;
                        if (apiData.mute !== undefined) formatted.voiceState.serverMute = apiData.mute;
                    }
                    if (action === 'kickall' || action === 'kick') {
                        formatted.voiceState.channelId = null;
                    }
                    if (action === 'moveall' && extra?.toChannelId) {
                        formatted.voiceState.channelId = extra.toChannelId;
                    }
                }
                return formatted;
            });

            return {
                data: {
                    action,
                    channelId,
                    excludeAuthors: excludeAuthors,
                    usersCount: totalVoiceMembers,
                    affectedCount: results.length,
                    success: results.filter(r => r.status === 'fulfilled').length,
                    failed: results.filter(r => r.status === 'rejected').length,
                    data: [oldData, newData],
                    ...extra
                }
            };
        };

        if (['deafen', 'undeafen', 'mute', 'unmute', 'kick', 'move'].includes(action)) {
            const { userId } = payload;
            if (!userId) return { error: 'Missing valid parameter: userId' };

            const memberObj = await guild.members.fetch(userId);
            if (!memberObj.voice.channelId) {
                return { error: { message: "Target user is not connected to voice.", code: 40032 } };
            }
            const oldData = formatMemberData(memberObj);

            let result: any;
            if (action === 'deafen') result = await modifyMember(userId, { deaf: true });
            else if (action === 'undeafen') result = await modifyMember(userId, { deaf: false });
            else if (action === 'mute') result = await modifyMember(userId, { mute: true });
            else if (action === 'unmute') result = await modifyMember(userId, { mute: false });
            else if (action === 'kick') result = await modifyMember(userId, { channel_id: null });
            else if (action === 'move') {
                const { toChannelId } = payload;
                if (!toChannelId) return { error: 'Missing valid parameter: toChannelId' };
                result = await modifyMember(userId, { channel_id: toChannelId });
            }

            // Construct the updated state in the same structure
            const newData = formatMemberData(memberObj);
            if (result.data) {
                if (result.data.deaf !== undefined) newData.voiceState.serverDeaf = result.data.deaf;
                if (result.data.mute !== undefined) newData.voiceState.serverMute = result.data.mute;
            }
            if (action === 'kick') {
                newData.voiceState.channelId = null;
            }
            if (action === 'move') {
                newData.voiceState.channelId = payload.toChannelId;
            }

            return {
                data: {
                    status: true,
                    action,
                    userId,
                    data: [oldData, newData],
                }
            };
        }

        const { channelId } = payload;
        if (!channelId) return { error: 'Missing valid parameter: channelId' };

        const channel: any = await guild.channels.fetch(channelId);
        if (!channel || !channel.isVoiceBased()) return { error: 'Invalid voice channel' };

        if (action === 'list') {
            const membersCount = channel.members.size;
            const membersList = channel.members.map((m: any) => {
                const { guild: _g, ...member } = m;
                const { guild: _vg, member: _vm, ...voiceState } = m.voice;
                return { member, voiceState };
            });
            return {
                data: {
                    usersCount: membersCount,
                    data: membersList,
                    ...channel
                }
            };
        }

        const authorIds = (payload.authorId || '').split(',').map((id: string) => id.trim()).filter(Boolean);

        if (action === 'muteall') {
            const members = [...channel.members.values()].filter((member: any) => !authorIds.includes(member.id));
            const oldData = members.map(formatMemberData);
            const results = await Promise.allSettled(members.map((member: any) => modifyMember(member.id, { mute: true })));
            return buildAllResult('muteall', channelId, oldData, results, channel.members.size, authorIds);
        }

        if (action === 'unmuteall') {
            const members = [...channel.members.values()].filter((member: any) => !authorIds.includes(member.id));
            const oldData = members.map(formatMemberData);
            const results = await Promise.allSettled(members.map((member: any) => modifyMember(member.id, { mute: false })));
            return buildAllResult('unmuteall', channelId, oldData, results, channel.members.size, authorIds);
        }

        if (action === 'deafall') {
            const members = [...channel.members.values()].filter((member: any) => !authorIds.includes(member.id));
            const oldData = members.map(formatMemberData);
            const results = await Promise.allSettled(members.map((member: any) => modifyMember(member.id, { deaf: true })));
            return buildAllResult('deafall', channelId, oldData, results, channel.members.size, authorIds);
        }

        if (action === 'undeafall') {
            const members = [...channel.members.values()].filter((member: any) => !authorIds.includes(member.id));
            const oldData = members.map(formatMemberData);
            const results = await Promise.allSettled(members.map((member: any) => modifyMember(member.id, { deaf: false })));
            return buildAllResult('undeafall', channelId, oldData, results, channel.members.size, authorIds);
        }

        if (action === 'kickall') {
            const members = [...channel.members.values()].filter((member: any) => !authorIds.includes(member.id));
            const oldData = members.map(formatMemberData);
            const results = await Promise.allSettled(members.map((member: any) => modifyMember(member.id, { channel_id: null })));
            return buildAllResult('kickall', channelId, oldData, results, channel.members.size, authorIds);
        }

        if (action === 'moveall') {
            const { toChannelId } = payload;
            if (!toChannelId) return { error: 'Missing valid parameter: toChannelId' };
            const members = [...channel.members.values()].filter((member: any) => !authorIds.includes(member.id));
            const oldData = members.map(formatMemberData);
            const results = await Promise.allSettled(members.map((member: any) => modifyMember(member.id, { channel_id: toChannelId })));
            return buildAllResult('moveall', channelId, oldData, results, channel.members.size, authorIds, { toChannelId });
        }

        return { error: 'Unknown action' };
    } catch (e: any) {
        return { error: e.json ?? { message: e.message } };
    }
};

export const Audiomack = async function Audiomack(que: string, type: string = 'songs', limits: number = 30): Promise<any> {
    if (!que) return null;

    let searchType = type.toLowerCase();
    if (searchType === 'song' || searchType === 'songs') searchType = 'songs';
    else if (searchType === 'album' || searchType === 'albums') searchType = 'albums';
    else if (searchType === 'playlist' || searchType === 'playlists') searchType = 'playlists';
    else if (searchType === 'artist' || searchType === 'artists') searchType = 'artists';
    else searchType = 'songs';

    try {
        const { signature, params } = await mackOauth('GET', 'https://api.audiomack.com/v1/search', {
            q: que,
            show: searchType,
            sort: 'popular',
            limit: limits,
            page: 1
        });

        const searchParams = new URLSearchParams(
            Object.entries({ ...params, oauth_signature: signature })
                .map(([k, v]): [string, string] => [k, String(v)])
        );

        const pull = await request(`https://api.audiomack.com/v1/search?${searchParams}`, {
            headers: { ...commonHeaders },
            useH2: true
        });

        if (pull.statusCode !== 200) {
            return {
                error: `${pull.statusCode} - Can't process this`
            }
        }

        const res: any = await pull.json();
        return { signature: signature, data: res?.results || null }
    } catch (e) { console.error(e); return null }
}

export const CrunchySearch = async function CrunchySearch(que: string, refresh_auth: boolean = false) {
    if (!que) return null;

    try {
        if (refresh_auth || !keycrunchy) {
            keycrunchy = await crunchyKey();
        }

        const per = await request(`https://beta-api.crunchyroll.com/content/v2/discover/search?q=${encodeURIComponent(que)}&n=20&type=series,episode,top_results&ratings=true&locale=en`, {
            headers: {
                ...commonHeaders,
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + keycrunchy,
            },
            useH2: true
        });

        if (per.statusCode === 403) {
            return {
                "error": "Cloudflare Turnstile asking to verify you're not a bot"
            }
        }

        if (per.statusCode === 400 || per.statusCode === 401) {
            return await CrunchySearch(que, true);
        }

        const res: any = await per.json();
        const finalres: any = {
            episode: res?.data?.find((a: any) => a.type == 'episode')?.items,
            series: res?.data?.find((a: any) => a.type == 'series')?.items,
            topResults: res?.data?.find((a: any) => a.type == 'top_results')?.items
        };
        return { data: finalres || null }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const SafeBooru = async function SafeBooru(que: string) {
    if (!que) return null;

    try {
        const per = await request(`https://safebooru.org/autocomplete.php?q=${encodeURIComponent(que)}`, {
            headers: {
                ...commonHeaders
            },
            useH2: true
        });

        if (per.statusCode === 403) {
            return {
                "error": "Cloudflare Turnstile asking to verify you're not a bot"
            }
        }

        const res: any = await per.text;
        let parseres: any = {};
        try {
            parseres = JSON.parse(res);
        }
        catch { }

        if (!parseres?.[0]) {
            return {
                data: null
            }
        }

        const finalres = await Promise.allSettled(
            parseres.map(async (e: any) => {
                const req2 = await request(`https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(e.value)}&limit=100`, {
                    headers: {
                        ...commonHeaders
                    },
                    useH2: true
                });

                const res2: any = await req2.json();

                // Safebooru labels are usually "tag_name (count)"
                // We extract the count inside the parentheses
                const totalMatch = e.label.match(/\((\d+)\)/);
                const total = totalMatch ? totalMatch[1] : "0";

                return {
                    title: e.value,
                    total: total,
                    data: res2
                }
            })
        );

        return { data: finalres.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean) }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const Konachan = async function Konachan(que: string) {
    if (!que) return null;

    try {
        if (!konaSummary || konaSummary.length === 0) {
            const pullinfo = await request(`https://konachan.net/tag/summary.json`, {
                headers: {
                    ...commonHeaders
                },
                useH2: true
            });

            const lookinfo: any = await pullinfo.json();
            const data = lookinfo.data || "";
            // Konachan summary format: "category`tag1`tag2` category`tag3`..."
            konaSummary = data.split(' ').flatMap((group: string) => group.split('`').slice(1, -1));
        }

        const specificTags = konaSummary.filter((tag: string) => tag.includes(que.toLowerCase())).slice(0, 5);

        if (specificTags.length === 0) {
            return {
                data: null
            }
        }

        const finalres = await Promise.allSettled(
            specificTags.map(async (tag: string) => {
                const req2 = await request(`https://konachan.net/post.json?limit=20&tags=${encodeURIComponent(tag)}`, {
                    headers: {
                        ...commonHeaders
                    },
                    useH2: true
                });

                const res2: any = await req2.json();

                return {
                    title: tag,
                    data: res2 || []
                }
            })
        );

        return { data: finalres.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean) }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const Tumblr = async (query: string): Promise<any> => {
    if (!query) return null;

    try {
        const res = await request(`https://api.tumblr.com/v2/timeline/search?limit=40&query=${encodeURIComponent(query)}&mode=recent&timeline_type=post&post_role=any&reblog_info=true&notes_info=true&days=0&npf=true`, {
            headers: {
                ...commonHeaders,
                'Authorization': 'Bearer ' + keytumblr
            },
            useH2: true
        });

        if (res.statusCode === 429) {
            return {
                error: "Rate-limited"
            }
        }

        const response = await res.json();

        if (!response?.response?.timeline?.elements?.[0]) {
            return { data: null }
        }

        return {
            data: response?.response?.timeline?.elements?.map((a: any) => a.object_type === 'post' ? a : null).filter(Boolean)
        }
    }
    catch {
        return null;
    }
}

export const googleImgSearch = async (query: string, sort: string = 'relevance'): Promise<any> => {
    if (!query) return null;

    try {
        const dateRestrictParam = sort === 'latest' ? '&dateRestrict=d1' : '';

        const fetchPage = (start: number) => {
            return request(`https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&prettyPrint=false&searchType=image&num=10&start=${start}${dateRestrictParam}&cx=${process.env.GOOG_CX}`, {
                headers: {
                    ...commonHeaders,
                    'Referer': process.env.GOOG_RX || '',
                    'X-Goog-Api-Key': process.env.GOOG_EX || ''
                },
                useH2: true
            });
        };

        const [res1, res2] = await Promise.all([
            fetchPage(1).catch(() => ({ statusCode: 500, json: async () => ({}) } as any)),
            fetchPage(11).catch(() => ({ statusCode: 500, json: async () => ({}) } as any))
        ]);

        const isOk1 = res1.statusCode === 200;
        const isOk2 = res2.statusCode === 200;

        if (!isOk1 && !isOk2) {
            if (res1.statusCode === 503) return { error: "Service unavailable" };
            if (res1.statusCode === 429) return { error: "Rate-limited" };
            return null;
        }

        const response1 = isOk1 ? await res1.json() : {};
        const response2 = isOk2 ? await res2.json() : {};

        const res = await request(`https://www.google.com/complete/s?q=${encodeURIComponent(query)}&pq=${encodeURIComponent(query)}&client=gws-wiz-img&ds=i`, {
            headers: {
                ...commonHeaders
            },
            useH2: true
        });

        const resText = res.text;
        let suggestions: string[] = [];
        try {
            const jsonString = resText.replace(/^window\.google\.ac\.h\(/, '').replace(/\)$/, '');
            const parsed = JSON.parse(jsonString);
            if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
                suggestions = parsed[0].map((item: any) => {
                    return typeof item[0] === 'string' ? item[0].replace(/<\/?b>/g, '') : '';
                }).filter(Boolean);
            }
        } catch (e) {
            // Ignore parse errors
        }

        const combinedItems = [...(response1.items || []), ...(response2.items || [])];
        const validResponse = response1.queries ? response1 : response2;

        let filterResponse = {};
        if (validResponse.queries?.request?.[0]) {
            const { cx, count, startIndex, ...rest } = validResponse.queries.request[0];
            filterResponse = rest;
        }

        return {
            data: {
                autocomplete: suggestions,
                ...filterResponse,
                sort: sort,
                items: combinedItems,
            }
        }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const googleImgSearchV2 = async (query: string, refresh_auth: boolean = false): Promise<any> => {
    if (!query) return null;

    try {
        if (refresh_auth || !googleImgSpAuth?.cx) {
            googleImgSpAuth = await googleAuthKey();
        }

        const res = await request(`https://cse.google.com/cse/element/v1?rsz=${googleImgSpAuth?.uiOptions?.resultSetSize}&hl=${googleImgSpAuth?.language}&source=gcsc&cselibv=${googleImgSpAuth?.cselibVersion}&searchtype=image&cx=${googleImgSpAuth?.cx}&${googleImgSpAuth?.uiOptions?.queryParameterName}=${encodeURIComponent(query)}&safe=off&cse_tok=${encodeURIComponent(googleImgSpAuth?.cse_token)}&lr=&cr=&gl=&filter=0&sort=&as_oq=&as_sitesearch=&exp=${encodeURIComponent(googleImgSpAuth?.exp?.join(',') || '')}&fexp=${encodeURIComponent(googleImgSpAuth?.fexp?.join(',') || '')}&callback=google.search.cse.api&rurl=${encodeURI(googleImgSpAuth?.uiOptions?.resultsUrl || '')}`, {
            headers: {
                ...commonHeaders
            },
            useH2: true
        });

        if (res.statusCode === 403) {
            return {
                error: "Google asking to verify you're not a bot"
            }
        }

        if (res.statusCode === 429) {
            return {
                error: "Rate-limited"
            }
        }

        let raw = res.text;

        if (!raw) {
            return { data: null }
        }

        const jsonpMatch = raw.match(/^\/\*.*?\*\/\s*\w[\w.]*\(([\s\S]+)\);?\s*$/);
        if (jsonpMatch) {
            raw = jsonpMatch[1];
        }

        if (raw.trim().startsWith('<')) {
            return { error: "Google asking to verify you're not a bot" };
        }

        const response = JSON.parse(raw);

        if (response?.error?.code === 400 || response?.error?.code === 401 || res.statusCode === 400 || res.statusCode === 401) {
            return await googleImgSearchV2(query, true);
        }

        // force renew auth data
        if(!response?.cursor?.estimatedResultCount) {
            googleImgSpAuth = await googleAuthKey();
            return await googleImgSearchV2(query);
        }

        const res2 = await request(`https://www.google.com/complete/s?q=${encodeURIComponent(query)}&pq=${encodeURIComponent(query)}&client=gws-wiz-img&ds=i`, {
            headers: {
                ...commonHeaders
            },
            useH2: true
        });

        const resText = res2.text;
        let suggestions: string[] = [];
        try {
            const jsonString = resText.replace(/^window\.google\.ac\.h\(/, '').replace(/\)$/, '');
            const parsed = JSON.parse(jsonString);
            if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
                suggestions = parsed[0].map((item: any) => {
                    return typeof item[0] === 'string' ? item[0].replace(/<\/?b>/g, '') : '';
                }).filter(Boolean);
            }
        } catch (e) {
            // Ignore parse errors
        }

        return {
            data: {
                autocomplete: suggestions,
                estimatedResultCount: response.cursor?.estimatedResultCount || "0",
                searchResultTime: response.cursor?.searchResultTime || "0",
                items: response.results || []
            }
        }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const googleSearch = async (query: string, refresh_auth: boolean = false): Promise<any> => {
    if (!query) return null;

    try {
        if (refresh_auth || !googleImgSpAuth?.cx) {
            googleImgSpAuth = await googleAuthKey();
        }

        const res = await request(`https://cse.google.com/cse/element/v1?rsz=${googleImgSpAuth?.uiOptions?.resultSetSize}&hl=${googleImgSpAuth?.language}&source=gcsc&cselibv=${googleImgSpAuth?.cselibVersion}&cx=${googleImgSpAuth?.cx}&${googleImgSpAuth?.uiOptions?.queryParameterName}=${encodeURIComponent(query)}&safe=off&cse_tok=${encodeURIComponent(googleImgSpAuth?.cse_token)}&lr=&cr=&gl=&filter=0&sort=&as_oq=&as_sitesearch=&exp=${encodeURIComponent(googleImgSpAuth?.exp?.join(',') || '')}&fexp=${encodeURIComponent(googleImgSpAuth?.fexp?.join(',') || '')}&callback=google.search.cse.api&rurl=${encodeURI(googleImgSpAuth?.uiOptions?.resultsUrl || '')}`, {
            headers: {
                ...commonHeaders
            },
            useH2: true
        });

        if (res.statusCode === 403) {
            return {
                error: "Google asking to verify you're not a bot"
            }
        }

        if (res.statusCode === 429) {
            return {
                error: "Rate-limited"
            }
        }

        let raw = res.text;

        if (!raw) {
            return { data: null }
        }

        const jsonpMatch = raw.match(/^\/\*.*?\*\/\s*\w[\w.]*\(([\s\S]+)\);?\s*$/);
        if (jsonpMatch) {
            raw = jsonpMatch[1];
        }

        if (raw.trim().startsWith('<')) {
            return { error: "Google asking to verify you're not a bot" };
        }

        const response = JSON.parse(raw);

        if (response?.error?.code === 400 || response?.error?.code === 401 || res.statusCode === 400 || res.statusCode === 401) {
            return await googleSearch(query, true);
        }

        // force renew auth data
        if(!response?.cursor?.estimatedResultCount) {
            googleImgSpAuth = await googleAuthKey();
            return await googleSearch(query);
        }

        const res2 = await request(`https://www.google.com/complete/s?q=${encodeURIComponent(query)}&pq=${encodeURIComponent(query)}&client=gws-wiz-img&ds=i`, {
            headers: {
                ...commonHeaders
            },
            useH2: true
        });

        const resText = res2.text;
        let suggestions: string[] = [];
        try {
            const jsonString = resText.replace(/^window\.google\.ac\.h\(/, '').replace(/\)$/, '');
            const parsed = JSON.parse(jsonString);
            if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
                suggestions = parsed[0].map((item: any) => {
                    return typeof item[0] === 'string' ? item[0].replace(/<\/?b>/g, '') : '';
                }).filter(Boolean);
            }
        } catch (e) {
            // Ignore parse errors
        }

        return {
            data: {
                autocomplete: suggestions,
                estimatedResultCount: response.cursor?.estimatedResultCount || "0",
                searchResultTime: response.cursor?.searchResultTime || "0",
                items: response.results?.map((a: any) => {
                    const { clicktrackUrl, ...c } = a;
                    return c;
                }) || []
            }
        }
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

export const duckSearch = async (query: string): Promise<any> => {
    if (!query) return null;

    try {
        const res = await request(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
            headers: {
                ...commonHeaders
            },
            useH2: true
        });

        if (res.statusCode === 403) {
            return {
                error: "Blocked / Challenge"
            }
        }

        if (res.statusCode === 429) {
            return {
                error: "Rate-limited"
            }
        }

        const linkstarget = res.text.split("initialize('")?.[1]?.split("',")?.[0];

        const res2 = await request(`https://links.duckduckgo.com${linkstarget}`, {
            headers: {
                ...commonHeaders,
                'Accept': '*/*',
                'Referer': 'https://duckduckgo.com/',
                'Sec-Fetch-Dest': 'script',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'same-site'
            },
            useH2: true
        });

        if (res2.statusCode === 403) {
            return {
                error: "Blocked / Challenge"
            }
        }

        if (res2.statusCode === 429) {
            return {
                error: "Rate-limited"
            }
        }

        if (res2.statusCode === 202) {
            return {
                error: "Can't process due unusual requests"
            }
        }

        const final = res2.text;

        // Extract instant answers from deepPayload or duckbar.add
        let instantAnswers: any = null;
        try {
            const deepMatch = final.match(/DDG\.deep\.deepPayload\s*=\s*(\{[\s\S]*?\});/);
            if (deepMatch) {
                const payload = JSON.parse(deepMatch[1]);
                instantAnswers = payload?.instantAnswers?.[0]?.data || null;
            }

            if (!instantAnswers) {
                const duckbarMatch = final.match(/DDG\.duckbar\.add\((\{[\s\S]*?"from":"deep_answer"[\s\S]*?\})\);/);
                if (duckbarMatch) {
                    const duckbarData = JSON.parse(duckbarMatch[1]);
                    instantAnswers = duckbarData?.data || null;
                }
            }

            if (!instantAnswers) {
                const iaMatch = final.match(/^(\{.*?\});/);
                if (iaMatch) {
                    const iaJson = JSON.parse(iaMatch[1]);
                    instantAnswers = iaJson?.instantAnswers?.[0]?.data || null;
                }
            }
        } catch { }

        // Extract organic results from DDG.pageLayout.load('d', [...])
        let organicResults: any[] = [];
        try {
            const organicMatch = final.match(/DDG\.pageLayout\) DDG\.pageLayout\.load\('d',\s*(\[[\s\S]*?\])\);/);
            if (organicMatch) {
                const parsed = JSON.parse(organicMatch[1]);
                organicResults = parsed
                    .filter((r: any) => r.u) // filter out pagination objects (they have 'n' key only)
                    .map((r: any) => ({
                        title: r.t || null,
                        url: r.u || null,
                        snippet: (r.a || '').replace(/<\/?b>/g, ''),
                        domain: r.d || null,
                        siteName: r.sn || null,
                        icon: r.i ? `https://external-content.duckduckgo.com/ip3/${r.i}.ico` : null,
                        siteLinks: r.l?.map((sl: any) => ({
                            text: sl.text,
                            url: sl.targetUrl,
                            snippet: sl.snippet
                        })) || [],
                        date: r.e || null
                    }));
            }
        } catch { }

        // Extract related searches from DDG.duckbar.loadModule('related_searches', {...})
        let relatedSearches: any[] = [];
        try {
            const relatedMatch = final.match(/DDG\.duckbar\.loadModule\('related_searches',\s*(\{[\s\S]*?\})\);/);
            if (relatedMatch) {
                const parsed = JSON.parse(relatedMatch[1]);
                relatedSearches = parsed.results?.map((r: any) => ({
                    text: r.text,
                    displayText: (r.display_text || '').replace(/<\/?b>/g, '')
                })) || [];
            }
        } catch { }

        const res3 = await request(`https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&kl=wt-wt&vertical=web`, {
            headers: {
                ...commonHeaders
            },
            useH2: true
        });

        let autotext: any = {};

        try {
            autotext = JSON.parse(res3.text);
        }
        catch { }

        return {
            data: {
                autocomplete: autotext?.map((a: any) => a.phrase) || [],
                instantAnswer: instantAnswers ? {
                    answer: instantAnswers.answer || null,
                    expandedAnswer: instantAnswers.expanded_answer || null,
                    sources: instantAnswers.sources || [],
                    query: instantAnswers.query || query
                } : null,
                relatedSearches,
                items: organicResults
            }
        };
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

// ──── Emoji Lookup ────

type EmojiDatabase = {
    knownSupportedEmoji: string[];
    data: Record<string, any>;
    combinations: Record<string, any>;
};

const EMOJI_SOURCE_URL = 'https://emojikitchen.dev/metadata.json';
const EMOJI_CACHE_TTL = 24 * 60 * 60 * 1000;

let emojiDataCache: EmojiDatabase | null = null;
let emojiLoadPromise: Promise<EmojiDatabase | null> | null = null;
let emojiLastFetchTime = 0;

async function loadEmojiData() {
    const now = Date.now();
    if (emojiDataCache && (now - emojiLastFetchTime) < EMOJI_CACHE_TTL) return emojiDataCache;
    if (emojiLoadPromise) return emojiLoadPromise;

    emojiLoadPromise = (async () => {
        try {
            const res = await fetch(EMOJI_SOURCE_URL);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            emojiDataCache = await res.json() as EmojiDatabase;
            emojiLastFetchTime = Date.now();
            return emojiDataCache;
        } catch (e) {
            console.error('Failed to fetch emoji data:', e);
            emojiLoadPromise = null;
            return emojiDataCache; // return stale cache if available
        }
    })();

    const result = await emojiLoadPromise;
    emojiLoadPromise = null;
    return result;
}

export const EmojiLookup = async function EmojiLookup(query: string, limit: number = 25) {
    if (!query || query.trim().length === 0) return { error: "Missing parameter 'q'" };

    const qInput = query.trim();
    // Discord emoji regex: <:name:id> or <a:name:id>
    const discordEmojiMatch = qInput.match(/^<(a?):(\w+):(\d+)>$/);

    if (discordEmojiMatch) {
        const name = discordEmojiMatch[2];
        const id = discordEmojiMatch[3];

        // Try GIF version first as priority
        let isAnimated = true;
        let emojiUrl = `https://media.discordapp.net/emojis/${id}.gif`;
        let available = await fetch(emojiUrl, { method: "HEAD" }).then(a => a.ok).catch(() => false);

        // Fallback to PNG if GIF is not available
        if (!available) {
            isAnimated = false;
            emojiUrl = `https://media.discordapp.net/emojis/${id}.png`;
            available = await fetch(emojiUrl, { method: "HEAD" }).then(a => a.ok).catch(() => false);
        }

        const finalUrl = emojiUrl + '?size=4096&quality=lossless';

        return {
            query: qInput,
            count: 1,
            limit: limit,
            data: [{
                type: "discordEmoji",
                id: id,
                name: name,
                animated: isAnimated,
                available: available,
                emojiUrl: finalUrl,
                created_at: String(getSnowflakeDate(id))
            }]
        };
    }

    const trimmed = query.trim();

    // Primary Search using emojibase-data
    const isEmoji = /\p{Emoji}/u.test(trimmed);
    let emojibaseMatches: any[] = [];
    
    if (isEmoji) {
        emojibaseMatches = emojibaseData.filter((e: any) => e.emoji === trimmed);
    } else {
        const searchQ = trimmed.toLowerCase();
        emojibaseMatches = emojibaseData.filter((e: any) =>
            e.label.toLowerCase().includes(searchQ) ||
            e.tags?.some((t: string) => t.toLowerCase().includes(searchQ))
        );

        // Sort to prioritize better matches
        emojibaseMatches.sort((a: any, b: any) => {
            const aLabel = a.label.toLowerCase();
            const bLabel = b.label.toLowerCase();
            const aTags = (a.tags || []).map((t: string) => t.toLowerCase());
            const bTags = (b.tags || []).map((t: string) => t.toLowerCase());

            // 1. Exact label match
            if (aLabel === searchQ && bLabel !== searchQ) return -1;
            if (bLabel === searchQ && aLabel !== searchQ) return 1;

            // 2. Label starts with search term
            if (aLabel.startsWith(searchQ) && !bLabel.startsWith(searchQ)) return -1;
            if (bLabel.startsWith(searchQ) && !aLabel.startsWith(searchQ)) return 1;

            // 3. Exact tag match
            const aHasExactTag = aTags.includes(searchQ);
            const bHasExactTag = bTags.includes(searchQ);
            if (aHasExactTag && !bHasExactTag) return -1;
            if (bHasExactTag && !aHasExactTag) return 1;

            // Default to emojibase order
            return (a.order || 0) - (b.order || 0);
        });
    }

    if (emojibaseMatches.length > 0) {
        const limited = emojibaseMatches.slice(0, limit);
        return {
            query: trimmed,
            count: emojibaseMatches.length,
            limit,
            data: limited.map((entry: any) => {
                const codepoint = entry.hexcode.toLowerCase().replace(/-fe0f/g, '');
                const cpNoto = codepoint.replace(/-/g, '_');
                return {
                    type: 'twemoji',
                    alt: entry.label,
                    emoji: entry.emoji,
                    codepoint,
                    emojiUrl: `https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u${cpNoto}.png`,
                    emojiUrl2: `https://raw.githubusercontent.com/jdecked/twemoji/refs/heads/main/assets/72x72/${codepoint}.png`,
                    gBoardOrder: entry.order,
                    keywords: [entry.label.toLowerCase().replace(/ /g, '_'), ...(entry.tags ?? [])],
                    category: (emojibaseGroups.groups as any)[entry.group]?.toLowerCase() || '',
                    subcategory: (emojibaseGroups.subgroups as any)[entry.subgroup] || '',
                };
            }),
            isFallback: false
        };
    }

    // Fallback to Google Emoji Kitchen data
    const db = await loadEmojiData();
    if (!db) return { error: "Emoji data unavailable" };

    const q = query.toLowerCase().trim();
    const terms = q.split(/\s+/);
    const results: any[] = [];

    // Check if query looks like a codepoint (hex string like "2615" or "1f600")
    const isCodepointQuery = /^[0-9a-f]+(-[0-9a-f]+)*$/i.test(q.replace(/\s+/g, '-'));

    const normalizedQuery = query.trim().replace(/\uFE0F/g, '');

    for (const [codepoint, entry] of Object.entries(db.data)) {
        // Direct emoji character match
        if (entry.emoji && entry.emoji.replace(/\uFE0F/g, '') === normalizedQuery) {
            results.unshift({ ...entry, codepoint });
            continue;
        }

        // Direct codepoint match
        if (isCodepointQuery && codepoint.toLowerCase() === q.replace(/\s+/g, '-')) {
            results.unshift({ ...entry, codepoint });
            continue;
        }

        const alt = (entry.alt || '').toLowerCase();
        const keywords: string[] = (entry.keywords || []).map((k: string) => k.toLowerCase());
        const category = (entry.category || '').toLowerCase();
        const subcategory = (entry.subcategory || '').toLowerCase();
        const searchable = `${alt} ${keywords.join(' ')} ${category} ${subcategory}`;

        const matches = terms.every(term => searchable.includes(term));
        if (matches) {
            results.push({ ...entry, codepoint });
        }
    }

    const totalCount = results.length;
    // Apply limit to the results before heavy mapping
    const limitedResults = results.slice(0, limit);

    // Attach combinations for each matched emoji
    const withCombinations = limitedResults.map(entry => {
        const combos = entry.combinations;
        const combinationList: any[] = [];

        if (combos && typeof combos === 'object') {
            for (const [partnerCodepoint, comboEntries] of Object.entries(combos)) {
                if (Array.isArray(comboEntries)) {
                    for (const combo of comboEntries) {
                        combinationList.push({
                            ...combo,
                            partnerCodepoint
                        });
                    }
                }
            }
        }

        return {
            type: "twemoji",
            alt: entry.alt,
            emoji: entry.emoji,
            codepoint: entry.codepoint,
            emojiUrl: `https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u${entry.codepoint.toLowerCase().replace(/-fe0f$/, '')}.png`,
            emojiUrl2: `https://raw.githubusercontent.com/jdecked/twemoji/refs/heads/main/assets/72x72/${entry.codepoint.toLowerCase().replace(/-fe0f$/, '')}.png`,
            gBoardOrder: entry.gBoardOrder,
            keywords: entry.keywords,
            category: entry.category,
            subcategory: entry.subcategory,
            combinationCount: combinationList.length
        };
    });

    return {
        query: q,
        count: totalCount,
        limit: limit,
        data: withCombinations,
        isFallback: true
    };
}