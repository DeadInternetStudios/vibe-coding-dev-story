import type { SfxIdOf } from '../ids';
import { noise, slide, tone, type SfxBody, type ToneEvent } from './dsl';
import type { LayerSpec } from '../synth/voice';

/** A bell: a sine with two inharmonic partials. Used for cash register dings and sparkles. */
const BELL: readonly LayerSpec[] = [{ wave: 'sine' }, { wave: 'sine', ratio: 2.4, vol: 0.45 }, { wave: 'sine', ratio: 4.1, vol: 0.15 }];

const SHOWER_NOTES = ['E6', 'G6', 'A6', 'C7', 'E6', 'G6', 'C7', 'E7', 'A6', 'G6'] as const;
const SHOWER_PANS = [-0.4, 0.25, -0.15, 0.4, -0.3, 0.1, 0.35, -0.2, 0, 0.3] as const;

const shower: ToneEvent[] = SHOWER_NOTES.map((n, i) =>
  tone(i * 0.045, 'p50', n, 0.06, { vol: 0.19, d: 0.05, s: 0.4, r: 0.04, pan: SHOWER_PANS[i] }),
);

/** Money sounds. Bright and rewarding when it comes in, flat and sad when it goes out. */
export const money: Record<SfxIdOf<'money'>, SfxBody> = {
  coin: {
    events: [
      tone(0, 'p50', 'B5', 0.065, { vol: 0.28, a: 0.001, d: 0.05, s: 0.8, r: 0.015 }),
      tone(0.065, 'p50', 'E6', 0.34, { vol: 0.28, a: 0.001, d: 0.3, s: 0.12, r: 0.12 }),
      tone(0.065, 'p12', 'E7', 0.22, { vol: 0.06, d: 0.2, s: 0, r: 0.06 }),
    ],
    jitter: 18,
    cooldown: 0.03,
    // a streak of coins climbs a major scale, like a coin block combo
    combo: { window: 0.5, steps: [0, 2, 4, 5, 7, 9, 11, 12] },
  },

  coins: {
    level: -1,
    events: [
      ...shower,
      tone(0.5, 'p50', 'E7', 0.3, { vol: 0.17, d: 0.28, s: 0.1, r: 0.12 }),
      tone(0.5, 'p12', 'E6', 0.3, { vol: 0.08, d: 0.28, s: 0.1, r: 0.12 }),
      noise(0, 'noiseL', 20000, 0.5, { vol: 0.04, a: 0.01, d: 0.45, s: 0, r: 0.05, filter: { type: 'bandpass', f0: 4200, q: 1.5 } }),
    ],
    jitter: 12,
    cooldown: 0.08,
  },

  cash_register: {
    events: [
      // ka: the drawer thunk
      slide(0, 'tri', 200, 80, 0.07, { vol: 0.4, d: 0.06, s: 0, r: 0.01 }),
      noise(0, 'noiseL', 22000, 0.03, { vol: 0.2, a: 0.0005, d: 0.02, s: 0, r: 0.005, filter: { type: 'bandpass', f0: 2500, q: 0.8 } }),
      noise(0.03, 'noiseL', 12000, 0.1, { vol: 0.09, a: 0.02, d: 0.08, s: 0, r: 0.02, filter: { type: 'bandpass', f0: 1200, f1: 3000, time: 0.1, q: 1 } }),
      // ching: the bell
      tone(0.11, 'sine', 'G6', 0.7, { vol: 0.22, layers: BELL, a: 0.001, d: 0.55, s: 0, r: 0.2 }),
      tone(0.11, 'p12', 'G7', 0.12, { vol: 0.05, d: 0.1, s: 0, r: 0.04 }),
    ],
    jitter: 10,
    cooldown: 0.12,
  },

  payday: {
    events: [
      tone(0, 'p25', 'C5', 0.07, { vol: 0.26, d: 0.06, s: 0.4, r: 0.03 }),
      tone(0.08, 'p25', 'E5', 0.07, { vol: 0.26, d: 0.06, s: 0.4, r: 0.03 }),
      tone(0.16, 'p25', 'G5', 0.07, { vol: 0.26, d: 0.06, s: 0.4, r: 0.03 }),
      tone(0.24, 'p25', 'C6', 0.07, { vol: 0.26, d: 0.06, s: 0.4, r: 0.03 }),
      tone(0.34, 'sine', 'C6', 0.8, { vol: 0.2, layers: BELL, d: 0.65, s: 0, r: 0.25 }),
      tone(0.34, 'p50', 'E6', 0.45, { vol: 0.14, d: 0.4, s: 0.2, r: 0.15 }),
      tone(0.34, 'p50', 'G6', 0.45, { vol: 0.12, d: 0.4, s: 0.2, r: 0.15 }),
      ...[0.5, 0.56, 0.63, 0.7, 0.78, 0.86].map((at, i) =>
        tone(at, 'p50', (['E6', 'G6', 'C7', 'A6', 'E7', 'G6'] as const)[i]!, 0.06, { vol: 0.13, d: 0.05, s: 0.3, r: 0.04, pan: (i % 2 ? 0.35 : -0.35) }),
      ),
    ],
    jitter: 8,
    cooldown: 0.3,
  },

  bill: {
    events: [
      // a sour two note drop. The pulses carry the harmonics a phone speaker can reproduce,
      // the triangles underneath add the weight.
      tone(0, 'p25', 'G4', 0.12, { vol: 0.26, d: 0.1, s: 0.5, r: 0.05 }),
      tone(0.14, 'p25', 'Eb4', 0.28, { vol: 0.26, d: 0.25, s: 0.3, r: 0.1 }),
      tone(0, 'tri', 'G3', 0.12, { vol: 0.3, d: 0.1, s: 0.5, r: 0.05 }),
      tone(0.14, 'tri', 'Eb3', 0.28, { vol: 0.3, d: 0.25, s: 0.3, r: 0.1 }),
      slide(0, 'p12', 660, 300, 0.4, { vol: 0.05, d: 0.3, s: 0.2, r: 0.1 }),
      noise(0, 'noiseL', 9000, 0.14, { vol: 0.09, a: 0.012, d: 0.1, s: 0, r: 0.02, filter: { type: 'bandpass', f0: 1800, q: 0.5 } }),
    ],
    jitter: 12,
    cooldown: 0.2,
  },

  broke: {
    events: [
      // an empty drawer, then the sad walk down
      slide(0, 'tri', 190, 75, 0.07, { vol: 0.36, d: 0.06, s: 0, r: 0.01 }),
      noise(0, 'noiseL', 20000, 0.03, { vol: 0.14, a: 0.0005, d: 0.02, s: 0, r: 0.005, filter: { type: 'bandpass', f0: 2200, q: 0.8 } }),
      tone(0.16, 'p25', 'D4', 0.13, { vol: 0.26, d: 0.1, s: 0.5, r: 0.04 }),
      tone(0.3, 'p25', 'Db4', 0.13, { vol: 0.26, d: 0.1, s: 0.5, r: 0.04 }),
      tone(0.44, 'p25', 'C4', 0.13, { vol: 0.26, d: 0.1, s: 0.5, r: 0.04 }),
      slide(0.58, 'p25', 'B3', 'Ab2', 0.55, {
        vol: 0.28,
        d: 0.45,
        s: 0.4,
        r: 0.12,
        vib: { rate: 6, depth: 25, delay: 0.1 },
      }),
    ],
    jitter: 8,
    cooldown: 0.4,
  },
};
