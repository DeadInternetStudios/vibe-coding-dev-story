/**
 * Big backdrops: the night city behind the title and the loading screens.
 * Seeded, so the same city comes out every run.
 */
import { Px, type InkName } from '../pixel';
import { Rng } from '../../sim/rng';
import { glyphs } from '../glyphs';

/** Banded night sky, dark at the top, plum and orange glow at the horizon, with dithered seams. */
export function nightSky(w: number, h: number): Px {
  const c = new Px(w, h);
  const bands: InkName[] = ['ink0', 'ink1', 'violet0', 'violet1', 'berry0', 'orange0'];
  const bh = Math.ceil(h / bands.length);
  bands.forEach((b, i) => {
    c.rect(0, i * bh, w, bh, b);
    const next = bands[i + 1];
    if (next) c.dither(0, (i + 1) * bh - 2, w, 2, b, next, 'checker');
  });
  return c;
}

/** Scatter of stars as a transparent layer. */
export function stars(w: number, h: number, seed: number, count: number): Px {
  const rng = new Rng(seed);
  const c = new Px(w, h);
  for (let i = 0; i < count; i++) {
    const x = rng.int(0, w - 1);
    const y = rng.int(0, Math.floor(h * 0.6));
    const bright = rng.chance(0.2);
    c.set(x, y, bright ? 'white' : 'violet2');
    if (bright && rng.chance(0.5)) {
      c.set(x - 1, y, 'violet2');
      c.set(x + 1, y, 'violet2');
      c.set(x, y - 1, 'violet2');
      c.set(x, y + 1, 'violet2');
    }
  }
  return c;
}

export function moon(): Px {
  const c = new Px(18, 18);
  c.ellipse(8.5, 8.5, 8, 8, 'cream');
  c.ellipse(8.5, 8.5, 6, 6, 'white');
  c.set(5, 6, 'wood4').set(6, 6, 'wood4').set(10, 10, 'wood4').set(11, 10, 'wood4').set(11, 11, 'wood4').set(6, 11, 'wood4');
  c.dither(2, 8, 14, 8, 'white', 'cream', 'quarter');
  return c.halo('violet0');
}

/**
 * A row of buildings. `layer` 0 is far and dark, 1 is near and brighter with lit windows.
 * The strip is `h` tall and buildings stand on its bottom edge.
 */
export function skyline(w: number, h: number, seed: number, layer: 0 | 1): Px {
  const rng = new Rng(seed);
  const c = new Px(w, h);
  const wall: InkName = layer === 0 ? 'violet0' : 'ink1';
  const edge: InkName = layer === 0 ? 'violet1' : 'ink2';
  let x = -rng.int(0, 6);
  while (x < w) {
    const bw = rng.int(layer === 0 ? 10 : 14, layer === 0 ? 22 : 30);
    const bh = rng.int(Math.floor(h * 0.35), Math.floor(h * (layer === 0 ? 0.8 : 0.95)));
    const top = h - bh;
    c.rect(x, top, bw, bh, wall);
    c.hline(x, top, bw, edge);
    c.vline(x, top, bh, edge);
    // roof clutter
    if (rng.chance(0.5)) c.rect(x + rng.int(1, bw - 4), top - 2, 2, 2, wall);
    if (rng.chance(0.25)) {
      const ax = x + rng.int(2, bw - 3);
      c.vline(ax, top - 5, 5, edge);
      if (layer === 1) c.set(ax, top - 6, 'orange2');
    }
    // windows
    if (layer === 1) {
      for (let wy = top + 3; wy < h - 2; wy += 4) {
        for (let wx = x + 2; wx < x + bw - 2; wx += 3) {
          const lit = rng.chance(0.38);
          c.set(wx, wy, lit ? (rng.chance(0.25) ? 'mint' : 'yellow') : 'ink2');
          if (lit && rng.chance(0.5)) c.set(wx, wy + 1, 'orange3');
        }
      }
    } else {
      for (let wy = top + 3; wy < h - 2; wy += 5) for (let wx = x + 2; wx < x + bw - 2; wx += 4) if (rng.chance(0.2)) c.set(wx, wy, 'violet1');
    }
    x += bw + rng.int(0, 2);
  }
  return c;
}

/** A tall building with a billboard on the roof, so the skyline has one thing to look at. */
function landmark(h: number): Px {
  const bw = 28;
  const signH = 17;
  const c = new Px(bw, h + signH);
  const top = signH;
  c.rect(0, top, bw, h, 'ink1');
  c.hline(0, top, bw, 'ink2');
  c.vline(0, top, h, 'ink2');
  const rng = new Rng(77);
  let row = 0;
  for (let wy = top + 4; wy < top + h - 4; wy += 5, row++) {
    for (let wx = 3; wx < bw - 3; wx += 5) {
      const lit = rng.chance(0.4);
      c.rect(wx, wy, 3, 2, lit ? (rng.chance(0.2) ? 'mint' : 'yellow') : 'ink2');
    }
  }
  // the one window that is still lit at 3am: blue monitor glow and a head
  c.rect(13, top + 14, 3, 2, 'blue2');
  c.set(14, top + 14, 'ink0');
  // billboard on two posts
  c.vline(5, 9, signH - 9, 'ink3').vline(bw - 6, 9, signH - 9, 'ink3');
  c.rect(1, 0, bw - 2, 10, 'ink0');
  c.rect(2, 1, bw - 4, 8, 'teal1');
  c.hline(2, 1, bw - 4, 'teal2');
  glyphs(c, 'LGTM', 6, 3, 'mint');
  // a red light on the corner, for planes
  c.set(bw - 1, top - 1, 'berry1');
  return c;
}

/** A taxi, parked with its light on, because it is that kind of city. */
function taxi(): Px {
  const c = new Px(14, 6);
  c.rect(0, 2, 14, 3, 'yellow');
  c.rect(3, 0, 7, 2, 'yellow');
  c.rect(4, 1, 2, 1, 'sky').rect(7, 1, 2, 1, 'sky');
  c.hline(0, 4, 14, 'orange3');
  c.rect(6, 0, 2, 1, 'orange1');
  c.set(13, 3, 'white').set(0, 3, 'berry1');
  c.rect(2, 5, 3, 1, 'ink0').rect(9, 5, 3, 1, 'ink0');
  return c.halo('ink0');
}

/** A street lamp: a bright head with a halo, and a pool of light on the road. */
function lamp(c: Px, x: number, groundY: number): void {
  const head = groundY - 15;
  c.vline(x, head, 15, 'ink3');
  c.hline(x - 3, head - 1, 4, 'ink3');
  c.rect(x - 5, head, 4, 2, 'yellow');
  for (const [dx, dy] of [[-6, 0], [-6, 1], [0, 0], [0, 1], [-4, -1], [-3, -1], [-4, 2], [-3, 2]] as const) c.set(x + dx, head + dy, 'orange3');
  c.hline(x - 9, groundY + 1, 10, 'orange0');
  c.hline(x - 7, groundY + 2, 6, 'orange0');
}

/**
 * The whole night in one picture for behind the office room: sky, stars, moon, a far and a
 * near skyline, one billboard, a taxi and a street with lamps. `w` and `h` are the screen.
 */
export function nightCity(w: number, h: number): Px {
  const c = nightSky(w, h);
  c.blit(stars(w, h, 3, Math.floor((w * h) / 420)), 0, 0);
  c.blit(stars(w, h, 9, Math.floor((w * h) / 520)), 0, 0);
  c.blit(moon(), w - 44, Math.max(4, Math.round(h * 0.09)));
  const street = 8;
  const farH = Math.round(h * 0.34);
  const nearH = Math.round(h * 0.22);
  c.blit(skyline(w, farH, 21, 0), 0, h - street - farH - 8);
  const lmH = Math.round(h * 0.4);
  c.blit(landmark(lmH), Math.round(w * 0.12), h - street - lmH - 17 - 2);
  c.blit(skyline(w, nearH, 5, 1), 0, h - street - nearH);
  // the street
  c.rect(0, h - street, w, street, 'ink0');
  c.hline(0, h - street, w, 'ink2');
  for (let x = 4; x < w; x += 12) c.hline(x, h - 3, 6, 'orange3');
  for (let x = 70; x < w - 20; x += 150) lamp(c, x, h - street);
  c.blit(taxi(), Math.round(w * 0.62), h - street - 3);
  return c;
}
