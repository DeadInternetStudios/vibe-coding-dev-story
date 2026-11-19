import { describe, expect, it } from 'vitest';
import { LOGO_H, LOGO_W } from '../art/sprites/logo';
import { landmarkSign } from '../art/sprites/scenery';
import { BUTTON_W, TITLE_BAND, titleBlock } from './titleLayout';

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
