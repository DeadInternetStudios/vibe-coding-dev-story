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
import { TILE, carpetTile, wallTile, woodTile } from './office';

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

import { DOOR, GARAGE, PEG, PRINTER, WALL_H, WINDOW_W, WINDOW_Y, doorElevator, doorGlass, doorSteel, doorWood, elevatorBay, elevatorIndicator, exitSign, garageDoor, hqSign, neonExit, neonGlow, stickyNote, stringLights, windowBlinds, windowGarage, windowLoft, extinguisher, graffiti, pegboard, poster, printer, tires } from './roomFixtures';

export { DOOR, WALL_H, WINDOW_W };

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
    c.blit(poster(), px0 + 4, 5);
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
    c.blit(elevatorIndicator(), DOOR.x + 1, 1);
    c.blit(doorElevator(), DOOR.x, WALL_H - DOOR.h);
  }
}

/** Light on the floor, mats and stains. Drawn after the floor tiles, before anything stands on them. */
function drawFloor(c: Px, look: RoomLook, W: number): void {
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
  drawFloor(c, look, W);
  drawWall(c, look, W);
  return c;
}
