import type { Song } from '../sequencer';
import { compileSong } from './dsl';
import { cat, hold, place, rep, rests } from './helpers';

/**
 * THREAD: smug and jaunty, the music under a voice reading a thread aloud.
 * G major, 96 bpm, swung eighths, 24 bars (60 s).
 *
 *   A  (1-8)    "I vi ii V" twice: a marimba line that tiptoes down the chord tones
 *   B  (9-16)   the bridge: IV, then the sly minor iv, I, a secondary dominant (E7) and back
 *   A' (17-24)  the tune again with a longer run, ending on V so the loop falls back into A
 *
 * Built to sit under speech: no snare, soft kick, and the lead is a plucked marimba that
 * decays fast, over one quiet sustained line.
 *
 * Intensity (0 to 1) stacks layers:
 *   0.0   base (offbeat comping) + bass (two feel) + perc (shaker and rim tick)
 *   0.25  lead (marimba) joins
 *   0.3   extra (flute drone line) joins
 *   0.55  kit (soft kick, claps in the bridge) joins
 */
const HARMONY = [
  // A
  'G', 'Em7', 'Am7', 'D7', 'G', 'Em7', 'Am7', 'D7',
  // B
  'C', 'Cm', 'G', 'E7', 'Am7', 'D7', 'G,E7', 'Am7,D7',
  // A'
  'G', 'Em7', 'Am7', 'D7', 'G', 'Em7', 'Am7', 'D7',
];

// ------------------------------------------------------------------ lead
const LEAD_A = [
  'B4 . D5 . G5 - - - F#5 . G5 . D5 - - -',
  'E5 . G5 . B5 - - - D6 . B5 . G5 - - -',
  'A5 . C6 . E6 - - - D6 . C6 . A5 - - -',
  'D6 . C6 . A5 - - - F#5 . A5 . D5 - - -',
  'B4 . D5 . G5 - - - A5 . B5 . D6 - - -',
  'E5 . G5 . B5 - - - D6 - - - E6 - - -',
  'C6 . . . A5 . . . E5 . . . A5 . C6 .',
  'A5 . F#5 . D5 - - - . . . . . . . .',
];
const LEAD_B = [
  'E5 . G5 . C6 - - - B5 . A5 . G5 - - -',
  'Eb5 . G5 . C6 - - - Bb5 . G5 . Eb5 - - -',
  'D5 . G5 . B5 - - - D6 . B5 . G5 - - -',
  'G#5 . B5 . E6 - - - D6 . B5 . G#5 - - -',
  'A5 . C6 . E6 - - - C6 . A5 . E5 - - -',
  'F#5 . A5 . D6 - - - C6 . A5 . F#5 - - -',
  'B5 . . . D6 . . . G#5 . . . B5 . . .',
  'C6 . . . A5 . . . F#5 . . . D5 . . .',
];
const LEAD_A2 = [
  'B4 . D5 . G5 - - - F#5 . G5 . B5 - - -',
  'E5 . G5 . B5 - - - D6 . B5 . G5 . E5 .',
  'A5 . C6 . E6 - - - D6 . C6 . A5 - - -',
  'D6 . C6 . A5 - - - F#5 . A5 . D6 - - -',
  'B5 . . G5 . . D5 . B4 . . . G4 . . .',
  'E5 . G5 . B5 . D6 . E6 . . . D6 . B5 .',
  'C6 . A5 . E5 . A5 . C6 . E6 . D6 . C6 .',
  'A5 . F#5 . D5 - - - . . . . . . . .',
];

// ------------------------------------------------------------------ base
const COMP = place({ 2: '3+5', 6: '3+5', 10: '3+5', 14: '3+5' });

// ------------------------------------------------------------------ bass
const TWO_FEEL = place({ 0: '1', 1: '-', 2: '-', 8: '5', 9: '-', 10: '-' });
const WALK = place({ 0: '1', 1: '-', 4: '3', 5: '-', 8: '5', 9: '-', 12: '3', 13: '-' });

// ----------------------------------------------------------------- extra
const DRONE_5 = hold('5', 16);
const DRONE_3 = hold('3', 16);
const DRONE_3_SPLIT = `${hold('3', 8)} ${hold('3', 8)}`;

// ------------------------------------------------------------------- kit
const KICK_A = place({ 0: 'x', 8: 'x' });
const KICK_B = place({ 0: 'x', 6: 'o', 8: 'x', 14: 'o' });
const CLAP = place({ 4: 'o', 12: 'o' });

export const thread: Song = compileSong({
  id: 'thread',
  title: 'Thread (smug)',
  key: 'G major',
  bpm: 96,
  bars: 24,
  swing: 0.5,
  defaultIntensity: 0.4,
  chromatic: ['Bb', 'Eb', 'G#'],
  harmony: HARMONY,
  tracks: [
    {
      id: 'base',
      inst: 'pluckSq',
      pan: -0.15,
      vol: 2.09,
      bars: rep(COMP, 24),
    },
    {
      id: 'bass',
      inst: 'bassPizz',
      octave: 2,
      vol: 0.85,
      bars: cat(rep(TWO_FEEL, 7), WALK, rep(WALK, 8), rep(TWO_FEEL, 7), WALK),
    },
    {
      id: 'perc',
      vol: 0.82,
      lanes: {
        sh: rep('X . o . x . o . X . o . x . o .', 24),
        r: rep(place({ 4: 'x', 12: 'x' }), 24),
      },
    },
    {
      id: 'lead',
      inst: 'marimba',
      at: 0.25,
      pan: 0.1,
      vol: 2.4,
      bars: cat(LEAD_A, LEAD_B, LEAD_A2),
    },
    {
      id: 'kit',
      at: 0.55,
      vol: 0.77,
      lanes: {
        k: cat(rep(KICK_A, 8), rep(KICK_B, 8), rep(KICK_A, 8)),
        c: cat(rests(8), rep(CLAP, 8), rests(8)),
      },
    },
    {
      id: 'extra',
      inst: 'flute',
      octave: 4,
      at: 0.3,
      pan: 0.2,
      vol: 0.22,
      bars: cat(
        DRONE_5, DRONE_5, DRONE_5, DRONE_5, DRONE_5, DRONE_5, DRONE_5, DRONE_5,
        DRONE_3, DRONE_3, DRONE_3, DRONE_3, DRONE_3, DRONE_3, DRONE_3_SPLIT, DRONE_3_SPLIT,
        DRONE_5, DRONE_5, DRONE_5, DRONE_5, DRONE_5, DRONE_5, DRONE_5, DRONE_5,
      ),
    },
  ],
});
