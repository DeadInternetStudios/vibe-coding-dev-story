import type { SfxIdOf } from '../ids';
import { hit, noise, slide, tone, type SfxBody, type ToneEvent } from './dsl';
import { BELL } from './parts';

/** A burst of typing: irregular gaps, two key sounds, and a heavier thock for the enter key. */
const KEY_TIMES = [0, 0.058, 0.109, 0.152, 0.213, 0.268, 0.309, 0.371, 0.43, 0.474, 0.538] as const;
const keys: ToneEvent[] = KEY_TIMES.flatMap((at, i): ToneEvent[] => {
  const high = i % 3 !== 1;
  return [
    noise(at, 'noiseL', high ? 15000 : 11000, 0.014, {
      vol: 0.13 - (i % 4) * 0.01,
      a: 0.0005,
      d: 0.011,
      s: 0,
      r: 0.004,
      filter: { type: 'bandpass', f0: high ? 2300 : 1500, q: 0.9 },
    }),
    tone(at, 'tri', high ? 720 - i * 6 : 470 + i * 5, 0.022, { vol: 0.26, a: 0.001, d: 0.02, s: 0, r: 0.006 }),
  ];
});

/** Bubbles rising in a cup: each is a small upward blip. */
const BUBBLES = [
  { at: 0.06, from: 'C5', to: 'G5' },
  { at: 0.13, from: 'E5', to: 'B5' },
  { at: 0.2, from: 'D5', to: 'A5' },
  { at: 0.27, from: 'F5', to: 'C6' },
  { at: 0.33, from: 'E5', to: 'B5' },
] as const;

/** The office, its people and its pets. Mostly cheerful, some of it a disaster. */
export const office: Record<SfxIdOf<'office'>, SfxBody> = {
  hire: {
    events: [
      // hel-LO, a leap up a sixth, and a little round of applause
      tone(0, 'p25', 'G5', 0.09, { vol: 0.24, d: 0.08, s: 0.4, r: 0.03 }),
      tone(0.1, 'p25', 'E6', 0.32, { vol: 0.24, d: 0.28, s: 0.25, r: 0.1, vib: { rate: 6, depth: 14, delay: 0.1 } }),
      tone(0.1, 'sine', 'E6', 0.4, { vol: 0.1, layers: BELL, d: 0.35, s: 0, r: 0.12 }),
      hit(0.14, 'clap', 0.7),
      hit(0.2, 'clap', 0.55),
      hit(0.25, 'clap', 0.6),
      hit(0.3, 'clap', 0.45),
    ],
    jitter: 12,
    cooldown: 0.25,
  },

  fire: {
    events: [
      // dun
      hit(0, 'tom', 0.6, { tune: 0.75 }),
      tone(0, 'saw', 'G3', 0.16, { vol: 0.34, a: 0.004, d: 0.12, s: 0.5, r: 0.05, filter: { type: 'lowpass', f0: 1800, q: 0.8 } }),
      tone(0, 'tri', 'G2', 0.16, { vol: 0.2, d: 0.14, s: 0.5, r: 0.05 }),
      // dun
      hit(0.24, 'tom', 0.6, { tune: 0.75 }),
      tone(0.24, 'saw', 'G3', 0.16, { vol: 0.34, a: 0.004, d: 0.12, s: 0.5, r: 0.05, filter: { type: 'lowpass', f0: 1800, q: 0.8 } }),
      tone(0.24, 'tri', 'G2', 0.16, { vol: 0.2, d: 0.14, s: 0.5, r: 0.05 }),
      // DUUUN: lower and long, sagging a little under a slow wobble
      hit(0.48, 'tom', 0.7, { tune: 0.65 }),
      slide(0.48, 'saw', 'Db3', 'C3', 0.6, {
        vol: 0.38,
        a: 0.006,
        d: 0.5,
        s: 0.5,
        r: 0.15,
        vib: { rate: 5.5, depth: 28, delay: 0.15 },
        filter: { type: 'lowpass', f0: 1600, q: 0.8 },
      }),
      slide(0.48, 'tri', 'Db2', 'C2', 0.6, { vol: 0.2, d: 0.5, s: 0.5, r: 0.15 }),
      // a low rumble under the last stroke instead of a cymbal wash
      noise(0.48, 'noiseL', 3000, 0.7, { vol: 0.22, a: 0.01, d: 0.6, s: 0.1, r: 0.1, filter: { type: 'lowpass', f0: 900, f1: 200, time: 0.6, q: 0.7 } }),
    ],
    jitter: 8,
    cooldown: 0.6,
  },

  coffee: {
    events: [
      // pouring: a band of noise that rises as the cup fills
      noise(0, 'noiseL', 12000, 0.4, { vol: 0.5, a: 0.04, d: 0.3, s: 0.3, r: 0.06, filter: { type: 'bandpass', f0: 900, f1: 1600, time: 0.36, q: 1.3 } }),
      ...BUBBLES.map((b) => slide(b.at, 'sine', b.from, b.to, 0.05, { vol: 0.1, d: 0.045, s: 0, r: 0.01 })),
      // the cup clinks the saucer
      tone(0.42, 'sine', 'E7', 0.12, { vol: 0.06, layers: BELL, d: 0.1, s: 0, r: 0.04 }),
    ],
    jitter: 25,
    cooldown: 0.3,
  },

  pizza: {
    events: [
      // the cutter rolls: five quick ticks
      ...[0, 0.04, 0.075, 0.105, 0.13].map((at) =>
        noise(at, 'noiseL', 9000, 0.012, { vol: 0.1, a: 0.0005, d: 0.01, s: 0, r: 0.003, filter: { type: 'bandpass', f0: 2600, q: 1.2 } }),
      ),
      // a happy "mmm" and a ding
      slide(0.17, 'p50', 'C5', 'G5', 0.16, { vol: 0.2, d: 0.14, s: 0.4, r: 0.04, vib: { rate: 7, depth: 12, delay: 0.08 } }),
      tone(0.35, 'p25', 'A5', 0.09, { vol: 0.22, d: 0.08, s: 0.3, r: 0.03 }),
      tone(0.44, 'p25', 'E6', 0.3, { vol: 0.22, d: 0.25, s: 0.2, r: 0.1 }),
      tone(0.44, 'sine', 'E6', 0.35, { vol: 0.09, layers: BELL, d: 0.3, s: 0, r: 0.1 }),
    ],
    jitter: 14,
    cooldown: 0.4,
  },

  phone: {
    level: -2,
    events: [
      // a two tone trill, twice, like a desk phone
      tone(0, 'p50', 'A5', 0.34, { vol: 0.2, a: 0.004, d: 0.02, s: 0.9, r: 0.02, arp: { semis: [0, 4], rate: 22 } }),
      tone(0, 'tri', 'A4', 0.34, { vol: 0.12, a: 0.004, d: 0.02, s: 0.9, r: 0.02, arp: { semis: [0, 4], rate: 22 } }),
      tone(0.5, 'p50', 'A5', 0.34, { vol: 0.2, a: 0.004, d: 0.02, s: 0.9, r: 0.02, arp: { semis: [0, 4], rate: 22 } }),
      tone(0.5, 'tri', 'A4', 0.34, { vol: 0.12, a: 0.004, d: 0.02, s: 0.9, r: 0.02, arp: { semis: [0, 4], rate: 22 } }),
    ],
    jitter: 10,
    cooldown: 0.4,
  },

  keyboard_burst: {
    level: -4,
    events: [
      ...keys,
      // enter
      noise(0.62, 'noiseL', 8000, 0.03, { vol: 0.15, a: 0.0005, d: 0.025, s: 0, r: 0.006, filter: { type: 'bandpass', f0: 1000, q: 0.8 } }),
      tone(0.62, 'tri', 300, 0.05, { vol: 0.32, a: 0.001, d: 0.045, s: 0, r: 0.01 }),
    ],
    jitter: 60,
    cooldown: 0.2,
  },

  rate_limit: {
    events: [
      // requests pour in faster and faster, climbing a whole tone scale ...
      ...[
        { at: 0, f: 'C5' },
        { at: 0.08, f: 'D5' },
        { at: 0.15, f: 'E5' },
        { at: 0.21, f: 'F#5' },
        { at: 0.26, f: 'G#5' },
        { at: 0.3, f: 'A#5' },
        { at: 0.33, f: 'C6' },
      ].map((n) => tone(n.at, 'p25', n.f, 0.04, { vol: 0.34, d: 0.035, s: 0.2, r: 0.01 })),
      // ... then the door shuts: a sagging buzz
      slide(0.42, 'saw', 330, 82, 0.4, { vol: 0.2, d: 0.35, s: 0.4, r: 0.05, filter: { type: 'lowpass', f0: 1800, f1: 400, time: 0.4, q: 1 } }),
      slide(0.42, 'tri', 165, 70, 0.4, { vol: 0.12, d: 0.35, s: 0.4, r: 0.05 }),
    ],
    jitter: 10,
    cooldown: 0.5,
  },

  alert: {
    events: [
      // attention please: two pairs of rising pings
      tone(0, 'p50', 'E6', 0.09, { vol: 0.2, d: 0.08, s: 0.4, r: 0.03 }),
      tone(0.12, 'p50', 'A6', 0.12, { vol: 0.2, d: 0.1, s: 0.3, r: 0.04 }),
      tone(0.34, 'p50', 'E6', 0.09, { vol: 0.22, d: 0.08, s: 0.4, r: 0.03 }),
      tone(0.46, 'p50', 'A6', 0.18, { vol: 0.22, d: 0.15, s: 0.3, r: 0.06 }),
      tone(0, 'tri', 'E5', 0.09, { vol: 0.12, d: 0.08, s: 0.4, r: 0.03 }),
      tone(0.12, 'tri', 'A5', 0.12, { vol: 0.12, d: 0.1, s: 0.3, r: 0.04 }),
      tone(0.34, 'tri', 'E5', 0.09, { vol: 0.12, d: 0.08, s: 0.4, r: 0.03 }),
      tone(0.46, 'tri', 'A5', 0.18, { vol: 0.12, d: 0.15, s: 0.3, r: 0.06 }),
    ],
    jitter: 8,
    cooldown: 0.4,
  },

  bug: {
    events: [
      // a fly: two close pitches beating against each other
      tone(0, 'p25', 'A3', 0.26, {
        vol: 0.2,
        a: 0.01,
        d: 0.05,
        s: 0.8,
        r: 0.03,
        arp: { semis: [0, 1], rate: 38 },
        filter: { type: 'lowpass', f0: 1800 },
        vib: { rate: 9, depth: 20, delay: 0.05 },
      }),
      tone(0, 'saw', 'A4', 0.26, {
        vol: 0.07,
        a: 0.01,
        d: 0.05,
        s: 0.8,
        r: 0.03,
        arp: { semis: [0, -1], rate: 31 },
        filter: { type: 'bandpass', f0: 1400, q: 2 },
      }),
      // bzzt-oop: it zips away
      slide(0.27, 'p25', 'E5', 'A3', 0.14, { vol: 0.2, d: 0.12, s: 0.2, r: 0.03, filter: { type: 'lowpass', f0: 2400 } }),
      noise(0, 'noiseS', 3000, 0.05, { vol: 0.06, a: 0.002, d: 0.04, s: 0, r: 0.01, filter: { type: 'bandpass', f0: 1800, q: 1 } }),
    ],
    jitter: 30,
    cooldown: 0.3,
  },

  fix: {
    events: [
      // clunk: the wrench goes on
      hit(0, 'rim', 0.9),
      hit(0.01, 'tom', 0.6, { tune: 1.4 }),
      // then a rising run that lands bright
      tone(0.11, 'p25', 'G5', 0.07, { vol: 0.24, d: 0.06, s: 0.4, r: 0.03 }),
      tone(0.17, 'p25', 'B5', 0.07, { vol: 0.24, d: 0.06, s: 0.4, r: 0.03 }),
      tone(0.23, 'p25', 'D6', 0.07, { vol: 0.24, d: 0.06, s: 0.4, r: 0.03 }),
      tone(0.29, 'p25', 'G6', 0.3, { vol: 0.22, d: 0.25, s: 0.25, r: 0.1 }),
      tone(0.29, 'sine', 'G6', 0.4, { vol: 0.1, layers: BELL, d: 0.35, s: 0, r: 0.12 }),
    ],
    jitter: 12,
    cooldown: 0.3,
  },

  explosion: {
    events: [
      // crack, then the boom rolls away
      noise(0, 'noiseL', 24000, 0.05, { vol: 0.26, a: 0.0005, d: 0.04, s: 0, r: 0.01 }),
      noise(0.01, 'noiseL', 9000, 0.8, { vol: 0.36, a: 0.004, d: 0.7, s: 0.05, r: 0.1, filter: { type: 'lowpass', f0: 5000, f1: 250, time: 0.7, q: 0.7 } }),
      slide(0, 'tri', 160, 38, 0.6, { vol: 0.5, a: 0.002, d: 0.5, s: 0.1, r: 0.12 }),
      slide(0, 'p25', 220, 70, 0.45, { vol: 0.18, d: 0.4, s: 0, r: 0.08 }),
      // debris rattling down
      ...[0.18, 0.27, 0.36, 0.5].map((at) =>
        noise(at, 'noiseS', 7000, 0.04, { vol: 0.07, d: 0.035, s: 0, r: 0.01, filter: { type: 'bandpass', f0: 1800, q: 1 } }),
      ),
    ],
    jitter: 40,
    cooldown: 0.3,
  },

  quack: {
    events: [
      // "kwa": a saw through a band-pass that opens as the pitch falls
      noise(0, 'noiseS', 4000, 0.025, { vol: 0.1, a: 0.001, d: 0.02, s: 0, r: 0.005, filter: { type: 'bandpass', f0: 1500, q: 1.2 } }),
      slide(0, 'saw', 620, 340, 0.1, { vol: 0.8, a: 0.004, d: 0.09, s: 0.5, r: 0.03, filter: { type: 'bandpass', f0: 900, f1: 1500, time: 0.09, q: 3 } }),
      // "ack": a shorter, lower second pulse
      slide(0.11, 'saw', 480, 280, 0.08, { vol: 0.6, a: 0.004, d: 0.07, s: 0.4, r: 0.03, filter: { type: 'bandpass', f0: 800, f1: 1300, time: 0.08, q: 3 } }),
    ],
    jitter: 120,
    cooldown: 0.12,
  },

  meow: {
    events: [
      // mee: the vowel opens as the pitch rises ...
      slide(0, 'saw', 520, 880, 0.14, { vol: 0.3, a: 0.015, d: 0.12, s: 0.8, r: 0.02, filter: { type: 'bandpass', f0: 900, f1: 2100, time: 0.14, q: 2.5 } }),
      // ... ow: and closes again as it falls
      slide(0.14, 'saw', 880, 460, 0.3, {
        vol: 0.3,
        a: 0.01,
        d: 0.28,
        s: 0.6,
        r: 0.08,
        vib: { rate: 7, depth: 30, delay: 0.1 },
        filter: { type: 'bandpass', f0: 2100, f1: 800, time: 0.3, q: 2.5 },
      }),
    ],
    jitter: 150,
    cooldown: 0.25,
  },

  ghost: {
    events: [
      // ooOOoo: a hollow sine gliding up and back down under a slow wobble, then two fading echoes
      ...[
        { at: 0, vol: 0.2, pan: 0 },
        { at: 0.2, vol: 0.1, pan: -0.4 },
        { at: 0.38, vol: 0.05, pan: 0.4 },
      ].flatMap((echo): ToneEvent[] => [
        slide(echo.at, 'sine', 392, 740, 0.45, { vol: echo.vol, a: 0.12, d: 0.4, s: 0.7, r: 0.1, vib: { rate: 5, depth: 45, delay: 0.1 }, pan: echo.pan }),
        slide(echo.at + 0.45, 'sine', 740, 330, 0.5, { vol: echo.vol, a: 0.02, d: 0.45, s: 0.6, r: 0.2, vib: { rate: 5, depth: 45, delay: 0.05 }, pan: echo.pan }),
      ]),
      noise(0, 'noiseL', 6000, 1, { vol: 0.03, a: 0.3, d: 0.6, s: 0.3, r: 0.1, filter: { type: 'bandpass', f0: 500, f1: 900, time: 0.9, q: 3 } }),
    ],
    jitter: 25,
    cooldown: 0.8,
  },
};
