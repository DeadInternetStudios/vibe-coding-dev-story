import { DOOR, WALL_H, wallBlocks, type RoomLook } from '../art/sprites/rooms';
import { TILE } from '../art/sprites/office';
import { OFFICE_TIERS } from '../sim/config';

export interface Spot {
  x: number;
  y: number;
}

export interface RoomSpec {
  look: RoomLook;
  w: number;
  h: number;
  /** top left of each desk sprite, in room pixels */
  desks: Spot[];
  /** bottom center of floor and corner items */
  floorSpots: Spot[];
  /** top center of wall items */
  wallSpots: Spot[];
  /** where people walk in and out */
  door: Spot;
  /** the rectangle support staff wander in */
  roam: { x0: number; y0: number; x1: number; y1: number };
}

const DESK_W = 32;
const DESK_STEP = 40;
const DESK_X0 = 14;

interface TierLook {
  tilesW: number;
  rows: number;
  floor: RoomLook['floor'];
  wall: RoomLook['wall'];
  windows: number[];
}

const LOOKS: TierLook[] = [
  { tilesW: 13, rows: 5, floor: 'concrete', wall: 'plank', windows: [136] },
  { tilesW: 17, rows: 6, floor: 'carpet', wall: 'cream', windows: [38, 206] },
  { tilesW: 22, rows: 6, floor: 'wood', wall: 'brick', windows: [34, 150, 266] },
  { tilesW: 28, rows: 6, floor: 'slate', wall: 'glass', windows: [] },
];

function build(tier: number): RoomSpec {
  const t = LOOKS[tier]!;
  const w = t.tilesW * TILE;
  const h = WALL_H + t.rows * TILE;
  const desks = OFFICE_TIERS[tier]!.desks;
  const cols = Math.ceil(desks / 2);
  const rowYs = [WALL_H + 8, WALL_H + 8 + 38];
  const spots: Spot[] = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < cols; c++) spots.push({ x: DESK_X0 + c * DESK_STEP, y: rowYs[r]! });
  // right region
  const rx0 = DESK_X0 + cols * DESK_STEP + 6;
  const floorSpots: Spot[] = [];
  const perRow = Math.max(0, Math.floor((w - 6 - rx0) / 36));
  for (const yb of [WALL_H + 34, WALL_H + 62, h - 4]) {
    for (let i = 0; i < perRow; i++) floorSpots.push({ x: Math.round(rx0 + 18 + i * 36), y: yb });
  }
  // bottom row below the desks
  for (let x = 22; x < rx0 - 10; x += 38) floorSpots.push({ x, y: h - 3 });
  // wall: in the gaps the architecture leaves (windows, doors, fixtures), as many 32 wide pieces as fit
  const wallSpots: Spot[] = [];
  const gaps: [number, number][] = [];
  let edge = 0;
  for (const [a, b] of wallBlocks(t).sort((p, q) => p[0] - q[0])) {
    if (a > edge) gaps.push([edge, a]);
    edge = Math.max(edge, b);
  }
  if (edge < w) gaps.push([edge, w]);
  for (const [a, b] of gaps) {
    const n = Math.floor((b - a + 4) / 36);
    const x0 = a + (b - a - (n * 32 + (n - 1) * 4)) / 2 + 16;
    for (let i = 0; i < n; i++) wallSpots.push({ x: Math.round(x0 + i * 36), y: 9 });
  }
  return {
    look: { ...t },
    w,
    h,
    desks: spots.slice(0, desks),
    floorSpots,
    wallSpots,
    door: { x: DOOR.x + DOOR.w / 2, y: WALL_H + 4 },
    roam: { x0: 12, y0: WALL_H + 20, x1: w - 14, y1: h - 6 },
  };
}

const CACHE: RoomSpec[] = [];
export function roomSpec(tier: number): RoomSpec {
  const t = Math.max(0, Math.min(LOOKS.length - 1, tier));
  return (CACHE[t] ??= build(t));
}

export { DESK_W };
