import { describe, expect, it } from 'vitest';
import { teamGrid } from './teamGrid';

/** the grid starts 6 art pixels in and keeps the same margin on the right */
const rightEdge = (cols: number, tile: number) => 6 + cols * (tile + 2) - 2;

describe('team grid', () => {
  it('stays inside the card at every width a phone can give it (a 224 to 250 wide canvas makes a 220 to 246 wide card)', () => {
    for (let w = 220; w <= 246; w++) {
      const { cols, tile } = teamGrid(w, false);
      expect(rightEdge(cols, tile), `card ${w} wide`).toBeLessThanOrEqual(w - 6);
    }
  });

  it('keeps the tiles big enough for a person (16 wide, 20 high, plus a ring)', () => {
    for (let w = 220; w <= 246; w++) expect(teamGrid(w, false).tile).toBeGreaterThanOrEqual(24);
  });

  it('uses whole pixels for the middle of a tile', () => {
    for (let w = 220; w <= 246; w++) expect(teamGrid(w, false).tile % 2).toBe(0);
  });

  it('the wide card keeps four columns of 30', () => {
    expect(teamGrid(410, true)).toEqual({ cols: 4, tile: 30 });
  });
});
