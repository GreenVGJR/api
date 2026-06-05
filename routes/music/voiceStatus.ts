import { Hono } from 'hono';
import {
    getOrCreatePlayer,
    setVoiceStatus,
    updateVoiceStatus,
    createMusicStream,
    getVoiceStatusSettings,
    setVoiceStatusSetting
} from '../../functions/musicPlayer.js';

const app = new Hono();

app.get('/voiceStatus', async (c) => {
    return await createMusicStream(c, async (log, s) => {
        const token = c.req.query('token');
        const guildId = c.req.query('guildId');
        const type = c.req.query('type');
        const statusStr = c.req.query('status');
        const content = c.req.query('content');

        if (!token || !guildId) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId', type: { primary: "error", alt: "invalid_query" } })}}`);
            return;
        }

        try {
            await log('Fetching player...');
            const { client, player: manager } = await getOrCreatePlayer(token, log);
            
            await log(`Validating guild: ${guildId}`);
            let guild = client.guilds.cache.get(guildId as string);
            if (!guild) {
                guild = await client.guilds.fetch(guildId as string).catch(() => undefined);
            }
            if (!guild) {
                await log('Guild not found or bot not in guild');
                await s.write(`],"data":${JSON.stringify({ status: false, message: 'Guild not found or bot not in guild', data: getVoiceStatusSettings(token, "unknown"), type: { primary: "error", alt: "invalid_query" } })}}`);
                return;
            }

            const player = manager.players.get(guildId);
            const channelId = player?.voiceChannelId;
            const isActivePlayer = !!(player && player.queue.current);

            if (type && statusStr !== undefined) {
                const validTypes = ['trackStart', 'queueEnd'];
                if (!validTypes.includes(type)) {
                    await log(`Invalid type: ${type}`);
                    await s.write(`],"data":${JSON.stringify({
                        status: false,
                        message: `Invalid type "${type}". Allowed: ${validTypes.join(', ')}`,
                        data: getVoiceStatusSettings(token, guildId),
                        type: { primary: "error", alt: "invalid_query" }
                    })}}`);
                    return;
                }

                const isActive = statusStr === 'true';
                const template = (content || "").trim();

                await log(`Configuring voice status for type: ${type} (Active: ${isActive})`);

                // Persist settings in the central store (works even if player is destroyed or not yet playing)
                setVoiceStatusSetting(token, guildId, type, isActive, template);

                // Only attempt immediate status update if there's actually a player and track active
                if (isActivePlayer && type === 'trackStart') {
                    if (isActive) {
                        if (template === "") {
                            await log('Clearing track start status...');
                            await setVoiceStatus(channelId!, token, "");
                        } else {
                            await log('Updating track start status...');
                            await updateVoiceStatus(player!, token);
                        }
                    } else {
                        await log('Clearing track start status (deactivated)...');
                        await setVoiceStatus(channelId!, token, "");
                    }
                }

                await log('Configuration saved');
            } else {
                await log('Fetched current configurations');
            }

            // Return response: status is true only if a player is active, 
            // but the data always reflects the most recent settings.
            await s.write(`],"data":${JSON.stringify({
                status: isActivePlayer,
                message: isActivePlayer ? undefined : 'No active player for this channel',
                data: {
                    ...getVoiceStatusSettings(token, guildId),
                    tags: [
                        "{id}", "{title}", "{author}", "{url}", "{source}", "{actualSource}", "{thumbnail}",
                        "{duration}", "{durationMS}", "{isSeekable}", "{isStream}", "{requestedBy}",
                        "{requester.id}", "{requester.username}", "{requester.globalName}", "{requester.tag}"
                    ]
                },
                type: { primary: "final", alt: "success" }
            })}}`);
        } catch (err: any) {
            await log(`Error: ${err?.message}`);
            await s.write(`],"data":${JSON.stringify({ status: false, message: err?.message || 'Failed to update voice status configuration', type: { primary: "error", alt: "critical" } })}}`);
        }
    });
});

export default app;
