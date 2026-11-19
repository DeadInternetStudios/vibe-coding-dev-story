import { describe, expect, it } from 'vitest';
import type { Layout } from './layout';
import { HUD_TOP_H, popupH } from './popupSize';

const screen = (W: number, H: number): Layout => ({ W, H, portrait: H > W * 1.02, cw: W, x0: 0, cx: Math.floor(W / 2) });

describe('how tall a card is on each screen', () => {
  it('on the smallest upright phone a card that would cut the status strip in half covers it instead', () => {
    const L = screen(240, 427);
    expect(popupH(L, 408)).toBe(423);
    expect(popupH(L, 404)).toBe(423);
  });

  it('a card that leaves the whole status strip showing keeps its own height', () => {
    const L = screen(240, 427);
    const room = L.H - 4 - 2 * (HUD_TOP_H + 1);
    expect(popupH(L, 350)).toBe(350);
    expect(popupH(L, room)).toBe(room);
    expect(popupH(L, room + 1)).toBe(423);
  });

  it('a taller phone has room for the card and the strip', () => {
    expect(popupH(screen(234, 507), 408)).toBe(408);
  });

  it('a phone on its side takes the screen less a margin', () => {
    expect(popupH(screen(507, 234), 246)).toBe(220);
    expect(popupH(screen(507, 234), 258)).toBe(220);
  });

  it('a laptop takes the whole height for a card that would cut into the two rows of the strip, and keeps a short one', () => {
    expect(popupH(screen(480, 300), 246)).toBe(296);
    expect(popupH(screen(480, 300), 258)).toBe(296);
    expect(popupH(screen(480, 300), 230)).toBe(230);
  });

  it('never taller than the screen allows', () => {
    for (const [W, H] of [[240, 427], [234, 420], [507, 234], [480, 300]] as const) expect(popupH(screen(W, H), 9999)).toBeLessThanOrEqual(H - 4);
  });
});
