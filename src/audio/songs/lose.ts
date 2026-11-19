import type { Song } from '../sequencer';
import { compileSong } from './dsl';
import { hold, place } from './helpers';

/**
 * LOSE: the sad trombone. G minor, 100 bpm, two bars of three beats, plays once (3.6 s).
 *
 *   bar 1   wah, wah, wah: Bb A Ab, each a dark note that opens up, each one a semitone lower
 *   bar 2   waaaah: the last G holds for a whole bar and sags a major third while it wobbles
 *
 * Nothing is gated by intensity: a stinger plays every layer.
 */
const BAR = 12; // three beats of four steps

export const lose: Song = compileSong({
  id: 'lose',
  title: 'Lose (sad trombone)',
  key: 'G minor',
  bpm: 100,
  bars: 2,
  beatsPerBar: 3,
  loop: false,
  chromatic: ['Ab'],
  harmony: ['Gm', 'Gm'],
  tracks: [
    {
      id: 'lead',
      inst: 'trombone',
      vol: 1,
      bars: ['Bb3 - - . A3 - - . Ab3 - - .', hold('G3\\4', BAR)],
    },
    {
      // the floor drops out with the horn
      id: 'bass',
      inst: 'bass',
      octave: 2,
      vol: 0.35,
      bars: [hold('1', BAR), hold('1\\4', BAR)],
    },
    {
      id: 'pad',
      inst: 'pad',
      octave: 3,
      vol: 0.58,
      bars: [hold('1+3+5', BAR), hold('1+3+5', BAR)],
    },
    {
      id: 'perc',
      vol: 0.27,
      lanes: {
        tl: [place({ 0: 'X' }, BAR), place({ 0: 'X' }, BAR)],
        k: [place({}, BAR), place({ 0: 'X' }, BAR)],
      },
    },
  ],
});
