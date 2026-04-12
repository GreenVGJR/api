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
    formatDuration,
    formatTrack,
    fillAutoplay,
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
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token, log);
        const queue = getQueue(player, guildId);

        if (!queue || !isActive(queue)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        if (queue.paused) {
            await s.write(`],"data":${JSON.stringify({
                status: true,
                data: { action: 'none', isPaused: queue.paused, isPlaying: queue.playing },
            })}}`);
            return;
        }

        await queue.pause();

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
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token, log);
        const queue = getQueue(player, guildId);

        if (!queue || !isActive(queue)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        if (!queue.paused) {
            await s.write(`],"data":${JSON.stringify({
                status: true,
                data: { action: 'none', isPaused: queue.paused, isPlaying: queue.playing },
            })}}`);
            return;
        }

        await queue.resume();

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
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token, log);
        const queue = getQueue(player, guildId);

        if (!queue || !isActive(queue)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        if (queue.queue.tracks.length === 0) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No more tracks in queue to skip to' })}}`);
            return;
        }

        const skippedTrack = queue.queue.current;
        let nextTrack: any = queue.queue.tracks[0] ?? null;

        // If index provided, validate and reposition
        if (indexStr !== '' && !isNaN(index)) {
            const tracks = queue.queue.tracks;
            if (index < 0 || index >= tracks.length) {
                // If autoplay is on, we allow "skipping past the end" by just jumping to something new
                if (queue.get('autoplay')) {
                    await log(`Index ${index} is past the buffer, clearing and finding new recommendations...`);
                    await queue.queue.splice(0, tracks.length);
                    // Explicitly fill before continuing so the output matches
                    await fillAutoplay(queue);
                } else {
                    await s.write(`],"data":${JSON.stringify({ status: false, message: `Index ${index} is out of bounds (0-${tracks.length - 1})` })}}`);
                    return;
                }
            } else {
                nextTrack = tracks[index];
                if (index > 0) await queue.queue.splice(0, index);
            }
        }

        await log(skippedTrack ? `Skipping: "${skippedTrack.info.title}"...` : 'Skipping: Unknown...');
        
        // Use skip(0, false) originally intended, but if it's a live track,
        // we use stopPlaying(false) to ensure it stops correctly then plays next.
        if (skippedTrack?.info.isStream) {
            await (queue as any).stopPlaying(false);
        } else {
            await queue.skip(0, false);
        }
        await log(nextTrack ? `Now playing: "${nextTrack.info.title}"` : 'Queue ended');

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: {
                action: 'skipped',
                skippedTrack: skippedTrack
                    ? formatTrack(skippedTrack)
                    : null,
                currentTrack: nextTrack
                    ? formatTrack(nextTrack)
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
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player: manager } = await getOrCreatePlayer(token, log);
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
            if (queue.queue.previous.length > 0) {
                await log('Clearing queue history...');
                queue.queue.previous.splice(0, queue.queue.previous.length);
            }
            await queue.destroy();
            await log('Player destroyed');

            try {
                const newPlayer = await manager.createPlayer({
                    guildId,
                    voiceChannelId: voiceChannelId!,
                    selfDeaf: true,
                    selfMute: false
                });
                set247(token!, guildId!, true);
                await newPlayer.connect();
                await log('Reconnected to voice channel in 24/7 mode');
            } catch (err: any) {
                await log(`Reconnect failed: ${err.message}`);
            }

            await s.write(`],"data":${JSON.stringify({
                status: true,
                data: { action: 'stopped', context_destroyed: false, is247: true },
            })}}`);
            return;
        }

        await log('Clearing queue history...');
        if (queue.queue.previous.length > 0) {
            queue.queue.previous.splice(0, queue.queue.previous.length);
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
        const time = c.req.query('time');

        if (!token || !guildId || !time) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId, time' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token, log);
        const queue = getQueue(player, guildId);

        if (!queue || !isActive(queue) || !queue.queue.current) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        const currentTrack = queue.queue.current;
        const duration = currentTrack.info.duration || 0;

        if (currentTrack.info.isStream) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Cannot seek on a live track' })}}`);
            return;
        }

        if (duration <= 0) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Cannot seek: track metadata is missing duration' })}}`);
            return;
        }

        const ms = parseTimeMS(time);

        if (ms > duration) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: `Cannot seek beyond song duration (${Math.floor(duration/1000)}s)` })}}`);
            return;
        }

        if (ms < 0) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: `Cannot seek below 0` })}}`);
            return;
        }

        const seekTarget = Math.max(0, ms);
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
            data: { 
                action: 'seek', 
                time: String(seekTarget), 
                formatTime: formatDuration(seekTarget),  
                progress: {
                    current: { label: formatDuration(seekTarget), value: String(seekTarget) },
                    total: { label: formatDuration(currentTrack.info.duration), value: String(currentTrack.info.duration) },
                },
            },
        })}}`);
    });
});


app.get('/volume', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token   = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const value = parseInt(c.req.query('value') || '');
        if (isNaN(value) || value < 0 || value > 100) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Volume must be a number between 0 and 100' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token, log);
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


const LOOP_MODES: Record<string, RMValue | 'autoplay'> = {
    off:   RM.OFF,
    track: RM.TRACK,
    queue: RM.QUEUE,
    autoplay: 'autoplay',
};

const LOOP_MODE_NAMES: Record<RMValue | 'autoplay', string> = {
    'off':   'off',
    'track': 'track',
    'queue': 'queue',
    'autoplay': 'autoplay',
};

app.get('/loop', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token   = c.req.query('token');
        const guildId = c.req.query('guildId');
        const mode    = (c.req.query('mode') || '').toLowerCase();

        if (!token || !guildId) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token, log);
        const queue = getQueue(player, guildId);

        if (!queue || !isActive(queue)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        let repeatMode: RMValue | 'autoplay';

        if (mode === '' || mode === 'toggle') {
            const current = queue.repeatMode as unknown as RMValue;
            const isAutoplay = queue.get('autoplay');
            
            if (isAutoplay)                repeatMode = RM.TRACK;
            else if (current === RM.OFF)   repeatMode = 'autoplay';
            else if (current === RM.TRACK) repeatMode = RM.QUEUE;
            else                           repeatMode = RM.OFF;
        } else if (mode in LOOP_MODES) {
            repeatMode = LOOP_MODES[mode];
        } else {
            // support numeric shortcuts: 0=off, 1=track, 2=queue, 3=autoplay
            const num = parseInt(mode, 10);
            const numMap: Record<number, RMValue | 'autoplay'> = { 0: 'off', 1: 'track', 2: 'queue', 3: 'autoplay' };
            if (!isNaN(num) && num in numMap) {
                repeatMode = numMap[num];
            } else {
                await s.write(`],"data":${JSON.stringify({ status: false, message: `Invalid loop mode: "${mode}". Use: off, track, queue, autoplay (or 0-3)` })}}`);
                return;
            }
        }

        await log(`Setting loop mode to ${repeatMode}...`);
        
        if (repeatMode === 'autoplay') {
            queue.set('autoplay', true);
            await queue.setRepeatMode(RM.OFF as any);
            // Trigger initial fill so tracks appear immediately
            fillAutoplay(queue);
        } else {
            queue.set('autoplay', false);
            // Remove tracks added by autoplay
            const tracks = queue.queue.tracks;
            for (let i = tracks.length - 1; i >= 0; i--) {
                const t = tracks[i];
                if ((t.requester as any)?.isAutoplay) {
                    await queue.queue.splice(i, 1);
                }
            }
            await queue.setRepeatMode(repeatMode as any);
        }
        
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
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token, log);
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
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing or invalid required params: token, guildId, index' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token, log);
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
        const current = queue.queue.current;

        await log(`Removing: "${trackToRemove.info.title}"...`);
        await queue.queue.splice(index, 1);
        await log(current ? `Now playing: "${current.info.title}"` : 'Queue ended');

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: {
                action: 'removed',
                removedTrack: { title: trackToRemove.info.title, author: trackToRemove.info.author, url: trackToRemove.info.uri },
                currentTrack: current ? { title: current.info.title, author: current.info.author, url: current.info.uri } : null,
            },
        })}}`);
    });
});


app.get('/clear', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token   = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token, log);
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
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing or invalid required params: token, guildId, index' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token, log);
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
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing or invalid required params: token, guildId, from, to' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token, log);
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
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const { player } = await getOrCreatePlayer(token, log);
        const queue = getQueue(player, guildId);

        if (!queue) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        if (!queue.queue.previous.length) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No history found' })}}`);
            return;
        }

        const skipped = queue.queue.current;
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
            data: {
                action: 'back',
                skippedTrack: skipped
                    ? formatTrack(skipped)
                    : null,
                currentTrack: prevTrack
                    ? formatTrack(prevTrack)
                    : null,
            },
        })}}`);
    });
});

app.get('/247', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token   = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId' })}}`);
            return;
        }
        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const valueStr = c.req.query('value') || '';
        if (valueStr !== 'true' && valueStr !== 'false') {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Value must be "true" or "false"' })}}`);
            return;
        }

        const is247 = valueStr === 'true';

        // Check if the bot is actually in the guild
        const { player } = await getOrCreatePlayer(token, log);
        const queue = getQueue(player, guildId);

        if (!queue) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player or queue found for this guild' })}}`);
            return;
        }

        set247(token, guildId, is247);
        await log(`24/7 mode set to ${is247} for guild ${guildId}`);

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: { action: '247_set', is247 },
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
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required param: token' })}}`);
            return;
        }
        const isNew = !hasActivePlayer(token);
        await log(isNew ? 'Creating new discord.js client...' : 'Reusing existing discord.js client');

        const { client, player: manager } = await getOrCreatePlayer(token, log);
        await log(isNew ? 'Discord.js client ready' : 'Client retrieved');
        await log('Lavalink manager active');

        // ── Bot's connected VCs (array) ───────────────────────────────────
        const botChannels: { id: string; voiceId: string; name: string; guildId: string; usersInChannel: { id: string; username: string; displayName: string; isBot: boolean; }[] | null }[] = [];

        const playersToCheck = guildId
            ? [[guildId, manager.players.get(guildId)]].filter(([, p]) => p) as [string, any][]
            : [...manager.players.entries()];

        for (const [gid, guildPlayer] of playersToCheck) {
            if (guildPlayer?.voiceChannelId) {
                const ch = await client.channels.fetch(guildPlayer.voiceChannelId).catch(() => null) as any;
                const usersInChannel = ch?.members
                    ? [...ch.members.values()].map((m: any) => ({
                        id: m.user.id,
                        username: m.user.username,
                        displayName: m.displayName,
                        isBot: m.user.bot,
                    }))
                    : null;
                botChannels.push({
                    id: guildPlayer.voiceChannelId,
                    voiceId: guildPlayer.voiceChannelId,
                    name: ch?.name ?? 'Unknown',
                    guildId: gid,
                    usersInChannel,
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
            client: {
                id: b.id,
                voiceId: b.id,
                name: b.name,
                guildId: b.guildId,
            },
            author: authorChannel?.guildId === b.guildId ? authorChannel : null,
            sameChannel: !!(authorChannel && authorChannel.id === b.id),
            usersInChannel: b.usersInChannel,
        }));

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: result,
            author: authorChannel,
        })}}`);
    });
});