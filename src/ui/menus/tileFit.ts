/**
 * Tile size for a grid of `cols` columns on a card `cardW` art pixels wide, so the grid stays inside the card and
 * keeps the 6 pixel margin the card gives it on the left. Tiles are 2 pixels apart. A narrow card (a phone) shrinks
 * the tiles to fit, in even steps so what is drawn in the middle of a tile stays on whole pixels.
 */
export function fitTile(cardW: number, cols: number, max: number): number {
  return Math.min(max, 2 * Math.floor(((cardW - 12) / cols - 2) / 2));
}

/** Columns and tile size of the face grid on the team card. */
export function teamGrid(cardW: number, wide: boolean): { cols: number; tile: number } {
  const cols = wide ? 4 : 8;
  return { cols, tile: wide ? 30 : fitTile(cardW, cols, 28) };
}

/** Columns and tile size of the item grid in the office shop. */
export function shopGrid(cardW: number, wide: boolean): { cols: number; tile: number } {
  const cols = wide ? 5 : 6;
  return { cols, tile: wide ? 36 : fitTile(cardW, cols, 36) };
}
