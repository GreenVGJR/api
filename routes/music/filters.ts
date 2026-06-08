import { Hono } from "hono";
const app = new Hono();

import {
  getOrCreatePlayer,
  getQueue,
  hasActivePlayer,
  createMusicStream,
} from "../../functions/musicPlayer.js";

type FilterPreset = {
  description: string;
  requires: string | string[];
  isActive: (p: any) => boolean;
  apply: (p: any) => Promise<void>;
  disable: (p: any) => Promise<void>;
};

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.000001;
}

function eqBands(gains: number[]) {
  return Array.from({ length: 15 }, (_, band) => ({
    band,
    gain: gains[band] ?? 0,
  }));
}

function eqPreset(description: string, gains: number[]): FilterPreset {
  return {
    description,
    requires: "equalizer",
    isActive: (p) =>
      eqBands(gains).every(({ band, gain }) =>
        nearlyEqual(p.filterManager.equalizerBands?.[band]?.gain ?? 0, gain),
      ),
    apply: async (p) => {
      await p.filterManager.setEQ(eqBands(gains));
    },
    disable: async (p) => {
      await p.filterManager.clearEQ();
    },
  };
}

function timescalePreset(
  description: string,
  timescale: { speed: number; pitch: number; rate: number },
): FilterPreset {
  return {
    description,
    requires: "timescale",
    isActive: (p) => {
      const active = p.filterManager.data.timescale;
      return (
        nearlyEqual(active?.speed ?? 1, timescale.speed) &&
        nearlyEqual(active?.pitch ?? 1, timescale.pitch) &&
        nearlyEqual(active?.rate ?? 1, timescale.rate)
      );
    },
    apply: async (p) => {
      p.filterManager.data.timescale = timescale;
      await p.filterManager.applyPlayerFilters();
    },
    disable: async (p) => {
      delete p.filterManager.data.timescale;
      await p.filterManager.applyPlayerFilters();
    },
  };
}

function channelMixPreset(
  description: string,
  channelMix: {
    leftToLeft: number;
    leftToRight: number;
    rightToLeft: number;
    rightToRight: number;
  },
): FilterPreset {
  return {
    description,
    requires: "channelMix",
    isActive: (p) => {
      const active = p.filterManager.data.channelMix;
      return (
        nearlyEqual(active?.leftToLeft ?? 1, channelMix.leftToLeft) &&
        nearlyEqual(active?.leftToRight ?? 0, channelMix.leftToRight) &&
        nearlyEqual(active?.rightToLeft ?? 0, channelMix.rightToLeft) &&
        nearlyEqual(active?.rightToRight ?? 1, channelMix.rightToRight)
      );
    },
    apply: async (p) => {
      p.filterManager.data.channelMix = channelMix;
      p.filterManager.filters.audioOutput = "custom";
      await p.filterManager.applyPlayerFilters();
    },
    disable: async (p) => {
      delete p.filterManager.data.channelMix;
      p.filterManager.filters.audioOutput = "stereo";
      await p.filterManager.applyPlayerFilters();
    },
  };
}

function normalizeFilterName(filter: string): string {
  return filter.toLowerCase().replace(/[\s_-]+/g, "");
}

const VOCAL_ONLY_EQ = [
  -0.25, -0.25, -0.2, -0.12, 0.02, 0.18, 0.3, 0.35, 0.3, 0.22, 0.08, -0.06,
  -0.16, -0.22, -0.25,
];
const VOCAL_ONLY_CHANNEL_MIX = {
  leftToLeft: 0.5,
  leftToRight: 0.5,
  rightToLeft: 0.5,
  rightToRight: 0.5,
};

const FILTER_PRESETS: Record<string, FilterPreset> = {
  nightcore: {
    description:
      "Speeds up the track with a higher pitch for an energetic feel",
    requires: "timescale",
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
    description: "Slows down the track with a lower pitch for a dreamy vibe",
    requires: "timescale",
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
  speed: timescalePreset("Speeds up playback without changing the pitch much", {
    speed: 1.25,
    pitch: 1.0,
    rate: 1.0,
  }),
  slow: timescalePreset(
    "Slows playback down while keeping the original pitch",
    { speed: 0.75, pitch: 1.0, rate: 1.0 },
  ),
  chipmunk: timescalePreset(
    "Raises the pitch for a chipmunk-style vocal effect",
    { speed: 1.0, pitch: 1.55, rate: 1.0 },
  ),
  deep: timescalePreset("Lowers the pitch for a deeper vocal tone", {
    speed: 1.0,
    pitch: 0.75,
    rate: 1.0,
  }),
  bassboost: {
    description: "Enhances the bass frequencies for a heavier sound",
    requires: "equalizer",
    isActive: (p) =>
      p.filterManager.equalizerBands?.some(
        (b: any) => b.band === 0 && b.gain === 0.6,
      ) ?? false,
    apply: async (p) => {
      await p.filterManager.setEQ([
        { band: 0, gain: 0.6 },
        { band: 1, gain: 0.67 },
        { band: 2, gain: 0.67 },
        { band: 3, gain: 0.4 },
        { band: 4, gain: -0.02 },
        { band: 5, gain: 0.0 },
        { band: 6, gain: -0.05 },
        { band: 7, gain: -0.1 },
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
  bassboostlow: eqPreset(
    "Adds a lighter bass boost without overpowering the mix",
    [
      0.2, 0.18, 0.16, 0.1, 0.04, 0.0, -0.03, -0.05, 0.0, 0.0, 0.0, 0.0, 0.0,
      0.0, 0.0,
    ],
  ),
  bassboosthigh: eqPreset(
    "Adds a stronger bass boost while keeping the highs controlled",
    [
      0.45, 0.5, 0.5, 0.28, 0.08, 0.0, -0.05, -0.08, 0.0, 0.0, 0.0, 0.0, 0.0,
      0.0, 0.0,
    ],
  ),
  soft: {
    description: "Softens the audio by lowering highs and smoothing the sound",
    requires: "lowPass",
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
    description: "Boosts the treble frequencies for a brighter sound",
    requires: "equalizer",
    isActive: (p) =>
      p.filterManager.equalizerBands?.some(
        (b: any) => b.band === 14 && b.gain === 0.45,
      ) ?? false,
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
  rock: eqPreset(
    "Boosts lows and highs for a punchier rock sound",
    [
      0.22, 0.18, 0.12, 0.06, 0.03, -0.03, -0.08, -0.12, -0.08, -0.03, 0.04,
      0.08, 0.14, 0.18, 0.22,
    ],
  ),
  pop: eqPreset(
    "Adds clearer vocals and polished highs for pop tracks",
    [
      0.12, 0.1, -0.04, -0.06, -0.04, 0.08, 0.12, 0.14, 0.14, 0.12, 0.04, -0.02,
      0.08, 0.1, 0.1,
    ],
  ),
  electronic: eqPreset(
    "Strengthens sub-bass and bright highs for electronic music",
    [
      0.25, 0.22, 0.14, 0.06, 0.0, -0.04, -0.06, 0.0, 0.1, 0.14, 0.18, 0.2,
      0.22, 0.24, 0.25,
    ],
  ),
  classical: eqPreset(
    "Balances the spectrum with smooth high-end detail",
    [
      0.1, 0.08, 0.04, 0.0, 0.0, 0.04, 0.08, 0.06, 0.08, 0.1, 0.12, 0.14, 0.16,
      0.18, 0.2,
    ],
  ),
  vocal: eqPreset(
    "Highlights vocals by lifting the mid frequencies",
    [
      -0.08, -0.06, -0.04, 0.02, 0.08, 0.14, 0.18, 0.16, 0.12, 0.08, 0.02,
      -0.02, -0.04, -0.06, -0.08,
    ],
  ),
  vocalonly: {
    description: "Emphasizes centered vocals while reducing lows and highs",
    requires: ["equalizer", "channelMix"],
    isActive: (p) => {
      const active = p.filterManager.data.channelMix;
      return (
        eqBands(VOCAL_ONLY_EQ).every(({ band, gain }) =>
          nearlyEqual(p.filterManager.equalizerBands?.[band]?.gain ?? 0, gain),
        ) &&
        nearlyEqual(
          active?.leftToLeft ?? 1,
          VOCAL_ONLY_CHANNEL_MIX.leftToLeft,
        ) &&
        nearlyEqual(
          active?.leftToRight ?? 0,
          VOCAL_ONLY_CHANNEL_MIX.leftToRight,
        ) &&
        nearlyEqual(
          active?.rightToLeft ?? 0,
          VOCAL_ONLY_CHANNEL_MIX.rightToLeft,
        ) &&
        nearlyEqual(
          active?.rightToRight ?? 1,
          VOCAL_ONLY_CHANNEL_MIX.rightToRight,
        )
      );
    },
    apply: async (p) => {
      p.filterManager.equalizerBands = eqBands(VOCAL_ONLY_EQ);
      p.filterManager.data.channelMix = VOCAL_ONLY_CHANNEL_MIX;
      p.filterManager.filters.audioOutput = "custom";
      await p.filterManager.applyPlayerFilters();
    },
    disable: async (p) => {
      p.filterManager.equalizerBands = eqBands([]);
      delete p.filterManager.data.channelMix;
      p.filterManager.filters.audioOutput = "stereo";
      await p.filterManager.applyPlayerFilters();
    },
  },
  fullsound: eqPreset(
    "Gives the whole track a fuller and slightly louder profile",
    [
      0.18, 0.18, 0.16, 0.14, 0.12, 0.1, 0.1, 0.1, 0.12, 0.12, 0.14, 0.16, 0.18,
      0.18, 0.18,
    ],
  ),
  gaming: eqPreset(
    "Emphasizes low-end impact and trims sharp highs for game audio",
    [
      0.18, 0.16, 0.14, 0.12, 0.08, 0.04, 0.0, -0.04, -0.08, -0.1, -0.12, -0.14,
      -0.16, -0.18, -0.2,
    ],
  ),
  "8d": {
    description: "Creates a 360° rotating audio effect around the listener",
    requires: "rotation",
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
    description: "Reduces the vocal track to create a karaoke-like experience",
    requires: "karaoke",
    isActive: (p) => p.filterManager.data.karaoke?.level === 1.0,
    apply: async (p) => {
      p.filterManager.data.karaoke = {
        level: 1.0,
        monoLevel: 1.0,
        filterBand: 220.0,
        filterWidth: 100.0,
      };
      await p.filterManager.applyPlayerFilters();
    },
    disable: async (p) => {
      delete p.filterManager.data.karaoke;
      await p.filterManager.applyPlayerFilters();
    },
  },
  tremolo: {
    description: "Adds a wavering effect by modulating the volume rapidly",
    requires: "tremolo",
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
  pulse: {
    description: "Adds a slower pulsing volume movement",
    requires: "tremolo",
    isActive: (p) => p.filterManager.data.tremolo?.frequency === 2.0,
    apply: async (p) => {
      p.filterManager.data.tremolo = { frequency: 2.0, depth: 0.45 };
      await p.filterManager.applyPlayerFilters();
    },
    disable: async (p) => {
      delete p.filterManager.data.tremolo;
      await p.filterManager.applyPlayerFilters();
    },
  },
  vibrato: {
    description: "Creates a vibrating pitch effect for a richer sound",
    requires: "vibrato",
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
  wobble: {
    description: "Adds a gentler pitch wobble than vibrato",
    requires: "vibrato",
    isActive: (p) => p.filterManager.data.vibrato?.frequency === 2.5,
    apply: async (p) => {
      p.filterManager.data.vibrato = { frequency: 2.5, depth: 0.4 };
      await p.filterManager.applyPlayerFilters();
    },
    disable: async (p) => {
      delete p.filterManager.data.vibrato;
      await p.filterManager.applyPlayerFilters();
    },
  },
  lowpass: {
    description: "Applies a low-pass filter, muffling high frequencies",
    requires: "lowPass",
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
  muffled: {
    description: "Strongly muffles the track for an underwater-like tone",
    requires: "lowPass",
    isActive: (p) => p.filterManager.data.lowPass?.smoothing === 80.0,
    apply: async (p) => {
      p.filterManager.data.lowPass = { smoothing: 80.0 };
      await p.filterManager.applyPlayerFilters();
    },
    disable: async (p) => {
      delete p.filterManager.data.lowPass;
      await p.filterManager.applyPlayerFilters();
    },
  },
  rotation: {
    description: "Slow rotation effect that gently pans audio around",
    requires: "rotation",
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
  spin: {
    description: "Faster rotating stereo movement than the 8d preset",
    requires: "rotation",
    isActive: (p) => p.filterManager.data.rotation?.rotationHz === 0.35,
    apply: async (p) => {
      p.filterManager.data.rotation = { rotationHz: 0.35 };
      await p.filterManager.applyPlayerFilters();
    },
    disable: async (p) => {
      delete p.filterManager.data.rotation;
      await p.filterManager.applyPlayerFilters();
    },
  },
  distortion: {
    description: "Adds distortion for a gritty, overdriven tone",
    requires: "distortion",
    isActive: (p) => typeof p.filterManager.data.distortion === "object",
    apply: async (p) => {
      p.filterManager.data.distortion = {
        sinOffset: 0,
        sinScale: 1,
        cosOffset: 0,
        cosScale: 1,
        tanOffset: 0,
        tanScale: 1,
        offset: 0,
        scale: 1,
      };
      await p.filterManager.applyPlayerFilters();
    },
    disable: async (p) => {
      delete p.filterManager.data.distortion;
      await p.filterManager.applyPlayerFilters();
    },
  },
  channelmix: {
    description: "Swaps left and right audio channels",
    requires: "channelMix",
    isActive: (p) => {
      const active = p.filterManager.data.channelMix;
      return (
        active?.leftToLeft === 0 &&
        active?.leftToRight === 1 &&
        active?.rightToLeft === 1 &&
        active?.rightToRight === 0
      );
    },
    apply: async (p) => {
      p.filterManager.data.channelMix = {
        leftToLeft: 0,
        leftToRight: 1,
        rightToLeft: 1,
        rightToRight: 0,
      };
      p.filterManager.filters.audioOutput = "custom";
      await p.filterManager.applyPlayerFilters();
    },
    disable: async (p) => {
      delete p.filterManager.data.channelMix;
      p.filterManager.filters.audioOutput = "stereo";
      await p.filterManager.applyPlayerFilters();
    },
  },
  mono: {
    description: "Mixes stereo audio into a single mono channel",
    requires: "channelMix",
    isActive: (p) => {
      const active = p.filterManager.data.channelMix;
      return (
        active?.leftToLeft === 0.5 &&
        active?.leftToRight === 0.5 &&
        active?.rightToLeft === 0.5 &&
        active?.rightToRight === 0.5
      );
    },
    apply: async (p) => {
      p.filterManager.data.channelMix = {
        leftToLeft: 0.5,
        leftToRight: 0.5,
        rightToLeft: 0.5,
        rightToRight: 0.5,
      };
      p.filterManager.filters.audioOutput = "mono";
      await p.filterManager.applyPlayerFilters();
    },
    disable: async (p) => {
      delete p.filterManager.data.channelMix;
      p.filterManager.filters.audioOutput = "stereo";
      await p.filterManager.applyPlayerFilters();
    },
  },
  wide: channelMixPreset("Adds subtle crossfeed for a wider stereo image", {
    leftToLeft: 1,
    leftToRight: 0.15,
    rightToLeft: 0.15,
    rightToRight: 1,
  }),
  surround: channelMixPreset(
    "Creates a wider virtual surround-like stereo spread",
    {
      leftToLeft: 0.75,
      leftToRight: 0.25,
      rightToLeft: 0.25,
      rightToRight: 0.75,
    },
  ),
  left: channelMixPreset("Plays the left channel through both speakers", {
    leftToLeft: 1,
    leftToRight: 0,
    rightToLeft: 1,
    rightToRight: 0,
  }),
  right: channelMixPreset("Plays the right channel through both speakers", {
    leftToLeft: 0,
    leftToRight: 1,
    rightToLeft: 0,
    rightToRight: 1,
  }),
  reset: {
    description: "Removes all active filters and resets to default playback",
    requires: "",
    isActive: () => false,
    apply: async (p) => {
      await p.filterManager.clearEQ();
      await p.filterManager.resetFilters();
    },
    disable: async () => {},
  },
};

export function getActiveFilters(queue: any): string[] {
  if (!queue) return [];
  return Object.keys(FILTER_PRESETS).filter(
    (k) => k !== "reset" && FILTER_PRESETS[k].isActive(queue),
  );
}

app.get("/filter", async (c) => {
  return await createMusicStream(c, async (log, s) => {
    const token = c.req.query("token");
    const guildId = c.req.query("guildId");
    const filter = normalizeFilterName(c.req.query("filter") || "");

    if (!token || !guildId) {
      await s.write(
        `],"data":${JSON.stringify({ status: false, message: "Missing required params: token, guildId", type: { primary: "error", alt: "invalid_query" } })}}`,
      );
      return;
    }

    // ── No filter param → list available filters from node info ───────
    if (!filter) {
      if (!hasActivePlayer(token)) {
        await s.write(
          `],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`,
        );
        return;
      }

      const { player: manager } = await getOrCreatePlayer(token, log);
      const nodes = [...manager.nodeManager.nodes.values()].filter(
        (n: any) => n.connected,
      );

      if (nodes.length === 0) {
        await s.write(
          `],"data":${JSON.stringify({ status: false, message: "No connected Lavalink nodes", type: { primary: "error", alt: "critical" } })}}`,
        );
        return;
      }

      const node = nodes[0] as any;
      const nodeFilters: string[] = node.info?.filters ?? [];

      await log(
        `Found ${nodeFilters.length} supported filters from node "${node.options?.id || node.id || "unknown"}"`,
      );

      const queue = getQueue(manager, guildId);
      const activeFilters = getActiveFilters(queue);

      await s.write(
        `],"data":${JSON.stringify({
          status: true,
          data: {
            lavalinkFilters: {
              _warning:
                "This only meant to check if the lavalink actually support it. Some filters might not exists. Check 'presetFilters' for actual list filters.",
              array: nodeFilters,
              string: nodeFilters?.join(", ") || "",
            },
            presetFilters: {
              array: Object.keys(FILTER_PRESETS),
              string: Object.keys(FILTER_PRESETS)?.join(", ") || "",
            },
            enabledFilters: {
              array: activeFilters.length > 0 ? activeFilters : [],
              string: activeFilters.length > 0 ? activeFilters.join(", ") : "",
            },
          },
          type: { primary: "final", alt: "success" },
        })}}`,
      );
      return;
    }

    // ── Filter specified → validate preset ────────────────────────────
    const preset = FILTER_PRESETS[filter];

    if (!preset) {
      const availableFallback = Object.keys(FILTER_PRESETS).join(", ");
      await s.write(
        `],"data":${JSON.stringify({ status: false, message: `Unknown filter: "${filter}". Available: ${availableFallback}`, type: { primary: "error", alt: "invalid_query" } })}}`,
      );
      return;
    }

    if (!hasActivePlayer(token)) {
      await s.write(
        `],"data":${JSON.stringify({ status: false, message: "No active player found", type: { primary: "error", alt: "inactive_player" } })}}`,
      );
      return;
    }

    const { player: manager } = await getOrCreatePlayer(token, log);

    // ── Check if Lavalink node supports this filter ───────────────────
    const requiredFilters = Array.isArray(preset.requires)
      ? preset.requires
      : preset.requires
        ? [preset.requires]
        : [];

    if (requiredFilters.length) {
      const nodes = [...manager.nodeManager.nodes.values()].filter(
        (n: any) => n.connected,
      );

      if (nodes.length === 0) {
        await s.write(
          `],"data":${JSON.stringify({ status: false, message: "No connected Lavalink nodes", type: { primary: "error", alt: "critical" } })}}`,
        );
        return;
      }

      const nodeFilters: string[] = (nodes[0] as any).info?.filters ?? [];
      const missingFilters = requiredFilters.filter(
        (required) => !nodeFilters.includes(required),
      );

      if (missingFilters.length) {
        await s.write(
          `],"data":${JSON.stringify({
            status: false,
            message: `Filter "${filter}" is not supported by the Lavalink node (requires: ${requiredFilters.join(", ")}; missing: ${missingFilters.join(", ")})`,
            type: { primary: "error", alt: "invalid_query" },
          })}}`,
        );
        return;
      }

      await log(`Node supports "${requiredFilters.join(", ")}", proceeding`);
    }

    const queue = getQueue(manager, guildId);

    if (!queue) {
      await s.write(
        `],"data":${JSON.stringify({ status: false, message: "No active player found for this guild", type: { primary: "error", alt: "inactive_queue" } })}}`,
      );
      return;
    }

    if (!queue.playing && !queue.paused) {
      await s.write(
        `],"data":${JSON.stringify({ status: false, message: "No track is currently playing", type: { primary: "error", alt: "inactive_player" } })}}`,
      );
      return;
    }

    if (filter === "reset") {
      const isAnyPresetActive = Object.keys(FILTER_PRESETS).some(
        (k) => k !== "reset" && FILTER_PRESETS[k].isActive(queue),
      );
      const hasRawEQ =
        queue.filterManager.equalizerBands?.some((b: any) => b.gain !== 0) ??
        false;

      if (!isAnyPresetActive && !hasRawEQ) {
        await s.write(
          `],"data":${JSON.stringify({ status: false, message: "No filters enabled", type: { primary: "error", alt: "invalid_query" } })}}`,
        );
        return;
      }

      await log("Resetting all filters...");
      try {
        await preset.apply(queue);
        if (queue.position) {
          await queue.seek(queue.position);
        }
        await log("All filters reset successfully");
      } catch (err: any) {
        await log(`Filter reset failed: ${err?.message || err}`);
        await s.write(
          `],"data":${JSON.stringify({ status: false, message: `Failed to reset filters: ${err?.message || "Unknown error"}`, type: { primary: "error", alt: "critical" } })}}`,
        );
        return;
      }

      await s.write(
        `],"data":${JSON.stringify({
          status: true,
          data: {
            action: "filters_reset",
            filter: "reset",
            description: preset.description,
          },
          type: { primary: "final", alt: "success" },
        })}}`,
      );
      return;
    }

    const currentlyActive = preset.isActive(queue);
    const actionType = currentlyActive ? "filter_disabled" : "filter_applied";

    await log(
      currentlyActive
        ? `Disabling filter: ${filter}...`
        : `Applying filter: ${filter}...`,
    );
    try {
      if (currentlyActive) {
        await preset.disable(queue);
      } else {
        await preset.apply(queue);
      }

      if (queue.position) {
        await queue.seek(queue.position);
      }
      await log(
        `Filter "${filter}" ${currentlyActive ? "disabled" : "applied"} successfully`,
      );
    } catch (err: any) {
      await log(`Filter failed: ${err?.message || err}`);
      await s.write(
        `],"data":${JSON.stringify({ status: false, message: `Failed to modify filter: ${err?.message || "Unknown error"}`, type: { primary: "error", alt: "critical" } })}}`,
      );
      return;
    }

    await s.write(
      `],"data":${JSON.stringify({
        status: true,
        data: {
          action: actionType,
          filter,
          description: preset.description,
        },
        type: { primary: "final", alt: "success" },
      })}}`,
    );
  });
});

export default app;
