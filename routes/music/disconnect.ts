import { Hono } from 'hono';
const app = new Hono();

import {
    getOrCreatePlayer,
    destroyPlayer,
    hasActivePlayer,
    createMusicStream,
    clear247,
    setVoiceStatus,
    voiceStatusStore,
} from '../../functions/musicPlayer.js';

app.get('/disconnect', async (c) => {
    const token = c.req.query('token');
    const guildId = c.req.query('guildId');
    const voiceId = c.req.query('voiceId');

    return await createMusicStream(c, async (log, s) => {
        if (!token || !guildId) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId', type: { primary: "error", alt: "invalid_query" } })}}`);
            return;
        }


        if (!hasActivePlayer(token)) {
            await log('No active player found for this token');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found', type: { primary: "error", alt: "inactive_player" } })}}`);
            return;
        }

        const { player: manager } = await getOrCreatePlayer(token);

        // ── Guild-scoped disconnect ───────────────────────────────────────
        if (guildId) {
            await log(`Disconnecting from guild: ${guildId}`);

            const guildPlayer = manager.players.get(guildId);
            if (!guildPlayer) {
                await log('No Lavalink player found for this guild');
                await s.write(`],"data":${JSON.stringify({
                    status: false,
                    message: 'Not connected to this guild',
                    type: { primary: "error", alt: "inactive_player" }
                })}}`);
                return;
            }

            if (guildPlayer.queue.previous.length > 0) {
                await log('Clearing queue history...');
                guildPlayer.queue.previous.splice(0, guildPlayer.queue.previous.length);
            }

            // Explicitly clear 24/7 and wipe voice status/configs for this guild
            clear247(token, guildId);
            const voiceChannelId = guildPlayer.voiceChannelId;
            if (voiceChannelId) {
                await setVoiceStatus(voiceChannelId, token, "").catch(() => { });
            }
            voiceStatusStore.delete(`${token}:${guildId}`);

            await guildPlayer.destroy();
            await log('Lavalink player destroyed');

            // Destroy the discord.js client only if no other guilds are active
            let hasActiveNodes = false;
            for (const [id, p] of manager.players) {
                if (id === guildId) continue;
                if (p.playing || p.paused || p.queue.tracks.length > 0) {
                    hasActiveNodes = true;
                    break;
                }
            }

            let killed = false;
            if (!hasActiveNodes) {
                await log('No other active guilds, destroying discord.js client...');
                await destroyPlayer(token);
                killed = true;
                await log('Discord.js client destroyed');
            }

            await s.write(`],"data":${JSON.stringify({
                status: true,
                data: { action: 'disconnected', guildId, context_destroyed: killed },
                type: { primary: "final", alt: "success" }
            })}}`);

            // ── Full destroy (no guildId) ─────────────────────────────────────
        } else {
            await log('No guildId specified, destroying entire player...');
            await destroyPlayer(token);
            await log('Discord.js client and all Lavalink players destroyed');

            await s.write(`],"data":${JSON.stringify({
                status: true,
                data: { action: 'disconnected', context_destroyed: true },
                type: { primary: "final", alt: "success" }
            })}}`);
        }
    });
});

export default app;