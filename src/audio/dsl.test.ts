import { describe, expect, it } from 'vitest';
import { CHORD_QUALITIES, compileSong, normalizeBars, parseChord, scaleOf, type SongSpec } from './songs/dsl';

const R16 = '. . . . . . . . . . . . . . . .';

function spec(over: Partial<SongSpec> & Pick<SongSpec, 'tracks'>): SongSpec {
  return { id: 't', title: 't', key: 'C major', bpm: 100, bars: 1, harmony: ['C'], ...over };
}

const pitched = (bars: string, over: Partial<SongSpec> = {}, octave?: number) =>
  compileSong(spec({ ...over, tracks: [{ id: 'x', inst: 'lead', octave, bars }] })).tracks[0]!.notes;

describe('chords and keys', () => {
  it('parses roots and qualities', () => {
    expect(parseChord('C')).toMatchObject({ rootPc: 0, intervals: [0, 4, 7] });
    expect(parseChord('F#m7')).toMatchObject({ rootPc: 6, intervals: [0, 3, 7, 10] });
    expect(parseChord('Bbmaj7')).toMatchObject({ rootPc: 10, intervals: [0, 4, 7, 11] });
    expect(parseChord('G7sus4').intervals).toEqual([0, 5, 7, 10]);
  });

  it('knows every quality it lists', () => {
    for (const q of Object.keys(CHORD_QUALITIES)) expect(() => parseChord(`C${q}`)).not.toThrow();
  });

  it('rejects unknown chords with the symbol in the message', () => {
    expect(() => parseChord('Cwobble')).toThrow(/Cwobble/);
    expect(() => parseChord('H')).toThrow(/bad chord/);
  });

  it('builds the pitch classes of a key', () => {
    expect([...scaleOf('C major')].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect([...scaleOf('F major')].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 10]);
    expect(scaleOf('A minor').has(8)).toBe(true); // raised seventh, so a dominant chord is not an outsider
    expect(() => scaleOf('C dorian')).toThrow(/bad key/);
  });

  it('splits bars on pipes and trims', () => {
    expect(normalizeBars('a | b|c')).toEqual(['a', 'b', 'c']);
    expect(normalizeBars(['a|b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});

describe('compileSong: pitched tracks', () => {
  it('reads absolute notes, rests, holds and velocity marks', () => {
    const notes = pitched('C4 - . . E4 . . . G4! . . . A4~ - - -');
    expect(notes.map((n) => [n.step, n.dur, n.pitch, n.vel])).toEqual([
      [0, 2, 60, 0.8],
      [4, 1, 64, 0.8],
      [8, 1, 67, 1],
      [12, 4, 69, 0.5],
    ]);
  });

  it('resolves chord tokens against the chord active at that step', () => {
    const notes = pitched('1 . . . 5 . . . 1 . . . 5 . . .', { harmony: ['F,C'] }, 2);
    // first half F (F2 = 41, its fifth = 48), second half C (C2 = 36, its fifth = 43)
    expect(notes.map((n) => n.pitch)).toEqual([41, 48, 36, 43]);
  });

  it('thirds, sevenths, octave marks and the eighth', () => {
    const notes = pitched("1 3 5 7 8 1' 5, 3' . . . . . . . .", { harmony: ['Am7'] }, 3);
    // A3 = 57
    expect(notes.map((n) => n.pitch)).toEqual([57, 60, 64, 67, 69, 69, 52, 72]);
  });

  it('a triad has no seventh, so "7" falls back to the root an octave up', () => {
    expect(pitched('7 . . . . . . . . . . . . . . .', {}, 3)[0]!.pitch).toBe(60); // C3 is 48, so the octave above is 60
  });

  it('plus joins notes into a chord on one step', () => {
    const notes = pitched("5+1' . . . . . . . . . . . . . . .", {}, 3);
    expect(notes.map((n) => [n.step, n.pitch]).sort((a, b) => a[1]! - b[1]!)).toEqual([
      [0, 55],
      [0, 60],
    ]);
  });

  it('@ plays the whole chord as a tracker arpeggio', () => {
    const n = pitched('@ . . . . . . . . . . . . . . .', {}, 4)[0]!;
    expect(n.pitch).toBe(60);
    expect(n.arp).toEqual([0, 4, 7, 12]);
  });

  it('spans several bars given with pipes or as an array', () => {
    const a = compileSong(spec({ bars: 2, harmony: ['C', 'G'], tracks: [{ id: 'x', inst: 'lead', bars: `C4 ${R16.slice(2)} | ${R16}` }] }));
    const b = compileSong(spec({ bars: 2, harmony: ['C', 'G'], tracks: [{ id: 'x', inst: 'lead', bars: [`C4 ${R16.slice(2)}`, R16] }] }));
    expect(a.totalSteps).toBe(32);
    expect(a.tracks[0]!.notes).toEqual(b.tracks[0]!.notes);
  });

  it('fills in defaults and the step grid', () => {
    const s = compileSong(spec({ chromatic: ['F#', 'Bb'], tracks: [{ id: 'x', inst: 'lead', bars: 'C4 . . . E4 . . . . . . . . . . .' }] }));
    expect(s).toMatchObject({ stepsPerBar: 16, totalSteps: 16, loop: true, swing: 0, defaultIntensity: 1, chromatic: [6, 10] });
    const t = s.tracks[0]!;
    expect(t).toMatchObject({ id: 'x', inst: 'lead', at: 0, to: 1, pan: 0, vol: 1 });
    expect(t.grid.length).toBe(16);
    expect(t.grid[4]![0]!.pitch).toBe(64);
    expect(t.grid[1]).toBeUndefined();
  });
});

describe('compileSong: drums', () => {
  it('reads lanes, accents, ghosts, tuned toms and holds', () => {
    const s = compileSong(
      spec({
        tracks: [
          {
            id: 'perc',
            lanes: {
              k: 'X . . . x . . . x . . . x . . .',
              h: 'x o x o x o x o x o x o x o x o',
              tl: 'x . . . . . . . . . . . . . . .',
              ri: 'x - - - - - - - . . . . . . . .',
            },
          },
        ],
      }),
    );
    const t = s.tracks[0]!;
    expect(t.inst).toBe('drums');
    const kicks = t.notes.filter((n) => n.drum === 'kick');
    expect(kicks.map((n) => [n.step, n.vel])).toEqual([
      [0, 1],
      [4, 0.8],
      [8, 0.8],
      [12, 0.8],
    ]);
    const hats = t.notes.filter((n) => n.drum === 'hat');
    expect(hats.length).toBe(16);
    expect(hats[1]!.vel).toBe(0.45);
    expect(t.notes.find((n) => n.drum === 'tom')!.tune).toBeLessThan(1);
    expect(t.notes.find((n) => n.drum === 'riser')!.dur).toBe(8);
  });
});

describe('compileSong: mistakes name the exact place', () => {
  const lead = (bars: string, extra: Partial<SongSpec> = {}) => () => compileSong(spec({ ...extra, tracks: [{ id: 'lead', inst: 'lead', bars }] }));

  it('wrong step count', () => {
    expect(lead('C4 . . .')).toThrow(/t\/lead bar 1: expected 16 steps, got 4/);
  });

  it('wrong bar count', () => {
    expect(lead(R16, { bars: 2, harmony: ['C', 'C'] })).toThrow(/expected 2 bars, got 1/);
  });

  it('harmony length', () => {
    expect(lead(R16, { harmony: ['C', 'G'] })).toThrow(/harmony has 2 bars/);
  });

  it('a hold with nothing to hold', () => {
    expect(lead('- . . . . . . . . . . . . . . .')).toThrow(/nothing to hold/);
  });

  it('a rest ends a hold', () => {
    expect(lead('C4 . - . . . . . . . . . . . . .')).toThrow(/nothing to hold/);
  });

  it('unreadable token', () => {
    expect(lead('Q9 . . . . . . . . . . . . . . .')).toThrow(/cannot read token "Q9"/);
  });

  it('unknown chord', () => {
    expect(lead(R16, { harmony: ['Cblah'] })).toThrow(/unknown chord quality/);
  });

  it('unknown drum lane and bad drum token', () => {
    const drums = (lanes: Record<string, string>) => () => compileSong(spec({ tracks: [{ id: 'd', lanes }] }));
    expect(drums({ zz: R16 })).toThrow(/unknown drum lane "zz"/);
    expect(drums({ k: 'q . . . . . . . . . . . . . . .' })).toThrow(/bad drum token "q"/);
  });

  it('duplicate track ids', () => {
    expect(() =>
      compileSong(
        spec({
          tracks: [
            { id: 'a', inst: 'lead', bars: R16 },
            { id: 'a', inst: 'bass', bars: R16 },
          ],
        }),
      ),
    ).toThrow(/duplicate track id "a"/);
  });
});
