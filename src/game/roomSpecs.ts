import { WALL_H, type RoomLook } from '../art/sprites/rooms';
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
  { tilesW: 17, rows: 6, floor: 'carpet', wall: 'cream', windows: [28, 120, 212] },
  { tilesW: 22, rows: 6, floor: 'wood', wall: 'brick', windows: [30, 130, 230, 300] },
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
  // wall: between windows, away from the pegboard
  const wallSpots: Spot[] = [];
  const blocked = [...t.windows.map((wx) => [wx - 4, wx + 36] as const), ...(t.wall === 'plank' ? ([[4, 52]] as const) : [])];
  for (let x = 30; x < w - 24; x += 44) {
    if (blocked.some(([a, b]) => x + 14 > a && x - 14 < b)) continue;
    wallSpots.push({ x, y: 9 });
  }
  // glass walls have no gaps, hang things on the mullions anyway
  if (t.wall === 'glass') for (let x = 40; x < w - 24; x += 64) wallSpots.push({ x, y: 9 });
  return {
    look: { ...t },
    w,
    h,
    desks: spots.slice(0, desks),
    floorSpots,
    wallSpots,
    door: { x: 8, y: WALL_H + 30 },
    roam: { x0: 12, y0: WALL_H + 20, x1: w - 14, y1: h - 6 },
  };
}

const CACHE: RoomSpec[] = [];
export function roomSpec(tier: number): RoomSpec {
  const t = Math.max(0, Math.min(LOOKS.length - 1, tier));
  return (CACHE[t] ??= build(t));
}

export { DESK_W };
