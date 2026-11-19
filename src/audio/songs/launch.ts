import type { Song } from '../sequencer';
import { compileSong } from './dsl';
import { cat, every8, hold, phrase, place, R16, rep, rests } from './helpers';

/**
 * LAUNCH: the countdown is over and the post is live. D major, 132 bpm, 32 bars
 * (about 58 s). An anthem that keeps climbing.
 *
 *   A  (1-8)    the I V vi IV spine; a bright tune that leaps up the D triad
 *   B  (9-16)   up to the IV: the tune climbs to the top of the range, stabs on every eighth
 *   A' (17-24)  the first tune again, a turn into the last chorus
 *   C  (25-32)  the last chorus, loudest, every chord changing twice, ending on the dominant
 *
 * Every 8 bars a snare roll and a full-bar riser lift into the next section.
 *
 * Intensity (0 to 1) stacks layers, in this order:
 *   0.0   16th arps and the bass (the quiet floor: a pulse that is already building)
 *   0.3   the kit (kick, hats, backbeat, crash on each section, riser and roll before it)
 *   0.45  chords (off-beat stabs, eighth stabs in B and C)
 *   0.55  lead
 *   0.8   glockenspiel twinkle and the runs into each section
 */
const HARMONY = [
  // A
  'D', 'A', 'Bm', 'G', 'D', 'A', 'Bm', 'G,A',
  // B
  'G', 'A', 'Bm', 'F#m', 'G', 'A', 'Bm,A', 'A',
  // A'
  'D', 'A', 'Bm', 'G', 'D', 'A', 'G,A', 'Bm,A',
  // C
  'G', 'A', 'D,A', 'Bm,G', 'G', 'A', 'D,Bm', 'G,A',
];

// ------------------------------------------------------------------ lead
const A = [
  phrase({ 0: 'F#5', 3: 'A5', 6: 'D6', 8: 'F#6', 10: 'E6', 12: 'D6' }),
  phrase({ 0: 'E6', 3: 'C#6', 6: 'A5', 8: 'C#6', 12: 'E6' }),
  phrase({ 0: 'D6', 3: 'F#6', 6: 'A6', 8: 'B6', 11: 'A6', 14: 'F#6' }),
  phrase({ 0: 'G5', 3: 'B5', 6: 'D6', 8: 'G6', 11: 'F#6', 14: 'D6' }),
  phrase({ 0: 'F#5', 3: 'A5', 6: 'D6', 8: 'F#6', 10: 'E6', 12: 'A6' }),
  phrase({ 0: 'E6', 3: 'C#6', 6: 'A5', 8: 'C#6', 12: 'E6', 14: 'A6' }),
  phrase({ 0: 'D6', 3: 'F#6', 6: 'A6', 8: 'B6', 11: 'A6', 14: 'F#6' }),
  phrase({ 0: 'G5', 3: 'B5', 6: 'D6', 8: 'E6', 10: 'C#6', 12: 'E6', 14: 'A6' }),
];
const B = [
  phrase({ 0: 'D6', 3: 'G6', 6: 'B6', 8: 'D7', 12: 'B6' }),
  phrase({ 0: 'E6', 3: 'A6', 6: 'C#7', 8: 'A6', 12: 'E6' }),
  phrase({ 0: 'D6', 3: 'F#6', 6: 'B6', 8: 'D7', 12: 'B6' }),
  phrase({ 0: 'C#6', 3: 'F#6', 6: 'A6', 8: 'C#7', 12: 'A6' }),
  phrase({ 0: 'D6', 3: 'G6', 6: 'B6', 8: 'D7', 12: 'G6' }),
  phrase({ 0: 'E6', 3: 'A6', 6: 'C#7', 8: 'A6', 12: 'C#6' }),
  phrase({ 0: 'F#6', 3: 'D6', 6: 'B5', 8: 'E6', 11: 'C#6', 14: 'A5' }),
  phrase({ 0: 'E6', 4: 'A6', 8: 'C#7', 12: '.' }),
];
const A_TURN = [
  phrase({ 0: 'A5', 3: 'D6', 6: 'F#6', 8: 'A6', 11: 'F#6', 14: 'D6' }),
  phrase({ 0: 'E6', 3: 'A6', 6: 'C#7', 8: 'A6', 12: 'E6' }),
  phrase({ 0: 'B5', 3: 'D6', 6: 'G6', 8: 'E6', 10: 'A6', 12: 'C#7', 14: 'A6' }),
  phrase({ 0: 'D6', 3: 'F#6', 6: 'B6', 8: 'A6', 11: 'C#7', 14: 'E7' }),
];
const C = [
  phrase({ 0: 'B5', 3: 'D6', 6: 'G6', 8: 'B6', 11: 'G6', 14: 'D6' }),
  phrase({ 0: 'C#6', 3: 'E6', 6: 'A6', 8: 'C#7', 11: 'A6', 14: 'E6' }),
  phrase({ 0: 'F#6', 3: 'A6', 6: 'D7', 8: 'C#7', 12: 'E6' }),
  phrase({ 0: 'D6', 3: 'F#6', 6: 'B6', 8: 'G6', 11: 'B6', 14: 'D7' }),
  phrase({ 0: 'D7', 3: 'B6', 6: 'G6', 8: 'B6', 12: 'D7' }),
  phrase({ 0: 'E7', 3: 'C#7', 6: 'A6', 8: 'C#7', 12: 'E7' }),
  phrase({ 0: 'A6', 3: 'F#6', 6: 'D6', 8: 'F#6', 11: 'D6', 14: 'B5' }),
  phrase({ 0: 'G6', 3: 'B6', 6: 'D7', 8: 'C#7', 10: 'A6', 12: 'E6', 14: 'C#6' }),
];
const LEAD = cat(A, B, A.slice(0, 4), A_TURN, C);

// ------------------------------------------------------------------ base (16th arps)
const ARP = '1 3 5 8 5 3 5 8 1 3 5 8 5 3 5 8';
const ARP_UP = "1 3 5 8 3' 8 5 3 1 3 5 8 3' 8 5 3";

// ------------------------------------------------------------------ bass
const BOUNCE = "1 . 1' . 5 . 1' . 1 . 1' . 5 . 1' .";
const BOUNCE_END = "1 . 1' . 5 . 1' . 1 . 3 . 5 . 7 .";
const DRIVE = '1 . 1 . 1 . 1 . 1 . 1 . 1 . 1 .';

// ------------------------------------------------------------------ kit
const FOUR = 'X . . . X . . . X . . . X . . .';
const QUARTER_HATS = 'x . . . x . . . x . . . x . . .';
const OFFBEAT_OPEN = place({ 2: 'x', 6: 'x', 10: 'x', 14: 'x' });
const BACKBEAT = place({ 4: 'X', 12: 'X' });
const ROLL = 'o o o o x x x x x x x x X X X X';
const RISER = hold('x', 16);

/** One hit-bar at the end of each 8 bar block, silence elsewhere. */
const closing = (hit: string): string[] => every8(R16, hit, 4);
/** One hit-bar at the start of each 8 bar block, silence elsewhere. */
const opening = (hit: string): string[] => Array.from({ length: 4 }, () => [hit, ...rests(7)]).flat();

// ------------------------------------------------------------------ chords
const OFFBEAT = '. . 3+5+8 . . . 3+5+8 . . . 3+5+8 . . . 3+5+8 .';
const STAB8 = rep('3+5+8 .', 8).join(' ');

// ------------------------------------------------------------------ glock
const TWINKLE = '. . 5 . . . 8 . . . 5 . . . 8 .';
const RUN = ". . . . . . . . 1 3 5 8 3' 5' 8' .";

export const launch: Song = compileSong({
  id: 'launch',
  title: 'Launch (it is live)',
  key: 'D major',
  bpm: 132,
  bars: 32,
  defaultIntensity: 0.7,
  harmony: HARMONY,
  tracks: [
    {
      id: 'base',
      inst: 'arp',
      octave: 4,
      pan: -0.25,
      vol: 1.23,
      bars: cat(rep(ARP, 8), rep(ARP, 8), rep(ARP, 8), rep(ARP_UP, 8)),
    },
    {
      id: 'bass',
      inst: 'bassPulse',
      octave: 3,
      vol: 0.89,
      bars: cat(rep(BOUNCE, 7), BOUNCE_END, rep(DRIVE, 7), BOUNCE_END, rep(BOUNCE, 7), BOUNCE_END, rep(DRIVE, 7), BOUNCE_END),
    },
    {
      id: 'kit',
      at: 0.3,
      vol: 0.68,
      lanes: {
        k: rep(FOUR, 32),
        h: rep(QUARTER_HATS, 32),
        oh: rep(OFFBEAT_OPEN, 32),
        s: every8(BACKBEAT, ROLL, 4),
        cr: opening(place({ 0: 'X' })),
        ri: closing(RISER),
      },
    },
    {
      id: 'chords',
      inst: 'chord',
      octave: 4,
      at: 0.45,
      pan: 0.25,
      vol: 0.96,
      bars: cat(rep(OFFBEAT, 8), rep(STAB8, 8), rep(OFFBEAT, 8), rep(STAB8, 8)),
    },
    { id: 'lead', inst: 'lead', at: 0.55, pan: 0.1, vol: 1.1, bars: LEAD },
    {
      id: 'extra',
      inst: 'glock',
      octave: 4,
      at: 0.8,
      pan: 0.3,
      vol: 1.76,
      bars: cat(rests(7), RUN, rep(TWINKLE, 7), RUN, rep(TWINKLE, 7), RUN, rep(TWINKLE, 7), RUN),
    },
  ],
});
