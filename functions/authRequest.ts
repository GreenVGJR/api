import crypto from "crypto";
import { Buffer } from "buffer";
import { commonHeaders, userAgent } from "./request.js";

export let keytidal: string | undefined = "txNoH4kkV41MfH25";
export const keytidalopen: string = "txNoH4kkV41MfH25";
export function setKeyTidal(val: string | undefined) {
  keytidal = val;
}

export async function youtubeVisitorKey(): Promise<{
  visitor_data: string;
  cookie: string;
} | null> {
  try {
    const res = await fetch("https://www.youtube.com/", {
      headers: commonHeaders,
    });
    const text = await res.text();
    const visitor_data =
      text.split('"visitorData":"')[1]?.split('"')[0] || null;
    let cookie = "";
    if (res.headers.getSetCookie) {
      cookie = res.headers.getSetCookie().join("; ");
    } else {
      cookie = res.headers.get("set-cookie") || "";
    }
    if (!visitor_data) return null;
    return { visitor_data, cookie };
  } catch (e) {
    console.error("Error fetching visitorData:", e);
    return null;
  }
}

export const googleAuthKey = async function googleAuthKey() {
  try {
    const res = await fetch(
      `https://cse.google.com/cse.js?hpg=1&cx=${process.env.GOOG_CX}`,
      {
        headers: {
          ...commonHeaders,
        },
      },
    );
    if (res.status !== 200) return undefined;
    const text = await res.text();
    const extractObject = text?.split("})(")?.[1]?.slice(0, -2);
    return JSON.parse(extractObject);
  } catch {
    return undefined;
  }
};

export const giphyKey = async function giphyKey() {
  try {
    const res = await fetch("https://giphy.com/", {
      headers: {
        ...commonHeaders,
      },
    });
    const text = await res.text();
    const extractHash = text?.split("app/layout-")?.[1]?.split('"')?.[0];
    if (!extractHash) return undefined;
    const res2 = await fetch(
      `https://giphy.com/_next/static/chunks/app/layout-${extractHash}`,
      {
        headers: {
          ...commonHeaders,
        },
      },
    );
    const text2 = await res2.text();
    return text2.split('mobileApiKey:"')[1].split('"')[0];
  } catch {
    return undefined;
  }
};

export const flickrKey = async function flickrKey() {
  try {
    const res = await fetch("https://flickr.com/photos/", {
      headers: {
        ...commonHeaders,
      },
    });
    const text = await res.text();
    return text.split("flickr.api.site_key =")[1].split('"')[1];
  } catch {
    return undefined;
  }
};

export const soundcloudKey = async function soundcloudKey() {
  try {
    const res = await fetch("https://m.soundcloud.com", {
      method: "GET",
      headers: {
        ...commonHeaders,
      },
    });
    const text = await res.text();
    return text.split('"clientId":"')[1].split('"')[0];
  } catch {
    return undefined;
  }
};

function decodeSpotifySecret(encoded: string): Buffer {
  const t = 33;
  const n = 9;

  const byteValues = encoded.split("").map((char, index) => {
    return char.charCodeAt(0) ^ ((index % t) + n);
  });

  const joined = byteValues.join("");
  const asciiBuffer = Buffer.from(joined, "utf8");
  const hexString = asciiBuffer.toString("hex");

  return Buffer.from(hexString, "hex");
}

function generateSpotifyTOTP(
  secretHex: string,
  timestampMs: number,
  step = 30,
): string {
  const counter = Math.floor(timestampMs / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", Buffer.from(secretHex, "hex"));
  hmac.update(buf);
  const digest = hmac.digest();

  const offset = (digest[digest.length - 1] ?? 0) & 0xf;
  const code =
    ((((digest[offset] ?? 0) & 0x7f) << 24) |
      (((digest[offset + 1] ?? 0) & 0xff) << 16) |
      (((digest[offset + 2] ?? 0) & 0xff) << 8) |
      ((digest[offset + 3] ?? 0) & 0xff)) %
    1000000;

  return code.toString().padStart(6, "0");
}

let currentTotpSecret: string | null = null;
let currentTotpVersion: string | null = null;
let lastSecretFetchTime = 0;
const SECRET_FETCH_INTERVAL = 60 * 60 * 1000;

async function ensureTotpSecrets(): Promise<void> {
  const now = Date.now();
  if (currentTotpSecret && now - lastSecretFetchTime < SECRET_FETCH_INTERVAL)
    return;

  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/xyloflake/spot-secrets-go/refs/heads/main/secrets/secretDict.json",
      {
        headers: { Accept: "application/json" },
      },
    );

    if (res.status !== 200) throw new Error("Failed to fetch secrets");

    const secrets: any = await res.json();
    const versions = Object.keys(secrets).map(Number);
    const newestVersion = Math.max(...versions).toString();
    const secretData = secrets[newestVersion];

    if (!secretData) throw new Error("Missing newest secret entry");

    const mappedData = secretData.map(
      (value: number, index: number) => value ^ ((index % 33) + 9),
    );

    currentTotpSecret = Buffer.from(mappedData.join(""), "utf8").toString(
      "hex",
    );
    currentTotpVersion = newestVersion;
    lastSecretFetchTime = now;
  } catch {
    if (!currentTotpSecret) {
      const fallbackData = [
        99, 111, 47, 88, 49, 56, 118, 65, 52, 67, 50, 104, 117, 101, 55, 94, 95,
        75, 94, 49, 69, 36, 85, 64, 74, 60,
      ];
      const mapped = fallbackData.map(
        (value, index) => value ^ ((index % 33) + 9),
      );
      currentTotpSecret = Buffer.from(mapped.join(""), "utf8").toString("hex");
      currentTotpVersion = "19";
    }
  }
}

async function performSpotifyTokenRequest(secretHex: string, version: string) {
  let serverTimeMs = Date.now();
  try {
    const timeRes = await fetch("https://open.spotify.com/api/server-time", {
      headers: { "User-Agent": userAgent },
    });
    if (timeRes.status === 200) {
      const timeData: any = await timeRes.json();
      serverTimeMs = timeData.serverTime || Date.now();
    }
  } catch {}

  const localTimeMs = Date.now();
  const totpLocal = generateSpotifyTOTP(secretHex, localTimeMs, 30);
  const totpServer = generateSpotifyTOTP(secretHex, serverTimeMs, 900);

  const url = new URL("https://open.spotify.com/api/token");
  url.searchParams.append("reason", "init");
  url.searchParams.append("productType", "mobile-web-player");
  url.searchParams.append("totp", totpLocal);
  url.searchParams.append("totpServer", totpServer);
  url.searchParams.append("totpVer", version);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      ...commonHeaders,
      ...(process.env.SPOTIFY_COOKIES
        ? { cookie: process.env.SPOTIFY_COOKIES }
        : {}),
      "User-Agent": userAgent,
      Origin: "https://open.spotify.com/",
      Referer: "https://open.spotify.com/",
      Accept: "application/json",
    },
  });

  if (res.status !== 200) throw new Error(`Spotify Auth Error: ${res.status}`);

  const data: any = await res.json();
  const token = data.accessToken;
  if (!token) throw new Error("Missing token");

  return data.accessToken;
}

export const spotifyKey = async function spotifyKey() {
  try {
    const primarySecret = { secret: ',7/*F("rLJ2oxaKL^f+E1xvP@N', version: 61 };
    const secretHex = decodeSpotifySecret(primarySecret.secret).toString("hex");
    const version = String(primarySecret.version);

    return await performSpotifyTokenRequest(secretHex, version);
  } catch {
    try {
      await ensureTotpSecrets();
      if (currentTotpSecret && currentTotpVersion) {
        return await performSpotifyTokenRequest(
          currentTotpSecret,
          currentTotpVersion,
        );
      }
    } catch {}

    try {
      const res = await fetch(
        `https://open.spotify.com/embed/track/${["4PTG3Z6ehGkBFwjybzWkR8", "2yR2sziCF4WEs3klW1F38d", "0IuVhCflrQPMGRrOyoY5RW", "2yWlGEgEfPot0lv3OAjuG3", "4Xfp9BcKrKYmxJPxn68Yb8", "7uuJqaRjSXzja6VGgDpWem", " BP1klbHxsOf6IxscNIX0r", "6BYzwbWg1Z2EB6VUXTYnhm"][Math.floor(Math.random() * 8)]}`,
        {
          headers: {
            ...commonHeaders,
            ...(process.env.SPOTIFY_COOKIES
              ? { cookie: process.env.SPOTIFY_COOKIES }
              : {}),
          },
        },
      );
      const text = await res.text();
      return text.split('"accessToken":"')[1].split('"')[0];
    } catch {
      return undefined;
    }
  }
};

export const spotifyKeyToken = async function spotifyKeyToken() {
  const clientId = {
    web_player: "d8a5ed958d274c2e8ee717e6a4b0971d",
    mobile_web_player: "f6a40776580943a7bc5173125a1e8832",
    embeds: "ab9ad0d96a624805a7d51e8868df1f97",
  };

  const bodyhttp = {
    client_data: {
      client_version: "1.0",
      client_id: clientId.mobile_web_player,
      js_sdk_data: {},
    },
  };

  try {
    const req = await fetch(`https://clienttoken.spotify.com/v1/clienttoken`, {
      method: "POST",
      body: JSON.stringify(bodyhttp),
      headers: {
        ...commonHeaders,
        ...(process.env.SPOTIFY_COOKIES
          ? { cookie: process.env.SPOTIFY_COOKIES }
          : {}),
        Origin: "https://clienttoken.spotify.com",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const res: any = await req.json();
    return res.granted_token.token;
  } catch {
    return undefined;
  }
};

const CONSUMER_KEY_MACK = "audiomack-web";
const CONSUMER_SECRET_MACK = "bd8a07e9f23fbe9d808646b730f89b8e";
const STRICT_URI_RE = /[!'()*]/g;

type OAuthParamValue = string | number | boolean;

function strictEncodeURIComponent(value: OAuthParamValue): string {
  return encodeURIComponent(String(value)).replace(
    STRICT_URI_RE,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function buildParamString(params: Record<string, OAuthParamValue>): string {
  return Object.keys(params)
    .sort()
    .map(
      (key) =>
        `${strictEncodeURIComponent(key)}=${strictEncodeURIComponent(params[key] ?? "")}`,
    )
    .join("&");
}

export const mackOauth = async function mackOauth(
  method: string,
  url: string,
  additionalParams: Record<string, OAuthParamValue> = {},
): Promise<{ signature: string; params: Record<string, OAuthParamValue> }> {
  const params: Record<string, OAuthParamValue> = {
    ...additionalParams,
    oauth_consumer_key: CONSUMER_KEY_MACK,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000),
    oauth_version: "1.0",
  };

  const paramString = buildParamString(params);
  const signatureBase = `${method.toUpperCase()}&${strictEncodeURIComponent(url)}&${strictEncodeURIComponent(paramString)}`;
  const signingKey = `${strictEncodeURIComponent(CONSUMER_SECRET_MACK)}&`;
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(signatureBase)
    .digest("base64");

  return { signature, params };
};

export const tidalKeys = async function tidalKeys() {
  try {
    const rest = await fetch(
      `https://embed.tidal.com/tracks/${[406956243, 1550546][Math.floor(Math.random() * 2)]}`,
      {
        method: "GET",
        headers: {
          ...commonHeaders,
        },
      },
    );
    const rest_get = await rest.text();
    const rest2 = await fetch(
      "https://embed.tidal.com" +
        rest_get
          .split('type="module"')[0]
          .split('script src="')[1]
          .split('"')[0],
      {
        headers: {
          ...commonHeaders,
        },
      },
    );
    const rest2_get = await rest2.text();
    return rest2_get.split('"X-Tidal-Token","')[1].split('"')[0];
  } catch {
    return undefined;
  }
};

export const tidalKeysToken = async function tidalKeysToken(
  refresh: boolean = false,
) {
  try {
    if (!keytidal || refresh) {
      keytidal = await tidalKeys();
    }

    const rt = new URLSearchParams();
    rt.append("client_id", keytidalopen);
    rt.append(
      "client_secret",
      decodeURIComponent("dQjy0MinCEvxi1O4UmxvxWnDjt4cgHBPw8ll6nYBk98%3D"),
    );
    rt.append("grant_type", "client_credentials");

    const rest = await fetch(`https://auth.tidal.com/v1/oauth2/token`, {
      method: "POST",
      body: rt.toString(),
      headers: {
        ...commonHeaders,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (rest.status === 400 || rest.status === 401) {
      return await tidalKeysToken(true);
    }

    const res: any = await rest.json();
    return res.access_token;
  } catch {
    return undefined;
  }
};

export const deezerKeys = async function deezerKeys() {
  try {
    const rest = await fetch(
      "https://auth.deezer.com/login/anonymous?jo=p&rto=p",
      {
        headers: {
          ...commonHeaders,
        },
      },
    );
    let rest_get: any = await rest.text();
    rest_get = JSON.parse(rest_get);
    return rest_get.jwt;
  } catch {
    return undefined;
  }
};

export const imgurKey = async function imgurKey() {
  try {
    const req = await fetch("https://imgur.com", {
      headers: { ...commonHeaders },
    });
    const res = await req.text();

    const mainAssetPath = res.split("desktop-assets/js/main")[1]?.split(">")[0];
    if (!mainAssetPath) return undefined;

    const req2 = await fetch(
      "https://s.imgur.com/desktop-assets/js/main" + mainAssetPath,
      { headers: { ...commonHeaders } },
    );
    const res2 = await req2.text();
    return res2.split('apiClientId:"')[1]?.split('"')[0];
  } catch (e) {
    console.error("Imgur Key Error:", e);
  }
};

export const crunchyKey = async function crunchyKey() {
  try {
    const req = await fetch(
      atob("aHR0cHM6Ly93d3cuY3J1bmNoeXJvbGwuY29tL2F1dGgvdjEvdG9rZW4="),
      {
        headers: {
          ...commonHeaders,
          Accept: "application/json",
          Authorization: "Basic Y3Jfd2ViOg==",
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: `device_id=${crypto.randomUUID()}; c_locale=en`,
          Origin: "https://www.crunchyroll.com",
        },
        method: "POST",
        body: "grant_type=client_id",
      },
    );
    if (req.status !== 200) return;
    const res = await req.json();
    return res.access_token;
  } catch (e) {
    console.error(e);
  }
};

export const saweriaBuildKey = async function saweriaBuildKey(): Promise<
  string | undefined
> {
  const mainRes = await fetch("https://saweria.co", {
    headers: { ...commonHeaders },
  });

  if (mainRes.status === 403) return undefined;
  const mainText = await mainRes.text();
  return mainText.split('"buildId":"')[1]?.split('"')[0];
};

export const instagramKey = async function instagramKey(): Promise<
  string | null
> {
  try {
    const res = await fetch("https://www.instagram.com/", {
      headers: commonHeaders,
    });
    if (res.headers.getSetCookie) {
      return res.headers.getSetCookie().join("; ");
    }
    return res.headers.get("set-cookie") || null;
  } catch (e) {
    console.error(e);
    return null;
  }
};
