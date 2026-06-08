import { Hono } from "hono";
import { dispatch } from "../../functions/httpRequest.js";
import { request, commonHeaders } from "../../functions/request.js";
import { decodeHTML } from "entities";

const app = new Hono();

app.get("/shazam", async (c) => {
  const query = c.req.query("q");
  if (query === undefined) {
    return c.json({ error: "Missing parameter required" }, 202);
  } else if (query === "") {
    return c.json({ error: "Nothing to do" }, 202);
  }
  c.header("X-Route", "itunes.apple.com, www.shazam.com");

  const task = async () => {
    try {
      const itunesRes = await request(
        `https://itunes.apple.com/search?media=music&limit=1&country=US&term=${encodeURIComponent(query)}`,
        { method: "GET", headers: commonHeaders },
      );
      const itunesData: any = await itunesRes.json();
      const tracks = itunesData?.results;

      if (!tracks || tracks.length === 0) {
        return { data: null };
      }

      const firstTrack = tracks[0];
      const trackViewUrl: string = firstTrack.trackViewUrl || "";

      let shazamUrl: string | null = null;
      try {
        const parsedUrl = new URL(trackViewUrl);
        const iParam = parsedUrl.searchParams.get("i");
        const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);

        const slugSegment = pathSegments.length >= 3 ? pathSegments[2] : null;

        if (iParam && slugSegment) {
          shazamUrl = `https://www.shazam.com/song/${iParam}/${slugSegment}`;
        }
      } catch {}

      const trackInfo = { ...firstTrack };

      let shazamInfo: any = null;
      let lyrics: string | null = null;
      let syncLyrics: string | null = null;

      if (shazamUrl) {
        try {
          const shazamRes = await request(shazamUrl, {
            headers: {
              ...commonHeaders,
            },
          });

          const html = await shazamRes.text;

          try {
            const ldJsonMatch = html.split(
              'script type="application/ld+json">',
            );
            if (ldJsonMatch.length > 1) {
              const ldJsonStr = ldJsonMatch[1].split("</script>")[0];
              const ldJson = JSON.parse(ldJsonStr);

              let parsedDuration: number | null = null;
              if (ldJson.duration && ldJson.duration.startsWith("PT")) {
                const match = ldJson.duration.match(
                  /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/,
                );
                if (match) {
                  const h = parseInt(match[1] || "0", 10);
                  const m = parseInt(match[2] || "0", 10);
                  const s = parseFloat(match[3] || "0");
                  parsedDuration = Math.round((h * 3600 + m * 60 + s) * 1000);
                }
              }

              const byArtist =
                typeof ldJson.byArtist === "string"
                  ? ldJson.byArtist
                  : ldJson.byArtist?.name || ldJson.creator?.name || null;

              shazamInfo = {
                trackName: ldJson.name || null,
                trackUrl: ldJson.url || null,
                thumbnailUrl:
                  ldJson.thumbnailUrl
                    ?.replace(/\d+x\d+\w+/, "1x1ss")
                    .replace(/\.\w+$/, ".png") || null,
                durationTrack: parsedDuration,
                genreTrack: ldJson.genre || null,
                byArtist: byArtist,
                albumName: ldJson.inAlbum?.name || null,
                albumPublished: ldJson.datePublished || null,
              };
            } else {
              shazamInfo = {
                trackName: null,
                trackUrl: null,
                thumbnailUrl: null,
                durationTrack: null,
                genreTrack: null,
                byArtist: null,
                albumName: null,
                albumPublished: null,
              };
            }

            const artistMatch = html.match(
              /TrackPageArtistLink_artistNameText[^>]*>([^<]+)<\/span>/,
            );
            if (artistMatch) shazamInfo.byArtist = decodeHTML(artistMatch[1]);

            const albumMatch = html.match(
              />Album<\/span>(?:<a[^>]*>)?<span[^>]*>([^<]+)<\/span>/,
            );
            if (albumMatch) shazamInfo.albumName = decodeHTML(albumMatch[1]);

            const dateMatch = html.match(
              />Release Date<\/span><span[^>]*>([^<]+)<\/span>/,
            );
            if (dateMatch) shazamInfo.albumPublished = dateMatch[1];

            const labelMatch = html.match(
              />Label<\/span><span[^>]*>([^<]+)<\/span>/,
            );
            shazamInfo.label = labelMatch ? decodeHTML(labelMatch[1]) : null;

            const languageMatch = html.match(
              />Language<\/span><span[^>]*>([^<]+)<\/span>/,
            );
            shazamInfo.language = languageMatch
              ? decodeHTML(languageMatch[1])
              : null;

            const bpmMatch = html.match(/>BPM<\/span><span[^>]*>(\d+)<\/span>/);
            shazamInfo.bpm = bpmMatch ? parseInt(bpmMatch[1], 10) : null;

            const getAttribute = (name: string) => {
              const regex = new RegExp(
                `>${name}<\\/span><\\/div><div[^>]*><div[^>]*><div[^>]*style="left:(\\d+)%"`,
              );
              const match = html.match(regex);
              return match ? parseInt(match[1], 10) : null;
            };

            shazamInfo.melodicness = getAttribute("Melodicness");
            shazamInfo.acousticness = getAttribute("Acousticness");
            shazamInfo.valence = getAttribute("Valence");
            shazamInfo.danceability = getAttribute("Danceability");
            shazamInfo.energy = getAttribute("Energy");
          } catch {}

          try {
            const rx = /\\\\?"lyricLines\\\\?":(\[.*?\])\}/g;
            const matches = [...html.matchAll(rx)];

            if (matches.length > 0) {
              const parseTime = (str: string) => {
                if (str.includes(":")) {
                  const parts = str.split(":");
                  if (parts.length === 3) {
                    return (
                      parseFloat(parts[0]) * 3600 +
                      parseFloat(parts[1]) * 60 +
                      parseFloat(parts[2])
                    );
                  } else if (parts.length === 2) {
                    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
                  }
                }
                return parseFloat(str);
              };

              const syncedLines: string[] = [];
              matches.forEach((m) => {
                try {
                  const raw = m[1].replace(/\\"/g, '"');
                  const arr = JSON.parse(raw);

                  arr.forEach((l: any) => {
                    const time = parseTime(l.startTimeInSeconds || "0");
                    const mins = Math.floor(time / 60)
                      .toString()
                      .padStart(2, "0");
                    const secs = (time % 60).toFixed(2).padStart(5, "0");
                    syncedLines.push(`[${mins}:${secs}] ${l.content}`);
                  });
                } catch (err) {}
              });

              if (syncedLines.length > 0) {
                syncLyrics = syncedLines.join("\n");
              }
            }
          } catch {}

          if (!lyrics) {
            try {
              const lyricParts = html.split("LyricsContent_");
              if (lyricParts.length > 1) {
                const lyricLines: string[] = [];
                for (let i = 1; i < lyricParts.length; i++) {
                  const part = lyricParts[i];
                  if (
                    part.startsWith("sectionTitle") ||
                    part.startsWith("lyricLine")
                  ) {
                    const text = part
                      .split('">')[1]
                      ?.split("</div>")[0]
                      ?.replace(/<[^>]*>/g, "");
                    if (text) {
                      lyricLines.push(text);
                    }
                  }
                }

                if (lyricLines.length > 0) {
                  lyrics = decodeHTML(lyricLines.join("\n"));
                }
              }
            } catch {}
          }

          if (!lyrics) {
            try {
              const ldJsonMatch = html.split(
                'script type="application/ld+json">',
              );
              if (ldJsonMatch.length > 1) {
                const ldJsonStr = ldJsonMatch[1].split("</script>")[0];
                const ldJson = JSON.parse(ldJsonStr);
                if (ldJson?.recordingOf?.lyrics?.text) {
                  lyrics = ldJson.recordingOf.lyrics.text;
                }
              }
            } catch {}
          }
        } catch (e) {
          console.error("Shazam fetch error:", e);
        }
      }

      return {
        data: [trackInfo, shazamInfo],
        lyrics: lyrics,
        syncLyrics: syncLyrics || null,
      };
    } catch (e) {
      console.error("Shazam lyrics error:", e);
      return null;
    }
  };

  return await dispatch(c, task);
});

export default app;
