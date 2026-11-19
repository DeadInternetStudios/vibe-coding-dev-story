import type { SfxIdOf } from '../ids';
import { noise, slide, tone, type SfxBody } from './dsl';

/**
 * Interface sounds. Short, soft and quick to answer: a click should feel like
 * it happened under the finger. Small random pitch spread so a row of the
 * same click never sounds like a machine gun.
 */
export const ui: Record<SfxIdOf<'ui'>, SfxBody> = {
  click: {
    level: -3,
    events: [
      slide(0, 'p50', 1300, 780, 0.034, { vol: 0.26, a: 0.001, d: 0.03, s: 0, r: 0.008 }),
      noise(0, 'noiseL', 18000, 0.012, { vol: 0.12, a: 0.0005, d: 0.008, s: 0, r: 0.004, filter: { type: 'bandpass', f0: 3200, q: 0.9 } }),
    ],
    jitter: 45,
    cooldown: 0.015,
  },

  hover: {
    level: -9,
    events: [
      tone(0, 'sine', 1650, 0.02, { vol: 0.09, a: 0.001, d: 0.018, s: 0, r: 0.006 }),
      tone(0, 'p12', 2300, 0.016, { vol: 0.035, a: 0.001, d: 0.014, s: 0, r: 0.004 }),
    ],
    jitter: 70,
    cooldown: 0.05,
  },

  back: {
    level: -2,
    events: [
      tone(0, 'p50', 'E5', 0.05, { vol: 0.24, d: 0.04, s: 0.3, r: 0.02 }),
      tone(0.055, 'p50', 'A4', 0.1, { vol: 0.22, d: 0.08, s: 0.2, r: 0.04 }),
    ],
    jitter: 25,
  },

  open: {
    level: -3,
    events: [
      slide(0, 'tri', 320, 880, 0.11, { vol: 0.3, a: 0.004, d: 0.1, s: 0.2, r: 0.03 }),
      tone(0.06, 'p25', 'E6', 0.08, { vol: 0.16, d: 0.07, s: 0, r: 0.03 }),
      noise(0, 'noiseL', 9000, 0.1, { vol: 0.07, a: 0.01, d: 0.08, s: 0, r: 0.02, filter: { type: 'bandpass', f0: 800, f1: 3600, time: 0.1, q: 1.2 } }),
    ],
    jitter: 30,
  },

  close: {
    level: -3,
    events: [
      slide(0, 'tri', 880, 320, 0.09, { vol: 0.26, a: 0.003, d: 0.08, s: 0.2, r: 0.03 }),
      tone(0.03, 'p25', 'A5', 0.06, { vol: 0.12, d: 0.05, s: 0, r: 0.02 }),
      noise(0, 'noiseL', 9000, 0.09, { vol: 0.06, a: 0.005, d: 0.08, s: 0, r: 0.02, filter: { type: 'bandpass', f0: 3600, f1: 800, time: 0.09, q: 1.2 } }),
    ],
    jitter: 30,
  },

  tab: {
    level: -4,
    events: [
      tone(0, 'tri', 'A5', 0.04, { vol: 0.3, a: 0.001, d: 0.035, s: 0, r: 0.01 }),
      tone(0.018, 'p12', 'A6', 0.03, { vol: 0.07, a: 0.001, d: 0.025, s: 0, r: 0.01 }),
      noise(0, 'noiseL', 16000, 0.01, { vol: 0.1, a: 0.0005, d: 0.008, s: 0, r: 0.003, filter: { type: 'bandpass', f0: 2600, q: 0.9 } }),
    ],
    jitter: 60,
    cooldown: 0.03,
  },

  toggle: {
    level: -3,
    events: [
      tone(0, 'p50', 'C6', 0.03, { vol: 0.24, a: 0.001, d: 0.025, s: 0.1, r: 0.01 }),
      tone(0.035, 'p50', 'G6', 0.045, { vol: 0.22, a: 0.001, d: 0.04, s: 0.1, r: 0.02 }),
    ],
    jitter: 20,
  },

  error: {
    events: [
      tone(0, 'p25', 'A3', 0.11, {
        vol: 0.28,
        layers: [{ wave: 'p25' }, { wave: 'p25', detune: 30, vol: 0.8 }],
        d: 0.09,
        s: 0.7,
        r: 0.03,
      }),
      tone(0.13, 'p25', 'F3', 0.2, {
        vol: 0.28,
        layers: [{ wave: 'p25' }, { wave: 'p25', detune: 30, vol: 0.8 }],
        d: 0.15,
        s: 0.6,
        r: 0.08,
      }),
      noise(0, 'noiseL', 7000, 0.06, { vol: 0.07, a: 0.002, d: 0.05, s: 0, r: 0.01, filter: { type: 'lowpass', f0: 2000, q: 0.7 } }),
    ],
    jitter: 15,
  },

  confirm: {
    events: [
      tone(0, 'p50', 'G5', 0.06, { vol: 0.26, d: 0.05, s: 0.5, r: 0.02 }),
      tone(0.06, 'p50', 'D6', 0.18, { vol: 0.26, d: 0.15, s: 0.25, r: 0.1 }),
      tone(0.06, 'p12', 'D7', 0.12, { vol: 0.07, d: 0.1, s: 0, r: 0.05 }),
    ],
    jitter: 20,
  },

  deny: {
    events: [
      tone(0, 'p25', 'E4', 0.06, { vol: 0.28, d: 0.05, s: 0.5, r: 0.02 }),
      tone(0.075, 'p25', 'Bb3', 0.13, { vol: 0.28, d: 0.1, s: 0.4, r: 0.06 }),
    ],
    jitter: 15,
  },

  select: {
    level: -2,
    events: [
      tone(0, 'p25', 'C6', 0.075, { vol: 0.3, d: 0.06, s: 0.2, r: 0.03 }),
      tone(0, 'p12', 'C7', 0.05, { vol: 0.09, d: 0.04, s: 0, r: 0.02 }),
    ],
    jitter: 35,
  },

  type: {
    level: -7,
    events: [
      noise(0, 'noiseL', 15000, 0.014, { vol: 0.22, a: 0.0005, d: 0.011, s: 0, r: 0.004, filter: { type: 'bandpass', f0: 2300, q: 0.9 } }),
      tone(0, 'tri', 720, 0.022, { vol: 0.14, a: 0.001, d: 0.02, s: 0, r: 0.006 }),
    ],
    jitter: 130,
    cooldown: 0.018,
  },

  type2: {
    level: -7,
    events: [
      noise(0, 'noiseL', 11000, 0.016, { vol: 0.24, a: 0.0005, d: 0.013, s: 0, r: 0.004, filter: { type: 'bandpass', f0: 1500, q: 0.9 } }),
      tone(0, 'tri', 470, 0.026, { vol: 0.16, a: 0.001, d: 0.024, s: 0, r: 0.006 }),
    ],
    jitter: 130,
    cooldown: 0.018,
  },
};
