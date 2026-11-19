import { describe, expect, it } from 'vitest';
import { FONT_SPECS } from './fontSpecs';
import { handGlyph } from './handGlyph';

const strokes = (row: string) => row.split(/\.+/).filter(Boolean).length;

describe('handGlyph', () => {
  it('reads rows of # and . into bits of the same height', () => {
    const g = handGlyph('#.#/###', 2);
    expect(g?.w).toBe(3);
    expect([...(g?.bits ?? [])]).toEqual([1, 0, 1, 1, 1, 1]);
  });

  it('may be wider than the letter it replaces: it only has to match the height', () => {
    expect(handGlyph('########/##.##.##', 2)?.w).toBe(8);
    expect(handGlyph('##/##', 2)?.w).toBe(2);
  });

  it('keeps the font own drawing when the rows do not make a letter of that height', () => {
    expect(handGlyph(undefined, 2)).toBeNull();
    expect(handGlyph('', 1)).toBeNull();
    expect(handGlyph('##/##/##', 2)).toBeNull();
    expect(handGlyph('##/###', 2)).toBeNull();
    expect(handGlyph('#x/##', 2)).toBeNull();
  });
});

describe('the letters drawn by hand in the baked fonts', () => {
  const patches = FONT_SPECS.flatMap((spec) => Object.entries(spec.patch ?? {}).map(([ch, rows]) => ({ font: spec.key, ch, rows })));

  it('are rectangles of # and . with one character each', () => {
    expect(patches.length).toBeGreaterThan(0);
    for (const { ch, rows } of patches) {
      expect(ch).toHaveLength(1);
      expect(handGlyph(rows, rows.split('/').length), `${ch}`).not.toBeNull();
    }
  });

  // the Thread Score showed "I'm in." as "I'# in.": VT323 at 16 px draws an m with no room between its three strokes
  it.each(['m', 'w', 'M', 'W'])('keeps three separate strokes in the reading font %s', (ch) => {
    const rows = FONT_SPECS.find((s) => s.key === 'vt16')?.patch?.[ch]?.split('/') ?? [];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => strokes(row) === 3), `${ch} has no row with three strokes`).toBe(true);
  });
});
