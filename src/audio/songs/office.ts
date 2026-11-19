import type { Song } from '../sequencer';
import { compileSong } from './dsl';
import { cat, every8, hold, rep, rests } from './helpers';

/**
 * OFFICE: the cozy, bouncy home theme. F major, 104 bpm, 32 bars (about 74 s).
 *
 *   A  (1-8)    the hook: a 3-3-2 "tresillo" motif sequenced down by thirds, then answered
 *   B  (9-16)   lift to the IV and V, longer singing notes (the Japanese "royal road" IV V iii vi)
 *   A' (17-24)  the hook again, arps run in sixteenths
 *   C  (25-32)  calm turn, half notes, ends on the dominant so the loop falls back into A
 *
 * Intensity (0 to 1) stacks layers:
 *   0.0  base + bass + perc + pad          (idle, a cup of coffee)
 *   0.3  chords join, pad leaves
 *   0.45 kit + lead join                   (a normal working day)
 *   0.8  extra (glock twinkle) joins       (crunch is near)
 */
const HARMONY = [
  // A
  'F', 'Dm7', 'Gm7', 'C7', 'F', 'Bb', 'Gm7,C7', 'F',
  // B
  'Bb', 'C', 'Am7', 'Dm', 'Bb', 'C', 'Gm7,C7', 'F',
  // A'
  'F', 'Dm7', 'Gm7', 'C7', 'F', 'Bb', 'Gm7,C7', 'F',
  // C
  'Dm7', 'Dm7', 'Gm7', 'Gm7', 'Bb', 'Am7', 'Gm7', 'C7sus4,C7',
];

// ------------------------------------------------------------------ lead
const HOOK_F = 'A5 - - C6 - - A5 - F5 - - G5 - - A5 -';
const LEAD_A = [
  HOOK_F,
  'F5 - - A5 - - F5 - D5 - - E5 - - F5 -',
  'Bb5 - - D6 - - Bb5 - G5 - - A5 - - Bb5 -',
  'G5 - - Bb5 - - G5 - E5 - - F5 - - G5 -',
  HOOK_F,
  'D6 - - Bb5 - - D6 - C6 - - Bb5 - - A5 -',
  'Bb5 - - G5 - - D6 - C6 - - Bb5 - - G5 -',
  'C6 - - A5 - - F5 - G5 - - F5 - - . .',
];
const LEAD_B = [
  'D6 - - - C6 - Bb5 - A5 - - - Bb5 - C6 -',
  'C6 - - - Bb5 - A5 - G5 - - - A5 - Bb5 -',
  'A5 - - - G5 - E5 - G5 - - - A5 - C6 -',
  'D6 - - - C6 - A5 - F5 - - - A5 - D6 -',
  'D6 - - - C6 - Bb5 - A5 - - - Bb5 - C6 -',
  'C6 - - - Bb5 - A5 - G5 - - - Bb5 - C6 -',
  'Bb5 - - G5 - - D5 - E5 - - G5 - - Bb5 -',
  'C6 - - - - - A5 - F5 - - - - - . .',
];
const LEAD_C = [
  'A5 - - - - - - - F5 - - - - - - -',
  'D5 - - - E5 - - - F5 - - - A5 - - -',
  'Bb5 - - - - - - - G5 - - - - - - -',
  'G5 - - - A5 - - - Bb5 - - - D6 - - -',
  'D6 - - - - - - - C6 - - - Bb5 - - -',
  'A5 - - - C6 - - - A5 - - - G5 - - -',
  'Bb5 - - - A5 - - - G5 - - - F5 - - -',
  'F5 - - - - - - - E5 - - - G5 - - -',
];
// the third time round the hook gets a small lift in bar 3 and a turn at the end
const LEAD_A2 = [...LEAD_A.slice(0, 2), 'Bb5 - - D6 - - F6 - D6 - - C6 - - Bb5 -', ...LEAD_A.slice(3, 7), 'C6 - - A5 - - F5 - A5 - - C6 - - . .'];

// ------------------------------------------------------------------ base
const ARP8 = '1 . 5 . 8 . 5 . 3 . 5 . 8 . 5 .';
const ARP16 = '1 5 8 5 3 5 8 5 1 5 8 5 3 5 8 5';
const ARPQ = '1 . . . 5 . . . 8 . . . 5 . . .';

// ------------------------------------------------------------------ bass
const BOUNCE = "1 . 1' . 5 . 1' . 1 . 1' . 5 . 1' .";
const BOUNCE_WALK = "1 . 1' . 5 . 1' . 1 . 3 . 5 . 7 .";
const SYNC = '1 . . 1 . . 5 . 1 . . 1 . . 5 .';
const SYNC_WALK = '1 . . 1 . . 5 . 1 . 3 . 5 . 7 .';
const HALF = '1 . . . . . . . 5 . . . . . . .';

// ----------------------------------------------------------------- chords
const OFFBEAT = '. . 3+5+8 . . . 3+5+8 . . . 3+5+8 . . . 3+5+8 .';

// ------------------------------------------------------------------- pad
const PAD1 = hold('1+3+5', 16);
const PAD2 = `${hold('1+3+5', 8)} ${hold('1+3+5', 8)}`;
const PAD = cat(
  PAD1, PAD1, PAD1, PAD1, PAD1, PAD1, PAD2, PAD1,
  PAD1, PAD1, PAD1, PAD1, PAD1, PAD1, PAD2, PAD1,
  PAD1, PAD1, PAD1, PAD1, PAD1, PAD1, PAD2, PAD1,
  PAD1, PAD1, PAD1, PAD1, PAD1, PAD1, PAD1, PAD2,
);

// ----------------------------------------------------------------- glock
const TWINKLE = '. . 5 . . . 3 . . . 5 . . . 8 .';
const TWINKLE2 = '. . 8 . . . 5 . . . 3 . . . 5 .';

export const office: Song = compileSong({
  id: 'office',
  title: 'Office (cozy)',
  key: 'F major',
  bpm: 104,
  bars: 32,
  defaultIntensity: 0.5,
  harmony: HARMONY,
  tracks: [
    {
      id: 'base',
      inst: 'arpSoft',
      pan: -0.2,
      vol: 1.6,
      bars: cat(rep(ARP8, 16), rep(ARP16, 8), rep(ARPQ, 8)),
    },
    {
      id: 'bass',
      inst: 'bassPulse',
      octave: 3,
      vol: 1.15,
      bars: cat(
        rep(BOUNCE, 3), BOUNCE_WALK, rep(BOUNCE, 3), BOUNCE_WALK,
        rep(SYNC, 3), SYNC_WALK, rep(SYNC, 3), SYNC_WALK,
        rep(BOUNCE, 3), BOUNCE_WALK, rep(BOUNCE, 3), BOUNCE_WALK,
        rep(HALF, 8),
      ),
    },
    {
      id: 'perc',
      vol: 1.35,
      lanes: {
        sh: rep('o o x o o o x o o o x o o o x o', 32),
      },
    },
    { id: 'pad', inst: 'pad', octave: 3, to: 0.34, pan: 0.15, vol: 0.72, bars: PAD },
    {
      id: 'chords',
      inst: 'chord',
      at: 0.3,
      pan: 0.2,
      vol: 1.05,
      bars: cat(rep(OFFBEAT, 24), rests(8)),
    },
    {
      id: 'kit',
      at: 0.45,
      vol: 1,
      lanes: {
        k: every8('X . . . . . x . x . . . . . . .', 'X . . . . . x . x . . . x . x .', 4),
        s: every8('. . . . X . . . . . . . X . . .', '. . . . X . . . . . x . x x X X', 4),
        h: every8('x . o . x . o . x . o . x . o .', 'x . o . x . o . x . o . . . . .', 4),
        th: every8(
          '. . . . . . . . . . . . . . . .',
          '. . . . . . . . . . . . x . . .',
          4,
        ),
        tm: every8(
          '. . . . . . . . . . . . . . . .',
          '. . . . . . . . . . . . . x . .',
          4,
        ),
        tl: every8(
          '. . . . . . . . . . . . . . . .',
          '. . . . . . . . . . . . . . x .',
          4,
        ),
      },
    },
    {
      id: 'lead',
      inst: 'lead',
      at: 0.45,
      vol: 1,
      bars: cat(LEAD_A, LEAD_B, LEAD_A2, LEAD_C),
    },
    {
      id: 'extra',
      inst: 'glock',
      octave: 4,
      at: 0.8,
      pan: 0.25,
      vol: 2.3,
      bars: cat(rests(8), rep(TWINKLE2, 8), rep(TWINKLE, 8), rep(TWINKLE2, 8)),
    },
  ],
});
