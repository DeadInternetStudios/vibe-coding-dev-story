/** Room under the last channel row for the LAUNCH button and its margins, in art pixels. */
export const BELOW_ROWS = 34;
/** The tallest a channel row gets. */
export const MAX_ROW_H = 24;
/** A row has to be this tall to stack the name and the "hype +8" note: two 8 pixel lines, a pixel between, and the button's bevel. */
export const TWO_LINE_ROW_H = 23;

/**
 * The channel list on the ready card. `h` is the card height, `top` where the first row starts, `count` how many rows.
 * A row too short for two lines puts the note beside the name instead of under it, so nothing is cut by the row below.
 */
export function channelRows(h: number, top: number, count: number): { rowH: number; inline: boolean } {
  const rowH = Math.min(MAX_ROW_H, Math.floor((h - top - BELOW_ROWS) / Math.max(1, count)));
  return { rowH, inline: rowH < TWO_LINE_ROW_H };
}

/** Where the name sits inside a row, from the row's top, so the text block is centred in the button. */
export function channelTextY(rowH: number, inline: boolean): number {
  return inline ? Math.floor((rowH - 1 - 8) / 2) : Math.max(1, Math.floor((rowH - 1 - 17) / 2));
}
