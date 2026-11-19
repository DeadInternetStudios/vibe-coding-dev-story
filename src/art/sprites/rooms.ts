/**
 * Backdrops for the four offices: floor, wall, windows, and the one or two
 * pieces of architecture that make each place feel different.
 */
import { Px } from '../pixel';
import { Rng } from '../../sim/rng';
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
  if (variant % 5 === 2) {
    // oil stain
    c.ellipse(8, 8, 4, 3, 'steel0');
    c.ellipse(7, 7, 2, 1, 'steel1');
  }
  if (variant % 7 === 3) {
    c.line(2, 14, 10, 4, 'steel1');
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

/** Plywood panel wall for the garage, with a pegboard strip. */
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

/** The whole room back to front: wall, windows, floor, architecture. */
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
      const t = look.floor === 'concrete' ? concreteTile(v) : look.floor === 'carpet' ? carpetTile(v % 3) : look.floor === 'wood' ? woodTile(v % 3) : slateTile(v);
      c.blit(t, x * TILE, WALL_H + y * TILE);
    }
  }
  if (look.wall !== 'glass') for (const wx of look.windows) c.blit(windowCity(), wx, 7);
  if (look.wall === 'brick') c.blit(pipes(W), 0, 3);
  if (look.wall === 'plank') {
    // pegboard with outlines of tools
    const px0 = 8;
    c.rect(px0, 12, 40, 18, 'wood3');
    c.frame(px0, 12, 40, 18, 'wood1');
    for (let x = px0 + 3; x < px0 + 38; x += 4) for (let y = 15; y < 28; y += 4) c.set(x, y, 'wood1');
    c.rect(px0 + 6, 16, 2, 9, 'steel2');
    c.rect(px0 + 14, 16, 6, 2, 'steel1');
    c.rect(px0 + 26, 15, 3, 10, 'orange1');
  }
  return c;
}
