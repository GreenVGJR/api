import { Hono } from "hono";
const app = new Hono();

import { DiscordCreateRole } from "../../functions/request.js";
import { dispatch, processImage } from "../../functions/httpRequest.js";

app.get("/discord/createRole", async (c) => {
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

	const getQuery = (key: string): string | undefined => {
		const val = c.req.query(key);
		if (val === undefined) return undefined;
		if (val === "null") return null as any;
		return val;
	};

	const payload: any = {};
	const payloadError: string[] = [];

	const reason = getQuery("reason");

	const name = getQuery("name");
	const color = getQuery("color");
	const permissions = getQuery("permissions");
	const hoist = getQuery("hoist");
	const mentionable = getQuery("mentionable");
	const unicodeEmoji = getQuery("unicodeEmoji");
	const icon = getQuery("roleIcon");

	if (!name) payloadError.push("[name] Required");
	else payload.name = name;

	if (color !== undefined) {
		if (color === null) {
			payload.color = 0;
		} else {
			let cVal: number;
			if (color.startsWith("#")) {
				cVal = parseInt(color.slice(1), 16);
			} else if (color.startsWith("0x") || color.startsWith("0X")) {
				cVal = parseInt(color.slice(2), 16);
			} else {
				cVal = parseInt(color, 10);
			}
			if (!isNaN(cVal) && cVal >= 0 && cVal <= 0xffffff) {
				payload.color = cVal;
			} else {
				payloadError.push("[color] Invalid color value (must be 0-16777215 or hex like #a09fff)");
			}
		}
	}

	if (permissions !== undefined) {
		if (permissions === null) {
			payload.permissions = "0";
		} else {
			const pVal = parseInt(permissions);
			if (!isNaN(pVal) && pVal >= 0) {
				payload.permissions = String(pVal);
			} else {
				payloadError.push("[permissions] Invalid permission bitfield");
			}
		}
	}

	if (hoist !== undefined) {
		if (hoist === "true") payload.hoist = true;
		else if (hoist === "false") payload.hoist = false;
		else payloadError.push("[hoist] Must be 'true' or 'false'");
	}

	if (mentionable !== undefined) {
		if (mentionable === "true") payload.mentionable = true;
		else if (mentionable === "false") payload.mentionable = false;
		else payloadError.push("[mentionable] Must be 'true' or 'false'");
	}

	if (unicodeEmoji !== undefined) {
		if (unicodeEmoji === null) payload.unicode_emoji = null;
		else payload.unicode_emoji = unicodeEmoji;
	}

	if (icon === null) {
		payload.icon = null;
	} else if (typeof icon === "string" && icon) {
		const pIcon = await processImage(c, icon);
		if (pIcon == "") payloadError.push("[roleIcon] Failed to download image");
		if (pIcon) payload.icon = pIcon;
	}

	c.header("X-Route", "discord.com");
	return await dispatch(c, () => DiscordCreateRole(token!, guildId!, payload, reason || undefined));
});

export default app;
