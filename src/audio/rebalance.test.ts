import { describe, expect, it } from 'vitest';
import { CHANGE_LIMITS, MIN_CHANGE, objectRanges, rewriteVols } from '../../tools/audio/rebalance-core';

const SONG = `
const X = '{ not an object }';
// a comment with a { brace
export const demo = compileSong({
  id: 'demo',
  tracks: [
    {
      id: 'base',
      inst: 'arp',
      vol: 2,
      bars: 'a',
    },
    { id: 'lead', inst: 'lead', pan: 0.1, vol: 1.4, bars: 'b' },
    {
      id: 'bass',
      inst: 'bass',
      bars: 'c',
    },
    { id: 'chords', inst: 'chord', bars: 'd' },
    {
      id: 'kit',
      vol: 0.5,
      lanes: {
        k: 'x . . .',
        s: '. . x .',
      },
    },
  ],
});
`;

const volOf = (src: string, id: string): number | undefined => {
  const at = src.indexOf(`id: '${id}'`);
  const [open, close] = objectRanges(src).filter(([o, c]) => o < at && at < c).sort((a, b) => a[1] - a[0] - (b[1] - b[0]))[0]!;
  const m = /\bvol:\s*(-?\d*\.?\d+)/.exec(src.slice(open, close + 1));
  return m ? Number(m[1]) : undefined;
};

describe('rewriteVols', () => {
  it('multiplies an existing vol in a multi line track and in a one liner, and touches nothing else', () => {
    const r = rewriteVols(SONG, [
      { layer: 'base', change: 1.5 },
      { layer: 'lead', change: 0.5 },
    ]);
    expect(volOf(r.source, 'base')).toBe(3);
    expect(volOf(r.source, 'lead')).toBe(0.7);
    expect(volOf(r.source, 'kit')).toBe(0.5);
    expect(r.edits).toEqual([
      { layer: 'base', from: 2, to: 3 },
      { layer: 'lead', from: 1.4, to: 0.7 },
    ]);
    // everything but the two numbers is byte for byte the same
    expect(r.source.replace('vol: 3,', 'vol: 2,').replace('vol: 0.7,', 'vol: 1.4,')).toBe(SONG);
  });

  it('adds a vol where the track has none, in the style of the line it sits on', () => {
    const r = rewriteVols(SONG, [
      { layer: 'bass', change: 0.75 },
      { layer: 'chords', change: 1.25 },
    ]);
    expect(volOf(r.source, 'bass')).toBe(0.75);
    expect(volOf(r.source, 'chords')).toBe(1.25);
    expect(r.source).toContain("      id: 'bass',\n      vol: 0.75,\n      inst: 'bass',");
    expect(r.source).toContain("{ id: 'chords', vol: 1.25, inst: 'chord'");
    expect(r.edits).toEqual([
      { layer: 'bass', from: 1, to: 0.75 },
      { layer: 'chords', from: 1, to: 1.25 },
    ]);
  });

  it('edits a drum track by its own vol, not by anything inside its lanes', () => {
    const r = rewriteVols(SONG, [{ layer: 'kit', change: 2 }]);
    expect(volOf(r.source, 'kit')).toBe(1);
    expect(r.source).toContain("k: 'x . . .'");
  });

  it('leaves a layer alone when it is already close, so a second run changes nothing', () => {
    const near = 1 + MIN_CHANGE / 2;
    const r = rewriteVols(SONG, [{ layer: 'base', change: near }]);
    expect(r.source).toBe(SONG);
    expect(r.edits).toEqual([]);
    const once = rewriteVols(SONG, [{ layer: 'base', change: 1.5 }]);
    expect(rewriteVols(once.source, [{ layer: 'base', change: 1 }]).source).toBe(once.source);
  });

  it('never moves a layer further than the limits in one pass', () => {
    const r = rewriteVols(SONG, [
      { layer: 'base', change: 100 },
      { layer: 'lead', change: 0.001 },
    ]);
    expect(volOf(r.source, 'base')).toBe(2 * CHANGE_LIMITS[1]);
    expect(volOf(r.source, 'lead')).toBe(Math.round(1.4 * CHANGE_LIMITS[0] * 100) / 100);
  });

  it('fails loudly on a layer the song does not have, an ambiguous one, or a bad factor', () => {
    expect(() => rewriteVols(SONG, [{ layer: 'ghost', change: 2 }])).toThrow(/exactly one track with id 'ghost', found 0/);
    expect(() => rewriteVols(SONG + SONG, [{ layer: 'base', change: 2 }])).toThrow(/found 2/);
    expect(() => rewriteVols(SONG, [{ layer: 'base', change: Number.NaN }])).toThrow(/bad factor/);
    expect(() => rewriteVols(SONG, [{ layer: 'base', change: 0 }])).toThrow(/bad factor/);
  });
});

describe('objectRanges', () => {
  it('ignores braces in strings and comments', () => {
    const src = "const a = { s: '}{', t: \"{\" }; // {\n/* } */ const b = { c: { d: 1 } };";
    const ranges = objectRanges(src);
    expect(ranges.length).toBe(3);
    for (const [o, c] of ranges) expect(src[o]).toBe('{'), expect(src[c]).toBe('}');
  });
});
