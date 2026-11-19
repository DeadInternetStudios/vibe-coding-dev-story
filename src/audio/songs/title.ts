import type { Song } from '../sequencer';
import { compileSong } from './dsl';
import { cat, every4, place, R16, rep, rests } from './helpers';

/**
 * TITLE: the "press start" theme. C major, 120 bpm, 16 bars (32 s).
 *
 *   A (1-8)   the hook: short-short-long calls (G G C) answered up the chords C G Am F,
 *             then once more with a lift to the high G
 *   B (9-16)  the sweep: slow arpeggios over F G Em Am, then the heroic flat seven (Bb)
 *             into F and G, which falls straight back into the C of bar 1
 *
 * Intensity (0 to 1) stacks layers:
 *   0.0   base (arpeggio) + perc (shaker)     the title card fading in
 *   0.3   bass + chords + kit join
 *   0.55  lead joins                          the hook
 *   0.8   extra (glock sparkle) joins
 */
const HARMONY = [
  // A
  'C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G',
  // B
  'F', 'G', 'Em7', 'Am', 'F', 'Bb', 'F', 'G',
];

// ------------------------------------------------------------------ lead
const LEAD_A = [
  'G5 - G5 - C6 - - - E6 - - - D6 - C6 -',
  'B5 - B5 - D6 - - - G5 - - - A5 - B5 -',
  'A5 - A5 - C6 - - - E6 - - - D6 - C6 -',
  'A5 - A5 - C6 - - - F6 - - - E6 - D6 -',
  'G5 - G5 - C6 - - - E6 - - - G6 - E6 -',
  'B5 - B5 - D6 - - - G6 - - - D6 - B5 -',
  'A5 - C6 - F6 - - - E6 - D6 - C6 - A5 -',
  'D6 - - - B5 - - - G5 - - - D5 - G5 -',
];
const LEAD_B = [
  'C6 - - - A5 - - - F5 - - - A5 - C6 -',
  'D6 - - - B5 - - - G5 - - - B5 - D6 -',
  'E6 - - - B5 - - - G5 - - - B5 - D6 -',
  'C6 - - - E6 - - - A5 - - - C6 - E6 -',
  'F6 - - - - - C6 - A5 - - - C6 - F6 -',
  'D6 - - - Bb5 - - - D6 - - - F6 - - -',
  'C6 - - - F6 - - - A5 - - - C6 - - -',
  'B5 - D6 - G6 - - - D6 - B5 - G5 - . .',
];

// ------------------------------------------------------------------ base
const ARP8 = '1 . 3 . 5 . 8 . 5 . 3 . 5 . 3 .';
const ARP16 = '1 3 5 8 5 3 1 3 5 8 5 3 1 3 5 3';

// ------------------------------------------------------------------ bass
const BASS_A = "1 . . 1' . . 1 . 5 . . 1' . 1' 5 .";
const BASS_B = "1 . 1' . 1 . 1' . 1 . 1' . 5 . 1' .";

// ---------------------------------------------------------------- chords
const STAB = '3+5+8';
const STABS = place({ 4: STAB, 7: STAB, 12: STAB });

// ----------------------------------------------------------------- glock
const TWINKLE_A = '. . 3 . . . 5 . . . 8 . . . 5 .';
const TWINKLE_B = "3 . . . 5 . . . 8 . . . 5' . 8 .";

// ------------------------------------------------------------------- kit
const KICK = place({ 0: 'X', 4: 'x', 8: 'X', 12: 'x' });
const KICK_FILL = place({ 0: 'X', 8: 'X' });
const SNARE = place({ 4: 'X', 12: 'X' });
const SNARE_FILL = place({ 4: 'X', 15: 'X' });
const HAT = place({ 0: 'x', 2: 'o', 4: 'x', 6: 'o', 8: 'x', 10: 'o', 12: 'x', 14: 'o' });
const HAT_FILL = place({ 0: 'x', 2: 'o', 4: 'x', 6: 'o', 8: 'x', 10: 'o' });

export const title: Song = compileSong({
  id: 'title',
  title: 'Title (press start)',
  key: 'C major',
  bpm: 120,
  bars: 16,
  defaultIntensity: 1,
  chromatic: ['Bb'],
  harmony: HARMONY,
  tracks: [
    {
      id: 'base',
      inst: 'arp',
      pan: -0.2,
      vol: 1.9,
      bars: cat(rep(ARP8, 8), rep(ARP16, 8)),
    },
    {
      id: 'perc',
      vol: 1.15,
      lanes: {
        sh: rep('X o x o X o x o X o x o X o x o', 16),
      },
    },
    {
      id: 'bass',
      inst: 'bassPulse',
      octave: 3,
      at: 0.3,
      vol: 1.2,
      bars: cat(rep(BASS_A, 8), rep(BASS_B, 8)),
    },
    {
      id: 'chords',
      inst: 'stab',
      at: 0.3,
      pan: 0.2,
      vol: 1.5,
      bars: rep(STABS, 16),
    },
    {
      id: 'kit',
      at: 0.3,
      vol: 1,
      lanes: {
        k: every4(KICK, KICK_FILL, 4),
        s: every4(SNARE, SNARE_FILL, 4),
        h: every4(HAT, HAT_FILL, 4),
        oh: every4(place({ 14: 'o' }), R16, 4),
        th: every4(R16, place({ 12: 'x' }), 4),
        tm: every4(R16, place({ 13: 'x' }), 4),
        tl: every4(R16, place({ 14: 'X' }), 4),
        cr: cat(place({ 0: 'x' }), rests(7), place({ 0: 'x' }), rests(7)),
      },
    },
    {
      id: 'lead',
      inst: 'leadChorus',
      at: 0.55,
      vol: 1,
      bars: cat(LEAD_A, LEAD_B),
    },
    {
      id: 'extra',
      inst: 'glock',
      octave: 4,
      at: 0.8,
      pan: 0.25,
      vol: 2.4,
      bars: cat(rep(TWINKLE_A, 8), rep(TWINKLE_B, 8)),
    },
  ],
});
