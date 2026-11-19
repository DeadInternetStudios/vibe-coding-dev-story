/**
 * Boxes for the interface: panels, buttons, chips, bar frames. They are drawn
 * small and stretched as nine slices, so the corners stay crisp at any size.
 */
import { Px } from '../pixel';
import type { ColorName } from '../palette';

export interface BoxStyle {
  /** the face */
  fill: ColorName;
  /** light edge, top and left, inside the outline */
  hi: ColorName;
  /** dark edge, bottom and right, inside the outline */
  shade: ColorName;
  /** the outline */
  line: ColorName;
}

export const BOX_STYLES = {
  // content panels, like paper on a desk
  paper: { fill: 'cream', hi: 'white', shade: 'wood4', line: 'ink0' },
  paperDim: { fill: 'wood4', hi: 'cream', shade: 'wood3', line: 'ink0' },
  // dark HUD plates
  plum: { fill: 'ink1', hi: 'ink2', shade: 'ink0', line: 'ink0' },
  night: { fill: 'ink0', hi: 'ink1', shade: 'ink0', line: 'ink0' },
  // terminals and the thread
  teal: { fill: 'teal0', hi: 'teal1', shade: 'ink0', line: 'ink0' },
  sky: { fill: 'blue0', hi: 'blue1', shade: 'ink0', line: 'ink0' },
  violet: { fill: 'violet0', hi: 'violet1', shade: 'ink0', line: 'ink0' },
  // buttons
  btnOrange: { fill: 'orange1', hi: 'orange2', shade: 'orange0', line: 'ink0' },
  btnOrangeDown: { fill: 'orange0', hi: 'orange1', shade: 'orange0', line: 'ink0' },
  btnTeal: { fill: 'teal1', hi: 'teal2', shade: 'teal0', line: 'ink0' },
  btnTealDown: { fill: 'teal0', hi: 'teal1', shade: 'teal0', line: 'ink0' },
  btnCream: { fill: 'cream', hi: 'white', shade: 'wood3', line: 'ink0' },
  btnCreamDown: { fill: 'wood4', hi: 'cream', shade: 'wood4', line: 'ink0' },
  btnPlum: { fill: 'ink2', hi: 'ink3', shade: 'ink1', line: 'ink0' },
  btnPlumDown: { fill: 'ink1', hi: 'ink2', shade: 'ink1', line: 'ink0' },
  btnBerry: { fill: 'berry1', hi: 'pink', shade: 'berry0', line: 'ink0' },
  btnBerryDown: { fill: 'berry0', hi: 'berry1', shade: 'berry0', line: 'ink0' },
  btnViolet: { fill: 'violet1', hi: 'violet2', shade: 'violet0', line: 'ink0' },
  btnVioletDown: { fill: 'violet0', hi: 'violet1', shade: 'violet0', line: 'ink0' },
  btnOff: { fill: 'ink2', hi: 'ink2', shade: 'ink1', line: 'ink1' },
  // small tags
  chipLight: { fill: 'white', hi: 'white', shade: 'cream', line: 'ink0' },
  chipDark: { fill: 'ink0', hi: 'ink1', shade: 'ink0', line: 'ink0' },
  // a recessed slot, bar frames
  well: { fill: 'ink0', hi: 'ink0', shade: 'ink1', line: 'ink0' },
  wellLight: { fill: 'wood4', hi: 'wood3', shade: 'white', line: 'ink0' },
} satisfies Record<string, BoxStyle>;

export type BoxName = keyof typeof BOX_STYLES;

/** Source size of the stretchable boxes and how many pixels at each edge stay fixed. */
export const BOX_SRC = 12;
export const BOX_SLICE = 4;

/**
 * A rounded box of any size. Corners are cut by one pixel, a light line runs
 * along the top and left inside the outline and a shade line along the bottom
 * and right.
 */
export function box(w: number, h: number, s: BoxStyle): Px {
  const p = new Px(w, h);
  p.rect(0, 0, w, h, s.line);
  p.rect(1, 1, w - 2, h - 2, s.fill);
  if (w > 4 && h > 4) {
    p.hline(1, 1, w - 2, s.hi);
    p.vline(1, 1, h - 2, s.hi);
    p.hline(1, h - 2, w - 2, s.shade);
    p.vline(w - 2, 1, h - 2, s.shade);
    // the shade wins at the bottom right, the light wins at the top left
    p.set(w - 2, 1, s.fill);
    p.set(1, h - 2, s.fill);
  }
  p.set(0, 0, 'clear').set(w - 1, 0, 'clear').set(0, h - 1, 'clear').set(w - 1, h - 1, 'clear');
  return p;
}

export function boxFor(name: BoxName): Px {
  return box(BOX_SRC, BOX_SRC, BOX_STYLES[name]);
}
