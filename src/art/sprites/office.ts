/**
 * The office: floors, walls, furniture. All drawn with Px primitives so the
 * lighting is consistent: light from the top left, shadows lean plum, every
 * object has a dark outline, tops are lighter than fronts.
 */
import { Px, px, type Ink, ink } from '../pixel';

export const TILE = 16;

/* -------------------------------------------------------------------- floors */

/** Office carpet: cool slate, tiny woven pattern, so warm furniture pops. */
export function carpetTile(variant = 0): Px {
  const c = new Px(TILE, TILE);
  c.rect(0, 0, TILE, TILE, 'steel1');
  // woven speckle
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const v = (x * 7 + y * 13 + variant * 5) % 11;
      if (v === 0) c.set(x, y, 'steel2');
      else if (v === 5) c.set(x, y, 'steel0');
    }
  }
  // tile seams, very faint
  c.hline(0, 0, TILE, 'steel2');
  c.vline(0, 0, TILE, 'steel2');
  c.hline(0, TILE - 1, TILE, 'steel0');
  c.vline(TILE - 1, 0, TILE, 'steel0');
  return c;
}

/** Warm wooden floor planks. */
export function woodTile(variant = 0): Px {
  const c = new Px(TILE, TILE);
  c.rect(0, 0, TILE, TILE, 'wood3');
  const seams = [0, 4, 8, 12];
  seams.forEach((y, i) => {
    c.hline(0, y + 3, TILE, 'wood2');
    const sx = (i * 5 + variant * 3 + 3) % TILE;
    c.vline(sx, y, 3, 'wood2');
    c.set(sx + 1, y, 'wood4');
    // grain
    c.set((sx + 7) % TILE, y + 1, 'wood4');
    c.set((sx + 11) % TILE, y + 2, 'wood2');
  });
  return c;
}

/* --------------------------------------------------------------------- walls */

/** A 16 x 48 slice of wall: cream paper, teal wainscot, crown molding. */
export function wallTile(): Px {
  const c = new Px(TILE, 48);
  c.rect(0, 0, TILE, 48, 'cream');
  // faint vertical stripes
  for (let x = 0; x < TILE; x += 4) c.vline(x, 4, 32, 'wood4');
  // crown molding
  c.rect(0, 0, TILE, 3, 'ink2');
  c.hline(0, 3, TILE, 'ink1');
  c.hline(0, 0, TILE, 'ink3');
  // chair rail
  c.rect(0, 33, TILE, 2, 'wood4');
  c.hline(0, 35, TILE, 'wood2');
  // teal wainscot
  c.rect(0, 36, TILE, 9, 'teal1');
  c.hline(0, 36, TILE, 'teal2');
  for (let x = 0; x < TILE; x += 8) c.vline(x, 37, 8, 'teal0');
  // baseboard
  c.rect(0, 45, TILE, 3, 'wood1');
  c.hline(0, 45, TILE, 'wood3');
  c.hline(0, 47, TILE, 'wood0');
  return c;
}

/** A window onto a sunny city, 32 x 30. */
export function windowCity(): Px {
  const w = 32;
  const h = 30;
  const c = new Px(w, h);
  c.rect(0, 0, w, h, 'ink1');
  // glass: sky to warm horizon with dither
  c.rect(2, 2, w - 4, h - 4, 'sky');
  c.rect(2, 12, w - 4, 6, 'blue2');
  c.dither(2, 12, w - 4, 2, 'sky', 'blue2');
  c.rect(2, 18, w - 4, h - 20, 'cream');
  c.dither(2, 17, w - 4, 2, 'blue2', 'cream');
  // sun
  c.rect(23, 6, 4, 4, 'yellow');
  c.set(23, 6, 'sky');
  c.set(26, 6, 'sky');
  c.set(23, 9, 'sky');
  c.set(26, 9, 'sky');
  // clouds
  c.hline(5, 7, 6, 'white');
  c.hline(7, 6, 3, 'white');
  c.hline(12, 11, 5, 'white');
  // skyline
  const b: [number, number, number, Ink][] = [
    [2, 18, 5, ink('blue1')],
    [8, 14, 6, ink('blue0')],
    [15, 19, 5, ink('blue1')],
    [21, 16, 4, ink('blue0')],
    [26, 20, 4, ink('blue1')],
  ];
  for (const [x, top, bw, col] of b) {
    c.rect(x, top, bw, h - 2 - top, col);
    for (let wy = top + 2; wy < h - 4; wy += 3) for (let wx = x + 1; wx < x + bw - 1; wx += 2) c.set(wx, wy, wy % 2 ? 'yellow' : 'orange3');
  }
  // mullions
  c.vline(15, 2, h - 4, 'ink1');
  c.vline(16, 2, h - 4, 'ink2');
  c.hline(2, 14, w - 4, 'ink1');
  // frame highlight and sill
  c.hline(0, 0, w, 'ink3');
  c.vline(0, 0, h, 'ink3');
  c.rect(0, h - 2, w, 2, 'wood3');
  c.hline(0, h - 2, w, 'wood4');
  // glass shine
  c.line(4, 4, 7, 7, 'white');
  c.line(4, 8, 5, 9, 'white');
  return c.halo('ink0');
}

/* ----------------------------------------------------------------- furniture */

/** An empty desk with a drawer pedestal, 32 x 22. Origin is the bottom center. */
export function desk(): Px {
  const w = 32;
  const h = 22;
  const c = new Px(w, h);
  // top surface (visible, lighter)
  c.rect(1, 0, w - 2, 8, 'wood4');
  c.hline(1, 0, w - 2, 'cream');
  c.hline(1, 7, w - 2, 'wood3');
  c.dither(1, 2, w - 2, 1, 'wood4', 'wood3', 'checker');
  // front lip
  c.rect(1, 8, w - 2, 2, 'wood3');
  c.hline(1, 8, w - 2, 'wood4');
  c.hline(1, 9, w - 2, 'wood2');
  // front panel
  c.rect(2, 10, w - 4, 10, 'wood2');
  c.hline(2, 10, w - 4, 'wood1');
  // drawer pedestal on the right
  c.rect(19, 11, 11, 9, 'wood3');
  c.frame(19, 11, 11, 9, 'wood1');
  c.hline(20, 15, 9, 'wood1');
  c.rect(23, 13, 3, 1, 'steel3');
  c.rect(23, 17, 3, 1, 'steel3');
  // modesty panel shading
  c.rect(3, 11, 15, 8, 'wood1');
  c.dither(3, 11, 15, 2, 'wood1', 'wood0', 'rows');
  // legs
  c.rect(2, 20, 3, 2, 'wood0');
  c.rect(w - 5, 20, 3, 2, 'wood0');
  return c.halo('ink0');
}

/** Back of a laptop lid on a desk, 14 x 11. A sticker color tells the tool apart. */
export function laptop(sticker: Ink | 'orange1' | 'teal2' | 'violet1' | 'blue1' | 'green1' | 'berry1' = 'orange1'): Px {
  const c = new Px(14, 11);
  c.rect(0, 0, 14, 9, 'steel2');
  c.hline(0, 0, 14, 'steel3');
  c.vline(0, 0, 9, 'steel3');
  c.hline(0, 8, 14, 'steel1');
  c.vline(13, 0, 9, 'steel1');
  // sticker
  c.rect(4, 2, 6, 5, sticker);
  c.hline(4, 2, 6, 'white');
  c.set(6, 4, 'white');
  c.set(7, 4, 'white');
  c.set(6, 5, 'white');
  c.set(7, 5, 'white');
  // base peeking out
  c.rect(0, 9, 14, 2, 'steel1');
  c.hline(0, 9, 14, 'steel0');
  c.hline(0, 10, 14, 'ink2');
  return c.halo('ink0');
}

/** A coffee mug, 5 x 5. */
export function mug(): Px {
  return px([
    'wwww..',
    'wooow.',
    'wooowK',
    'wooow.',
    '.www..',
  ], { o: 'orange2' }).halo('ink0');
}

/** A rubber duck, 7 x 7. */
export function duck(): Px {
  return px([
    '...yy..',
    '..yyyy.',
    '..ykyyy',
    '.rryyy.',
    'yyyyyyy',
    '.yyyyy.',
    '..yyy..',
  ], { y: 'yellow', r: 'orange2', K: 'ink1' }).halo('ink0');
}

/** A potted plant, 12 x 22. */
export function plant(): Px {
  const c = new Px(14, 24);
  // leaves
  const leaf = (x: number, y: number, w: number, h: number) => {
    c.ellipse(x, y, w / 2, h / 2, 'green1');
    c.ellipse(x - 1, y - 1, w / 3, h / 3, 'green2');
  };
  leaf(7, 5, 8, 8);
  leaf(3, 9, 6, 6);
  leaf(11, 9, 6, 6);
  leaf(5, 13, 6, 5);
  leaf(10, 13, 6, 5);
  c.vline(7, 12, 5, 'green0');
  // pot
  c.rect(3, 16, 8, 6, 'orange1');
  c.hline(2, 16, 10, 'orange2');
  c.hline(2, 17, 10, 'orange0');
  c.vline(10, 18, 4, 'orange0');
  c.hline(3, 21, 8, 'orange0');
  return c.halo('ink0');
}
