import { Hono } from 'hono';
const app = new Hono();

import { getOrCreatePlayer, getQueue, destroyPlayer, hasActivePlayer, createMusicStream } from '../../functions/musicPlayer.js';
import { QueueRepeatMode } from 'discord-player';


function parseTimeMS(timeStr: string): number {
    if (!timeStr) return 0;
    timeStr = timeStr.toLowerCase().trim();


    const hmsRegex = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?/;
    if (/[hm]/.test(timeStr)) {
        const match = timeStr.match(hmsRegex);
        if (match) {
            const hours = parseInt(match[1] || '0', 10);
            const minutes = parseInt(match[2] || '0', 10);
            const seconds = parseInt(match[3] || '0', 10);
            return (hours * 3600 + minutes * 60 + seconds) * 1000;
        }
    }


    if (timeStr.includes(':')) {
        const parts = timeStr.split(':').map(p => parseInt(p, 10));
        if (parts.length === 2) {
            return (parts[0] * 60 + parts[1]) * 1000;
        } else if (parts.length === 3) {
            return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
        }
    }


    const secs = parseInt(timeStr, 10);
    return isNaN(secs) ? 0 : secs * 1000;
}


app.get('/pause', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }

        if (!hasActivePlayer(token)) {
            await log('No active player found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        await log('Retrieving player...');
        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue || !queue.isPlaying()) {
            await log('No active queue found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        if (queue.node.isPaused()) {
            await log('Already paused, no action taken');
            await s.write(`],"data":${JSON.stringify({
                status: false,
                message: 'Already paused',
                data: { action: 'pause', isPaused: true, isPlaying: false }
            })}}`);
            return;
        }

        await log('Pausing playback...');
        queue.node.pause();
        await log('Paused successfully');

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: { action: 'paused', isPaused: queue.node.isPaused(), isPlaying: queue.node.isPlaying() }
        })}}`);
    });
});


app.get('/resume', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }

        if (!hasActivePlayer(token)) {
            await log('No active player found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        await log('Retrieving player...');
        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue || !queue.isPlaying()) {
            await log('No active queue found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        if (!queue.node.isPaused()) {
            await log('Already playing, no action taken');
            await s.write(`],"data":${JSON.stringify({
                status: false,
                message: 'Already playing',
                data: { action: 'resume', isPaused: false, isPlaying: true }
            })}}`);
            return;
        }

        await log('Resuming playback...');
        queue.node.resume();
        await log('Resumed successfully');

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: { action: 'resumed', isPaused: queue.node.isPaused(), isPlaying: queue.node.isPlaying() }
        })}}`);
    });
});


app.get('/skip', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }

        if (!hasActivePlayer(token)) {
            await log('No active player found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        await log('Retrieving player...');
        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue || !queue.isPlaying()) {
            await log('No active queue found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        if (queue.tracks.size === 0) {
            await log('No tracks in queue to skip');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No tracks in queue to skip' })}}`);
            return;
        }

        const skipped = queue.currentTrack;
        const nextTrack = queue.tracks.toArray()[0] || null;

        await log(`Skipping: "${skipped?.title || 'Unknown'}"...`);
        queue.node.skip();
        await log(nextTrack ? `Now playing: "${nextTrack.title}"` : 'Queue ended');

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: {
                action: 'skipped',
                skippedTrack: skipped ? { title: skipped.title, author: skipped.author, url: skipped.url } : null,
                currentTrack: nextTrack ? { title: nextTrack.title, author: nextTrack.author, url: nextTrack.url } : null
            }
        })}}`);
    });
});


app.get('/stop', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }

        if (!hasActivePlayer(token)) {
            await log('No active player found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        await log('Retrieving player...');
        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue || (!queue.isPlaying() && queue.tracks.size === 0)) {
            await log('No active queue found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        await log('Deleting queue...');
        queue.delete();
        await log('Queue deleted');


        let hasActiveNodes = false;
        for (const [id, node] of player.nodes.cache) {
            if (id === guildId) continue;
            if (node.isPlaying() || node.tracks.size > 0) {
                hasActiveNodes = true;
                break;
            }
        }

        let killed = false;

        if (!hasActiveNodes) {
            await log('No other active servers, destroying discord.js client...');
            await destroyPlayer(token);
            killed = true;
            await log('Discord.js client destroyed');
        } else {
            await log('Other active servers exist, keeping client alive');
        }

        await log('Ending logs response...');

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: { action: 'stopped', context_destroyed: killed }
        })}}`);
    });
});


app.get('/seek', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }

        if (!hasActivePlayer(token)) {
            await log('No active player found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        await log('Retrieving player...');
        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue || !queue.isPlaying() || !queue.currentTrack) {
            await log('No active queue found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }


        const isLive = queue.currentTrack.raw?.live === true || queue.currentTrack.duration === '0:00';
        if (isLive) {
            await log('Cannot seek live track');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Cannot seek on a live stream' })}}`);
            return;
        }

        const time = c.req.query('time') || '';
        const ms = parseTimeMS(time);
        await log(`Seeking to ${ms}ms (input: "${time}")...`);

        const currentTrack = queue.currentTrack;
        if (!currentTrack) {
            await log('No current track to seek');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No current track to seek' })}}`);
            return;
        }

        const seekTarget = Math.max(0, Math.min(ms, queue.node.estimatedDuration || currentTrack.durationMS || 0));

        try {

            const seeker = (queue as any).filters?.seeker;
            const seekerPos = seeker ? seeker.getPosition() : 'no seeker';
            const playbackTime = queue.node.playbackTime;
            const estimatedPlaybackTime = queue.node.estimatedPlaybackTime;
            await log(`Pre-seek state: seekerPos=${seekerPos}, playbackTime=${playbackTime}, estimatedPlaybackTime=${estimatedPlaybackTime}, seekTarget=${seekTarget}`);


            const result = await queue.node.seek(seekTarget);


            const seekerPosAfter = seeker ? seeker.getPosition() : 'no seeker';
            const playbackTimeAfter = queue.node.playbackTime;
            await log(`Post-seek state: result=${result}, seekerPos=${seekerPosAfter}, playbackTime=${playbackTimeAfter}`);

                        await log(`Seek completed to ${seekTarget}ms`);
        } catch (err: any) {
            queue.tasksQueue.clear(true);
            await log(`Seek failed: ${err?.message || err}. Cleared tasksQueue.`);
            await s.write(`],"data":${JSON.stringify({ status: false, message: `Seek failed: ${err?.message || 'Unknown error'}` })}}`);
            return;
        }

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: { action: 'seek', time: ms }
        })}}`);
    });
});


app.get('/volume', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }

        if (!hasActivePlayer(token)) {
            await log('No active player found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        const value = parseInt(c.req.query('value') || '');
        if (isNaN(value) || value < 0 || value > 100) {
            await log('Invalid volume value');
            await s.write(`],"error":${JSON.stringify({ message: 'Volume must be a number between 0 and 100' })}}`);
            return;
        }

        await log('Retrieving player...');
        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue || !queue.isPlaying()) {
            await log('No active queue found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        await log(`Setting volume to ${value}...`);
        queue.node.setVolume(value);
        await log(`Volume set to ${queue.node.volume}`);

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: { action: 'volume_set', volume: queue.node.volume }
        })}}`);
    });
});


const LOOP_MODES: Record<string, number> = {
    off: QueueRepeatMode.OFF,
    track: QueueRepeatMode.TRACK,
    queue: QueueRepeatMode.QUEUE,
    autoplay: QueueRepeatMode.AUTOPLAY,
};

const LOOP_MODE_NAMES: Record<number, string> = {
    [QueueRepeatMode.OFF]: 'off',
    [QueueRepeatMode.TRACK]: 'track',
    [QueueRepeatMode.QUEUE]: 'queue',
    [QueueRepeatMode.AUTOPLAY]: 'autoplay',
};

app.get('/loop', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token = c.req.query('token');
        const guildId = c.req.query('guildId');
        const mode = (c.req.query('mode') || '').toLowerCase();

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }

        if (!hasActivePlayer(token)) {
            await log('No active player found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        await log('Retrieving player...');
        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue || !queue.isPlaying()) {
            await log('No active queue found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        let repeatMode: number;

        if (mode === '' || mode === 'toggle') {

            const current = queue.repeatMode;
            if (current === QueueRepeatMode.OFF) repeatMode = QueueRepeatMode.TRACK;
            else if (current === QueueRepeatMode.TRACK) repeatMode = QueueRepeatMode.QUEUE;
            else repeatMode = QueueRepeatMode.OFF;
        } else if (mode in LOOP_MODES) {
            repeatMode = LOOP_MODES[mode];
        } else {
            const num = parseInt(mode, 10);
            if (!isNaN(num) && num >= 0 && num <= 3) {
                repeatMode = num;
            } else {
                await log(`Invalid loop mode: "${mode}"`);
                await s.write(`],"error":${JSON.stringify({ message: `Invalid loop mode: "${mode}". Use: off, track, queue, autoplay (or 0-3)` })}}`);
                return;
            }
        }

        await log(`Setting loop mode to ${LOOP_MODE_NAMES[repeatMode]} (${repeatMode})...`);
        queue.setRepeatMode(repeatMode as typeof QueueRepeatMode[keyof typeof QueueRepeatMode]);
        await log(`Loop mode set to ${LOOP_MODE_NAMES[repeatMode]}`);

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: { action: 'loop', mode: LOOP_MODE_NAMES[repeatMode], modeId: repeatMode }
        })}}`);
    });
});


app.get('/shuffle', async (c) => {
    return createMusicStream(c, async (log, s) => {
        await log('Request accepted');
        const token = c.req.query('token');
        const guildId = c.req.query('guildId');

        if (!token || !guildId) {
            await s.write(`],"error":${JSON.stringify({ message: 'Missing required params: token, guildId' })}}`);
            return;
        }

        if (!hasActivePlayer(token)) {
            await log('No active player found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found' })}}`);
            return;
        }

        await log('Retrieving player...');
        const { player } = await getOrCreatePlayer(token);
        const queue = getQueue(player, guildId);

        if (!queue || !queue.isPlaying()) {
            await log('No active queue found');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active queue found for this guild' })}}`);
            return;
        }

        if (queue.tracks.size < 2) {
            await log('Not enough tracks to shuffle');
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Need at least 2 tracks in queue to shuffle' })}}`);
            return;
        }

        await log(`Shuffling ${queue.tracks.size} tracks...`);
        queue.tracks.shuffle();
        await log('Queue shuffled');

        const shuffledTracks = queue.tracks.toArray().slice(0, 20).map(t => ({
            title: t.title,
            author: t.author,
            url: t.url
        }));

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: {
                action: 'shuffled',
                queueSize: queue.tracks.size,
                tracks: shuffledTracks
            }
        })}}`);
    });
});

export default app;
