/**
 * Columns and tile size of the face grid on the team card, for a card `w` art pixels wide. The grid has to stay
 * inside the card, so a narrow card (a phone) shrinks the tiles, in even steps so the faces stay on whole pixels.
 */
export function teamGrid(w: number, wide: boolean): { cols: number; tile: number } {
  const cols = wide ? 4 : 8;
  const tile = wide ? 30 : Math.min(28, 2 * Math.floor(((w - 12) / cols - 2) / 2));
  return { cols, tile };
}
