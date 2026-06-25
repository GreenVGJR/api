import { Context } from "hono";
import { Buffer } from "buffer";
import { stream } from "hono/streaming";
import crypto from "crypto";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import config from "../config.json" with { type: "json" };
import { commonHeaders } from "./request.js";
import { recordRequestLog } from "./logs.js";
import {
  cookieChallengeIsValid,
  BACK_CHALLENGE_COOKIE,
} from "./backChallenge.js";

const { generate_hash } = config;

const logResponse = <T extends Response>(
  c: Context,
  response: T,
  statusCode = response.status,
) => {
  recordRequestLog(c, statusCode);
  return response;
};

export const blobDispatch = async (c: Context, body: any, headers?: any) => {
  await rateLimit();

  try {
    if (c.req.method !== "GET") return logResponse(c, c.text("", 200));
  } catch {
    return logResponse(c, c.text("", 200));
  }

  if (Object.entries(c.req.queries()).length >= 3) {
    return logResponse(c, c.text("Forbidden", 403));
  }

  c.header("X-Enc-Route", "v2");

  const type = headers?.get
    ? headers.get("content-type")
    : headers?.["content-type"];
  const filtype1 = type?.split("/")?.[0];
  const defaultExtensions: Record<string, string> = {
    video: "mp4",
    image: "png",
    audio: "mp3",
    text: "plain",
    application: "octet-stream",
  };
  const subtype = type?.split("/")?.[1]?.split(";")?.[0];
  const filtype2 =
    subtype === "*" ? defaultExtensions[filtype1] || null : subtype;
  const contentType = filtype2
    ? `${filtype1}/${filtype2}`
    : type || "application/octet-stream";

  c.header("Content-Type", contentType);
  c.header("Cache-Control", "public, max-age=30, must-revalidate");

  return logResponse(
    c,
    stream(c, async (s) => {
      s.onAbort(() => {
        return;
      });

      await s.write(new Uint8Array());

      if (c.req.raw.signal.aborted) return;

      try {
        let resolvedBody = typeof body === "function" ? body() : body;
        if (resolvedBody instanceof Promise) resolvedBody = await resolvedBody;

        if (c.req.raw.signal.aborted) return;

        if (resolvedBody?.ok === false) {
          console.error(
            `blobDispatch: Upstream returned status ${resolvedBody.status}`,
          );
          return;
        }

        const dataToPipe = resolvedBody?.body || resolvedBody;
        if (dataToPipe) {
          if (dataToPipe.getReader || dataToPipe.pipeTo) {
            await s.pipe(dataToPipe);
          } else if (dataToPipe.pipe) {
            const { Readable } = await import("stream");

            await s.pipe(Readable.toWeb(dataToPipe));
          } else {
            await s.write(dataToPipe);
          }
        }
      } catch (err) {}
    }),
  );
};

// Rate limiting config and state
const MAX_REQUESTS_PER_SECOND = 10;
let requestCount = 0;
const queue: (() => void)[] = [];

setInterval(() => {
  requestCount = 0;
  while (queue.length > 0 && requestCount < MAX_REQUESTS_PER_SECOND) {
    const resolve = queue.shift();
    if (resolve) {
      resolve();
      requestCount++;
    }
  }
}, 1000);

export async function rateLimit(): Promise<void> {
  if (requestCount >= MAX_REQUESTS_PER_SECOND) {
    await new Promise<void>((resolve) => {
      queue.push(resolve);
    });
  }
  requestCount++;
}

export const dispatch = async (c: Context, promiseFactory: any) => {
  const ua = c.req.header("user-agent") || "";
  if (ua.toLowerCase().includes("bot")) {
    return logResponse(c, c.text("", 403));
  }

  await rateLimit();

  try {
    if (c.req.method !== "GET") return logResponse(c, c.text("", 200));
  } catch {
    return logResponse(c, c.text("", 200));
  }

  if (generate_hash) {
    const sh = c.req.query("sh") || "";
    const uaHash = crypto
      .createHash("md5")
      .update(ua)
      .digest("hex")
      .slice(0, 8);
    const checkcookie = getCookie(c, "_sign");

    const urlObj = new URL(c.req.url);
    const queryKeys = Array.from(urlObj.searchParams.keys())
      .filter((k) => k !== "sh")
      .sort();
    const queryStr = queryKeys
      .map((k) => `${k}=${urlObj.searchParams.get(k)}`)
      .join("&");

    const providedUaHash = sh.slice(0, 8);
    const providedQHash = sh.slice(8, 16);
    const ts = parseInt(sh.slice(16), 16);

    const qHash = crypto
      .createHash("md5")
      .update(
        urlObj.pathname + "?" + queryStr + (isNaN(ts) ? "" : ts.toString()),
      )
      .digest("hex")
      .slice(0, 8);
    const letSh = uaHash + qHash;

    const now = Date.now();
    const isForceRefresh = c.req.header("cache-control") === "no-cache";
    const timeDiff = now - ts;

    if (
      sh &&
      (providedUaHash !== uaHash ||
        (providedQHash !== qHash &&
          (isNaN(ts) || new String(ts).length !== 13)))
    ) {
      return logResponse(c, c.text("Forbidden", 403));
    }

    if (
      !sh ||
      providedQHash !== qHash ||
      (isForceRefresh && timeDiff > 3000) ||
      timeDiff >= 30000
    ) {
      const newQHash = crypto
        .createHash("md5")
        .update(urlObj.pathname + "?" + queryStr + now.toString())
        .digest("hex")
        .slice(0, 8);
      const newLetSh = uaHash + newQHash;
      const newSh = newLetSh + now.toString(16);
      const newUrl = `${urlObj.origin}${urlObj.pathname}?sh=${newSh}${queryStr ? "&" + queryStr : ""}`;

      setCookie(c, "_sign", newLetSh.split("").reverse().join(""), {
        path: "/",
        secure: false,
        sameSite: "Lax",
      });
      if (c.req.header("sec-fetch-site") === "none") {
        c.header("Refresh", "0, url=" + newUrl);
        return logResponse(c, c.text("", 303));
      } else {
        return logResponse(c, c.redirect(newUrl, 302));
      }
    }

    if (checkcookie) {
      deleteCookie(c, "_sign", {
        path: "/",
        secure: false,
        domain: "",
        sameSite: "Lax",
      });
      if (
        checkcookie !== letSh.split("").reverse().join("") &&
        c.req.header("referer")
      ) {
        return logResponse(
          c,
          c.json(
            ["Signature mismatch", "Refresh this page for gain access"],
            200,
          ),
        );
      }
    }

    if (timeDiff > 1000 && !isForceRefresh) {
      c.header("X-If-Cache", "true");
      return logResponse(c, c.body(null, 304));
    }
  }

  const requrl = new URL(c.req.url);

  c.header("X-Enc-Route", "v4");
  c.header("Content-Type", "application/json");
  c.header(
    "Cache-Control",
    requrl.pathname?.startsWith("/tools/discord/") ||
      requrl.pathname?.startsWith("/tools/db/")
      ? "public, max-age=0, must-revalidate"
      : "public, max-age=5, must-revalidate",
  );

  const checkcookieApp = getCookie(c, BACK_CHALLENGE_COOKIE);
  c.status(cookieChallengeIsValid(c, checkcookieApp) ? 307 : 200);

  return logResponse(
    c,
    stream(c, async (stream) => {
      stream.onAbort(() => {
        return;
      });

      if (c.req.raw.signal.aborted) return;

      const [data] = await Promise.all([
        Promise.resolve()
          .then(() =>
            typeof promiseFactory === "function"
              ? promiseFactory()
              : promiseFactory,
          )
          .catch((err) => {
            console.error("Promise error:", err);
            return null;
          }),
        stream.write(""),
      ]);

      if (c.req.raw.signal.aborted) return;

      if (!data) {
        await stream.write("null");
      } else if (typeof data === "object") {
        await stream.write(JSON.stringify(data));
      } else {
        await stream.write(String(data));
      }
    }),
  );
};

export const processImage = async (c: Context, url?: string) => {
  if (!url) return undefined;
  if (!url.startsWith("http")) return undefined;

  let checkurl: URL;
  try {
    checkurl = new URL(url);
  } catch {
    return undefined;
  }
  if (checkurl.host === c.req.header("host")) return "";

  try {
    const res = await fetch(url, { headers: { ...commonHeaders } });
    if (!res.ok) return "";
    const contentType = res.headers.get("content-type");
    if (
      !contentType?.startsWith("image/") &&
      !contentType?.startsWith("video/")
    )
      return "";
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch (e) {
    return "";
  }
};
