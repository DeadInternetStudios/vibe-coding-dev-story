import type { SfxIdOf } from '../ids';
import { compileSong, type SongSpec } from '../songs/dsl';
import { hold, place, R16 } from '../songs/helpers';
import { hit, noise, slide, tone, type SfxBody } from './dsl';
import { BELL } from './parts';

/** A one shot song. No loop, every layer plays, and the sound effect is as long as the song. */
function jingle(spec: Omit<SongSpec, 'title' | 'loop' | 'defaultIntensity'>): SfxBody {
  return { song: compileSong({ ...spec, title: spec.id, loop: false }), cooldown: 0.5 };
}

/** Fanfares and stingers: the sounds that say "something big just happened". */
export const fanfares: Record<SfxIdOf<'fanfare'>, SfxBody> = {
  // a rising arpeggio that lands on a held high C, with a kick and a crash under it
  fanfare_small: jingle({
    id: 'fanfare_small',
    key: 'C major',
    bpm: 150,
    bars: 1,
    harmony: ['C'],
    tracks: [
      { id: 'lead', inst: 'lead', bars: `G4 C5 E5 G5 ${hold('C6', 12)}` },
      { id: 'chord', inst: 'chord', pan: 0.15, bars: `. . . . ${hold('1+3+5', 12)}` },
      { id: 'bass', inst: 'bassPulse', octave: 3, bars: "1 . . . 1' - - - . . . . . . . ." },
      { id: 'kit', lanes: { k: place({ 0: 'X', 4: 'x' }), cr: place({ 4: 'x' }) } },
    ],
  }),

  // the charge call twice, each time higher, then a snare roll into the big final chord
  fanfare_big: jingle({
    id: 'fanfare_big',
    key: 'C major',
    bpm: 160,
    bars: 2,
    harmony: ['C,F', 'G,C'],
    tracks: [
      {
        id: 'lead',
        inst: 'leadChorus',
        bars: ['C5 . C5 . C5 . G5 - A5 - - - F5 - - -', `D5 . D5 . D5 . B5 - ${hold('C6', 8)}`],
      },
      {
        id: 'chord',
        inst: 'chord',
        octave: 3,
        pan: 0.15,
        bars: [`${hold('1+3+5', 8)} ${hold('1+3+5', 8)}`, `${hold('1+3+5', 8)} ${hold('1+3+5+8', 8)}`],
      },
      {
        id: 'bass',
        inst: 'bassPulse',
        octave: 3,
        bars: ['1 . 1 . 1 . 1 . 1 . 1 . 1 . 1 .', "1 . 1 . 1 . 1 . 1' - - - - - - -"],
      },
      {
        id: 'kit',
        lanes: {
          k: [place({ 0: 'X', 8: 'x' }), place({ 0: 'x', 8: 'X' })],
          s: [place({ 4: 'x', 12: 'x' }), place({ 4: 'x', 5: 'x', 6: 'x', 7: 'x' })],
          cr: [R16, place({ 8: 'X' })],
        },
      },
    ],
  }),

  // pompous: brass in dotted rhythm, timpani underneath, a crash and a glockenspiel shimmer on the last chord
  award_win: jingle({
    id: 'award_win',
    key: 'Bb major',
    bpm: 150,
    bars: 2,
    harmony: ['Bb', 'F,Bb'],
    tracks: [
      {
        id: 'brass',
        inst: 'brass',
        bars: ['Bb4 . . Bb4 D5 - - . F5 - - . Bb5 - - -', `A5 - C6 - A5 - F5 - ${hold('Bb5', 8)}`],
      },
      {
        id: 'chord',
        inst: 'chord',
        octave: 3,
        pan: 0.15,
        bars: ['1+3+5 - - . 1+3+5 - - . 1+3+5 - - . 1+3+5 - - -', `${hold('1+3+5', 8)} ${hold('1+3+5+8', 8)}`],
      },
      {
        id: 'timpani',
        lanes: {
          tl: [place({ 0: 'X', 3: 'x', 6: 'x', 8: 'X', 11: 'x', 14: 'x' }), place({ 0: 'X', 2: 'x', 4: 'X', 6: 'x', 8: 'X' })],
          s: [place({ 12: 'x', 13: 'x', 14: 'x', 15: 'X' }), R16],
          cr: [R16, place({ 8: 'X' })],
        },
      },
      {
        id: 'glock',
        inst: 'glock',
        octave: 4,
        pan: 0.25,
        bars: [R16, `. . . . . . . . 1 3 5 8 3' 5' . .`],
      },
    ],
  }),

  // a rising run, a tall chord and a final cadence: the level is clear
  victory: jingle({
    id: 'victory',
    key: 'G major',
    bpm: 168,
    bars: 2,
    harmony: ['G,C', 'D,G'],
    tracks: [
      {
        id: 'lead',
        inst: 'lead',
        bars: ['D5 G5 B5 D6 - - B5 - E6 - - - C6 - - -', `A5 - D6 - A5 - F#5 - ${hold('G5', 8)}`],
      },
      {
        id: 'chord',
        inst: 'chord',
        octave: 3,
        pan: 0.15,
        bars: [`${hold('1+3+5', 8)} ${hold('1+3+5', 8)}`, `${hold('1+3+5', 8)} ${hold('1+3+5+8', 8)}`],
      },
      {
        id: 'bass',
        inst: 'bassPulse',
        octave: 3,
        bars: ['1 . 1 . 1 . 1 . 1 . 1 . 1 . 1 .', "1 . 1 . 1 . 1 . 1' - - - - - - -"],
      },
      {
        id: 'kit',
        lanes: {
          k: [place({ 0: 'X', 4: 'x', 8: 'X', 12: 'x' }), place({ 0: 'x', 4: 'x', 8: 'X' })],
          s: [place({ 4: 'x', 12: 'x' }), place({ 4: 'x', 5: 'x', 6: 'x', 7: 'X' })],
          cr: [R16, place({ 8: 'X' })],
        },
      },
      { id: 'glock', inst: 'glock', octave: 4, pan: 0.25, bars: [R16, `. . . . . . . . 1 3 5 8 3' . . .`] },
    ],
  }),

  game_over: {
    events: [
      // dun, dun, dun: three heavy steps down
      ...(
        [
          { at: 0, hi: 'G4', lo: 'G3' },
          { at: 0.3, hi: 'F4', lo: 'F3' },
          { at: 0.6, hi: 'Eb4', lo: 'Eb3' },
        ] as const
      ).flatMap((n) => [
        tone(n.at, 'p25', n.hi, 0.24, { vol: 0.26, d: 0.2, s: 0.4, r: 0.06 }),
        tone(n.at, 'tri', n.lo, 0.24, { vol: 0.34, d: 0.2, s: 0.4, r: 0.06 }),
        hit(n.at, 'tom', 0.7, { tune: 0.7 }),
      ]),
      // and the last note falls a whole octave and fades
      slide(0.9, 'p25', 'C4', 'C3', 1.1, {
        vol: 0.28,
        a: 0.01,
        d: 0.9,
        s: 0.4,
        r: 0.25,
        vib: { rate: 5.5, depth: 30, delay: 0.2 },
        filter: { type: 'lowpass', f0: 2200, f1: 700, time: 1.1, q: 0.7 },
      }),
      slide(0.9, 'tri', 'C3', 'C2', 1.1, { vol: 0.4, d: 0.9, s: 0.4, r: 0.25 }),
      hit(0.9, 'tom', 1, { tune: 0.55 }),
    ],
    cooldown: 1,
  },

  achievement: {
    events: [
      // a whoosh up, four bells climbing an A major arpeggio, then a warm chord
      slide(0, 'sine', 500, 1500, 0.1, { vol: 0.12, a: 0.005, d: 0.09, s: 0.3, r: 0.02 }),
      tone(0.1, 'sine', 'A5', 0.5, { vol: 0.16, layers: BELL, a: 0.001, d: 0.4, s: 0, r: 0.15, pan: -0.25 }),
      tone(0.16, 'sine', 'C#6', 0.5, { vol: 0.16, layers: BELL, a: 0.001, d: 0.4, s: 0, r: 0.15, pan: 0.2 }),
      tone(0.22, 'sine', 'E6', 0.5, { vol: 0.15, layers: BELL, a: 0.001, d: 0.4, s: 0, r: 0.15, pan: -0.15 }),
      tone(0.28, 'sine', 'A6', 0.6, { vol: 0.14, layers: BELL, a: 0.001, d: 0.5, s: 0, r: 0.2, pan: 0.25 }),
      tone(0.34, 'p50', 'A5', 0.55, { vol: 0.14, d: 0.5, s: 0.25, r: 0.2 }),
      tone(0.34, 'p50', 'C#6', 0.55, { vol: 0.1, d: 0.5, s: 0.25, r: 0.2 }),
      tone(0.34, 'p50', 'E6', 0.55, { vol: 0.1, d: 0.5, s: 0.25, r: 0.2 }),
      noise(0.1, 'noiseL', 20000, 0.7, { vol: 0.03, a: 0.04, d: 0.6, s: 0, r: 0.05, filter: { type: 'bandpass', f0: 4200, q: 2 } }),
    ],
    cooldown: 0.5,
  },
};
