import type { Song } from '../sequencer';
import { compileSong } from './dsl';
import { cat, every4, hold, phrase, place, rep, rests } from './helpers';

/**
 * AWARDS: the ceremony, red carpet and far too many trumpets. Bb major, 108 bpm,
 * 16 bars (about 36 s).
 *
 *   A  (1-4)    the call: a rising triad in a dotted rhythm, then down through Eb and F
 *   A2 (5-8)   the answer, a third higher, ending on the dominant seventh
 *   B  (9-12)   the trophy moment: long notes climbing through the relative minor
 *   C  (13-16)  the climax: the call at the top of the range, and a cadence that falls into the loop
 *
 * Intensity (0 to 1) stacks layers:
 *   0.0   organ + oom-pah bass
 *   0.25  chord stabs on 2 and 4 (the "pah")
 *   0.3   trumpets (the melody) join
 *   0.45  marching snare, timpani and cymbals
 *   0.7   glockenspiel sparkle
 */
const HARMONY = [
  // A
  'Bb', 'Eb,Bb', 'F', 'Bb,F',
  // A2
  'Bb', 'Eb,Cm', 'F', 'F,F7',
  // B
  'Gm', 'Eb', 'Bb,F', 'Cm,F',
  // C
  'Gm', 'Eb,Cm', 'F', 'F7',
];

// ------------------------------------------------------------------ melody (brass)
const MELODY = [
  // A
  phrase({ 0: 'F5', 3: 'F5', 4: 'Bb5', 8: 'D6', 12: 'F6' }),
  phrase({ 0: 'Eb6', 3: 'Eb6', 4: 'D6', 8: 'Bb5', 12: 'D6' }),
  phrase({ 0: 'C6', 3: 'C6', 4: 'F6', 8: 'A6', 10: 'C7', 12: 'A6' }),
  phrase({ 0: 'Bb6', 6: 'A6', 8: 'F6', 12: 'C6' }),
  // A2
  phrase({ 0: 'D6', 3: 'D6', 4: 'F6', 8: 'Bb6', 12: 'D7' }),
  phrase({ 0: 'G6', 3: 'G6', 4: 'Bb6', 8: 'C7', 12: 'Eb7' }),
  phrase({ 0: 'C7', 3: 'C7', 4: 'A6', 8: 'F6', 12: 'A6' }),
  phrase({ 0: 'C7', 4: 'A6', 8: 'Eb6', 10: 'F6', 12: 'A6', 14: 'C7' }),
  // B
  phrase({ 0: 'G5', 6: 'Bb5', 8: 'D6', 12: 'G6' }),
  phrase({ 0: 'Eb6', 4: 'D6', 6: 'Eb6', 8: 'G6', 12: 'Bb6' }),
  phrase({ 0: 'D6', 4: 'F6', 8: 'A6', 12: 'F6' }),
  phrase({ 0: 'Eb6', 4: 'G6', 8: 'A6', 12: 'C7' }),
  // C
  phrase({ 0: 'G6', 3: 'G6', 4: 'Bb6', 8: 'D7', 12: 'Bb6' }),
  phrase({ 0: 'Eb7', 3: 'D7', 4: 'C7', 8: 'Eb7', 12: 'G6' }),
  phrase({ 0: 'C7', 3: 'A6', 4: 'F6', 8: 'A6', 12: 'C7' }),
  phrase({ 0: 'A6', 2: 'C7', 4: 'Eb7', 8: 'C7', 12: 'A6', 14: 'F6' }),
];

// ------------------------------------------------------------------ organ and oom-pah
const ONE = hold('1+3+5', 16);
const TWO = `${hold('1+3+5', 8)} ${hold('1+3+5', 8)}`;
// bars with two chords are 2, 4, 6, 8, 11, 12 and 14
const ORGAN = [ONE, TWO, ONE, TWO, ONE, TWO, ONE, TWO, ONE, ONE, TWO, TWO, ONE, TWO, ONE, ONE];

const OOM = '1 - . . . . . . 5 - . . . . . .';
const OOM2 = '1 - . . . . . . 1 - . . . . . .';
const OOM_PICKUP = '1 - . . . . . . 1 - . . 3 - 5 -';
const BASS = [OOM, OOM2, OOM, OOM2, OOM, OOM2, OOM, OOM2, OOM, OOM, OOM2, OOM2, OOM, OOM2, OOM, OOM_PICKUP];

const PAH = place({ 4: '3+5+8', 12: '3+5+8' });
const PAH_END = place({ 4: '3+5+8', 12: '3+5+8', 14: '3+5+8' });

// ------------------------------------------------------------------ march
const MARCH = place({ 0: 'o', 2: 'o', 3: 'x', 4: 'X', 6: 'o', 8: 'o', 10: 'o', 11: 'x', 12: 'X', 14: 'o' });
const ROLL = 'o o o o o o o o x x x x X X X X';
const TIMP = place({ 0: 'X', 8: 'X' });
const TIMP_END = place({ 0: 'X', 8: 'X', 14: 'x' });
const CRASH = place({ 0: 'X' });

// ------------------------------------------------------------------ sparkle
const SPARK = '. . . . . . . . 1 . 3 . 5 . 8 .';
const TWINKLE = '5 . . . . . 8 . . . 5 . . . 8 .';

export const awards: Song = compileSong({
  id: 'awards',
  title: 'Awards (ceremony)',
  key: 'Bb major',
  bpm: 108,
  bars: 16,
  defaultIntensity: 0.6,
  harmony: HARMONY,
  tracks: [
    { id: 'base', inst: 'organ', octave: 3, pan: -0.15, vol: 0.37, bars: ORGAN },
    { id: 'bass', inst: 'bassPulse', octave: 3, vol: 0.95, bars: BASS },
    { id: 'chords', inst: 'stab', octave: 4, at: 0.25, pan: 0.2, vol: 2.21, bars: every4(PAH, PAH_END, 4) },
    { id: 'lead', inst: 'brass', at: 0.3, pan: 0.05, vol: 1.5, bars: MELODY },
    {
      id: 'perc',
      at: 0.45,
      vol: 0.37,
      lanes: {
        s: every4(MARCH, ROLL, 4),
        tl: every4(TIMP, TIMP_END, 4),
        cr: cat(CRASH, rests(3), CRASH, rests(3), CRASH, rests(3), CRASH, rests(3)),
      },
    },
    { id: 'extra', inst: 'glock', octave: 5, at: 0.7, pan: 0.3, vol: 1.32, bars: cat(rests(4), rep(SPARK, 4), rep(TWINKLE, 4), rep(SPARK, 4)) },
  ],
});
