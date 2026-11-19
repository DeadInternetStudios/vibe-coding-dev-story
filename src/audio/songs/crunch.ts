import type { Song } from '../sequencer';
import { compileSong } from './dsl';
import { cat, every4, every8, hold, phrase, place, R16, rep, rests } from './helpers';

/**
 * CRUNCH: deadline week. The build is red, the coffee is cold. A minor, 148 bpm,
 * 32 bars (about 52 s), driving.
 *
 *   A  (1-8)    the hook: a syncopated run up the Am triad, answered through F, G, C and E7
 *   B  (9-16)   steady eighths in the bass, the tune climbs through Dm and Am to the top
 *   A' (17-24)  the hook again with a turn on the E7
 *   C  (25-32)  the breakdown: the drums thin out, the arps warble, a snare build and a riser
 *               into the dominant, which falls straight back into bar 1
 *
 * Intensity (0 to 1) stacks layers:
 *   0.0   16th arps + bass
 *   0.2   hats
 *   0.35  kit (four on the floor)
 *   0.45  lead
 *   0.5   stab riff in 3+3+2
 *   0.8   ticking clock (the deadline)
 */
const HARMONY = [
  // A
  'Am', 'Am', 'F', 'G', 'Am', 'C', 'F', 'E7',
  // B
  'Dm', 'Dm', 'Am', 'Am', 'F', 'G', 'E7', 'E7',
  // A'
  'Am', 'Am', 'F', 'G', 'Am', 'C', 'F', 'E7',
  // C
  'Dm', 'Dm', 'F', 'F', 'G', 'G', 'E7', 'E7',
];

// ------------------------------------------------------------------ lead
const HOOK = [
  phrase({ 0: 'A5', 3: 'C6', 6: 'E6', 8: 'A6', 11: 'G6', 14: 'E6' }),
  phrase({ 0: 'E6', 3: 'D6', 6: 'C6', 8: 'A5', 12: 'C6', 14: 'E6' }),
  phrase({ 0: 'F6', 3: 'E6', 6: 'C6', 8: 'A5', 11: 'C6', 14: 'F6' }),
  phrase({ 0: 'D6', 3: 'B5', 6: 'G5', 8: 'B5', 12: 'D6', 14: 'G6' }),
  phrase({ 0: 'A5', 3: 'C6', 6: 'E6', 8: 'A6', 11: 'G6', 14: 'A6' }),
  phrase({ 0: 'C7', 3: 'B6', 6: 'G6', 8: 'E6', 12: 'G6' }),
  phrase({ 0: 'A6', 3: 'G6', 6: 'F6', 8: 'C6', 12: 'F6' }),
];
const HOOK_END = phrase({ 0: 'E6', 3: 'G#6', 6: 'B6', 8: 'D7', 10: 'B6', 12: 'G#6', 14: 'E6' });
const HOOK_END2 = phrase({ 0: 'E6', 3: 'G#6', 6: 'B6', 8: 'D7', 12: 'B6', 14: 'G#6' });

const CLIMB = [
  phrase({ 0: 'D6', 6: 'F6', 8: 'A6', 12: 'F6' }),
  phrase({ 0: 'D7', 6: 'C7', 8: 'A6', 12: 'F6' }),
  phrase({ 0: 'C6', 3: 'E6', 6: 'A6', 8: 'C7', 12: 'A6' }),
  phrase({ 0: 'E6', 6: 'D6', 8: 'C6', 12: 'A5' }),
  phrase({ 0: 'F6', 3: 'A6', 6: 'C7', 8: 'A6', 12: 'F6' }),
  phrase({ 0: 'G6', 3: 'B6', 6: 'D7', 8: 'B6', 12: 'G6' }),
  phrase({ 0: 'E6', 3: 'G#6', 6: 'B6', 8: 'E7', 12: 'D7', 14: 'B6' }),
  phrase({ 0: 'B6', 4: 'G#6', 8: 'E6', 12: '.' }),
];

const BUILD = [
  phrase({ 0: 'D6', 8: 'F6' }),
  phrase({ 0: 'A6', 8: 'F6' }),
  phrase({ 0: 'A6', 8: 'C7' }),
  phrase({ 0: 'F6', 8: 'A6' }),
  phrase({ 0: 'B6', 8: 'D7' }),
  phrase({ 0: 'D7', 4: 'B6', 8: 'G6', 12: 'B6' }),
  phrase({ 0: 'E6', 2: 'G#6', 4: 'B6', 6: 'D7', 8: 'E7' }),
  phrase({ 0: 'E7', 2: 'D7', 4: 'B6', 6: 'G#6', 8: 'E6', 12: '.' }),
];

const LEAD = cat(HOOK, HOOK_END, CLIMB, HOOK, HOOK_END2, BUILD);

// ------------------------------------------------------------------ base (16th arps)
const ARP = '1 3 5 8 5 3 5 8 1 3 5 8 5 3 5 8';
const ARP_E7 = '1 3 5 7 8 7 5 3 1 3 5 7 8 7 5 3';
const WARBLE = '@ - - - @ - - - @ - - - @ - - -';

// ------------------------------------------------------------------ bass
const BOUNCE = "1 . 1' . 1 . 1' . 1 . 1' . 5 . 1' .";
const BOUNCE_END = "1 . 1' . 1 . 1' . 1 . 3 . 5 . 7 .";
const DRIVE = '1 . 1 . 1 . 1 . 1 . 1 . 1 . 1 .';
const QUARTERS = '1 . . . 1 . . . 1 . . . 1 . . .';
const PULSE16 = '1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1';

// ------------------------------------------------------------------ percussion
const HATS = 'X o x o X o x o X o x o X o x o';
const OPEN = place({ 6: 'x', 14: 'x' });
const FOUR = 'X . . . X . . . X . . . X . . .';
const HALFTIME = 'X . . . . . . . X . . . . . . .';
const BACKBEAT = place({ 4: 'X', 12: 'X' });
const SNARE_FILL = place({ 4: 'X', 8: 'x', 10: 'x', 12: 'X', 13: 'x', 14: 'x', 15: 'X' });
const SNARE_8 = 'x . x . x . x . x . x . x . x .';
const SNARE_16 = 'x x x x x x x x x x x x x x x x';
const SNARE_ROLL = 'o o o o x x x x x x x x X X X X';
const RISER = hold('x', 16);

/** A bar with one hit at the end of each 8 bar block, silence elsewhere. */
const closing = (hit: string): string[] => every8(R16, hit, 4);
/** A bar with one hit at the start of each 8 bar block, silence elsewhere. */
const opening = (hit: string): string[] => Array.from({ length: 4 }, () => [hit, ...rests(7)]).flat();

// ------------------------------------------------------------------ stabs
const STAB = '3+5+8';
const RIFF = place({ 0: `${STAB}!`, 3: STAB, 6: STAB, 8: `${STAB}!`, 11: STAB, 14: STAB });
const STAB8 = rep(`${STAB} .`, 8).join(' ');

// ------------------------------------------------------------------ clock
const TICK = '1 . . . 5 . . . 1 . . . 5 . . .';
const TICK8 = '1 . 1 . 5 . 5 . 1 . 1 . 5 . 5 .';
const TICK16 = '1 1 5 5 1 1 5 5 1 1 5 5 1 1 5 5';

export const crunch: Song = compileSong({
  id: 'crunch',
  title: 'Crunch (deadline)',
  key: 'A minor',
  bpm: 148,
  bars: 32,
  defaultIntensity: 0.7,
  harmony: HARMONY,
  tracks: [
    {
      id: 'base',
      inst: 'arpThin',
      octave: 4,
      pan: -0.25,
      vol: 1.4,
      bars: cat(rep(ARP, 7), ARP_E7, rep(ARP, 6), rep(ARP_E7, 2), rep(ARP, 7), ARP_E7, rep(WARBLE, 8)),
    },
    {
      id: 'bass',
      inst: 'bassPulse',
      octave: 3,
      vol: 0.86,
      bars: cat(rep(BOUNCE, 7), BOUNCE_END, rep(DRIVE, 8), rep(BOUNCE, 7), BOUNCE_END, rep(QUARTERS, 4), rep(PULSE16, 4)),
    },
    {
      id: 'perc',
      at: 0.2,
      vol: 1.45,
      lanes: {
        h: rep(HATS, 32),
        oh: rep(OPEN, 32),
      },
    },
    {
      id: 'kit',
      at: 0.35,
      vol: 0.64,
      lanes: {
        k: cat(rep(FOUR, 24), rep(HALFTIME, 4), rep(FOUR, 4)),
        s: cat(
          every4(BACKBEAT, SNARE_FILL, 6),
          rests(3),
          SNARE_ROLL,
          BACKBEAT,
          SNARE_8,
          SNARE_16,
          SNARE_ROLL,
        ),
        th: closing(place({ 12: 'x' })),
        tm: closing(place({ 13: 'x' })),
        tl: closing(place({ 14: 'X' })),
        cr: opening(place({ 0: 'X' })),
        ri: cat(rests(27), RISER, rests(3), RISER),
      },
    },
    { id: 'lead', inst: 'lead', at: 0.45, pan: 0.1, vol: 1.1, bars: LEAD },
    {
      id: 'chords',
      inst: 'stab',
      octave: 4,
      at: 0.5,
      pan: 0.25,
      vol: 2,
      bars: cat(rep(RIFF, 24), rests(4), rep(STAB8, 4)),
    },
    {
      id: 'extra',
      inst: 'blip',
      octave: 5,
      at: 0.8,
      pan: -0.1,
      vol: 2.75,
      bars: cat(rep(TICK, 24), rep(TICK8, 2), rep(TICK8, 2), rep(TICK16, 4)),
    },
  ],
});
