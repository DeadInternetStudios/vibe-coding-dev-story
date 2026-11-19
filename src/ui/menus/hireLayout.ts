/** The line under the rows of a wide job board (what a tapped face said, or how the board works): a 16 px font and the card's edge. */
export const HIRE_WIDE_FOOT = 22;
/** Where the first row starts: under the title. */
export const HIRE_TOP = 22;

/**
 * The height of one candidate row and of the whole job board card. `cap` is the tallest card the screen allows.
 * A phone on its side only has about 220 px, so the rows shrink until six of them and the line under them fit;
 * a laptop keeps full rows. An upright phone stacks everything in a taller row, tall enough that the trait line's descenders clear the row's edge.
 */
export function hireLayout(cap: number, rows: number, wide: boolean): { rowH: number; h: number } {
  if (!wide) return { rowH: 44, h: Math.min(cap, 44 + rows * 46 + 32) };
  const rowH = Math.min(29, Math.floor((cap - HIRE_TOP - HIRE_WIDE_FOOT) / rows) - 2);
  return { rowH, h: Math.min(cap, HIRE_TOP + rows * (rowH + 2) + HIRE_WIDE_FOOT + 4) };
}
