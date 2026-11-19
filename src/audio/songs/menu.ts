import type { Song } from '../sequencer';
import { compileSong } from './dsl';
import { cat, hold, phrase, rep, rests } from './helpers';

/**
 * MENU: calm. A quiet room with the lights low. Ab major, 84 bpm, 24 bars (about 69 s).
 *
 *   A  (1-8)    a flute lullaby over maj7 chords, ending open on the dominant
 *   B  (9-16)   the tune lifts a third, reaches the top of the range, turns back through ii-V
 *   A' (17-24)  the lullaby again, a new turn in bar 20, and home through the dominant
 *
 * Intensity (0 to 1) stacks layers, softest first:
 *   0.0   arps + pad       (a music box, nothing else)
 *   0.2   bass joins
 *   0.35  flute melody joins
 *   0.5   shaker and a soft kick
 *   0.65  bell twinkles
 */
const HARMONY = [
  // A
  'Abmaj7', 'Fm7', 'Dbmaj7', 'Eb', 'Abmaj7', 'Cm7', 'Dbmaj7', 'Eb',
  // B
  'Dbmaj7', 'Eb', 'Cm7', 'Fm7', 'Dbmaj7', 'Eb', 'Abmaj7,Fm7', 'Bbm7,Eb7',
  // A'
  'Abmaj7', 'Fm7', 'Dbmaj7', 'Bbm7,Eb7', 'Abmaj7', 'Cm7', 'Dbmaj7', 'Eb',
];

// ------------------------------------------------------------------ melody (flute)
const A1 = phrase({ 0: 'Eb5', 6: 'C5', 8: 'Eb5', 12: 'G5' });
const A2 = phrase({ 0: 'F5', 4: 'Eb5', 6: 'C5', 8: 'Ab4', 12: 'C5' });
const A3 = phrase({ 0: 'Db5', 6: 'F5', 8: 'Ab5', 12: 'F5' });
const A4 = phrase({ 0: 'G5', 6: 'Bb5', 8: 'G5', 12: '.' });
const A5 = phrase({ 0: 'Eb5', 6: 'C5', 8: 'Eb5', 12: 'Ab5' });
const A6 = phrase({ 0: 'G5', 4: 'F5', 6: 'Eb5', 8: 'C5', 12: 'Eb5' });
const A7 = phrase({ 0: 'F5', 4: 'Ab5', 8: 'C6', 12: 'Ab5' });
const A8 = phrase({ 0: 'Bb5', 6: 'G5', 8: 'Bb5', 12: '.' });

const B = [
  phrase({ 0: 'Ab5', 4: 'F5', 6: 'Db5', 8: 'F5', 12: 'Ab5' }),
  phrase({ 0: 'Bb5', 6: 'G5', 8: 'Eb5', 12: 'G5' }),
  phrase({ 0: 'C6', 4: 'Bb5', 6: 'G5', 8: 'Eb5', 12: 'G5' }),
  phrase({ 0: 'Ab5', 6: 'F5', 8: 'C5', 12: 'Eb5' }),
  phrase({ 0: 'F5', 4: 'Ab5', 8: 'C6', 12: 'Db6' }),
  phrase({ 0: 'Bb5', 4: 'G5', 8: 'Bb5', 12: 'Eb6' }),
  phrase({ 0: 'C6', 6: 'Eb5', 8: 'C6', 12: 'Ab5' }),
  phrase({ 0: 'F5', 4: 'Db5', 6: 'Bb4', 8: 'G5', 12: 'Bb5' }),
];

const MELODY = cat(
  [A1, A2, A3, A4, A5, A6, A7, A8],
  B,
  [A1, A2, A3, phrase({ 0: 'F5', 4: 'Db5', 6: 'Bb4', 8: 'G5', 12: 'Bb5' }), A5, A6, A7, phrase({ 0: 'Bb5', 6: 'G5', 8: 'Eb5', 12: '.' })],
);

// ------------------------------------------------------------------ arps (a music box)
const ARP8 = '1 . 5 . 8 . 5 . 3 . 5 . 8 . 5 .';
const ARP7 = '1 . 3 . 5 . 7 . 8 . 7 . 5 . 3 .';
const ARPHALF = '1 . 5 . 8 . 5 . 1 . 3 . 5 . 3 .';

// ------------------------------------------------------------------ bass
const HALF = '1 - - - - - - - 5 - - - - - - -';
const WALK = '1 - - - - - - - 5 - - - 3 - 5 -';
const LONG = hold('1', 16);
// a bar with two chords: the root of each
const ROOTS2 = '1 - - - - - - - 1 - - - - - - -';

// ------------------------------------------------------------------ pad
const PAD = hold('1+3+5+7', 16);
const PAD2 = `${hold('1+3+5+7', 8)} ${hold('1+3+5+7', 8)}`;

// ------------------------------------------------------------------ bell
const BELL_A = '. . . . . . . . 5 . . . . . 8 .';
const BELL_B = '. . 3 . . . . . . . 5 . . . . .';
const BELL_END = '. . . . . . . . . . . . 8 . . .';

export const menu: Song = compileSong({
  id: 'menu',
  title: 'Menu (calm)',
  key: 'Ab major',
  bpm: 84,
  bars: 24,
  defaultIntensity: 0.55,
  harmony: HARMONY,
  tracks: [
    {
      id: 'base',
      inst: 'arpSoft',
      pan: -0.2,
      vol: 4.03,
      bars: cat(rep(ARP8, 7), ARPHALF, rep(ARP7, 6), ARP8, ARP7, rep(ARP8, 7), ARPHALF),
    },
    {
      id: 'pad',
      inst: 'pad',
      octave: 3,
      pan: 0.15,
      vol: 1.33,
      bars: cat(rep(PAD, 14), PAD2, PAD2, rep(PAD, 3), PAD2, rep(PAD, 3), PAD),
    },
    {
      id: 'bass',
      inst: 'bassWarm',
      octave: 2,
      at: 0.2,
      vol: 0.95,
      bars: cat(rep(HALF, 3), WALK, rep(HALF, 3), WALK, rep(LONG, 6), rep(ROOTS2, 2), rep(HALF, 3), ROOTS2, rep(HALF, 3), WALK),
    },
    { id: 'lead', inst: 'flute', at: 0.35, pan: 0.1, vol: 1.4, bars: MELODY },
    {
      id: 'perc',
      at: 0.5,
      vol: 1.35,
      lanes: {
        k: rep('x . . . . . . . x . . . . . . .', 24),
        sh: rep('o . x . o . x . o . x . o . x .', 24),
      },
    },
    {
      id: 'extra',
      inst: 'bell',
      octave: 5,
      at: 0.65,
      pan: 0.3,
      vol: 1.75,
      bars: cat(rests(2), BELL_A, BELL_END, rests(2), BELL_A, BELL_END, BELL_B, BELL_END, BELL_B, BELL_END, BELL_B, BELL_END, BELL_A, BELL_END, rests(2), BELL_A, BELL_END, rests(2), BELL_A, BELL_END),
    },
  ],
});
