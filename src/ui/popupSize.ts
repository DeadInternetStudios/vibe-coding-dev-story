import type { Layout } from './layout';

/** Height of the status strip along the top of the office: two rows, the money and the date over the gauges and the speed buttons. */
export const HUD_TOP_H = 32;

/**
 * Height for a popup that wants `want`. On a short screen it keeps a margin so the page behind still frames it.
 * A card that would leave less than the status strip of page above it would cut a row of that strip in half,
 * so it takes the whole height instead and covers the strip.
 */
export function popupH(L: Layout, want: number): number {
  const cap = L.H - (L.H < 270 ? 14 : 4);
  return cap - want < 2 * (HUD_TOP_H + 1) ? cap : want;
}
