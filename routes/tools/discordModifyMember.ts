import { Hono } from "hono";
const app = new Hono();

import { DiscordMember } from "../../functions/request.js";
import { dispatch, processImage } from "../../functions/httpRequest.js";

// Credits: @zombie.clanx
// For name style codes

function hexToDiscordColor(hex: string): number {
	const val = parseInt(hex.replace("#", ""), 16);
	return isNaN(val) ? 0 : Math.min(val, 0xffffff);
}

const EFFECT_MAP: Record<string, number> = {
	none: 0,
	glow: 1,
	gradient: 2,
	neon: 3,
	chromatic: 4,
	shimmer: 5,
};

const FONT_MAP: Record<string, number> = {
	bangers: 1,
	bio_rhyme: 2,
	cherry_bomb: 3,
	compagnon: 5,
	museo_moderno: 6,
	neo_castel: 7,
	pixelify: 8,
	ribes: 9,
	sinistre: 10,
	default: 11,
	zilla_slab: 12,
};

app.get("/discord/modifyMemberServer", async (c) => {
	let token: string | null = null;
	try {
		const queryToken = c.req.query("token");
		if (queryToken) {
			const checktoken = Number.isInteger(parseInt(atob(queryToken.split(".")[0])));
			if (!checktoken) throw new Error();
			token = queryToken;
		}
	} catch {}
	const queryGuildId = c.req.query("guildId");
	const guildId = queryGuildId && Number.isInteger(parseInt(queryGuildId)) ? queryGuildId : null;

	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!guildId) return c.json({ error: "Missing valid parameter: guildId" }, 202);

	const getQuery = (key: string) => {
		const val = c.req.query(key);
		if (val === undefined) return undefined;
		if (val === "null") return null;
		return val;
	};

	const payload: any = {};
	const payloadError: string[] = [];

	const nickname = getQuery("nickname") ?? getQuery("nick");
	const reason = getQuery("reason");
	const bio = getQuery("bio");
	const reset = getQuery("reset");

	const effectStyle = getQuery("effectStyle");
	const fontStyle = getQuery("fontStyle");
	const colorsStyle = getQuery("colorsStyle");

	const avatar = getQuery("avatar");
	const banner = getQuery("banner");

	if (reset !== undefined) {
		payload.nick = null;
		payload.bio = null;
		payload.avatar = null;
		payload.banner = null;
		payload.display_name_font_id = 11;
		payload.display_name_effect_id = 0;
		payload.display_name_colors = null;
	} else {
		if (nickname !== undefined) payload.nick = nickname;
		if (bio !== undefined) payload.bio = bio;

		if (avatar === null) {
			payload.avatar = null;
		} else if (avatar) {
			const pAvatar = await processImage(c, avatar);
			if (pAvatar == "") payloadError.push("[avatar] Failed to download image");
			if (pAvatar) payload.avatar = pAvatar;
		}

		if (banner === null) {
			payload.banner = null;
		} else if (banner) {
			const pBanner = await processImage(c, banner);
			if (pBanner == "") payloadError.push("[banner] Failed to download image");
			if (pBanner) payload.banner = pBanner;
		}

		if (effectStyle !== undefined) {
			payload.display_name_effect_id = effectStyle === null ? 0 : (EFFECT_MAP[effectStyle] ?? 0);
		}
		if (fontStyle !== undefined) {
			payload.display_name_font_id = fontStyle === null ? 11 : (FONT_MAP[fontStyle] ?? 11);
		}
		if (colorsStyle !== undefined) {
			if (colorsStyle === null) {
				payload.display_name_colors = null;
			} else {
				try {
					const colors = JSON.parse(colorsStyle);
					if (Array.isArray(colors) && colors.length >= 2) {
						payload.display_name_colors = colors.map((c: string) => hexToDiscordColor(c));
					} else {
						payloadError.push("[colorsStyle] Expected a JSON array with at least 2 hex colors");
					}
				} catch {
					payloadError.push("[colorsStyle] Invalid JSON");
				}
			}
		}
	}

	c.header("X-Route", "discord.com");
	return await dispatch(c, () => DiscordMember(token!, guildId!, payload, payloadError, reason || undefined, reset !== undefined));
});

export default app;
