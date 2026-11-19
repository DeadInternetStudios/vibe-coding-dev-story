import { describe, expect, it } from 'vitest';
import { LOGO_H, LOGO_W } from '../art/sprites/logo';
import { landmarkSign } from '../art/sprites/scenery';
import { BUTTON_H, BUTTON_W, STRIP_H, TITLE_BAND, freeSpot, titleBlock } from './titleLayout';

const at = (W: number, H: number, save = false) => titleBlock({ W, H, cx: Math.floor(W / 2), save, logo: { w: LOGO_W, h: LOGO_H }, sign: landmarkSign(W, H) });

/** Whether the tower's sign sits in the columns of the buttons, which is when it can be covered. */
const underButtons = (W: number, H: number) => {
  const sign = landmarkSign(W, H);
  return sign.x + sign.w + 6 > Math.floor(W / 2) - BUTTON_W / 2;
};

/** Canvas sizes the title really gets: see computeViewport (portrait is never smaller than 234 by 420). */
const PHONES: [string, number, number][] = [
  ['smallest phone upright', 234, 420],
  ['small phone upright', 240, 427],
  ['phone upright', 234, 507],
  ['tall phone upright', 234, 600],
];

describe('the title block against the tall tower behind it', () => {
  it.each(PHONES)('%s: the tower is under the buttons, so the last button ends above its sign', (_name, W, H) => {
    expect(underButtons(W, H)).toBe(true);
    for (const save of [false, true]) {
      const b = at(W, H, save);
      expect(b.logoY + b.blockH).toBeLessThanOrEqual(landmarkSign(W, H).y - 4);
    }
  });

  it.each(PHONES)('%s: the logo never rides up into the band at the top', (_name, W, H) => {
    expect(at(W, H, true).logoY).toBeGreaterThanOrEqual(TITLE_BAND);
  });

  it('a tablet or a laptop has the tower off to the side of the buttons, so the block stays where it always was', () => {
    for (const [W, H] of [[328, 472], [480, 300], [507, 234]] as const) {
      expect(underButtons(W, H)).toBe(false);
      const b = at(W, H);
      const free = H - 13 - b.logoH - 14 - b.menuH - TITLE_BAND;
      expect(b.logoY).toBe(TITLE_BAND + Math.max(0, Math.floor(free * 0.32)));
    }
  });
});

describe('the free spot for a box on the title', () => {
  /** The buttons of a title with no saved run, as TitleScene lays them out, for the block `titleBlock` places. */
  const menuAt = (W: number, H: number) => {
    const b = at(W, H);
    const menuTop = b.logoY + b.logoH + 4 + 16;
    return { W, H, cx: Math.floor(W / 2), menuTop, menuBottom: menuTop + 3 * (BUTTON_H + 5) };
  };
  const SIZES: [number, number][] = [[234, 420], [240, 427], [234, 507], [234, 600], [328, 472], [380, 232], [413, 232], [417, 234], [427, 240], [507, 234], [640, 360]];
  const BOX_H = [14, 22, 54];

  it.each(SIZES)('%i x %i: a box is inside the canvas, above the news strip and clear of the buttons', (W, H) => {
    const m = menuAt(W, H);
    for (const boxH of BOX_H) {
      const s = freeSpot({ ...m, boxH });
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x + s.w).toBeLessThanOrEqual(W);
      const inLane = s.x + s.w <= m.cx - BUTTON_W / 2 || s.x >= m.cx + BUTTON_W / 2;
      if (inLane) expect(s.y).toBeGreaterThanOrEqual(m.menuTop);
      else expect(s.y + boxH).toBeLessThanOrEqual(H - STRIP_H - 4);
    }
  });

  it('a wide screen gives the box the lane beside the buttons, in the first rows of the buttons', () => {
    const m = menuAt(507, 234);
    const s = freeSpot({ ...m, boxH: 22 });
    expect(s.x).toBe(m.cx + BUTTON_W / 2 + 8);
    expect(s.y).toBe(m.menuTop + 6);
    expect(s.w).toBe(176);
  });

  it('a phone upright puts it under the last button, as wide as the screen allows', () => {
    const m = menuAt(234, 507);
    const s = freeSpot({ ...m, boxH: 22 });
    expect(s.y).toBe(m.menuBottom + 10);
    expect(s.w).toBe(222);
    expect(s.x).toBe(6);
  });

  it('no room under the buttons: it ends above the news strip instead of running off the screen', () => {
    const s = freeSpot({ W: 234, H: 300, cx: 117, menuTop: 150, menuBottom: 290, boxH: 40 });
    expect(s.y).toBe(300 - STRIP_H - 4 - 40);
  });
});
