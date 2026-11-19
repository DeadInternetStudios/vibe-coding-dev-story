/**
 * Big backdrops: the night city behind the title and the loading screens.
 * Seeded, so the same city comes out every run.
 */
import { Px, type InkName } from '../pixel';
import { Rng } from '../../sim/rng';

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
