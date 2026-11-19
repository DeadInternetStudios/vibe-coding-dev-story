/**
 * Backdrops for the four offices: floor, wall, windows, doors and the pieces of
 * architecture that make each place feel different. Garage: roll-up door, oil
 * stain, pegboard. Shared office: cubicle carpet, printer, blinds. Loft: brick,
 * pipes, string lights, neon. Tower: glass, skyline, an elevator.
 *
 * `wallBlocks` says which stretches of the back wall the architecture covers,
 * so `roomSpecs` can hang the shop's wall decor only in the gaps.
 */
import { Px, ink, type InkName } from '../pixel';
import { Rng } from '../../sim/rng';
import { glyphs } from '../glyphs';
import { stamp } from './draw';
import { TILE, carpetTile, wallTile, windowCity, woodTile } from './office';

export type FloorKind = 'concrete' | 'carpet' | 'wood' | 'slate';
export type WallKind = 'plank' | 'cream' | 'brick' | 'glass';

export interface RoomLook {
  tilesW: number;
  rows: number;
  floor: FloorKind;
  wall: WallKind;
  /** x of each window, in px */
  windows: number[];
}

export const WALL_H = 48;
/** The door in the back wall, left end. People walk in and out at its foot. */
export const DOOR = { x: 4, w: 16, h: 40 };
export const WINDOW_W = 32;
const WINDOW_Y = 7;
/** A strip of pegboard under where the wall decor hangs. */
const PEG = { x: 24, y: 34, w: 108, h: 11 };
const GARAGE = { x: 172, y: 10, w: 32, h: 37 };
const PRINTER = { w: 24, h: 26 };

/** x ranges of the back wall taken by architecture, with a 2 px margin. Wall decor goes in the gaps. */
export function wallBlocks(look: RoomLook): [number, number][] {
  const W = look.tilesW * TILE;
  if (look.wall === 'glass') return [[0, 30]];
  const out: [number, number][] = [[0, DOOR.x + DOOR.w + 2]];
  for (const wx of look.windows) out.push([wx - 2, wx + WINDOW_W + 2]);
  if (look.wall === 'plank') out.push([GARAGE.x - 2, GARAGE.x + GARAGE.w + 2]);
  if (look.wall === 'cream') out.push([W - PRINTER.w - 6, W]);
  return out;
}

/* --------------------------------------------------------------------- floors */

export function concreteTile(variant = 0): Px {
  const c = new Px(TILE, TILE);
  c.rect(0, 0, TILE, TILE, 'steel2');
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const v = (x * 5 + y * 11 + variant * 7) % 13;
      if (v === 0) c.set(x, y, 'steel1');
      else if (v === 6) c.set(x, y, 'steel3');
    }
  }
  c.hline(0, 0, TILE, 'steel1');
  c.vline(0, 0, TILE, 'steel1');
  if (variant % 7 === 3) {
    c.line(2, 14, 10, 4, 'steel1');
  }
  return c;
}

/** Cubicle carpet: squares laid in a checker, one shade a little busier than the other. */
export function cubicleCarpetTile(variant = 0, odd = false): Px {
  const c = carpetTile(variant);
  if (odd) {
    for (let y = 1; y < TILE - 1; y++) for (let x = 1; x < TILE - 1; x++) if ((x + y * 2) % 4 === 0) c.set(x, y, 'steel0');
  }
  return c;
}

export function slateTile(variant = 0): Px {
  const c = new Px(TILE, TILE);
  c.rect(0, 0, TILE, TILE, 'blue0');
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) if ((x * 3 + y * 7 + variant * 5) % 17 === 0) c.set(x, y, 'steel0');
  c.hline(0, 0, TILE, 'steel0');
  c.vline(0, 0, TILE, 'steel0');
  c.hline(0, TILE - 1, TILE, 'ink1');
  c.vline(TILE - 1, 0, TILE, 'ink1');
  return c;
}

const FLOOR_RAMP: Record<FloorKind, InkName[]> = {
  concrete: ['steel0', 'steel1', 'steel2', 'steel3', 'cream'],
  carpet: ['steel0', 'steel1', 'steel2', 'steel3', 'cream'],
  wood: ['wood1', 'wood2', 'wood3', 'wood4', 'cream'],
  slate: ['ink1', 'blue0', 'steel0', 'steel1'],
};

/**
 * Light spilling through a window onto the floor: a slanted patch, one step
 * lighter along the floor's own ramp, with soft dithered edges and the
 * window's mullion shadows inside it.
 */
function lightPool(c: Px, o: { x: number; y: number; w: number; h: number; skew: number; ramp: InkName[]; steps?: number; cross?: boolean; blinds?: boolean }): void {
  const ramp = o.ramp.map((n) => ink(n));
  for (let r = 0; r < o.h; r++) {
    const x0 = o.x + Math.round(r * o.skew);
    for (let i = 0; i < o.w; i++) {
      const x = x0 + i;
      const y = o.y + r;
      const edgeX = i === 0 || i === o.w - 1;
      const edgeY = r >= o.h - 3;
      if (edgeX && (x + y) % 2 === 1) continue;
      if (edgeY && (r === o.h - 1 ? x % 2 === 1 || y % 2 === 1 : (x + y) % 2 === 1)) continue;
      if (o.cross && (i === Math.floor(o.w / 2) || i === Math.floor(o.w / 2) - 1 || r === Math.floor(o.h * 0.4))) continue;
      if (o.blinds && r % 3 === 2) continue;
      const at = ramp.indexOf(c.get(x, y));
      if (at >= 0) c.set(x, y, ramp[Math.min(ramp.length - 1, at + (o.steps ?? 1))]!);
    }
  }
}

/** A dark oil stain with a rainbow sheen and a couple of drips. */
function oilStain(c: Px, cx: number, cy: number): void {
  c.ellipse(cx, cy, 12, 4, 'steel0');
  c.ellipse(cx - 7, cy + 1, 5, 3, 'steel0');
  c.ellipse(cx + 9, cy - 1, 4, 3, 'steel0');
  c.ellipse(cx - 2, cy - 1, 8, 2, 'ink2');
  c.set(cx - 6, cy - 2, 'violet2').set(cx - 5, cy - 2, 'teal2').set(cx - 4, cy - 2, 'pink').set(cx + 3, cy - 1, 'teal2').set(cx + 4, cy - 1, 'violet2');
  c.set(cx + 16, cy + 4, 'steel0').set(cx + 17, cy + 5, 'steel0').set(cx - 15, cy + 3, 'steel0');
}

function doormat(c: Px, x: number, y: number, a: InkName, b: InkName): void {
  c.rect(x, y, 14, 6, a);
  c.frame(x, y, 14, 6, 'ink0');
  for (let i = 2; i < 12; i += 2) c.vline(x + i, y + 1, 4, b);
}

/* ---------------------------------------------------------------------- walls */

/** Plywood panel wall for the garage. */
export function plankWall(): Px {
  const c = new Px(TILE, WALL_H);
  c.rect(0, 0, TILE, WALL_H, 'wood2');
  for (let x = 0; x < TILE; x += 8) {
    c.vline(x, 0, WALL_H, 'wood1');
    c.vline(x + 1, 0, WALL_H, 'wood3');
  }
  // knots
  c.set(3, 20, 'wood1').set(4, 20, 'wood1');
  c.set(12, 30, 'wood1');
  // crown
  c.rect(0, 0, TILE, 3, 'ink2');
  c.hline(0, 3, TILE, 'ink1');
  // baseboard
  c.rect(0, 45, TILE, 3, 'wood1');
  c.hline(0, 45, TILE, 'wood3');
  c.hline(0, 47, TILE, 'wood0');
  return c;
}

export function brickWall(): Px {
  const c = new Px(TILE, WALL_H);
  c.rect(0, 0, TILE, WALL_H, 'brick1');
  for (let y = 0; y < WALL_H; y += 4) {
    c.hline(0, y, TILE, 'brick0');
    const off = (y / 4) % 2 ? 4 : 0;
    for (let x = off; x < TILE + 8; x += 8) {
      c.vline(x % TILE, y, 4, 'brick0');
      c.set((x + 2) % TILE, y + 1, 'brick2');
    }
  }
  c.rect(0, 0, TILE, 2, 'ink2');
  c.rect(0, 45, TILE, 3, 'wood1');
  c.hline(0, 45, TILE, 'wood3');
  c.hline(0, 47, TILE, 'wood0');
  return c;
}

/** One big skyline window used as the tower's wall, `w` wide. */
export function glassWall(w: number): Px {
  const c = new Px(w, WALL_H);
  c.rect(0, 0, w, WALL_H, 'ink1');
  const rng = new Rng(11);
  c.rect(2, 3, w - 4, WALL_H - 8, 'blue0');
  // sky bands
  c.rect(2, 3, w - 4, 12, 'violet0');
  c.dither(2, 15, w - 4, 2, 'violet0', 'blue0');
  c.rect(2, 30, w - 4, 10, 'berry0');
  c.dither(2, 28, w - 4, 2, 'blue0', 'berry0');
  c.rect(2, 36, w - 4, 4, 'orange0');
  c.dither(2, 34, w - 4, 2, 'berry0', 'orange0');
  // stars
  for (let i = 0; i < w / 6; i++) c.set(rng.int(3, w - 4), rng.int(4, 18), rng.chance(0.3) ? 'white' : 'violet2');
  // towers
  let x = 2;
  while (x < w - 4) {
    const bw = rng.int(7, 14);
    const bh = rng.int(10, 30);
    const top = WALL_H - 8 - bh;
    c.rect(x, top, Math.min(bw, w - 3 - x), bh, rng.chance(0.5) ? 'ink1' : 'violet0');
    for (let wy = top + 2; wy < WALL_H - 8; wy += 3) for (let wx = x + 1; wx < x + bw - 1 && wx < w - 3; wx += 3) if (rng.chance(0.4)) c.set(wx, wy, rng.chance(0.3) ? 'mint' : 'yellow');
    x += bw + rng.int(0, 2);
  }
  // a red aircraft light on the tallest roof, because there is always one
  c.set(w - 40, 6, 'pink').set(w - 40, 7, 'berry1');
  // glints on the glass, light from the top left
  for (let gx = 20; gx < w - 10; gx += 52) {
    c.line(gx, 6, gx + 6, 12, 'violet2');
    c.line(gx + 2, 6, gx + 6, 10, 'violet1');
  }
  // mullions every 32
  for (let mx = 32; mx < w - 2; mx += 32) {
    c.vline(mx, 2, WALL_H - 6, 'ink0');
    c.vline(mx + 1, 2, WALL_H - 6, 'ink2');
  }
  // frame + sill
  c.frame(0, 0, w, WALL_H - 3, 'ink0');
  c.rect(0, WALL_H - 5, w, 5, 'steel1');
  c.hline(0, WALL_H - 5, w, 'steel3');
  c.hline(0, WALL_H - 1, w, 'steel0');
  return c;
}

function pipes(w: number): Px {
  const c = new Px(w, 6);
  c.rect(0, 1, w, 3, 'steel2');
  c.hline(0, 1, w, 'steel3');
  c.hline(0, 3, w, 'steel0');
  for (let x = 12; x < w; x += 40) {
    c.rect(x, 0, 3, 5, 'steel1');
    c.vline(x, 0, 5, 'steel3');
  }
  return c.halo('ink0');
}

/* -------------------------------------------------------------------- windows */

/** The garage window: sunny, dusty, and one spider has moved in. */
function windowGarage(): Px {
  const c = windowCity();
  // cobweb in the top left corner of the left pane
  c.line(3, 3, 11, 3, 'ink5').line(3, 3, 3, 11, 'ink5').line(3, 3, 9, 9, 'ink5');
  c.set(7, 3, 'ink4').set(3, 7, 'ink4').set(6, 6, 'ink4').set(9, 5, 'ink4').set(5, 9, 'ink4');
  c.set(8, 8, 'ink0').set(8, 9, 'ink0'); // the spider, mid thought
  // a strip of tape over a crack
  c.line(20, 16, 26, 22, 'orange1');
  c.line(21, 16, 27, 22, 'orange2');
  return c;
}

/** The office window with its blinds pulled `down` rows, and one bent slat. */
function windowBlinds(down: number): Px {
  const c = windowCity();
  for (let y = 3; y < 3 + down; y += 2) {
    c.hline(2, y, 28, 'cream');
    c.hline(2, y + 1, 28, y % 4 === 3 ? 'wood3' : 'wood4');
  }
  // one slat someone has been peeking through
  c.hline(14, 3 + Math.min(down - 2, 8), 8, 'ink1');
  c.hline(14, 4 + Math.min(down - 2, 8), 8, 'blue1');
  // pull cord
  c.vline(29, 3, down + 4, 'wood2');
  c.rect(28, 3 + down + 4, 3, 2, 'wood3');
  return c;
}

/** Loft window: black steel grid, dusk over the roofs. */
function windowLoft(): Px {
  const w = WINDOW_W;
  const h = 30;
  const c = new Px(w, h);
  c.rect(0, 0, w, h, 'steel0');
  c.rect(2, 2, w - 4, h - 6, 'violet1');
  c.rect(2, 12, w - 4, 6, 'berry1');
  c.dither(2, 10, w - 4, 2, 'violet1', 'berry1');
  c.rect(2, 18, w - 4, 6, 'orange2');
  c.dither(2, 16, w - 4, 2, 'berry1', 'orange2');
  c.rect(2, 24, w - 4, 2, 'orange3');
  c.dither(2, 22, w - 4, 2, 'orange2', 'orange3');
  // sun going down
  c.ellipse(23, 22, 3, 3, 'yellow');
  c.hline(2, 24, w - 4, 'orange3');
  // roofs
  const roofs: [number, number, number][] = [
    [2, 18, 6],
    [8, 14, 5],
    [14, 20, 7],
    [21, 16, 4],
    [25, 19, 5],
  ];
  for (const [x, top, bw] of roofs) {
    c.rect(x, top, bw, 26 - top, 'ink1');
    for (let wy = top + 2; wy < 24; wy += 3) for (let wx = x + 1; wx < x + bw - 1; wx += 2) if ((wx + wy) % 3 !== 0) c.set(wx, wy, 'yellow');
  }
  // water tank on the tallest roof
  c.rect(9, 11, 3, 3, 'ink2');
  c.hline(9, 11, 3, 'ink3');
  // steel grid: 3 x 2 panes
  for (const gx of [11, 21]) c.vline(gx, 2, h - 6, 'steel0');
  c.hline(2, 13, w - 4, 'steel0');
  // light edge, sill
  c.hline(0, 0, w, 'steel2');
  c.vline(0, 0, h, 'steel2');
  c.hline(1, 1, w - 2, 'steel1');
  c.rect(0, h - 4, w, 4, 'steel1');
  c.hline(0, h - 4, w, 'steel3');
  c.hline(0, h - 1, w, 'steel0');
  c.line(4, 4, 7, 7, 'violet2');
  return c.halo('ink0');
}

/* ---------------------------------------------------------------------- doors */

function doorWood(): Px {
  const c = new Px(DOOR.w, DOOR.h);
  c.rect(0, 0, DOOR.w, DOOR.h, 'wood1');
  c.frame(0, 0, DOOR.w, DOOR.h, 'wood0');
  c.hline(1, 1, DOOR.w - 2, 'wood3');
  c.vline(1, 1, DOOR.h - 2, 'wood3');
  c.rect(3, 3, 10, DOOR.h - 3, 'wood2');
  for (let x = 6; x < 13; x += 3) c.vline(x, 3, DOOR.h - 3, 'wood1');
  for (let x = 4; x < 13; x += 3) c.vline(x, 3, DOOR.h - 3, 'wood3');
  // little window
  c.rect(5, 6, 7, 8, 'sky');
  c.frame(5, 6, 7, 8, 'wood0');
  c.vline(8, 7, 6, 'wood1');
  c.hline(6, 10, 5, 'wood1');
  c.set(6, 7, 'white').set(6, 8, 'white');
  // knob and a hang tag
  c.rect(11, 22, 2, 2, 'yellow');
  c.set(12, 23, 'orange3');
  c.rect(9, 25, 4, 3, 'berry1');
  c.hline(10, 26, 2, 'white');
  // cat flap, for the office cat that does not exist yet
  c.rect(5, 33, 6, 5, 'wood0');
  c.rect(6, 34, 4, 3, 'ink1');
  c.set(7, 35, 'wood4').set(9, 35, 'wood4');
  // hinges
  c.rect(3, 8, 1, 3, 'steel1').rect(3, 29, 1, 3, 'steel1');
  return c;
}

function doorGlass(): Px {
  const c = new Px(DOOR.w, DOOR.h);
  c.rect(0, 0, DOOR.w, DOOR.h, 'steel2');
  c.frame(0, 0, DOOR.w, DOOR.h, 'ink0');
  c.hline(1, 1, DOOR.w - 2, 'steel3');
  c.vline(1, 1, DOOR.h - 2, 'steel3');
  c.vline(DOOR.w - 2, 2, DOOR.h - 3, 'steel1');
  c.rect(3, 3, 10, 31, 'sky');
  c.rect(3, 20, 10, 14, 'blue2');
  c.dither(3, 18, 10, 2, 'sky', 'blue2');
  c.frame(2, 2, 12, 33, 'steel0');
  // reflections
  c.line(4, 4, 8, 8, 'white');
  c.line(4, 7, 6, 9, 'white');
  c.line(8, 20, 11, 23, 'white');
  // push bar and kick plate
  c.rect(3, 21, 10, 2, 'steel3');
  c.hline(3, 23, 10, 'steel0');
  c.rect(2, 35, 12, 4, 'steel1');
  c.hline(2, 35, 12, 'steel3');
  return c;
}

function doorSteel(): Px {
  const c = new Px(DOOR.w, DOOR.h);
  c.rect(0, 0, DOOR.w, DOOR.h, 'steel1');
  c.frame(0, 0, DOOR.w, DOOR.h, 'ink0');
  c.hline(1, 1, DOOR.w - 2, 'steel2');
  c.vline(1, 1, DOOR.h - 2, 'steel2');
  c.vline(DOOR.w - 2, 2, DOOR.h - 3, 'steel0');
  // sliding rail and wheels
  c.rect(0, 0, DOOR.w, 3, 'steel0');
  c.hline(0, 0, DOOR.w, 'steel2');
  c.rect(3, 3, 3, 3, 'steel3').rect(10, 3, 3, 3, 'steel3');
  // panel seams and rivets
  c.hline(2, 16, 12, 'steel0');
  c.hline(2, 28, 12, 'steel0');
  for (const [rx, ry] of [[3, 8], [12, 8], [3, 20], [12, 20]] as const) c.set(rx, ry, 'steel3');
  // rust where the rain gets in
  c.dither(2, 30, 8, 5, 'steel1', 'orange0', 'quarter');
  c.set(4, 33, 'orange1');
  // handle
  c.rect(11, 18, 2, 7, 'steel3');
  c.vline(12, 18, 7, 'steel0');
  // hazard stripe at the foot
  for (let x = 1; x < DOOR.w - 1; x++) for (let y = 35; y < 39; y++) c.set(x, y, (x + y) % 4 < 2 ? 'yellow' : 'ink0');
  return c;
}

function doorElevator(): Px {
  const c = new Px(DOOR.w, DOOR.h);
  c.rect(0, 0, DOOR.w, DOOR.h, 'steel1');
  c.frame(0, 0, DOOR.w, DOOR.h, 'ink0');
  c.hline(1, 1, DOOR.w - 2, 'steel3');
  c.vline(1, 1, DOOR.h - 2, 'steel3');
  // two sliding panels, a seam, a shine on each
  c.rect(3, 3, 5, DOOR.h - 4, 'steel2');
  c.rect(8, 3, 5, DOOR.h - 4, 'steel2');
  c.vline(3, 3, DOOR.h - 4, 'steel3');
  c.vline(9, 3, DOOR.h - 4, 'steel3');
  c.vline(7, 3, DOOR.h - 4, 'steel0');
  c.vline(8, 3, DOOR.h - 4, 'steel0');
  c.vline(12, 3, DOOR.h - 4, 'steel1');
  c.hline(3, 3, 10, 'steel3');
  // scuff marks at the bottom
  c.hline(4, 37, 3, 'steel1');
  c.hline(9, 35, 2, 'steel1');
  c.rect(1, 38, 14, 1, 'steel0');
  return c;
}

function exitSign(): Px {
  const c = new Px(17, 7);
  c.rect(0, 0, 17, 7, 'green0');
  c.frame(0, 0, 17, 7, 'ink0');
  glyphs(c, 'EXIT', 1, 1, 'mint');
  return c;
}

/** Neon EXIT over the loft door, pink with a glow. */
function neonExit(): Px {
  const c = new Px(21, 9);
  glyphs(c, 'EXIT', 3, 2, 'pink');
  return c.halo('berry1');
}

function elevatorIndicator(): Px {
  const c = new Px(13, 7);
  c.rect(0, 0, 13, 7, 'ink0');
  c.frame(0, 0, 13, 7, 'steel0');
  glyphs(c, '42', 3, 1, 'orange2');
  c.set(10, 2, 'orange3').set(9, 3, 'orange3').set(11, 3, 'orange3');
  return c;
}

/* ----------------------------------------------------------------- the garage */

function pegboard(): Px {
  const { w, h } = PEG;
  const c = new Px(w, h);
  c.rect(0, 0, w, h, 'wood3');
  c.frame(0, 0, w, h, 'wood1');
  c.hline(1, 1, w - 2, 'wood4');
  for (let x = 3; x < w - 2; x += 4) for (const y of [3, 7]) c.set(x, y, 'wood1');
  // a hammer
  c.rect(4, 3, 4, 4, 'steel2');
  c.vline(4, 3, 4, 'steel3');
  c.rect(8, 4, 8, 2, 'orange1');
  // the wrench someone borrowed: its painted outline and a note about it
  c.rect(22, 3, 4, 4, 'wood2');
  c.rect(26, 4, 8, 2, 'wood2');
  c.rect(28, 2, 5, 5, 'yellow');
  c.hline(29, 3, 3, 'orange1');
  c.hline(29, 5, 2, 'orange1');
  // screwdriver
  c.rect(40, 3, 4, 4, 'orange1');
  c.rect(44, 4, 9, 2, 'steel2');
  // tape measure
  c.rect(58, 2, 6, 6, 'yellow');
  c.frame(58, 2, 6, 6, 'orange0');
  c.rect(60, 4, 2, 2, 'steel1');
  // saw
  c.rect(70, 3, 18, 3, 'steel2');
  c.hline(70, 3, 18, 'steel3');
  for (let x = 70; x < 88; x += 2) c.set(x, 6, 'steel0');
  c.rect(88, 2, 5, 6, 'orange1');
  c.rect(90, 4, 1, 2, 'orange0');
  // pliers
  c.rect(98, 3, 6, 2, 'steel2');
  c.rect(96, 5, 3, 2, 'berry1');
  c.rect(100, 5, 3, 2, 'berry1');
  return c;
}

/** Tires stacked in front of the garage door, with the office cat asleep on top. */
function tires(): Px {
  const c = new Px(16, 18);
  for (const y of [14, 10, 6]) {
    c.ellipse(8, y, 7, 3, 'ink1');
    c.ellipse(7, y - 1, 5, 2, 'ink2');
    c.ellipse(8, y, 3, 1, 'steel1');
  }
  c.hline(2, 9, 3, 'ink3');
  c.hline(2, 13, 3, 'ink3');
  // the cat
  c.ellipse(8, 3, 4, 2, 'orange2');
  c.set(5, 1, 'orange1').set(5, 0, 'orange1').set(10, 1, 'orange1').set(10, 0, 'orange1');
  c.hline(5, 3, 2, 'orange1');
  c.hline(11, 3, 3, 'orange2').set(14, 4, 'orange1');
  c.set(6, 2, 'ink0').set(8, 2, 'ink0');
  return c.halo('ink0');
}

function garageDoor(): Px {
  const { w, h } = GARAGE;
  const c = new Px(w, h);
  c.rect(0, 0, w, h, 'wood1');
  c.frame(0, 0, w, h, 'ink0');
  c.hline(1, 1, w - 2, 'wood3');
  c.vline(1, 1, h - 2, 'wood3');
  // five roll-up panels
  for (let i = 0; i < 5; i++) {
    const y = 3 + i * 6;
    c.rect(3, y, w - 6, 5, 'steel2');
    c.hline(3, y, w - 6, 'steel3');
    c.hline(3, y + 4, w - 6, 'steel1');
    c.hline(3, y + 5, w - 6, 'steel0');
  }
  // a row of small windows in the second panel
  for (let i = 0; i < 4; i++) {
    c.rect(5 + i * 6, 10, 4, 3, 'sky');
    c.set(5 + i * 6, 10, 'white');
  }
  // the door is not quite shut: a bright gap with two sneakers waiting outside
  c.rect(3, h - 7, w - 6, 5, 'cream');
  c.hline(3, h - 7, w - 6, 'yellow');
  c.rect(10, h - 4, 3, 2, 'ink0');
  c.rect(16, h - 4, 3, 2, 'ink0');
  c.hline(10, h - 5, 2, 'wood4');
  c.hline(16, h - 5, 2, 'wood4');
  // handle
  c.rect(14, 27, 4, 2, 'ink0');
  c.set(15, 27, 'yellow');
  // a sticky note, v0.1
  c.rect(22, 18, 5, 5, 'yellow');
  c.hline(23, 20, 3, 'orange1');
  c.hline(23, 22, 2, 'orange1');
  return c;
}

function hqSign(): Px {
  const c = new Px(17, 8);
  c.rect(0, 1, 17, 7, 'wood4');
  c.frame(0, 1, 17, 7, 'wood0');
  glyphs(c, 'H', 4, 2, 'orange1');
  // the font's Q is too small to read, so this one is drawn by hand
  stamp(c, 8, 2, ['.oo.', 'o..o', 'o..o', 'o.oo', '.ooo']);
  c.vline(3, 0, 1, 'ink3').vline(13, 0, 1, 'ink3');
  return c;
}

/* ------------------------------------------------------------- shared office */

function printer(): Px {
  const { w, h } = PRINTER;
  const c = new Px(w, h);
  // a ream of paper and a tray on top
  c.rect(3, 0, 11, 3, 'white');
  c.hline(3, 0, 11, 'cream');
  c.hline(3, 2, 11, 'ink4');
  // scanner lid
  c.rect(1, 3, w - 2, 5, 'steel3');
  c.hline(1, 3, w - 2, 'white');
  c.hline(1, 7, w - 2, 'steel2');
  c.rect(3, 5, 12, 2, 'sky');
  // control panel with a display that says what everyone knows
  c.rect(1, 8, w - 2, 8, 'steel1');
  c.hline(1, 8, w - 2, 'steel2');
  c.rect(3, 9, 13, 7, 'ink0');
  glyphs(c, 'JAM', 4, 10, 'pink');
  c.set(18, 10, 'green2').set(20, 10, 'orange2').set(18, 13, 'berry1').set(20, 13, 'steel3');
  // body, output slot, a sheet that is not going anywhere
  c.rect(1, 16, w - 2, 6, 'steel2');
  c.hline(1, 16, w - 2, 'steel0');
  c.rect(4, 18, 16, 2, 'ink1');
  c.rect(6, 19, 7, 4, 'white');
  c.hline(6, 19, 7, 'cream');
  c.set(8, 21, 'ink4').set(11, 22, 'ink4');
  // paper drawers
  c.rect(1, 22, w - 2, 4, 'steel1');
  c.hline(1, 22, w - 2, 'steel0');
  c.hline(8, 24, 8, 'steel3');
  c.vline(w - 2, 3, h - 3, 'steel1');
  return c.crop(0, 0, w, h);
}

/** A motivational poster. The mountain is doing its best. */
function poster(): Px {
  const c = new Px(14, 17);
  c.rect(0, 0, 14, 17, 'cream');
  c.frame(0, 0, 14, 17, 'wood1');
  c.rect(2, 2, 10, 8, 'sky');
  c.rect(2, 7, 10, 3, 'blue2');
  c.rect(4, 4, 6, 6, 'steel2');
  c.rect(6, 3, 2, 2, 'steel3');
  c.set(6, 3, 'white').set(7, 3, 'white');
  c.rect(9, 3, 2, 2, 'orange2');
  glyphs(c, 'GO', 3, 11, 'ink1');
  c.hline(3, 16, 8, 'wood3');
  return c;
}

function extinguisher(): Px {
  const c = new Px(6, 12);
  c.rect(1, 3, 4, 9, 'berry1');
  c.vline(1, 3, 9, 'pink');
  c.vline(4, 3, 9, 'berry0');
  c.rect(2, 6, 2, 3, 'white');
  c.rect(1, 1, 4, 2, 'steel1');
  c.set(5, 1, 'ink0').set(5, 2, 'ink0');
  c.set(0, 3, 'ink0').set(0, 4, 'ink0').set(1, 5, 'ink0');
  return c.halo('ink0');
}

/** Passive aggression, in marker. */
function stickyNote(): Px {
  const c = new Px(6, 6);
  c.rect(0, 0, 6, 6, 'yellow');
  c.hline(0, 5, 6, 'orange3');
  c.hline(1, 1, 4, 'orange1');
  c.hline(1, 3, 3, 'orange1');
  return c.halo('ink0');
}

/* ------------------------------------------------------------------- the loft */

/** Festoon lights swagged along the brick, bulbs warm, brick warmer under each. */
function stringLights(c: Px, x0: number, x1: number, y: number): void {
  const seg = 36;
  for (let sx = x0; sx < x1; sx += seg) {
    const sw = Math.min(seg, x1 - sx);
    let last = y;
    for (let i = 0; i <= sw; i++) {
      const t = i / seg;
      const yy = y + Math.round(3 * Math.sin(Math.PI * t));
      c.set(sx + i, yy, 'ink0');
      if (i > 0 && Math.abs(yy - last) > 1) c.set(sx + i, Math.floor((yy + last) / 2), 'ink0');
      last = yy;
      if (i % 9 === 4) {
        c.set(sx + i, yy + 1, 'yellow');
        c.set(sx + i, yy + 2, 'orange2');
        for (const [gx, gy] of [[-1, 1], [1, 1], [0, 3]] as const) {
          const gc = c.get(sx + i + gx, yy + gy);
          if (gc === ink('brick1') || gc === ink('brick0')) c.set(sx + i + gx, yy + gy, 'brick2');
        }
      }
    }
  }
}

/** Spray paint on the brick: the wall was not found. */
function graffiti(): Px {
  const t = new Px(11, 5);
  glyphs(t, '404', 0, 0, 'white');
  const c = new Px(26, 17);
  for (const [ox, oy, col] of [[3, 3, 'berry1'], [2, 2, 'white']] as const) {
    for (let y = 0; y < 5; y++) for (let x = 0; x < 11; x++) if (t.get(x, y) !== 0) c.rect(ox + x * 2, oy + y * 2, 2, 2, col);
  }
  c.vline(4, 12, 4, 'white').vline(12, 12, 2, 'white').vline(19, 12, 3, 'pink');
  c.set(4, 16, 'white');
  return c;
}

/** Warms the brick around a neon sign, a dithered ring that fades out. */
function neonGlow(c: Px, x: number, y: number, w: number, h: number): void {
  for (let yy = y - 4; yy < y + h + 4; yy++) {
    for (let xx = x - 4; xx < x + w + 4; xx++) {
      const dx = xx < x ? x - xx : xx >= x + w ? xx - (x + w - 1) : 0;
      const dy = yy < y ? y - yy : yy >= y + h ? yy - (y + h - 1) : 0;
      const d = Math.max(dx, dy);
      if (d === 0 || d > 4) continue;
      const cur = c.get(xx, yy);
      if (cur === ink('brick1') && (d <= 2 || (xx + yy) % 2 === 0)) c.set(xx, yy, 'brick2');
      else if (cur === ink('brick0') && d <= 2) c.set(xx, yy, 'brick1');
    }
  }
}

/* ------------------------------------------------------------------ the tower */

/** The elevator bay: a solid panel at the left end of the glass wall. */
function elevatorBay(c: Px): void {
  c.rect(0, 0, 29, WALL_H, 'ink1');
  c.rect(0, 0, 29, 3, 'ink2');
  c.hline(0, 3, 29, 'ink0');
  c.vline(28, 0, WALL_H, 'ink0');
  c.vline(27, 3, WALL_H - 3, 'ink2');
  c.rect(0, 45, 29, 3, 'steel1');
  c.hline(0, 45, 29, 'steel3');
  c.hline(0, 47, 29, 'steel0');
  // call buttons
  c.rect(22, 22, 4, 8, 'steel1');
  c.frame(22, 22, 4, 8, 'ink0');
  c.set(23, 24, 'yellow').set(24, 24, 'orange3').set(23, 27, 'steel3').set(24, 27, 'steel3');
}

/** Everything the back wall needs for this look, drawn on top of the plain wall. */
function drawWall(c: Px, look: RoomLook, W: number): void {
  const wall = look.wall;
  if (wall === 'plank') {
    c.blit(pegboard(), PEG.x, PEG.y);
    for (const wx of look.windows) c.blit(windowGarage(), wx, WINDOW_Y);
    c.blit(garageDoor(), GARAGE.x, GARAGE.y);
    c.blit(tires(), GARAGE.x + GARAGE.w - 17, WALL_H - 14);
    c.blit(hqSign(), GARAGE.x + 7, 2);
    c.blit(doorWood(), DOOR.x, WALL_H - DOOR.h);
  } else if (wall === 'cream') {
    look.windows.forEach((wx, i) => c.blit(windowBlinds(i === 0 ? 14 : i === 1 ? 6 : 0), wx, WINDOW_Y));
    c.blit(exitSign(), DOOR.x - 1, 1);
    c.blit(doorGlass(), DOOR.x, WALL_H - DOOR.h);
    c.blit(extinguisher(), DOOR.x + DOOR.w + 3, 34);
    const px0 = W - PRINTER.w - 3;
    c.blit(poster(), px0 + 4, 8);
    c.blit(printer(), px0, 22);
    c.blit(stickyNote(), px0 - 6, 28);
  } else if (wall === 'brick') {
    c.blit(pipes(W), 0, 3);
    for (const wx of look.windows) c.blit(windowLoft(), wx, WINDOW_Y);
    stringLights(c, 22, W - 4, 11);
    neonGlow(c, DOOR.x - 2, 0, 21, 9);
    c.blit(neonExit(), DOOR.x - 2, 0);
    c.blit(doorSteel(), DOOR.x, WALL_H - DOOR.h);
    c.blit(graffiti(), W - 38, 15);
  } else {
    elevatorBay(c);
    c.blit(elevatorIndicator(), DOOR.x + 1, 3);
    c.blit(doorElevator(), DOOR.x, WALL_H - DOOR.h);
  }
}

/** Light on the floor, mats and stains. Drawn after the floor tiles, before anything stands on them. */
function drawFloor(c: Px, look: RoomLook, W: number, H: number): void {
  const ramp = FLOOR_RAMP[look.floor];
  const y0 = WALL_H;
  if (look.wall === 'plank') {
    oilStain(c, 112, y0 + 38);
    doormat(c, DOOR.x, y0 + 2, 'orange0', 'orange1');
    for (const wx of look.windows) lightPool(c, { x: wx + 3, y: y0, w: 26, h: 38, skew: 0.55, ramp, cross: true });
    // sun under the garage door, and tire tracks leading out
    lightPool(c, { x: GARAGE.x + 3, y: y0, w: 26, h: 20, skew: 0, ramp, steps: 2 });
    c.line(GARAGE.x + 8, y0 + 4, GARAGE.x + 4, y0 + 20, 'steel1');
    c.line(GARAGE.x + 14, y0 + 4, GARAGE.x + 11, y0 + 20, 'steel1');
  } else if (look.wall === 'cream') {
    doormat(c, DOOR.x, y0 + 2, 'teal1', 'teal2');
    look.windows.forEach((wx, i) => lightPool(c, { x: wx + 3, y: y0, w: 26, h: 40, skew: 0.5, ramp, cross: i === 2, blinds: i < 2 }));
  } else if (look.wall === 'brick') {
    doormat(c, DOOR.x, y0 + 2, 'wood1', 'wood2');
    for (const wx of look.windows) lightPool(c, { x: wx + 3, y: y0, w: 26, h: 40, skew: 0.6, ramp, cross: true });
  } else {
    doormat(c, DOOR.x, y0 + 2, 'steel0', 'steel1');
    // the polished floor holds a faint copy of the skyline
    lightPool(c, { x: 30, y: y0, w: W - 34, h: 7, skew: 0, ramp });
    const rng = new Rng(5);
    for (let i = 0; i < W / 5; i++) c.set(rng.int(32, W - 6), y0 + rng.int(1, 5), rng.chance(0.3) ? 'mint' : 'yellow');
    for (let px = 40; px < W - 40; px += 64) lightPool(c, { x: px, y: y0 + 7, w: 26, h: 34, skew: 0.6, ramp, cross: true });
  }
  void H;
}

/** The whole room back to front: wall, floor, light, windows, doors and the architecture. */
export function roomBackdrop(look: RoomLook): Px {
  const W = look.tilesW * TILE;
  const H = WALL_H + look.rows * TILE;
  const c = new Px(W, H);
  if (look.wall === 'glass') {
    c.blit(glassWall(W), 0, 0);
  } else {
    const tile = look.wall === 'plank' ? plankWall() : look.wall === 'brick' ? brickWall() : wallTile();
    for (let x = 0; x < W; x += TILE) c.blit(tile, x, 0);
  }
  for (let y = 0; y < look.rows; y++) {
    for (let x = 0; x < look.tilesW; x++) {
      const v = (x * 3 + y * 5) % 7;
      const t =
        look.floor === 'concrete'
          ? concreteTile(v)
          : look.floor === 'carpet'
            ? cubicleCarpetTile(v % 3, (x + y) % 2 === 1)
            : look.floor === 'wood'
              ? woodTile(v % 3)
              : slateTile(v);
      c.blit(t, x * TILE, WALL_H + y * TILE);
    }
  }
  drawFloor(c, look, W, H);
  drawWall(c, look, W);
  return c;
}
