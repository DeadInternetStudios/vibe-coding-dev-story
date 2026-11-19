import { describe, expect, it } from 'vitest';
import { shopGrid, teamGrid } from './tileFit';

/** the grid starts 6 art pixels in and keeps the same margin on the right */
const rightEdge = (cols: number, tile: number) => 6 + cols * (tile + 2) - 2;
/** a 224 to 250 wide canvas makes a 220 to 246 wide card on a phone */
const PHONE_CARDS = Array.from({ length: 27 }, (_, i) => 220 + i);

describe('team grid', () => {
  it('stays inside the card at every width a phone can give it', () => {
    for (const w of PHONE_CARDS) {
      const { cols, tile } = teamGrid(w, false);
      expect(rightEdge(cols, tile), `card ${w} wide`).toBeLessThanOrEqual(w - 6);
    }
  });

  it('keeps the tiles big enough for a person (16 wide, 20 high, plus a ring)', () => {
    for (const w of PHONE_CARDS) expect(teamGrid(w, false).tile).toBeGreaterThanOrEqual(24);
  });

  it('the wide card keeps four columns of 30', () => {
    expect(teamGrid(410, true)).toEqual({ cols: 4, tile: 30 });
  });
});

describe('shop grid', () => {
  it('stays inside the card at every width a phone can give it', () => {
    for (const w of PHONE_CARDS) {
      const { cols, tile } = shopGrid(w, false);
      expect(rightEdge(cols, tile), `card ${w} wide`).toBeLessThanOrEqual(w - 6);
    }
  });

  it('keeps the tiles big enough for the biggest item picture and its price line', () => {
    for (const w of PHONE_CARDS) expect(shopGrid(w, false).tile).toBeGreaterThanOrEqual(30);
  });

  it('the wide card keeps five columns of 36', () => {
    expect(shopGrid(410, true)).toEqual({ cols: 5, tile: 36 });
  });
});

describe('both grids', () => {
  it('use even tiles, so the middle of a tile is a whole pixel', () => {
    for (const w of PHONE_CARDS) {
      expect(teamGrid(w, false).tile % 2).toBe(0);
      expect(shopGrid(w, false).tile % 2).toBe(0);
    }
  });
});
