import { describe, expect, it } from 'vitest';
import { buildingRows } from './roomLayout';

/** The card heights `popupH` gives the office card: a phone on its side, a laptop, an upright phone. */
const HEIGHTS = [
  ['phone on its side', 220],
  ['laptop', 246],
  ['upright phone', 330],
] as const;

describe('the office card building tab', () => {
  it.each(HEIGHTS)('%s: the first row of people sits inside the card with room to spare', (_name, h) => {
    const r = buildingRows(h);
    expect(r.cellsY + r.cellH).toBeLessThanOrEqual(h - 8);
  });

  it.each(HEIGHTS)('%s: the blocks come in order and do not overlap', (_name, h) => {
    const r = buildingRows(h);
    expect(r.nextY).toBeGreaterThanOrEqual(r.curY + r.panelH);
    expect(r.healthY).toBeGreaterThanOrEqual(r.nextY + r.panelH);
    expect(r.actionsY).toBeGreaterThanOrEqual(r.healthY + 20);
    expect(r.hintY).toBeGreaterThanOrEqual(r.actionsY + r.actionH);
    expect(r.floorY).toBeGreaterThanOrEqual(r.hintY + 9);
  });

  it('only a short card is packed tight; the roomy layouts stay as they were', () => {
    expect(buildingRows(220).tight).toBe(true);
    const roomy = buildingRows(246);
    expect(roomy).toMatchObject({ tight: false, panelH: 42, nextY: 84, healthY: 132, actionsY: 158, hintY: 180, floorY: 198, cellsY: 210 });
  });
});
