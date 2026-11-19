import type { Song } from '../sequencer';
import { compileSong } from './dsl';
import { cat, every8, phrase, place, rep, rests } from './helpers';

/**
 * SHOP: a shopping-centre bossa nova, the escalator and the fountain. Eb major,
 * 112 bpm, 24 bars (about 51 s).
 *
 *   A  (1-8)    ii-V-I chains: Ebmaj7 Cm7 Fm7 Bb7, then Gm7 C7 Fm7 Bb7. A breezy tune in 3+3+2
 *   B  (9-16)   up to the IV (Abmaj7) and back down the circle; the comping gets busier
 *   A' (17-24)  the first tune again, a new turn at the end that falls into the loop
 *
 * Feel: a bossa bass (root, then the fifth on the "and" of 2), a rim-shot clave
 * (3-2: steps 0 3 6 10 13), shaker in sixteenths, and guitar-like shell voicings
 * (3rd and 7th, 5th and root) that land between the beats.
 *
 * Intensity (0 to 1) stacks layers:
 *   0.0   bass + comping + clave and shaker
 *   0.3   melody joins
 *   0.45  a soft kick
 *   0.6   marimba cross-rhythm joins (three against four)
 */
const HARMONY = [
  // A
  'Ebmaj7', 'Cm7', 'Fm7', 'Bb7', 'Gm7', 'C7', 'Fm7', 'Bb7',
  // B
  'Abmaj7', 'Bb7', 'Gm7', 'Cm7', 'Fm7', 'Bb7', 'Ebmaj7', 'Fm7,Bb7',
  // A'
  'Ebmaj7', 'Cm7', 'Fm7', 'Bb7', 'Gm7', 'C7', 'Fm7', 'Bb7sus4,Bb7',
];

// ------------------------------------------------------------------ melody (soft lead)
const A = [
  phrase({ 0: 'G5', 3: 'Bb5', 6: 'D6', 8: 'Eb6', 11: 'D6', 14: 'Bb5' }),
  phrase({ 0: 'C6', 3: 'Eb6', 6: 'G6', 8: 'Bb6', 12: 'G6' }),
  phrase({ 0: 'Ab5', 3: 'C6', 6: 'Eb6', 8: 'F6', 11: 'Eb6', 14: 'C6' }),
  phrase({ 0: 'D6', 4: 'F6', 6: 'Ab6', 8: 'F6', 12: 'D6' }),
  phrase({ 0: 'G5', 3: 'Bb5', 6: 'D6', 8: 'F6', 11: 'D6', 14: 'Bb5' }),
  phrase({ 0: 'C6', 3: 'E6', 6: 'G6', 8: 'Bb6', 10: 'G6', 12: 'E6' }),
  phrase({ 0: 'Ab5', 3: 'C6', 6: 'Eb6', 8: 'Ab6', 12: 'F6' }),
  phrase({ 0: 'D6', 3: 'F6', 6: 'Ab6', 8: 'G6', 10: 'F6', 12: 'D6', 14: '.' }),
];
const B = [
  phrase({ 0: 'C6', 3: 'Eb6', 6: 'G6', 8: 'Ab6', 11: 'G6', 14: 'Eb6' }),
  phrase({ 0: 'D6', 3: 'F6', 6: 'Ab6', 8: 'Bb6', 12: 'Ab6' }),
  phrase({ 0: 'D6', 4: 'F6', 6: 'G6', 8: 'Bb6', 11: 'G6', 14: 'F6' }),
  phrase({ 0: 'Eb6', 3: 'G6', 6: 'Bb6', 8: 'C7', 12: 'Bb6' }),
  phrase({ 0: 'C6', 3: 'Eb6', 6: 'F6', 8: 'Ab6', 12: 'F6' }),
  phrase({ 0: 'D6', 3: 'F6', 6: 'Ab6', 8: 'Bb6', 10: 'Ab6', 12: 'F6' }),
  phrase({ 0: 'G5', 3: 'Bb5', 6: 'Eb6', 8: 'D6', 12: 'Bb5' }),
  phrase({ 0: 'Ab5', 3: 'C6', 6: 'Eb6', 8: 'D6', 11: 'F6', 14: 'Ab6' }),
];
const A_END = [
  phrase({ 0: 'D6', 3: 'F6', 6: 'G6', 8: 'Bb6', 11: 'G6', 14: 'D6' }),
  phrase({ 0: 'E6', 3: 'G6', 6: 'Bb6', 8: 'C7', 12: 'Bb6' }),
  phrase({ 0: 'C6', 3: 'Eb6', 6: 'F6', 8: 'Ab6', 12: 'C7' }),
  phrase({ 0: 'Eb6', 4: 'F6', 8: 'Ab6', 12: 'F6' }),
];
const MELODY = cat(A, B, A.slice(0, 4), A_END);

// ------------------------------------------------------------------ comping (guitar-like shells)
const COMP_A = place({ 3: '3+7', 6: '5+8', 10: '3+7', 13: '5+8' });
const COMP_B = place({ 0: '5', 3: '3+7', 6: '5+8', 8: '3+7', 11: '5+8', 14: '3+7' });

// ------------------------------------------------------------------ bass
const BOSSA = '1 - - - - - 5 - 1 - - - - - 5 -';
const BOSSA_WALK = '1 - - - - - 5 - 1 - 3 - 5 - 7 -';

// ------------------------------------------------------------------ percussion
const CLAVE = place({ 0: 'x', 3: 'x', 6: 'x', 10: 'x', 13: 'x' });
const SHAKER = 'X o x o x o x o X o x o x o x o';
const KICK = place({ 0: 'x', 8: 'x' });
const KICK_FILL = place({ 0: 'x', 8: 'x', 14: 'x' });

// ------------------------------------------------------------------ marimba (3 against 4)
const MARIMBA_A = place({ 2: '5', 5: '8', 8: "3'", 11: '5', 14: '3' });
const MARIMBA_B = place({ 2: "3'", 5: '8', 8: '5', 11: '3', 14: '5' });

export const shop: Song = compileSong({
  id: 'shop',
  title: 'Shop (mall bossa)',
  key: 'Eb major',
  bpm: 112,
  bars: 24,
  defaultIntensity: 0.55,
  harmony: HARMONY,
  tracks: [
    { id: 'base', inst: 'pluckSq', octave: 4, pan: -0.2, vol: 1.1, bars: cat(rep(COMP_A, 8), rep(COMP_B, 8), rep(COMP_A, 8)) },
    {
      id: 'bass',
      inst: 'bassPizz',
      octave: 2,
      vol: 1.25,
      bars: cat(rep(BOSSA, 7), BOSSA_WALK, rep(BOSSA, 7), BOSSA_WALK, rep(BOSSA, 7), BOSSA_WALK),
    },
    {
      id: 'perc',
      vol: 0.9,
      lanes: {
        r: rep(CLAVE, 24),
        sh: rep(SHAKER, 24),
      },
    },
    { id: 'lead', inst: 'leadSoft', at: 0.3, pan: 0.1, vol: 1.1, bars: MELODY },
    {
      id: 'kit',
      at: 0.45,
      vol: 0.8,
      lanes: {
        k: every8(KICK, KICK_FILL, 3),
      },
    },
    {
      id: 'extra',
      inst: 'marimba',
      octave: 4,
      at: 0.6,
      pan: 0.25,
      vol: 1.6,
      bars: cat(rests(4), rep(MARIMBA_A, 4), rep(MARIMBA_B, 8), rep(MARIMBA_A, 8)),
    },
  ],
});
