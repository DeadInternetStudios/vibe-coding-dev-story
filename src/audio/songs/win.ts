import type { Song } from '../sequencer';
import { compileSong } from './dsl';
import { cat, hold, phrase, place, R16, rep, rests } from './helpers';

/**
 * WIN: the "you did it" jingle. A major, 132 bpm, 8 bars, plays once (about 15 s).
 *
 *   1-2  the call: A A A rising, then a turn down to the fifth
 *   3-4  the answer: a step up the scale to the dominant (E), a drum fill
 *   5-6  the call again, higher
 *   7    the build: a snare roll on the dominant
 *   8    the end: one long A, a crash and a glockenspiel run to the top
 *
 * Nothing is gated by intensity: a jingle plays every layer.
 */
const HARMONY = ['A', 'D,A', 'F#m,Bm', 'E', 'A,D', 'Bm,E', 'D,E7', 'A'];

const LEAD = [
  phrase({ 0: 'A5', 3: 'A5', 4: 'A5', 7: 'C#6', 8: 'E6', 12: 'A6' }),
  phrase({ 0: 'F#6', 3: 'E6', 4: 'D6', 8: 'C#6', 10: 'D6', 12: 'E6' }),
  phrase({ 0: 'A5', 4: 'C#6', 6: 'A5', 8: 'B5', 12: 'D6', 14: 'F#6' }),
  phrase({ 0: 'G#6', 3: 'G#6', 4: 'B6', 8: 'G#6', 12: 'E6' }),
  phrase({ 0: 'A6', 4: 'E6', 6: 'C#6', 8: 'D6', 12: 'F#6', 14: 'A6' }),
  phrase({ 0: 'D6', 2: 'F#6', 4: 'B6', 8: 'G#6', 10: 'B6', 12: 'G#6' }),
  phrase({ 0: 'F#6', 3: 'A6', 6: 'F#6', 8: 'E6', 11: 'G#6', 14: 'B6' }),
  phrase({ 0: 'A6' }),
];

// four stabs a bar, a dotted quarter and an eighth rest each, the last one held
const STABS = '1+3+5 - - . 1+3+5 - - . 1+3+5 - - . 1+3+5 - - -';

const BASS_BOUNCE = "1 . 1' . 5 . 1' . 1 . 1' . 5 . 1' .";

const ARP = '1 3 5 8 5 3 5 8 1 3 5 8 5 3 5 8';

export const win: Song = compileSong({
  id: 'win',
  title: 'Win (you did it)',
  key: 'A major',
  bpm: 132,
  bars: 8,
  loop: false,
  harmony: HARMONY,
  tracks: [
    { id: 'lead', inst: 'leadChorus', vol: 1.3, bars: LEAD },
    { id: 'brass', inst: 'brass', octave: 4, pan: -0.15, vol: 1, bars: [...rep(STABS, 7), hold('1+3+5', 16)] },
    { id: 'base', inst: 'arp', octave: 4, pan: 0.2, vol: 0.9, bars: [...rep(ARP, 7), '. . . . . . . . . . . . . . . .'] },
    { id: 'bass', inst: 'bassPulse', octave: 3, vol: 1.1, bars: [...rep(BASS_BOUNCE, 7), hold('1', 16)] },
    {
      id: 'kit',
      vol: 1,
      lanes: {
        k: [...rep(place({ 0: 'X', 4: 'x', 8: 'X', 12: 'x' }), 7), place({ 0: 'X' })],
        s: cat(rep(place({ 4: 'X', 12: 'X' }), 6), place({ 4: 'X', 8: 'x', 10: 'x', 12: 'x', 13: 'x', 14: 'x', 15: 'X' }), R16),
        h: [...rep(place({ 0: 'x', 2: 'o', 4: 'x', 6: 'o', 8: 'x', 10: 'o', 12: 'x', 14: 'o' }), 7), R16],
        th: cat(rests(3), place({ 12: 'x' }), rests(4)),
        tm: cat(rests(3), place({ 13: 'x' }), rests(4)),
        tl: cat(rests(3), place({ 14: 'X' }), rests(4)),
        cr: cat(place({ 0: 'X' }), rests(3), place({ 0: 'x' }), rests(2), place({ 0: 'X' })),
      },
    },
    {
      id: 'extra',
      inst: 'glock',
      octave: 4,
      pan: 0.25,
      vol: 2.2,
      bars: [
        ...rests(4),
        ...rep('. . 5 . . . 8 . . . 5 . . . 8 .', 3),
        ". . . . . . . . 1 3 5 8 3' 5' 8' .",
      ],
    },
  ],
});
