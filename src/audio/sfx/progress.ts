import type { SfxIdOf } from '../ids';
import type { LayerSpec } from '../synth/voice';
import { hit, noise, slide, tone, type SfxBody } from './dsl';

const BELL: readonly LayerSpec[] = [{ wave: 'sine' }, { wave: 'sine', ratio: 2.4, vol: 0.4 }, { wave: 'sine', ratio: 4.1, vol: 0.12 }];
const LEVEL_UP_RUN = ['C5', 'E5', 'G5', 'C6', 'E6'] as const;
const GO_RUN = ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'] as const;

/** Progress sounds: things getting built, finished and shipped. Each one is a small win. */
export const progress: Record<SfxIdOf<'progress'>, SfxBody> = {
  level_up: {
    events: [
      ...LEVEL_UP_RUN.map((n, i) => tone(i * 0.065, 'p25', n, 0.06, { vol: 0.26, d: 0.05, s: 0.3, r: 0.03 })),
      tone(0.33, 'p25', 'C6', 0.5, { vol: 0.2, d: 0.45, s: 0.2, r: 0.2, vib: { rate: 6, depth: 10, delay: 0.1 } }),
      tone(0.33, 'p50', 'E6', 0.5, { vol: 0.13, d: 0.45, s: 0.2, r: 0.2 }),
      tone(0.33, 'p25', 'G6', 0.5, { vol: 0.13, d: 0.45, s: 0.2, r: 0.2 }),
      tone(0.33, 'sine', 'C7', 0.4, { vol: 0.1, layers: BELL, d: 0.35, s: 0, r: 0.15 }),
    ],
    jitter: 6,
    cooldown: 0.4,
  },

  hot_idea: {
    events: [
      slide(0, 'p50', 500, 1900, 0.13, { vol: 0.16, a: 0.003, d: 0.12, s: 0.3, r: 0.03 }),
      tone(0.13, 'sine', 'A6', 0.6, { vol: 0.24, layers: BELL, a: 0.001, d: 0.5, s: 0, r: 0.2 }),
      tone(0.22, 'p12', 'E7', 0.1, { vol: 0.06, d: 0.08, s: 0, r: 0.03, pan: 0.3 }),
      tone(0.28, 'p12', 'B6', 0.1, { vol: 0.06, d: 0.08, s: 0, r: 0.03, pan: -0.3 }),
      tone(0.34, 'p12', 'E7', 0.12, { vol: 0.06, d: 0.1, s: 0, r: 0.04, pan: 0.2 }),
    ],
    jitter: 10,
    cooldown: 0.25,
  },

  bubble: {
    level: -3,
    events: [
      slide(0, 'sine', 420, 1250, 0.075, { vol: 0.3, a: 0.003, d: 0.07, s: 0.2, r: 0.02 }),
      noise(0.07, 'noiseL', 20000, 0.012, { vol: 0.09, a: 0.0005, d: 0.01, s: 0, r: 0.003, filter: { type: 'bandpass', f0: 3000, q: 1 } }),
      slide(0.1, 'sine', 650, 1500, 0.05, { vol: 0.17, a: 0.002, d: 0.045, s: 0.1, r: 0.015 }),
    ],
    jitter: 150,
    cooldown: 0.05,
  },

  phase_done: {
    events: [
      tone(0, 'p25', 'G5', 0.075, { vol: 0.24, d: 0.06, s: 0.4, r: 0.03 }),
      tone(0.085, 'p25', 'B5', 0.075, { vol: 0.24, d: 0.06, s: 0.4, r: 0.03 }),
      tone(0.17, 'p25', 'D6', 0.25, { vol: 0.24, d: 0.2, s: 0.2, r: 0.1 }),
      tone(0.17, 'sine', 'D7', 0.2, { vol: 0.07, d: 0.18, s: 0, r: 0.06 }),
    ],
    jitter: 10,
    cooldown: 0.15,
  },

  ship_it: {
    events: [
      noise(0, 'noiseL', 20000, 0.4, { vol: 0.2, a: 0.3, d: 0.1, s: 0.5, r: 0.02, filter: { type: 'bandpass', f0: 300, f1: 4200, time: 0.4, q: 1.4 } }),
      slide(0, 'tri', 110, 330, 0.4, { vol: 0.3, a: 0.01, d: 0.38, s: 0.6, r: 0.02 }),
      hit(0, 'kick', 0.8),
      // two big stabs
      ...(['C5', 'E5', 'G5', 'C6'] as const).map((n) => tone(0.4, 'p25', n, 0.1, { vol: 0.2, d: 0.09, s: 0.2, r: 0.05 })),
      ...(['C5', 'E5', 'G5', 'C6'] as const).map((n) => tone(0.52, 'p25', n, 0.34, { vol: 0.2, d: 0.3, s: 0.2, r: 0.14 })),
      tone(0.52, 'p12', 'C7', 0.3, { vol: 0.06, d: 0.28, s: 0, r: 0.1 }),
      hit(0.4, 'snare', 0.8),
      hit(0.4, 'crash', 0.5),
    ],
    jitter: 6,
    cooldown: 0.5,
  },

  deploy_beep: {
    level: -4,
    events: [tone(0, 'p50', 'E6', 0.045, { vol: 0.2, d: 0.04, s: 0.3, r: 0.015 })],
    jitter: 6,
    cooldown: 0.03,
  },

  deploy_go: {
    events: [
      ...GO_RUN.map((n, i) => tone(i * 0.035, 'p25', n, 0.05, { vol: 0.2, d: 0.04, s: 0.3, r: 0.02 })),
      hit(0, 'kick', 0.8),
      noise(0, 'noiseL', 20000, 0.25, { vol: 0.12, a: 0.2, d: 0.04, s: 0.5, r: 0.02, filter: { type: 'bandpass', f0: 500, f1: 5000, time: 0.25, q: 1.3 } }),
      tone(0.26, 'p50', 'C7', 0.3, { vol: 0.2, d: 0.28, s: 0.1, r: 0.12 }),
      tone(0.26, 'sine', 'C6', 0.3, { vol: 0.2, d: 0.28, s: 0.1, r: 0.12 }),
    ],
    jitter: 6,
    cooldown: 0.3,
  },
};
