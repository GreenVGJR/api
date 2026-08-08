import { Hono } from "hono";
const app = new Hono();

import { DiscordModifyChannel, getQuery } from "../../functions/request.js";
import { dispatch, processImage } from "../../functions/httpRequest.js";

const parseJsonField = (val: string | null | undefined): { value?: any; error?: string } => {
	if (val === undefined || val === null) return { value: null };
	try {
		return { value: JSON.parse(val) };
	} catch {
		return { error: "Invalid JSON" };
	}
};

app.get("/discord/modifyChannel", async (c) => {
	const token = getQuery(c, "token");
	const channelId = getQuery(c, "channelId");
	if (!token) return c.json({ error: "Missing valid parameter: token" }, 202);
	if (!channelId) return c.json({ error: "Missing valid parameter: channelId" }, 202);

	const payload: any = {};
	const payloadError: string[] = [];

	const reason = getQuery(c, "reason");

	const buildNumber = (key: string, field: string, min = 0, max = Number.MAX_SAFE_INTEGER) => {
		const val = getQuery(c, key);
		if (val === undefined) return;
		if (val === null) {
			payload[field] = null;
			return;
		}
		const num = parseInt(val, 10);
		if (!isNaN(num) && num >= min && num <= max) payload[field] = num;
		else payloadError.push(`[${key}] Invalid number`);
	};

	const buildString = (field: string) => {
		const val = getQuery(c, field);
		if (val === undefined) return;
		if (val === null) {
			payload[field] = null;
		} else {
			payload[field] = val;
		}
	};

	const buildBool = (key: string, field: string) => {
		const val = getQuery(c, key);
		if (val === undefined) return;
		if (val === "true") payload[field] = true;
		else if (val === "false") payload[field] = false;
		else payloadError.push(`[${key}] Must be 'true' or 'false'`);
	};

	const buildOverrideable = (key: string, field: string) => {
		const val = getQuery(c, key);
		if (val === undefined) return;
		if (val === null) {
			payload[field] = null;
		} else {
			payload[field] = val;
		}
	};

	buildString("name");

	const typeVal = getQuery(c, "type");
	if (typeVal !== undefined) {
		if (typeVal === null) {
			payloadError.push("[type] Cannot be null");
		} else {
			// Per Discord docs, only conversion between text (0) and announcement (5) is supported
			const typeNorm = String(typeVal).toLowerCase();
			if (typeNorm === "text") payload.type = 0;
			else if (typeNorm === "announcement") payload.type = 5;
			else payloadError.push(`[type] Invalid channel type: "${typeVal}" (only text/announcement allowed)`);
		}
	}

	buildNumber("position", "position", -1000000, 1000000);
	buildOverrideable("topic", "topic");
	buildBool("nsfw", "nsfw");
	buildNumber("rateLimitPerUser", "rate_limit_per_user", 0, 21600);
	buildNumber("bitrate", "bitrate", 8000, 512000);
	buildNumber("userLimit", "user_limit", 0, 10000);
	buildOverrideable("parentId", "parent_id");
	buildOverrideable("rtcRegion", "rtc_region");
	buildNumber("videoQualityMode", "video_quality_mode", 1, 2);
	buildNumber("defaultAutoArchiveDuration", "default_auto_archive_duration", 0, 10080);
	buildNumber("defaultThreadRateLimitPerUser", "default_thread_rate_limit_per_user", 0, 21600);
	buildNumber("defaultSortOrder", "default_sort_order", 0, 3);
	buildNumber("defaultForumLayout", "default_forum_layout", 0, 2);
	buildOverrideable("description", "description");
	buildNumber("flags", "flags", 0, 1 << 62);

	const spoiler = getQuery(c, "spoiler");
	if (spoiler !== undefined) {
		const IS_SPOILER_CHANNEL = 1 << 21;
		const baseFlags = typeof payload.flags === "number" ? BigInt(payload.flags) : 0n;
		if (spoiler === "true") payload.flags = Number(baseFlags | BigInt(IS_SPOILER_CHANNEL));
		else if (spoiler === "false") payload.flags = Number(baseFlags & ~BigInt(IS_SPOILER_CHANNEL));
		else payloadError.push("[spoiler] Must be 'true' or 'false'");
	}

	const icon = getQuery(c, "icon");
	if (icon !== undefined) {
		if (icon === null) {
			payload.icon = null;
		} else if (icon) {
			const pIcon = await processImage(c, icon);
			if (pIcon == "") payloadError.push("[icon] Failed to download image");
			if (pIcon) payload.icon = pIcon;
		}
	}

	const permissionOverwrites = getQuery(c, "permissionOverwrites");
	if (permissionOverwrites !== undefined) {
		const parsed = parseJsonField(permissionOverwrites);
		if (parsed.error) payloadError.push(`[permissionOverwrites] ${parsed.error}`);
		else payload.permission_overwrites = parsed.value;
	}

	const defaultReactionEmoji = getQuery(c, "defaultReactionEmoji");
	if (defaultReactionEmoji !== undefined) {
		const parsed = parseJsonField(defaultReactionEmoji);
		if (parsed.error) payloadError.push(`[defaultReactionEmoji] ${parsed.error}`);
		else payload.default_reaction_emoji = parsed.value;
	}

	const availableTags = getQuery(c, "availableTags");
	if (availableTags !== undefined) {
		const parsed = parseJsonField(availableTags);
		if (parsed.error) payloadError.push(`[availableTags] ${parsed.error}`);
		else payload.available_tags = parsed.value;
	}

	if (payloadError.length) return c.json({ error: payloadError.join("; ") }, 202);

	c.header("X-Route", "discord.com");
	return await dispatch(c, () => DiscordModifyChannel(token!, channelId!, payload, reason || undefined));
});

export default app;
