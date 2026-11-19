/** Where each block of the office card's building tab starts, in card pixels. */
export interface BuildingRows {
  panelH: number;
  curY: number;
  nextY: number;
  healthY: number;
  actionsY: number;
  actionH: number;
  hintY: number;
  floorY: number;
  cellsY: number;
  /** a person's cell on the floor plan */
  cellH: number;
  /** pixels from one row of cells to the next */
  cellStep: number;
  tight: boolean;
}

/**
 * The building tab stacks two panels, two bars, two buttons, a hint and the floor plan. A card under 240 px
 * (a phone on its side) packs them closer, so the floor plan stays inside the card.
 */
export function buildingRows(h: number): BuildingRows {
  const tight = h < 240;
  const panelH = tight ? 32 : 42;
  const curY = 38;
  const nextY = curY + panelH + (tight ? 3 : 4);
  const healthY = nextY + panelH + (tight ? 4 : 6);
  const actionsY = healthY + (tight ? 24 : 26);
  const actionH = tight ? 16 : 18;
  const hintY = actionsY + actionH + (tight ? 3 : 4);
  const floorY = actionsY + (tight ? 34 : 40);
  return { panelH, curY, nextY, healthY, actionsY, actionH, hintY, floorY, cellsY: floorY + 12, cellH: 26, cellStep: 28, tight };
}
