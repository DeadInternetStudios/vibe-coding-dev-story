import type { SfxIdOf } from '../ids';
import { hit, noise, slide, tone, type SfxBody } from './dsl';
import { BELL, CHIME } from './parts';

/**
 * The fake social site. Votes and karma are tiny and frequent, so they are short and
 * quiet; awards, roasts and removals are the events people remember.
 */
export const thread: Record<SfxIdOf<'thread'>, SfxBody> = {
  upvote: {
    events: [
      // bip: a quick upward chirp, landing on a short ringing note
      slide(0, 'p25', 'G5', 'D6', 0.07, { vol: 0.24, a: 0.001, d: 0.06, s: 0.5, r: 0.02 }),
      tone(0.07, 'p25', 'D6', 0.13, { vol: 0.24, a: 0.001, d: 0.1, s: 0.2, r: 0.06 }),
      tone(0.07, 'p12', 'D7', 0.1, { vol: 0.05, d: 0.08, s: 0, r: 0.03 }),
    ],
    jitter: 20,
    cooldown: 0.04,
    // a run of upvotes climbs a pentatonic scale
    combo: { window: 0.6, steps: [0, 2, 4, 7, 9, 12] },
  },

  downvote: {
    events: [
      // a short sag, with a triangle underneath for weight
      slide(0, 'p25', 'D5', 'G3', 0.17, { vol: 0.26, a: 0.001, d: 0.15, s: 0.35, r: 0.05 }),
      slide(0, 'tri', 'D4', 'G2', 0.17, { vol: 0.3, a: 0.001, d: 0.15, s: 0.35, r: 0.05 }),
      noise(0, 'noiseS', 5000, 0.04, { vol: 0.08, d: 0.03, s: 0, r: 0.01, filter: { type: 'lowpass', f0: 1500 } }),
    ],
    jitter: 20,
    cooldown: 0.05,
  },

  award: {
    events: [
      // a gold shimmer climbing a major seventh, then a long glowing tail
      tone(0, 'sine', 'E6', 0.5, { vol: 0.15, layers: BELL, a: 0.001, d: 0.45, s: 0, r: 0.2, pan: -0.25 }),
      tone(0.055, 'sine', 'G6', 0.5, { vol: 0.15, layers: BELL, a: 0.001, d: 0.45, s: 0, r: 0.2, pan: 0.2 }),
      tone(0.11, 'sine', 'B6', 0.5, { vol: 0.13, layers: BELL, a: 0.001, d: 0.45, s: 0, r: 0.2, pan: -0.15 }),
      tone(0.165, 'p12', 'E7', 0.3, { vol: 0.06, d: 0.28, s: 0, r: 0.1, pan: 0.25 }),
      tone(0.24, 'sine', 'G6', 0.9, { vol: 0.14, layers: BELL, d: 0.8, s: 0, r: 0.3 }),
      tone(0.24, 'p50', 'B5', 0.4, { vol: 0.08, d: 0.35, s: 0.2, r: 0.15 }),
      noise(0, 'noiseL', 20000, 0.6, { vol: 0.035, a: 0.05, d: 0.5, s: 0, r: 0.05, filter: { type: 'bandpass', f0: 4500, q: 2 } }),
    ],
    jitter: 10,
    cooldown: 0.3,
  },

  comment_in: {
    level: -3,
    events: [
      // ba-bloop: a message lands
      tone(0, 'p50', 'E5', 0.05, { vol: 0.2, a: 0.001, d: 0.04, s: 0.3, r: 0.02 }),
      tone(0.055, 'p50', 'A5', 0.1, { vol: 0.2, a: 0.001, d: 0.09, s: 0.15, r: 0.05 }),
      tone(0.055, 'sine', 'A6', 0.12, { vol: 0.07, layers: CHIME, d: 0.1, s: 0, r: 0.05 }),
    ],
    jitter: 30,
    cooldown: 0.05,
  },

  karma_tick: {
    level: -8,
    events: [
      // one click of a counter rolling over: a soft triangle tick, almost nothing above 6 kHz
      tone(0, 'tri', 'B6', 0.03, { vol: 0.22, a: 0.0005, d: 0.025, s: 0, r: 0.006 }),
      noise(0, 'noiseS', 5000, 0.01, { vol: 0.06, a: 0.0005, d: 0.008, s: 0, r: 0.002, filter: { type: 'bandpass', f0: 2200, q: 1.5 } }),
    ],
    jitter: 60,
    cooldown: 0.02,
    // a counting run steps up a fifth, like numbers spinning
    combo: { window: 0.25, steps: [0, 1, 2, 3, 4, 5, 6, 7] },
  },

  thread_open: {
    events: [
      // the page unfolds, then three friendly notes
      noise(0, 'noiseL', 14000, 0.2, { vol: 0.07, a: 0.02, d: 0.16, s: 0, r: 0.03, filter: { type: 'bandpass', f0: 500, f1: 2600, time: 0.18, q: 1.2 } }),
      tone(0.07, 'p50', 'D5', 0.07, { vol: 0.2, d: 0.06, s: 0.3, r: 0.03 }),
      tone(0.14, 'p50', 'A5', 0.07, { vol: 0.2, d: 0.06, s: 0.3, r: 0.03 }),
      tone(0.21, 'p50', 'D6', 0.2, { vol: 0.2, d: 0.18, s: 0.2, r: 0.08 }),
      tone(0.21, 'sine', 'D7', 0.15, { vol: 0.05, layers: CHIME, d: 0.12, s: 0, r: 0.05 }),
    ],
    jitter: 12,
    cooldown: 0.1,
  },

  removed: {
    events: [
      // the moderator's gavel: a wooden knock with a low thump
      hit(0, 'tom', 0.9, { tune: 0.62 }),
      hit(0, 'rim', 0.8),
      slide(0.02, 'tri', 150, 48, 0.2, { vol: 0.34, d: 0.18, s: 0, r: 0.04 }),
      // "[removed]": a dry poof, and a tone that sinks away
      noise(0.06, 'noiseL', 9000, 0.2, { vol: 0.08, a: 0.01, d: 0.18, s: 0, r: 0.02, filter: { type: 'lowpass', f0: 3000, f1: 300, time: 0.2, q: 0.7 } }),
      slide(0.1, 'p25', 'F4', 'C4', 0.28, {
        vol: 0.2,
        d: 0.24,
        s: 0.2,
        r: 0.05,
        vib: { rate: 6, depth: 20, delay: 0.1 },
        filter: { type: 'lowpass', f0: 2200 },
      }),
    ],
    jitter: 10,
    cooldown: 0.2,
  },

  roast: {
    events: [
      // ba - dum - tss
      hit(0, 'tom', 0.8, { tune: 1.2 }),
      hit(0.12, 'snare', 1),
      hit(0.26, 'ohat', 0.7),
    ],
    jitter: 15,
    cooldown: 0.4,
  },

  praise: {
    events: [
      // a warm rising hug of three notes
      tone(0, 'sine', 'E5', 0.12, { vol: 0.22, layers: CHIME, a: 0.004, d: 0.1, s: 0.4, r: 0.04 }),
      tone(0.11, 'sine', 'G5', 0.12, { vol: 0.22, layers: CHIME, a: 0.004, d: 0.1, s: 0.4, r: 0.04 }),
      tone(0.22, 'sine', 'C6', 0.5, { vol: 0.24, layers: CHIME, a: 0.004, d: 0.4, s: 0.3, r: 0.16, vib: { rate: 6, depth: 14, delay: 0.1 } }),
      tone(0.22, 'p50', 'E6', 0.4, { vol: 0.07, d: 0.35, s: 0.2, r: 0.12 }),
    ],
    jitter: 10,
    cooldown: 0.2,
  },
};
