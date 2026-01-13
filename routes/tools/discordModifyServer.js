"use strict";

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
const commonHeaders = {
    'Accept': 'video/*, image/*',
    'Accept-Encoding': '',
    'Accept-Language': 'en',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'User-Agent': userAgent
}

const { Hono } = require('hono');
const app = new Hono();

const { Discord } = require('../../functions/request');
const { dispatch } = require('../../functions/httpRequest');

async function processImage(url) {
    if (!url) return undefined;
    if (!url.startsWith('http')) return undefined;
    
    try {
        const res = await fetch(url, { headers: { ...commonHeaders }});
        if(!res.ok) return '';
        if(!res.headers?.get('content-type').startsWith('image/') || !res.headers?.get('content-type').startsWith('video/')) return '';
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const type = res.headers.get('content-type');
        return `data:${type};base64,${buffer.toString('base64')}`;
    } catch {
        return '';
    }
}

app.get('/discord/modifyServer', async (c) => {
    let token = null;
    try {
        const checktoken = Number.isInteger(parseInt(atob(c.req.query('token').split('.')[0])));
        if(!checktoken) throw new Error();
        token = c.req.query('token');
    }
    catch {}
    const guildId = Number.isInteger(parseInt(c.req.query('guildId'))) ? c.req.query('guildId') : null;

    if (!token) return c.json(["Missing valid parameter: token"], 202);
    if (!guildId) return c.json(["Missing valid parameter: guildId"], 202);

    const payload = {};
    let payloadError = [];
    const name = c.req.query('guildName');
    const reason = c.req.query('reason');
    const description = c.req.query('guildDescription');
    const verificationLevel = c.req.query('guildVerifyLevel');
    const icon = c.req.query('guildIcon');
    const splash = c.req.query('guildSplash');
    const banner = c.req.query('guildBanner');
    const rulesChannelId = c.req.query('guildRulesChannelId');
    const publicUpdatesChannelId = c.req.query('guildCommunityChannelId');
    const preferredLocale = c.req.query('guildPreferredLocale');
    const vanityCode = c.req.query('guildVanityCode');

    if (name) payload.name = name;
    if (description) payload.description = description;

    if (rulesChannelId) payload.rules_channel_id = rulesChannelId;
    if (publicUpdatesChannelId) payload.public_updates_channel_id = publicUpdatesChannelId;
    if (preferredLocale) payload.preferred_locale = preferredLocale;
    if (vanityCode) payload.vanity_code = vanityCode;
    
    if (verificationLevel) {
        const vLevel = parseInt(verificationLevel);
        if (!isNaN(vLevel) && vLevel >= 0 && vLevel <= 4) {
            payload.verification_level = vLevel;
        }
    }

    if (icon === 'null') {
        payload.icon = null;
    } else if (icon) {
        const pIcon = await processImage(icon);
        if(pIcon == '') payloadError.push('[guildIcon] Failed to download image');
        if (pIcon) payload.icon = pIcon;
    }
    
    if (splash === 'null') {
        payload.splash = null;
    } else if (splash) {
        const pSplash = await processImage(splash);
        if(pSplash == '') payloadError.push('[guildSplash] Failed to download image');
        if (pSplash) payload.splash = pSplash;
    }
    
    if (banner === 'null') {
        payload.banner = null;
    } else if (banner) {
        const pBanner = await processImage(banner);
        if(pBanner == '') payloadError.push('[guildBanner] Failed to download image');
        if (pBanner) payload.banner = pBanner;
    }

    c.header('X-Route', 'discord.com');
    return await dispatch(c, () => Discord(token, guildId, payload, payloadError, reason));
});

module.exports = app;