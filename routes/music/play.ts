import { Hono } from "hono";
const app = new Hono();

import { getOrCreatePlayer, resolveVoiceChannel, formatTrack, hasActivePlayer, set247, get247, clear247, createMusicStream, checkVoicePermissions, formatDuration, setVoiceStatus, voiceStatusStore, PLATFORM_SEARCH, localNode } from "../../functions/musicPlayer.js";
import { SCMusic, SPMusic, YTMusic, YTVideo, Deezer, Tidal, infoYoutube, infoSpotify, infoITunes, infoSoundcloud, infoSoundcloudStreams, commonHeaders } from "../../functions/request.js";
import { getActiveFilters } from "./filters.js";
import { parseYtInitial } from "../../functions/request.ts";

interface CustomSearchResult {
	id?: string;
	url: string;

	title?: string;
	author?: string;
	thumbnail?: string;
	sourceName?: string;
	duration?: number;
}

const CUSTOM_SEARCH_TIMEOUT_MS = 5_000;

function normalizeUrl(url: string): string {
	if (!url) return url;
	if (url.startsWith("http://www.tidal.com")) {
		return url.replace("http://", "https://");
	}
	return url;
}

/**
 * For YouTube URLs containing a playlist (list=...), extract the playlist-only URL.
 * Returns null if the URL doesn't have a list parameter.
 */
function extractYouTubePlaylistUrl(url: string): string | null {
	if (!url.includes("youtube.com") && !url.includes("youtu.be")) return null;
	try {
		const urlObj = new URL(url);
		const listParam = urlObj.searchParams.get("list");
		if (listParam) {
			// RD* are YouTube Radio/Mix lists — they can't be loaded as /playlist URLs.
			// They're handled separately via fetchYouTubeMixTracks.
			if (listParam.startsWith("RD")) return null;
			urlObj.pathname = "/playlist";
			for (const key of [...urlObj.searchParams.keys()]) {
				if (key !== "list") {
					urlObj.searchParams.delete(key);
				}
			}
			return urlObj.toString();
		}
	} catch {}
	return null;
}

/**
 * For YouTube URLs containing both a video ID and a playlist (list=...), extract the video-only URL.
 * Returns null if the URL doesn't have both a video ID and a playlist parameter.
 */
function extractYouTubeVideoUrl(url: string): string | null {
	if (!url.includes("youtube.com") && !url.includes("youtu.be")) return null;
	try {
		const urlObj = new URL(url);
		const listParam = urlObj.searchParams.get("list");
		if (listParam && urlObj.searchParams.has("v")) {
			urlObj.searchParams.delete("list");
			urlObj.searchParams.delete("index");
			urlObj.searchParams.delete("start_radio");
			return urlObj.toString();
		}
	} catch {}
	return null;
}

/**
 * For YouTube Radio/Mix URLs (list=RD*), fetches the watch page, extracts ytInitialData,
 * and returns individual video URLs from the mix panel.
 * Mirrors the BDFD pattern:
 *   split on "var ytInitialData =" → split on ";" → parse JSON
 *   → contents.twoColumnWatchNextResults.playlist.playlist.contents
 *   → map playlistPanelVideoRenderer.videoId
 */
interface YtMixResult {
	title: string;
	list: string[];
}

async function fetchYouTubeMixTracks(url: string): Promise<YtMixResult | null> {
	try {
		const res = await fetch(url, {
			headers: { ...commonHeaders, "Accept-Language": "en-US,en;q=0.9" },
		});
		const html = await res.text();
		const ytInitialData = parseYtInitial(html);
		if (!ytInitialData) return null;
		const contents: any[] = ytInitialData?.contents?.twoColumnWatchNextResults?.playlist?.playlist?.contents;
		if (!Array.isArray(contents) || contents.length === 0) return null;
		return {
			title: ytInitialData?.contents?.twoColumnWatchNextResults?.playlist?.playlist?.title ?? "YouTube Mix",
			list: contents
				.map((item: any) => item?.playlistPanelVideoRenderer?.videoId)
				.filter(Boolean)
				.map((id: string) => `https://www.youtube.com/watch?v=${id}`),
		};
	} catch {
		return null;
	}
}

function getPlatformFromUrl(url: string): string | null {
	if (url.includes("spotify.com")) return "spotify";
	if (url.includes("soundcloud.com")) return "soundcloud";
	if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtubemusic";
	if (url.includes("apple.com")) return "applemusic";
	if (url.includes("deezer.com")) return "deezer";
	if (url.includes("tidal.com")) return "tidal";
	return null;
}

function isSoundCloudTrack(track: any): boolean {
	const info = track?.info || {};
	const sourceName = String(info.sourceName || "").toLowerCase();
	const actualSourceName = String(info.actualSourceName || "").toLowerCase();
	const uri = String(info.uri || "").toLowerCase();
	return sourceName === "soundcloud" || actualSourceName === "soundcloud" || uri.includes("soundcloud.com");
}

async function getUrlMetadata(url: string): Promise<CustomSearchResult | null> {
	try {
		if (url.includes("youtube.com") || url.includes("youtu.be")) {
			const info: any = await infoYoutube(url, false);
			if (info?.data?.title) {
				return {
					url,
					title: info.data.title,
					author: info.data.owners?.name,
					thumbnail: info.data.thumbnail,
					sourceName: "youtubemusic",
				};
			}
		}

		if (url.includes("spotify.com")) {
			const info: any = await infoSpotify(url);
			if (info?.data?.name) {
				return {
					url,
					title: info.data.name,
					author: info.data.artists?.[0]?.name,
					thumbnail: info.data.album?.images?.[0]?.url,
					sourceName: "spotify",
				};
			}
		}

		if (url.includes("music.apple.com")) {
			const info: any = await infoITunes(url);
			if (info?.data?.target?.attributes) {
				return {
					url,
					title: info.data.target.attributes.name,
					author: info.data.target.attributes.artistName,
					sourceName: "applemusic",
				};
			}
		}

		if (url.includes("soundcloud.com")) {
			const info: any = await infoSoundcloud(url);
			const track = info?.data?.[0];
			if (track?.title) {
				return {
					url,
					title: track.title,
					author: track.user?.username,
					thumbnail: track.artwork_url,
					sourceName: "soundcloud",
				};
			}
		}

		let endpoint = "";
		if (url.includes("soundcloud.com")) {
			endpoint = `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`;
		} else if (url.includes("youtube.com") || url.includes("youtu.be")) {
			endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
		} else if (url.includes("spotify.com")) {
			endpoint = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
		}

		if (endpoint) {
			const res = await fetch(endpoint, { headers: commonHeaders });
			const data: any = await res.json().catch(() => null);
			if (data && data.title) {
				return {
					url,
					title: data.title,
					author: data.author_name,
					thumbnail: data.thumbnail_url,
					sourceName: getPlatformFromUrl(url) || undefined,
				};
			}
		}

		return null;
	} catch {
		return null;
	}
}

async function customSearch(platform: string, query: string): Promise<CustomSearchResult | null> {
	try {
		const isUrl = query.startsWith("http://") || query.startsWith("https://");

		if (isUrl) {
			const metadata = await getUrlMetadata(query);
			if (metadata) return metadata;
		}
		switch (platform) {
			case "soundcloud": {
				const res = await SCMusic(query, undefined, 1);
				const track = res?.data?.[0]?.[0];
				if (!track?.permalink_url) return null;
				return {
					id: String(track.id),
					url: track.permalink_url,
					title: track.title,
					author: track.user?.username || track.publisher_metadata?.artist,
					thumbnail: track.artwork_url?.replace("-large", "-t500x500") || track.user?.avatar_url,
					sourceName: "soundcloud",
					duration: track.duration,
				};
			}
			case "spotify": {
				const res = await SPMusic(query, undefined, 1);
				const track = res?.data?.tracks?.[0];
				if (!track?.id) return null;
				return {
					id: track.id,
					url: `https://open.spotify.com/track/${track.id}`,
					title: track.name,
					author: track.artists?.items?.map((a: any) => a.profile?.name).join(", "),
					thumbnail: track.albumOfTrack?.coverArt?.sources?.sort((a: any, b: any) => (b.width || 0) - (a.width || 0))?.[0]?.url,
					sourceName: "spotify",
					duration: track.duration?.totalMilliseconds,
				};
			}
			case "youtube": {
				const res = await YTVideo(query, false);
				const track = res?.data?.[0];
				if (!track?.url) return null;
				return {
					id: track.videoId,
					url: track.url,
					title: track.title,
					author: track.author,
					thumbnail: track.thumbnail,
					sourceName: "youtube",
				};
			}
			case "youtubemusic": {
				const res = await YTMusic(query, false);
				const track = res?.data?.[0];
				if (!track?.url) return null;
				return {
					id: track.videoId,
					url: track.url,
					title: track.title,
					author:
						track.author ||
						track.artists
							?.map((a: any) => a.name)
							.filter(Boolean)
							.join(", "),
					thumbnail: track.thumbnail,
					sourceName: "youtube",
				};
			}
			case "applemusic": {
				const amRes = await fetch(`https://itunes.apple.com/search?media=music&limit=1&country=US&term=${encodeURIComponent(query)}`, { method: "GET", headers: commonHeaders });
				const parsed: any = await amRes.json();
				const track = parsed?.results?.[0];
				if (!track) return null;
				return {
					id: String(track.trackId),
					url: track.trackViewUrl,
					title: track.trackName,
					author: track.artistName,
					thumbnail: track.artworkUrl100?.replace("100x100", "600x600"),
					sourceName: "applemusic",
					duration: track.trackTimeMillis,
				};
			}
			case "deezer": {
				const res = await Deezer(query);
				const track = res?.data?.[0];
				if (!track?.link) return null;
				return {
					id: String(track.id),
					url: track.link,
					title: track.title,
					author: track.artist?.name,
					thumbnail: track.album?.cover_big || track.album?.cover_medium,
					sourceName: "deezer",
					duration: track.duration ? track.duration * 1000 : undefined,
				};
			}
			case "tidal": {
				const res = await Tidal(query);
				const track = res?.data?.[0];
				if (!track?.url) return null;
				return {
					id: String(track.id),
					url: track.url.startsWith("http://") ? track.url.replace("http://", "https://") : track.url,
					title: track.title,
					author: track.artist?.name || track.artists?.[0]?.name,
					thumbnail: track.album?.cover ? `https://resources.tidal.com/images/${track.album.cover.replace(/-/g, "/")}/640x640.jpg` : undefined,
					sourceName: "tidal",
					duration: track.duration ? track.duration * 1000 : undefined,
				};
			}
			default:
				return null;
		}
	} catch {
		return null;
	}
}

async function customSearchWithTimeout(platform: string, query: string, timeoutMs: number, log?: (msg: string) => Promise<void>, label = `Custom ${platform} search`): Promise<CustomSearchResult | null> {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	let timedOut = false;
	const timeout = new Promise<null>((resolve) => {
		timeoutId = setTimeout(() => {
			timedOut = true;
			resolve(null);
		}, timeoutMs);
	});

	const result = await Promise.race([customSearch(platform, query).catch(() => null), timeout]);

	if (timeoutId) clearTimeout(timeoutId);
	if (timedOut && log) await log(`${label} timed out after ${timeoutMs}ms`);
	return result;
}

app.get("/play", async (c) => {
	return await createMusicStream(c, async (log, s) => {
		const token = c.req.query("token");
		const query = c.req.query("q");
		const platform = (c.req.query("platform") || "youtubemusic").toLowerCase().replace(/\s+/g, "");
		const voiceId = c.req.query("voiceId");
		const reqGuildId = c.req.query("guildId");
		const authorId = c.req.query("authorId");
		const isDeaf = c.req.query("isDeaf") !== "false";
		const req247 = c.req.query("247");
		const allowFallback = c.req.query("fallback") !== "false";

		if (!token || !query || (!voiceId && (!reqGuildId || !authorId))) {
			await s.write(`],"data":${JSON.stringify({ status: false, message: "Missing required params: token, q, and either voiceId OR (guildId and authorId)", type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}

		let queryStr = query as string;
		if (queryStr.startsWith("http://") || queryStr.startsWith("https://")) {
			if (queryStr.includes("youtube.com") || queryStr.includes("youtu.be")) {
				try {
					const urlObj = new URL(queryStr);
					const topLevelList = c.req.query("list");
					if (topLevelList && !urlObj.searchParams.has("list")) {
						urlObj.searchParams.set("list", topLevelList);
						const topLevelIndex = c.req.query("index");
						if (topLevelIndex) {
							urlObj.searchParams.set("index", topLevelIndex);
						}
						queryStr = urlObj.toString();
					}
				} catch {}
			}
		}
		const isUrl = queryStr.startsWith("http://") || queryStr.startsWith("https://");

		const supportedPlatforms = ["youtube", "youtubemusic", "soundcloud", "spotify", "applemusic", "deezer", "tidal"];
		if (!isUrl && !supportedPlatforms.includes(platform)) {
			await log(`Unsupported search platform: "${platform}"`);
			await s.write(`],"data":${JSON.stringify({ status: false, message: `Search engine "${platform}" is not supported.`, list: supportedPlatforms.join(", "), type: { primary: "error", alt: "invalid_query" } })}}`);
			return;
		}

		const isNew = !hasActivePlayer(token);
		await log(isNew ? "Creating new discord.js client..." : "Reusing existing discord.js client");

		const effectivePlatform = isUrl ? getPlatformFromUrl(queryStr) || platform : platform;

		if (!isUrl) await log(`[Attempt 1] Custom ${platform} search: "${queryStr}"`);
		const pCustom = customSearchWithTimeout(effectivePlatform, queryStr, CUSTOM_SEARCH_TIMEOUT_MS, log, isUrl ? "[Attempt 1] URL metadata lookup" : `[Attempt 1] Custom ${platform} search`);
		const { client, player: manager } = await getOrCreatePlayer(token, log);

		await log(isNew ? "Discord.js client ready" : "Client retrieved");
		await log("Lavalink manager active");

		const applyOverlay = (result: any, customResult: CustomSearchResult | null) => {
			if (result?.tracks?.[0] && customResult) {
				const t = result.tracks[0];
				t.info = {
					...t.info,
					...(customResult.id ? { identifier: customResult.id } : {}),
					...(customResult.title ? { title: customResult.title } : {}),
					...(customResult.author ? { author: customResult.author } : {}),
					...(customResult.url ? { uri: customResult.url } : {}),
					...(customResult.thumbnail ? { artworkUrl: customResult.thumbnail } : {}),
					actualSourceName: t.info.sourceName,
					...(customResult.sourceName ? { sourceName: customResult.sourceName } : {}),
					...(customResult.duration ? { duration: customResult.duration } : {}),
				};
			}
		};

		const pRequester: Promise<any> = authorId
			? client.users
					.fetch(authorId as string)
					.then((user) => user)
					.catch(() => ({ id: authorId, username: "Discord User" }))
			: Promise.resolve(client.user);
		const requesterVoiceContext: { guildId?: string; voiceChannelId?: string } = {};

		const pVoice = (async () => {
			let channel: any = null;
			if (voiceId) {
				await log(`Resolving voice channel: ${voiceId}`);
				channel = await resolveVoiceChannel(client, voiceId);
				if (authorId && channel) {
					requesterVoiceContext.guildId = channel.guild.id;
					requesterVoiceContext.voiceChannelId = channel.id;
				}
				await log("Voice channel resolved");
			} else if (authorId && reqGuildId) {
				await log(`Looking for author's voice connection (${authorId}) in guild ${reqGuildId}...`);
				let guild = client.guilds.cache.get(reqGuildId as string);
				if (!guild) {
					guild = await client.guilds.fetch(reqGuildId as string).catch(() => undefined);
				}
				if (guild) {
					const voiceState = guild.voiceStates.cache.get(authorId as string);
					if (voiceState?.channel) channel = voiceState.channel;
				}
				if (channel) {
					requesterVoiceContext.guildId = channel.guild.id;
					requesterVoiceContext.voiceChannelId = channel.id;
					await log(`Found target in voice channel: ${channel.name}`);
					checkVoicePermissions(channel, client.user!);
				}
			}
			return channel;
		})();

		const pGP = (async () => {
			const channel = await pVoice;
			if (!channel) return null;

			const guildId = channel.guild.id;
			let gp = manager.players.get(guildId);

			// Force disconnect existing player if it's playing radio
			if (gp && gp.get("__isRadio")) {
				await log("Active radio player found, performing force disconnect...");
				if (gp.queue.previous.length > 0) {
					gp.queue.previous.splice(0, gp.queue.previous.length);
				}
				if (gp.queue.tracks.length > 0) {
					gp.queue.tracks.splice(0, gp.queue.tracks.length);
				}
				clear247(token, guildId);
				const radioVcId = gp.voiceChannelId;
				if (radioVcId) {
					await setVoiceStatus(radioVcId, token, "").catch(() => {});
				}
				voiceStatusStore.delete(`${token}:${guildId}`);
				await gp.destroy();
				await log("Radio player disconnected");

				try {
					if (localNode.id) manager.nodeManager.nodes.delete(localNode.id);
				} catch {}
				gp = undefined;
			}

			const isNewGP = !gp || (!gp.playing && !gp.paused && gp.queue.tracks.length === 0 && !gp.queue.current);

			if (!gp) {
				await log("Creating Lavalink player...");
				gp = await manager.createPlayer({
					guildId,
					voiceChannelId: channel.id,
					selfDeaf: isDeaf,
					selfMute: false,
				});
			} else {
				gp.options.selfDeaf = isDeaf;
			}

			return { gp, isNewGP };
		})();

		const pConnect = (async () => {
			const setup = await pGP;
			if (!setup) return;
			const { gp } = setup;
			if (!gp.connected) {
				await Promise.all([gp.connect(), log("Connecting to voice channel...")]);
				await log("Connected");
			}
		})();

		const pSearch = (async () => {
			const [setup, requester] = await Promise.all([pGP, pRequester]);
			if (!setup) throw new Error("No voice channel found");
			const { gp } = setup;
			if (authorId && requester && typeof requester === "object") {
				requester.guildId = requesterVoiceContext.guildId;
				requester.voiceChannelId = requesterVoiceContext.voiceChannelId;
			}

			const doSearch = async (q: string, src: string) => {
				const normalizedQ = normalizeUrl(q);
				const res = await gp.search(
					{
						query: normalizedQ,
						source: (src === "url" ? undefined : src) as any,
					},
					requester,
				);
				if (!res?.tracks?.length) throw new Error(`No results for "${normalizedQ}" due unavailable or geo-restriction`);
				return res;
			};

			const startLavalinkPlatformSearch = (searchPlatform: string, q: string) => {
				const lavalinkSource = PLATFORM_SEARCH[searchPlatform];
				if (!lavalinkSource) return Promise.resolve({ result: null, error: null });

				return doSearch(q, lavalinkSource)
					.then((result) => ({ result, error: null }))
					.catch((error) => ({ result: null, error }));
			};

			const useLavalinkPlatformSearch = async (attempt: string, label: string, searchPlatform: string, q: string, searchPromise = startLavalinkPlatformSearch(searchPlatform, q)) => {
				if (!PLATFORM_SEARCH[searchPlatform]) return null;

				await log(`[Attempt ${attempt}] Lavalink ${label} search: "${q}"`);
				const { result: lavalinkResult, error } = await searchPromise;
				if (lavalinkResult) {
					await log(`[Attempt ${attempt}] Lavalink ${label} search succeeded`);
					return lavalinkResult;
				}

				await log(`[Attempt ${attempt}] Lavalink ${label} search failed (${error?.message || "No results"})`);
				return null;
			};

			const pPrimaryLavalink = !isUrl && allowFallback ? startLavalinkPlatformSearch(platform, queryStr) : null;
			const customResult = await pCustom;

			let result: any = null;
			const loadSoundCloudManual = async (sourceUrl: string, attempt: string | number, overlaySource: CustomSearchResult | null): Promise<boolean> => {
				const streams = await infoSoundcloudStreams(sourceUrl);
				if (streams.length === 0) {
					await log(`[Attempt ${attempt}] No SoundCloud manual streams found`);
					return false;
				}

				for (const stream of streams) {
					const protocol = stream.protocol === "progressive" ? "progressive/legacy" : stream.protocol;
					const mime = stream.mimeType ? ` (${stream.mimeType})` : "";
					await log(`[Attempt ${attempt}] Manual ${protocol}${mime} stream resolved — loading via Lavalink`);
					try {
						result = await doSearch(stream.url, "url");
						applyOverlay(result, overlaySource);
						await log(`[Attempt ${attempt}] "SoundCloud Manual ${protocol}" succeeded`);
						return true;
					} catch (err: any) {
						await log(`[Attempt ${attempt}] "SoundCloud Manual ${protocol}" failed: ${err?.message || err}`);
					}
				}

				return false;
			};
			const ytListParam = isUrl
				? (() => {
						try {
							return new URL(queryStr).searchParams.get("list");
						} catch {
							return null;
						}
					})()
				: null;
			const isYtMix = ytListParam?.startsWith("RD") ?? false;
			const ytPlaylistUrl = isUrl ? extractYouTubePlaylistUrl(queryStr) : null; // returns null for RD lists
			const ytVideoUrl = isUrl ? extractYouTubeVideoUrl(queryStr) : null;

			if (isUrl) {
				await log(`Loading URL directly: "${queryStr}"`);
				try {
					if (isYtMix) {
						await log(`[Attempt 1] YouTube Mix (list=${ytListParam}) detected — fetching track list from watch page...`);
						const splitqueryStr = new URL(queryStr);
						const mixTrackUrls = await fetchYouTubeMixTracks(`https://youtube.com/watch?v=&list=${splitqueryStr.searchParams.get("list")}`);
						if (mixTrackUrls?.list?.length) {
							await log(`[Attempt 1] Fetched ${mixTrackUrls.list.length} tracks from mix — loading individually...`);
							const trackResults = await Promise.allSettled(mixTrackUrls.list.map((u) => doSearch(u, "url")));
							const tracks = trackResults.filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled").flatMap((r) => r.value.tracks ?? []);
							if (tracks.length > 0) {
								result = {
									loadType: "playlist",
									tracks,
									playlist: { name: mixTrackUrls.title, uri: queryStr },
								};
								await log(`[Attempt 1] Mix loaded: ${tracks.length}/${mixTrackUrls.list.length} tracks`);
							} else {
								throw new Error("No tracks could be loaded from YouTube Mix");
							}
						} else {
							throw new Error("Failed to extract tracks from YouTube Mix page");
						}
					} else if (ytPlaylistUrl) {
						await log(`[Attempt 1] YouTube playlist detected. Trying playlist first: "${ytPlaylistUrl}"`);
						result = await doSearch(ytPlaylistUrl, "url");
					} else {
						result = await doSearch(queryStr, "url");
						applyOverlay(result, customResult);
					}
				} catch (e: any) {
					if (effectivePlatform === "soundcloud") {
						await log(`[Attempt 1] SoundCloud direct load failed — attempting manual stream resolution`);
						await loadSoundCloudManual(queryStr, 2, customResult);
					}

					// Playlist URL fallback: if playlist load failed, try the video-only URL
					if (!result && ytVideoUrl) {
						await log(`[Attempt 1] YouTube playlist load failed (${e?.message}) — falling back to video-only URL`);
						try {
							await log(`[Attempt 2] Loading video-only URL: "${ytVideoUrl}"`);
							result = await doSearch(ytVideoUrl, "url");
							applyOverlay(result, customResult);
							await log(`[Attempt 2] Video-only fallback succeeded`);
						} catch (e2: any) {
							await log(`[Attempt 2] Video-only fallback also failed (${e2?.message}) — giving up`);
						}
					}
				}
			}

			// Skip the cross-platform fallback chain for YouTube playlist/mix URLs — if playlist and video-only failed, stop
			if (isUrl && !result && allowFallback && !ytPlaylistUrl && !isYtMix) {
				const metaQuery = customResult?.title ? (customResult.author ? `${customResult.title} ${customResult.author}` : customResult.title) : null;

				if (!metaQuery || !result) {
					await log(`[Attempt 1] Could not extract track title from URL — skipping fallback search`);
					throw new Error(`Direct load failed and no metadata found for "${queryStr}"`);
				}

				await log(`[Attempt 1] Extracted metadata: "${metaQuery}" — starting fallback search`);
				const urlFallbackQuery = metaQuery;
				const urlFallbacks: Array<{
					label: string;
					searchPlatform: string;
					query: string;
				}> = [];

				if (effectivePlatform !== "youtubemusic") {
					urlFallbacks.push({
						label: "YouTube Music",
						searchPlatform: "youtubemusic",
						query: urlFallbackQuery,
					});
				}
				if (effectivePlatform !== "spotify") {
					urlFallbacks.push({
						label: "Spotify",
						searchPlatform: "spotify",
						query: urlFallbackQuery,
					});
				}
				if (effectivePlatform !== "applemusic") {
					urlFallbacks.push({
						label: "Apple Music",
						searchPlatform: "applemusic",
						query: urlFallbackQuery,
					});
				}
				if (effectivePlatform !== "soundcloud") {
					urlFallbacks.push({
						label: "SoundCloud",
						searchPlatform: "soundcloud",
						query: urlFallbackQuery,
					});
				}
				if (effectivePlatform !== "deezer") {
					urlFallbacks.push({
						label: "Deezer",
						searchPlatform: "deezer",
						query: urlFallbackQuery,
					});
				}
				if (effectivePlatform !== "tidal") {
					urlFallbacks.push({
						label: "Tidal",
						searchPlatform: "tidal",
						query: urlFallbackQuery,
					});
				}

				let currentAttempt = 2;
				for (const attempt of urlFallbacks) {
					const pFallbackLavalink = startLavalinkPlatformSearch(attempt.searchPlatform, attempt.query);
					await log(`[Attempt ${currentAttempt}] Custom ${attempt.label} search: "${attempt.query}"`);
					try {
						const fallbackResult = await customSearchWithTimeout(attempt.searchPlatform, attempt.query, CUSTOM_SEARCH_TIMEOUT_MS, log, `[Attempt ${currentAttempt}] "${attempt.label}" search`);
						if (!fallbackResult?.url) {
							await log(`[Attempt ${currentAttempt}] "${attempt.label}" returned no results`);
						} else {
							await log(`[Attempt ${currentAttempt}] Got URL: "${fallbackResult.url}" — loading via Lavalink`);
							try {
								result = await doSearch(fallbackResult.url, "url");
								applyOverlay(result, customResult ?? fallbackResult);
								await log(`[Attempt ${currentAttempt}] "${attempt.label}" succeeded`);
								break;
							} catch (err: any) {
								if (attempt.searchPlatform === "soundcloud" && fallbackResult.url) {
									await log(`[Attempt ${currentAttempt}] SoundCloud direct load failed — attempting manual stream resolution`);
									if (await loadSoundCloudManual(fallbackResult.url, currentAttempt, customResult ?? fallbackResult)) break;
								}
								await log(`[Attempt ${currentAttempt}] "${attempt.label}" failed: ${err?.message}`);
							}
						}
					} catch (err: any) {
						await log(`[Attempt ${currentAttempt}] "${attempt.label}" failed: ${err?.message}`);
					}

					currentAttempt++;
					result = await useLavalinkPlatformSearch(String(currentAttempt), attempt.label, attempt.searchPlatform, attempt.query, pFallbackLavalink);
					if (result) applyOverlay(result, customResult);
					if (result) break;

					currentAttempt++;
				}
			} else if (!isUrl) {
				let currentAttempt = 2;

				if (customResult) {
					await log(`[Attempt 1] Got URL: "${customResult.url}" — loading via Lavalink`);
					try {
						result = await doSearch(customResult.url, "url");
						applyOverlay(result, customResult);
					} catch (e: any) {
						if (platform === "soundcloud" && customResult?.url) {
							await log(`[Attempt 1] SoundCloud direct load failed (${e?.message || e}) — attempting manual stream resolution`);
							const manualAttempt = currentAttempt++;
							await loadSoundCloudManual(customResult.url, manualAttempt, customResult);
						} else {
							await log(`[Attempt 1] ${platform} direct URL load failed (${e?.message || e})${allowFallback ? " — falling back to Lavalink search" : ""}`);
						}
					}
				} else {
					await log(`[Attempt 1] No URL returned${allowFallback ? " — falling back to Lavalink search" : " — fallback disabled"}`);
				}

				if (!result && allowFallback) {
					result = await useLavalinkPlatformSearch(String(currentAttempt), platform, platform, queryStr, pPrimaryLavalink || undefined);
					if (result) applyOverlay(result, customResult);
					currentAttempt++;
				}

				if (!result && allowFallback) {
					const hasMeta = customResult?.title && customResult?.author;
					const metaQuery = hasMeta ? `${customResult!.title} ${customResult!.author}` : null;

					const fallbacks: Array<{
						label: string;
						searchPlatform: string;
						query: string;
					}> = [];

					if (metaQuery) {
						fallbacks.push({
							label: "YouTube Music (metadata)",
							searchPlatform: "youtubemusic",
							query: metaQuery,
						});
					}
					if (!metaQuery && platform !== "youtubemusic") {
						fallbacks.push({
							label: "YouTube Music",
							searchPlatform: "youtubemusic",
							query: queryStr,
						});
					}
					if (platform !== "spotify")
						fallbacks.push({
							label: "Spotify",
							searchPlatform: "spotify",
							query: queryStr,
						});
					if (platform !== "applemusic")
						fallbacks.push({
							label: "Apple Music",
							searchPlatform: "applemusic",
							query: queryStr,
						});
					if (platform !== "soundcloud")
						fallbacks.push({
							label: "SoundCloud",
							searchPlatform: "soundcloud",
							query: queryStr,
						});
					if (platform !== "deezer")
						fallbacks.push({
							label: "Deezer",
							searchPlatform: "deezer",
							query: queryStr,
						});
					if (platform !== "tidal")
						fallbacks.push({
							label: "Tidal",
							searchPlatform: "tidal",
							query: queryStr,
						});

					for (const attempt of fallbacks) {
						const pFallbackLavalink = startLavalinkPlatformSearch(attempt.searchPlatform, attempt.query);
						await log(`[Attempt ${currentAttempt}] Custom ${attempt.label} search: "${attempt.query}"`);
						try {
							const fallbackResult = await customSearchWithTimeout(attempt.searchPlatform, attempt.query, CUSTOM_SEARCH_TIMEOUT_MS, log, `[Attempt ${currentAttempt}] "${attempt.label}" search`);
							if (!fallbackResult?.url) {
								await log(`[Attempt ${currentAttempt}] "${attempt.label}" returned no results`);
							} else {
								await log(`[Attempt ${currentAttempt}] Got URL: "${fallbackResult.url}" — loading via Lavalink`);
								try {
									result = await doSearch(fallbackResult.url, "url");
									applyOverlay(result, customResult ?? fallbackResult);
									await log(`[Attempt ${currentAttempt}] "${attempt.label}" succeeded`);
									break;
								} catch (err: any) {
									if (attempt.searchPlatform === "soundcloud" && fallbackResult.url) {
										await log(`[Attempt ${currentAttempt}] SoundCloud direct load failed — attempting manual stream resolution`);
										if (await loadSoundCloudManual(fallbackResult.url, currentAttempt, customResult ?? fallbackResult)) break;
									}
									await log(`[Attempt ${currentAttempt}] "${attempt.label}" failed: ${err?.message}`);
								}
							}
						} catch (err: any) {
							await log(`[Attempt ${currentAttempt}] "${attempt.label}" failed: ${err?.message}`);
						}

						currentAttempt++;
						result = await useLavalinkPlatformSearch(String(currentAttempt), attempt.label, attempt.searchPlatform, attempt.query, pFallbackLavalink);
						if (result) applyOverlay(result, customResult);
						if (result) break;

						currentAttempt++;
					}
				}
			}
			if (!result) throw new Error("All search methods failed");
			return result;
		})();

		const [searchResult, setup, _] = await Promise.allSettled([pSearch, pGP, pConnect]);

		if (searchResult.status === "rejected") {
			await s.write(`],"data":${JSON.stringify({ status: false, message: searchResult.reason?.message || "Search failed", type: { primary: "error", alt: "critical" } })}}`);
			return;
		}

		if (setup.status === "rejected" || !setup.value) {
			await log(setup.status === "rejected" ? `Voice setup failed: ${setup.reason?.message}` : "No voice channel found");
			await s.write(`],"data":${JSON.stringify({ status: false, message: setup.status === "rejected" ? setup.reason?.message : "Cant find a voice channel", type: { primary: "error", alt: "unknown_voice" } })}}`);
			return;
		}

		const { gp: guildPlayer, isNewGP: isNewGuildPlayer } = setup.value;
		const tracks = searchResult.value.tracks;
		const isPlaylist = searchResult.value.loadType === "playlist";
		let responseTrack = tracks[0];

		const guildId = guildPlayer.guildId;
		let is247 = get247(token!, guildId);
		if (req247 !== undefined) {
			is247 = req247 === "true";
			set247(token!, guildId, is247);
		}

		if (isPlaylist) {
			const playlistName = searchResult.value.playlist?.name || "Unknown Playlist";
			const playlistUrl = searchResult.value.playlist?.uri || searchResult.value.playlist?.url || "";
			const playlistTracks = tracks.map((t: any) => ({ ...t.info }));

			tracks.forEach((t: any) => {
				t.playlist = {
					name: playlistName,
					url: playlistUrl,
					tracks: playlistTracks,
				};
			});

			const filteredTracks = tracks.filter((t: any) => !t.info.isStream || isSoundCloudTrack(t));
			if (filteredTracks.length === 0) {
				await log("No non-live tracks found in playlist");
				await s.write(`],"data":${JSON.stringify({ status: false, message: "Playlist contains only live tracks, which are not allowed", type: { primary: "error", alt: "invalid_query" } })}}`);
				return;
			}
			responseTrack = filteredTracks[0];

			if (guildPlayer.get("autoplay")) {
				const autoplayIndex = guildPlayer.queue.tracks.findIndex((t) => (t.requester as any)?.isAutoplay);
				if (autoplayIndex !== -1) {
					await guildPlayer.queue.add(filteredTracks, autoplayIndex);
				} else {
					await guildPlayer.queue.add(filteredTracks);
				}
			} else {
				await guildPlayer.queue.add(filteredTracks);
			}
		} else {
			const track = tracks[0];
			if (track.info.isStream && !isSoundCloudTrack(track)) {
				await log(`Live track blocked: "${track.info.title}"`);
				await s.write(`],"data":${JSON.stringify({ status: false, message: "Live tracks (streams) are not allowed", type: { primary: "error", alt: "invalid_query" } })}}`);
				return;
			}
			responseTrack = track;
			if (guildPlayer.get("autoplay")) {
				const autoplayIndex = guildPlayer.queue.tracks.findIndex((t) => (t.requester as any)?.isAutoplay);
				if (autoplayIndex !== -1) {
					await guildPlayer.queue.add(track, autoplayIndex);
				} else {
					await guildPlayer.queue.add(track);
				}
			} else {
				await guildPlayer.queue.add(track);
			}
		}

		if (!guildPlayer.playing && !guildPlayer.paused) {
			try {
				await Promise.race([guildPlayer.play(), new Promise((_, reject) => setTimeout(() => reject(new Error("Play request timed out after 30s")), 30_000))]);
			} catch (err: any) {
				await log(`Play failed: ${err?.message || err}`);
				await s.write(`],"data":${JSON.stringify({ status: false, message: err?.message || "Failed to play track", type: { primary: "error", alt: "critical" } })}}`);
				return;
			}
		}

		const formattedTrack = formatTrack(responseTrack, client, guildPlayer);
		const queueTracks = guildPlayer.queue.tracks.slice(0, 3).map((t) => {
			const track = t as any;
			return track.info?.identifier === responseTrack.info?.identifier ? formattedTrack : formatTrack(track, client, guildPlayer);
		});
		const totalQueueDuration = guildPlayer.queue.tracks.reduce((acc, track) => acc + (track.info.duration ?? 0), 0);
		const activeFilters = getActiveFilters(guildPlayer);

		await s.write(
			`],"data":${JSON.stringify({
				status: true,
				nodeId: guildPlayer.node?.id ?? null,
				data: {
					isNewPlayer: isNewGuildPlayer,
					client: guildPlayer?.options || null,
					track: formattedTrack,
					platform,
					is247,
					isPlaying: guildPlayer.playing,
					isPaused: guildPlayer.paused,
					filters: {
						array: activeFilters.length > 0 ? activeFilters : [],
						string: activeFilters.length > 0 ? activeFilters.join(", ") : "",
					},
					queue: {
						size: guildPlayer.queue.tracks.length,
						limit_size: 3,
						tracks: queueTracks,
						elapsedTime: {
							label: formatDuration(totalQueueDuration),
							value: String(totalQueueDuration),
						},
					},
				},
				type: { primary: "final", alt: "success" },
			})}}`,
		);
	});
});

export default app;
