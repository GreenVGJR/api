import { Hono } from 'hono';
const app = new Hono();

import {
    getOrCreatePlayer,
    getQueue,
    destroyPlayer,
    hasActivePlayer,
    get247,
    clear247,
    set247,
    createMusicStream,
} from '../../functions/musicPlayer.js';
// lavalink-client setRepeatMode expects string literals
type RMValue = 'off' | 'track' | 'queue';
const RM = { OFF: 'off' as RMValue, TRACK: 'track' as RMValue, QUEUE: 'queue' as RMValue };

// ─── Time Parser ──────────────────────────────────────────────────────────────

function parseTimeMS(timeStr: string): number {
    if (!timeStr) return 0;
    timeStr = timeStr.toLowerCase().trim();

    const hmsRegex = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?/;
    if (/[hm]/.test(timeStr)) {
        const match = timeStr.match(hmsRegex);
        if (match) {
            const hours   = parseInt(match[1] || '0', 10);
            const minutes = parseInt(match[2] || '0', 10);
            const seconds = parseInt(match[3] || '0', 10);
            return (hours * 3600 + minutes * 60 + seconds) * 1000;
        }
    }

    if (timeStr.includes(':')) {
        const parts = timeStr.split(':').map(p => parseInt(p, 10));
        if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
        if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    }

    const secs = parseInt(timeStr, 10);
    return isNaN(secs) ? 0 : secs * 1000;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** True if the player has an active track (playing or paused). */
function isActive(p: any): boolean {
    return !!(p.playing || p.paused || p.queue.current);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/pause', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token   = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue || !isActive(queue)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        if (queue.paused) {
            await s.write(`],"data":${JSON.stringify({
                status: false, message: 'Already paused',
                data: { action: 'pause', isPaused: true, isPlaying: false },
            })}}`);
            return;
        }

        await log('Pausing playback...');
        await queue.pause();
        await log('Paused successfully');

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: { action: 'paused', isPaused: queue.paused, isPlaying: queue.playing },
        })}}`);
    });
});


app.get('/resume', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token   = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue || !isActive(queue)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        if (!queue.paused) {
            await s.write(`],"data":${JSON.stringify({
                status: false, message: 'Already playing',
                data: { action: 'resume', isPaused: false, isPlaying: true },
            })}}`);
            return;
        }

        await log('Resuming playback...');
        await queue.resume();
        await log('Resumed successfully');

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: { action: 'resumed', isPaused: queue.paused, isPlaying: queue.playing },
        })}}`);
    });
});


app.get('/skip', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token    = c.req.query('token');
        const guildId  = c.req.query('guildId');
        const indexStr = c.req.query('index') || '';
        const index    = parseInt(indexStr, 10);

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue || !isActive(queue)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        // Skip to specific index
        if (indexStr !== '' && !isNaN(index)) {
            const tracks = queue.queue.tracks;
            if (index < 0 || index >= tracks.length) {
                await s.write(`],"data":${JSON.stringify({ status: false, message: `Index ${index} is out of bounds (0-${tracks.length - 1})` })}}`);
                return;
            }
            const targetTrack = tracks[index];
            await log(`Skipping to index ${index}: "${targetTrack.info.title}"`);
            // Remove all tracks before the target, then skip current
            if (index > 0) await queue.queue.splice(0, index);
            await queue.skip();
            await s.write(`],"data":${JSON.stringify({
                status: true,
                data: { action: 'skipped_to_index', targetTrack: { title: targetTrack.info.title, index } },
            })}}`);
            return;
        }

        if (queue.queue.tracks.length === 0) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No tracks in queue to skip' })}}`);
            return;
        }

        const skipped  = queue.queue.current;
        const nextTrack = queue.queue.tracks[0] ?? null;

        await log(`Skipping: "${skipped?.info.title || 'Unknown'}"...`);
        await queue.skip();
        await log(nextTrack ? `Now playing: "${nextTrack.info.title}"` : 'Queue ended');

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: {
                action: 'skipped',
                skippedTrack: skipped
                    ? { title: skipped.info.title, author: skipped.info.author, url: skipped.info.uri }
                    : null,
                currentTrack: nextTrack
                    ? { title: nextTrack.info.title, author: nextTrack.info.author, url: nextTrack.info.uri }
                    : null,
            },
        })}}`);
    });
});


app.get('/stop', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token   = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player: manager } = await getOrCreatePlayer(token);
        const queue = getQueue(manager, guildId);

        if (!queue || (!isActive(queue) && queue.queue.tracks.length === 0)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const is247 = get247(token!, guildId!);

        if (is247) {
            // 24/7 mode: let the player destroy normally, then immediately
            // recreate it and reconnect to the same voice channel.
            // Unset _247 BEFORE destroying so playerDestroy event doesn't
            // also trigger a competing reconnect247 call.
            const voiceChannelId = queue.voiceChannelId;
            await log(`24/7 mode — stopping and reconnecting to VC: ${voiceChannelId}`);
            clear247(token!, guildId!);
            await queue.destroy();
            await log('Player destroyed');

            try {
                const newPlayer = await manager.createPlayer({
                    guildId,
                    voiceChannelId: voiceChannelId!,
                    selfDeaf: true,
                    selfMute: false,
                    volume: 50,
                });
                set247(token!, guildId!, true);
                await newPlayer.connect();
                await log('Reconnected to voice channel in 24/7 mode');
            } catch (err: any) {
                await log(`Reconnect failed: ${err.message}`);
            }

            await log('Ending logs response...');
            await s.write(`],"data":${JSON.stringify({
                status: true,
                data: { action: 'stopped', context_destroyed: false, is247: true },
            })}}`);
            return;
        }

        await log('Destroying Lavalink player...');
        await queue.destroy();
        await log('Player destroyed');

        // Destroy the full client if no other guilds remain active
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
            await log('No other active servers, destroying discord.js client...');
            const token2 = c.req.query('token')!;
            await destroyPlayer(token2);
            killed = true;
            await log('Discord.js client destroyed');
        } else {
            await log('Other active servers exist, keeping client alive');
        }

        await log('Ending logs response...');
        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: { action: 'stopped', context_destroyed: killed, is247: false },
        })}}`);
    });
});


app.get('/seek', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token   = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue || !isActive(queue) || !queue.queue.current) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        if (queue.queue.current.info.isStream) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Cannot seek on a live stream' })}}`);
            return;
        }

        const time = c.req.query('time') || '';
        const ms   = parseTimeMS(time);
        const seekTarget = Math.max(0, Math.min(ms, queue.queue.current.info.duration || 0));
        await log(`Seeking to ${seekTarget}ms (input: "${time}")...`);

        try {
            await queue.seek(seekTarget);
            await log(`Seek completed to ${seekTarget}ms`);
        } catch (err: any) {
            await log(`Seek failed: ${err?.message || err}`);
            await s.write(`],"data":${JSON.stringify({ status: false, message: `Seek failed: ${err?.message || 'Unknown error'}` })}}`);
            return;
        }

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: { action: 'seek', time: seekTarget },
        })}}`);
    });
});


app.get('/volume', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token   = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const value = parseInt(c.req.query('value') || '');
        if (isNaN(value) || value < 0 || value > 100) {
            await s.write(`],"error":${JSON.stringify({ message: 'Volume must be a number between 0 and 100' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue || !isActive(queue)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        await log(`Setting volume to ${value}...`);
        await queue.setVolume(value);
        await log(`Volume set to ${queue.volume}`);

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: { action: 'volume_set', volume: queue.volume },
        })}}`);
    });
});


const LOOP_MODES: Record<string, RMValue> = {
    off:   RM.OFF,
    track: RM.TRACK,
    queue: RM.QUEUE,
};

const LOOP_MODE_NAMES: Record<RMValue, string> = {
    'off':   'off',
    'track': 'track',
    'queue': 'queue',
};

app.get('/loop', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token   = c.req.query('token');
        const guildId = c.req.query('guildId');
        const mode    = (c.req.query('mode') || '').toLowerCase();

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue || !isActive(queue)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        let repeatMode: RMValue;

        if (mode === '' || mode === 'toggle') {
            const current = queue.repeatMode as unknown as RMValue;
            if (current === RM.OFF)        repeatMode = RM.TRACK;
            else if (current === RM.TRACK) repeatMode = RM.QUEUE;
            else                           repeatMode = RM.OFF;
        } else if (mode in LOOP_MODES) {
            repeatMode = LOOP_MODES[mode];
        } else {
            // support numeric shortcuts: 0=off, 1=track, 2=queue
            const num = parseInt(mode, 10);
            const numMap: Record<number, RMValue> = { 0: 'off', 1: 'track', 2: 'queue' };
            if (!isNaN(num) && num in numMap) {
                repeatMode = numMap[num];
            } else {
                await s.write(`],"error":${JSON.stringify({ message: `Invalid loop mode: "${mode}". Use: off, track, queue (or 0-2)` })}}`);
                return;
            }
        }

        await log(`Setting loop mode to ${repeatMode}...`);
        await queue.setRepeatMode(repeatMode as any);
        await log(`Loop mode set to ${repeatMode}`);

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: { action: 'loop', mode: repeatMode },
        })}}`);
    });
});


app.get('/shuffle', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token   = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue || !isActive(queue)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        if (queue.queue.tracks.length < 2) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Need at least 2 tracks in queue to shuffle' })}}`);
            return;
        }

        await log(`Shuffling ${queue.queue.tracks.length} tracks...`);
        await queue.queue.shuffle();
        await log('Queue shuffled');

        const shuffledTracks = queue.queue.tracks.slice(0, 20).map(t => ({
            title: t.info.title,
            author: t.info.author,
            url: t.info.uri,
        }));

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: {
                action: 'shuffled',
                queueSize: queue.queue.tracks.length,
                tracks: shuffledTracks,
            },
        })}}`);
    });
});


app.get('/remove', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token    = c.req.query('token');
        const guildId  = c.req.query('guildId');
        const indexStr = c.req.query('index') || '';
        const index    = parseInt(indexStr, 10);

        if (!token || !guildId || indexStr === '' || isNaN(index)) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing or invalid required params: token, guildId, index' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const tracks = queue.queue.tracks;
        if (index < 0 || index >= tracks.length) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: `Index ${index} is out of bounds (0-${tracks.length - 1})` })}}`);
            return;
        }

        const trackToRemove = tracks[index];
        await log(`Removing track at index ${index}: "${trackToRemove.info.title}"`);
        await queue.queue.splice(index, 1);
        await log('Track removed');

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: { action: 'removed', track: { title: trackToRemove.info.title, index } },
        })}}`);
    });
});


app.get('/clear', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token   = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const sizeBefore = queue.queue.tracks.length;
        await log(`Clearing queue (${sizeBefore} tracks)...`);
        await queue.queue.splice(0, sizeBefore);
        await log('Queue cleared');

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: { action: 'cleared', tracksRemoved: sizeBefore },
        })}}`);
    });
});


app.get('/jump', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token    = c.req.query('token');
        const guildId  = c.req.query('guildId');
        const indexStr = c.req.query('index') || '';
        const index    = parseInt(indexStr, 10);

        if (!token || !guildId || indexStr === '' || isNaN(index)) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing or invalid required params: token, guildId, index' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue || !isActive(queue)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        const tracks = queue.queue.tracks;
        if (index < 0 || index >= tracks.length) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: `Index ${index} is out of bounds (0-${tracks.length - 1})` })}}`);
            return;
        }

        const targetTrack = tracks[index];
        await log(`Jumping to index ${index}: "${targetTrack.info.title}"`);

        // Remove all tracks before the target, then skip current
        if (index > 0) await queue.queue.splice(0, index);
        await queue.skip();
        await log('Jumped successfully');

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: { action: 'jumped', targetTrack: { title: targetTrack.info.title, index } },
        })}}`);
    });
});


app.get('/move', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token   = c.req.query('token');
        const guildId = c.req.query('guildId');
        const fromStr = c.req.query('from') || '';
        const toStr   = c.req.query('to') || '';
        const from    = parseInt(fromStr, 10);
        const to      = parseInt(toStr, 10);

        if (!token || !guildId || fromStr === '' || toStr === '' || isNaN(from) || isNaN(to)) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing or invalid required params: token, guildId, from, to' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const tracks = queue.queue.tracks;
        if (from < 0 || from >= tracks.length || to < 0 || to >= tracks.length) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Index out of bounds' })}}`);
            return;
        }

        const trackToMove = tracks[from];
        await log(`Moving track "${trackToMove.info.title}" from ${from} to ${to}`);

        // Splice out from original position, then insert at target
        const [removed] = await queue.queue.splice(from, 1);
        await queue.queue.splice(to, 0, removed);
        await log('Track moved');

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: { action: 'moved', track: trackToMove.info.title, from, to },
        })}}`);
    });
});


app.get('/back', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token   = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        if (!queue.queue.previous.length) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No history found' })}}`);
            return;
        }

        const prevTrack = queue.queue.previous[0];
        await log(`Backing to previous track: "${prevTrack?.info.title || 'Unknown'}"`);

        try {
            // lavalink-client has no built-in previous() — prepend the previous
            // track back into the queue then skip the current one
            await queue.queue.add(prevTrack as any, 0);
            await queue.skip();
            await log('Back successful');
        } catch (err: any) {
            await log(`Back failed: ${err.message}`);
            await s.write(`],"data":${JSON.stringify({ status: false, message: `Failed to go back: ${err.message}` })}}`);
            return;
        }

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: { action: 'back', currentTrack: prevTrack?.info.title ?? null },
        })}}`);
    });
});

export default app;

app.get('/where', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token    = c.req.query('token');
        const guildId  = c.req.query('guildId');
        const authorId = c.req.query('authorId');

        if (!token) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required param: token' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { client, player: manager } = await getOrCreatePlayer(token);

        // ── Bot's connected VCs (array) ───────────────────────────────────
        const botChannels: { id: string; voiceId: string; name: string; guildId: string }[] = [];

        const playersToCheck = guildId
            ? [[guildId, manager.players.get(guildId)]].filter(([, p]) => p) as [string, any][]
            : [...manager.players.entries()];

        for (const [gid, guildPlayer] of playersToCheck) {
            if (guildPlayer?.voiceChannelId) {
                const ch = await client.channels.fetch(guildPlayer.voiceChannelId).catch(() => null) as any;
                botChannels.push({
                    id: guildPlayer.voiceChannelId,
                    voiceId: guildPlayer.voiceChannelId,
                    name: ch?.name ?? 'Unknown',
                    guildId: gid,
                });
                await log(`Bot is in VC: ${ch?.name ?? 'Unknown'} (${guildPlayer.voiceChannelId}) in guild ${gid}`);
            }
        }

        if (botChannels.length === 0) await log('Bot is not in any voice channel');

        // ── Author's current VC ───────────────────────────────────────────
        let authorChannel: { id: string; voiceId: string; name: string; guildId: string } | null = null;

        if (authorId) {
            await log(`Looking up voice channel for user: ${authorId}`);
            const guildsToCheck = guildId
                ? [client.guilds.cache.get(guildId)].filter(Boolean)
                : [...client.guilds.cache.values()];

            for (const guild of guildsToCheck as any[]) {
                try {
                    const member = await guild.members.fetch(authorId).catch(() => null);
                    if (member?.voice?.channelId) {
                        const channelId = member.voice.channelId;
                        const channelName = member.voice.channel?.name ?? 'Unknown';
                        authorChannel = {
                            id: channelId,
                            voiceId: channelId,
                            name: channelName,
                            guildId: guild.id,
                        };
                        await log(`User ${authorId} is in VC: ${channelName} (${channelId})`);
                        break;
                    }
                } catch { }
            }
            if (!authorChannel) await log(`User ${authorId} is not in any voice channel`);
        }

        // Merge bot channels with author info into a flat array
        const result = botChannels.map(b => ({
            ...b,
            author: authorChannel?.guildId === b.guildId ? authorChannel : null,
            client: {
                id: b.id,
                voiceId: b.id,
                name: b.name,
                guildId: b.guildId,
            },
            sameChannel: !!(authorChannel && authorChannel.id === b.id),
        }));

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: result,
        })}}`);
    });
});