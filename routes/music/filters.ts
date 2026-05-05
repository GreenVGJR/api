import { Hono } from 'hono';
const app = new Hono();

import {
    getOrCreatePlayer,
    getQueue,
    hasActivePlayer,
    createMusicStream,
} from '../../functions/musicPlayer.js';

// ─── Filter Presets ───────────────────────────────────────────────────────────

const FILTER_PRESETS: Record<string, { description: string; requires: string; isActive: (p: any) => boolean; apply: (p: any) => Promise<void>; disable: (p: any) => Promise<void> }> = {
    nightcore: {
        description: 'Speeds up the track with a higher pitch for an energetic feel',
        requires: 'timescale',
        isActive: (p) => p.filterManager.data.timescale?.speed === 1.2,
        apply: async (p) => {
            p.filterManager.data.timescale = { speed: 1.2, pitch: 1.25, rate: 1.0 };
            await p.filterManager.applyPlayerFilters();
        },
        disable: async (p) => {
            delete p.filterManager.data.timescale;
            await p.filterManager.applyPlayerFilters();
        },
    },
    vaporwave: {
        description: 'Slows down the track with a lower pitch for a dreamy vibe',
        requires: 'timescale',
        isActive: (p) => p.filterManager.data.timescale?.speed === 0.85,
        apply: async (p) => {
            p.filterManager.data.timescale = { speed: 0.85, pitch: 0.8, rate: 1.0 };
            await p.filterManager.applyPlayerFilters();
        },
        disable: async (p) => {
            delete p.filterManager.data.timescale;
            await p.filterManager.applyPlayerFilters();
        },
    },
    bassboost: {
        description: 'Enhances the bass frequencies for a heavier sound',
        requires: 'equalizer',
        isActive: (p) => p.filterManager.equalizerBands?.some((b: any) => b.band === 0 && b.gain === 0.6) ?? false,
        apply: async (p) => {
            await p.filterManager.setEQ([
                { band: 0, gain: 0.6 },
                { band: 1, gain: 0.67 },
                { band: 2, gain: 0.67 },
                { band: 3, gain: 0.4 },
                { band: 4, gain: -0.02 },
                { band: 5, gain: 0.0 },
                { band: 6, gain: -0.05 },
                { band: 7, gain: -0.10 },
                { band: 8, gain: 0.0 },
                { band: 9, gain: 0.0 },
                { band: 10, gain: 0.0 },
                { band: 11, gain: 0.0 },
                { band: 12, gain: 0.0 },
                { band: 13, gain: 0.0 },
                { band: 14, gain: 0.0 },
            ]);
        },
        disable: async (p) => {
            await p.filterManager.clearEQ();
        },
    },
    soft: {
        description: 'Softens the audio by lowering highs and smoothing the sound',
        requires: 'lowPass',
        isActive: (p) => p.filterManager.data.lowPass?.smoothing === 20.0,
        apply: async (p) => {
            p.filterManager.data.lowPass = { smoothing: 20.0 };
            await p.filterManager.applyPlayerFilters();
        },
        disable: async (p) => {
            delete p.filterManager.data.lowPass;
            await p.filterManager.applyPlayerFilters();
        },
    },
    trebleboost: {
        description: 'Boosts the treble frequencies for a brighter sound',
        requires: 'equalizer',
        isActive: (p) => p.filterManager.equalizerBands?.some((b: any) => b.band === 14 && b.gain === 0.45) ?? false,
        apply: async (p) => {
            await p.filterManager.setEQ([
                { band: 0, gain: 0.0 },
                { band: 1, gain: 0.0 },
                { band: 2, gain: 0.0 },
                { band: 3, gain: 0.0 },
                { band: 4, gain: 0.0 },
                { band: 5, gain: 0.0 },
                { band: 6, gain: 0.0 },
                { band: 7, gain: 0.0 },
                { band: 8, gain: 0.0 },
                { band: 9, gain: 0.0 },
                { band: 10, gain: 0.25 },
                { band: 11, gain: 0.3 },
                { band: 12, gain: 0.35 },
                { band: 13, gain: 0.4 },
                { band: 14, gain: 0.45 },
            ]);
        },
        disable: async (p) => {
            await p.filterManager.clearEQ();
        },
    },
    '8d': {
        description: 'Creates a 360° rotating audio effect around the listener',
        requires: 'rotation',
        isActive: (p) => p.filterManager.data.rotation?.rotationHz === 0.2,
        apply: async (p) => {
            p.filterManager.data.rotation = { rotationHz: 0.2 };
            await p.filterManager.applyPlayerFilters();
        },
        disable: async (p) => {
            delete p.filterManager.data.rotation;
            await p.filterManager.applyPlayerFilters();
        },
    },
    karaoke: {
        description: 'Reduces the vocal track to create a karaoke-like experience',
        requires: 'karaoke',
        isActive: (p) => p.filterManager.data.karaoke?.level === 1.0,
        apply: async (p) => {
            p.filterManager.data.karaoke = { level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 };
            await p.filterManager.applyPlayerFilters();
        },
        disable: async (p) => {
            delete p.filterManager.data.karaoke;
            await p.filterManager.applyPlayerFilters();
        },
    },
    tremolo: {
        description: 'Adds a wavering effect by modulating the volume rapidly',
        requires: 'tremolo',
        isActive: (p) => p.filterManager.data.tremolo?.frequency === 4.0,
        apply: async (p) => {
            p.filterManager.data.tremolo = { frequency: 4.0, depth: 0.75 };
            await p.filterManager.applyPlayerFilters();
        },
        disable: async (p) => {
            delete p.filterManager.data.tremolo;
            await p.filterManager.applyPlayerFilters();
        },
    },
    vibrato: {
        description: 'Creates a vibrating pitch effect for a richer sound',
        requires: 'vibrato',
        isActive: (p) => p.filterManager.data.vibrato?.frequency === 4.0,
        apply: async (p) => {
            p.filterManager.data.vibrato = { frequency: 4.0, depth: 0.75 };
            await p.filterManager.applyPlayerFilters();
        },
        disable: async (p) => {
            delete p.filterManager.data.vibrato;
            await p.filterManager.applyPlayerFilters();
        },
    },
    lowpass: {
        description: 'Applies a low-pass filter, muffling high frequencies',
        requires: 'lowPass',
        isActive: (p) => p.filterManager.data.lowPass?.smoothing === 50.0,
        apply: async (p) => {
            p.filterManager.data.lowPass = { smoothing: 50.0 };
            await p.filterManager.applyPlayerFilters();
        },
        disable: async (p) => {
            delete p.filterManager.data.lowPass;
            await p.filterManager.applyPlayerFilters();
        },
    },
    rotation: {
        description: 'Slow rotation effect that gently pans audio around',
        requires: 'rotation',
        isActive: (p) => p.filterManager.data.rotation?.rotationHz === 0.1,
        apply: async (p) => {
            p.filterManager.data.rotation = { rotationHz: 0.1 };
            await p.filterManager.applyPlayerFilters();
        },
        disable: async (p) => {
            delete p.filterManager.data.rotation;
            await p.filterManager.applyPlayerFilters();
        },
    },
    distortion: {
        description: 'Adds distortion for a gritty, overdriven tone',
        requires: 'distortion',
        isActive: (p) => typeof p.filterManager.data.distortion === 'object',
        apply: async (p) => {
            p.filterManager.data.distortion = {
                sinOffset: 0, sinScale: 1, cosOffset: 0, cosScale: 1,
                tanOffset: 0, tanScale: 1, offset: 0, scale: 1,
            };
            await p.filterManager.applyPlayerFilters();
        },
        disable: async (p) => {
            delete p.filterManager.data.distortion;
            await p.filterManager.applyPlayerFilters();
        },
    },
    channelmix: {
        description: 'Swaps left and right audio channels',
        requires: 'channelMix',
        isActive: (p) => p.filterManager.data.channelMix?.leftToRight === 1,
        apply: async (p) => {
            p.filterManager.data.channelMix = {
                leftToLeft: 0, leftToRight: 1,
                rightToLeft: 1, rightToRight: 0,
            };
            await p.filterManager.applyPlayerFilters();
        },
        disable: async (p) => {
            delete p.filterManager.data.channelMix;
            await p.filterManager.applyPlayerFilters();
        },
    },
    mono: {
        description: 'Mixes stereo audio into a single mono channel',
        requires: 'channelMix',
        isActive: (p) => p.filterManager.data.channelMix?.leftToLeft === 0.5,
        apply: async (p) => {
            p.filterManager.data.channelMix = {
                leftToLeft: 0.5, leftToRight: 0.5,
                rightToLeft: 0.5, rightToRight: 0.5,
            };
            await p.filterManager.applyPlayerFilters();
        },
        disable: async (p) => {
            delete p.filterManager.data.channelMix;
            await p.filterManager.applyPlayerFilters();
        },
    },
    reset: {
        description: 'Removes all active filters and resets to default playback',
        requires: '',
        isActive: (p) => false,
        apply: async (p) => {
            await p.filterManager.clearEQ();
            await p.filterManager.resetFilters();
        },
        disable: async (p) => { },
    },
};

export function getActiveFilters(queue: any): string[] {
    if (!queue) return [];
    return Object.keys(FILTER_PRESETS).filter(k => k !== 'reset' && FILTER_PRESETS[k].isActive(queue));
}

// ─── Route ────────────────────────────────────────────────────────────────────

app.get('/filter', async (c) => {
    return await createMusicStream(c, async (log, s) => {
        const token = c.req.query('token');
        const guildId = c.req.query('guildId');
        const voiceId = c.req.query('voiceId');
        const filter = (c.req.query('filter') || '').toLowerCase().trim();

        if (!token || !guildId) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'Missing required params: token, guildId', type: { primary: "error", alt: "invalid_query" } })}}`);
            return;
        }

        // ── No filter param → list available filters from node info ───────
        if (!filter) {
            if (!hasActivePlayer(token)) {
                await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found', type: { primary: "error", alt: "inactive_player" } })}}`);
                return;
            }

            const { player: manager } = await getOrCreatePlayer(token, log);
            const nodes = [...manager.nodeManager.nodes.values()].filter((n: any) => n.connected);

            if (nodes.length === 0) {
                await s.write(`],"data":${JSON.stringify({ status: false, message: 'No connected Lavalink nodes', type: { primary: "error", alt: "critical" } })}}`);
                return;
            }

            const node = nodes[0] as any;
            const nodeFilters: string[] = node.info?.filters ?? [];

            await log(`Found ${nodeFilters.length} supported filters from node "${node.options?.id || node.id || 'unknown'}"`);

            const queue = getQueue(manager, guildId);
            const activeFilters = getActiveFilters(queue);

            await s.write(`],"data":${JSON.stringify({
                status: true,
                data: {
                    lavalinkFilters: {
                        _warning: "This only meant to check if the lavalink actually support it. Some filters might not exists. Check 'presetFilters' for actual list filters.",
                        array: nodeFilters,
                        string: nodeFilters?.join(", ") || ""
                    },
                    presetFilters: {
                        array: Object.keys(FILTER_PRESETS),
                        string: Object.keys(FILTER_PRESETS)?.join(", ") || ""
                    },
                    enabledFilters: {
                        array: activeFilters.length > 0 ? activeFilters : [],
                        string: activeFilters.length > 0 ? activeFilters.join(", ") : ""
                    }
                },
                type: { primary: "final", alt: "success" }
            })}}`);
            return;
        }

        // ── Filter specified → validate preset ────────────────────────────
        const preset = FILTER_PRESETS[filter];

        if (!preset) {
            const availableFallback = Object.keys(FILTER_PRESETS).join(', ');
            await s.write(`],"data":${JSON.stringify({ status: false, message: `Unknown filter: "${filter}". Available: ${availableFallback}`, type: { primary: "error", alt: "invalid_query" } })}}`);
            return;
        }

        if (!hasActivePlayer(token)) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found', type: { primary: "error", alt: "inactive_player" } })}}`);
            return;
        }

        const { player: manager } = await getOrCreatePlayer(token, log);

        // ── Check if Lavalink node supports this filter ───────────────────
        if (preset.requires) {
            const nodes = [...manager.nodeManager.nodes.values()].filter((n: any) => n.connected);

            if (nodes.length === 0) {
                await s.write(`],"data":${JSON.stringify({ status: false, message: 'No connected Lavalink nodes', type: { primary: "error", alt: "critical" } })}}`);
                return;
            }

            const nodeFilters: string[] = (nodes[0] as any).info?.filters ?? [];

            if (!nodeFilters.includes(preset.requires)) {
                await s.write(`],"data":${JSON.stringify({
                    status: false,
                    message: `Filter "${filter}" is not supported by the Lavalink node (requires: ${preset.requires})`,
                    type: { primary: "error", alt: "invalid_query" }
                })}}`);
                return;
            }

            await log(`Node supports "${preset.requires}", proceeding`);
        }

        const queue = getQueue(manager, guildId);

        if (!queue) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No active player found for this guild', type: { primary: "error", alt: "inactive_queue" } })}}`);
            return;
        }

        if (!queue.playing && !queue.paused) {
            await s.write(`],"data":${JSON.stringify({ status: false, message: 'No track is currently playing', type: { primary: "error", alt: "inactive_player" } })}}`);
            return;
        }

        // ── Handle reset separately ───────────────────────────────────────
        if (filter === 'reset') {
            const isAnyPresetActive = Object.keys(FILTER_PRESETS).some(k => k !== 'reset' && FILTER_PRESETS[k].isActive(queue));
            const hasRawEQ = queue.filterManager.equalizerBands?.some((b: any) => b.gain !== 0) ?? false;

            if (!isAnyPresetActive && !hasRawEQ) {
                await s.write(`],"data":${JSON.stringify({ status: false, message: 'No filters enabled', type: { primary: "error", alt: "invalid_query" } })}}`);
                return;
            }

            await log('Resetting all filters...');
            try {
                await preset.apply(queue);
                if (queue.position) {
                    await queue.seek(queue.position);
                }
                await log('All filters reset successfully');
            } catch (err: any) {
                await log(`Filter reset failed: ${err?.message || err}`);
                await s.write(`],"data":${JSON.stringify({ status: false, message: `Failed to reset filters: ${err?.message || 'Unknown error'}`, type: { primary: "error", alt: "critical" } })}}`);
                return;
            }

            await s.write(`],"data":${JSON.stringify({
                status: true,
                data: {
                    action: 'filters_reset',
                    filter: 'reset',
                    description: preset.description,
                },
                type: { primary: "final", alt: "success" }
            })}}`);
            return;
        }

        // ── All other filters use toggle logic ────────────────────────────
        const currentlyActive = preset.isActive(queue);
        const actionType = currentlyActive ? 'filter_disabled' : 'filter_applied';

        await log(currentlyActive ? `Disabling filter: ${filter}...` : `Applying filter: ${filter}...`);
        try {
            if (currentlyActive) {
                await preset.disable(queue);
            } else {
                await preset.apply(queue);
            }
            // Flush the audio buffer immediately so the filter takes effect without delay
            if (queue.position) {
                await queue.seek(queue.position);
            }
            await log(`Filter "${filter}" ${currentlyActive ? 'disabled' : 'applied'} successfully`);
        } catch (err: any) {
            await log(`Filter failed: ${err?.message || err}`);
            await s.write(`],"data":${JSON.stringify({ status: false, message: `Failed to modify filter: ${err?.message || 'Unknown error'}`, type: { primary: "error", alt: "critical" } })}}`);
            return;
        }

        await s.write(`],"data":${JSON.stringify({
            status: true,
            data: {
                action: actionType,
                filter,
                description: preset.description,
            },
            type: { primary: "final", alt: "success" }
        })}}`);
    });
});

export default app;