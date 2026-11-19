/**
 * The wordmark: VIBE CODING on top in tomato orange, DEV [laptop] STORY below it in
 * teal. Chunky block letters from a 5 x 6 grid, each cell three pixels, lit from the
 * top left and pushed out two pixels so they stand on the page like arcade cabinet art.
 *
 * Jokes: a heart lives in the O of CODING, a bug lives in the D of DEV, and the laptop
 * has the one idea it will ever have on its screen.
 */
import { Px, type InkName } from '../pixel';
import { art } from './draw';
import { fxPx } from './fx';

/** 5 x 6 letters, '#' is paint. */
const LETTERS: Record<string, readonly string[]> = {
  V: ['#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '#####'],
  B: ['####.', '#...#', '####.', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '####.', '#....', '#....', '#####'],
  C: ['.####', '#....', '#....', '#....', '#....', '.####'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '####.'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  G: ['.####', '#....', '#.###', '#...#', '#...#', '.###.'],
  S: ['.####', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..'],
  R: ['####.', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..'],
};

const CELL = 3;
const SPACING = 2;
const ADVANCE = 5 * CELL + SPACING;
const DEPTH = 2;

interface Paint {
  shine: InkName;
  light: InkName;
  mid: InkName;
  dark: InkName;
  side: InkName;
}

const ORANGE: Paint = { shine: 'yellow', light: 'orange3', mid: 'orange2', dark: 'orange1', side: 'orange0' };
const TEAL: Paint = { shine: 'white', light: 'mint', mid: 'teal2', dark: 'teal1', side: 'teal0' };

/** Where each letter of `text` starts, with `gap` pixels for a space, and the width of the whole. */
function layout(text: string, gap: number): { xs: (number | null)[]; w: number } {
  let x = 0;
  const xs = [...text].map((ch) => {
    if (ch === ' ') {
      x += gap;
      return null;
    }
    const at = x;
    x += ADVANCE;
    return at;
  });
  return { xs, w: x - SPACING };
}

/** Top and left edges catch the light, bottom and right edges fall into shade. */
function paint(mask: Px, p: Paint): Px {
  const out = new Px(mask.w, mask.h);
  const on = (x: number, y: number) => mask.get(x, y) !== 0;
  for (let y = 0; y < mask.h; y++) {
    for (let x = 0; x < mask.w; x++) {
      if (!on(x, y)) continue;
      const lit = !on(x, y - 1) || !on(x - 1, y);
      const shaded = !on(x, y + 1) || !on(x + 1, y);
      out.set(x, y, lit && !shaded ? p.light : shaded && !lit ? p.dark : p.mid);
    }
  }
  return out;
}

/** Letters pushed out `DEPTH` pixels, with an ink outline all around. */
function block(face: Px, side: InkName): Px {
  const out = new Px(face.w, face.h + DEPTH);
  const flat = new Px(face.w, face.h);
  for (let y = 0; y < face.h; y++) for (let x = 0; x < face.w; x++) if (face.get(x, y) !== 0) flat.set(x, y, side);
  for (let d = DEPTH; d >= 1; d--) out.blit(flat, 0, d);
  return out.blit(face, 0, 0).outline('ink0');
}

/** Block letters for `text`. `inside` maps a letter's index to a small picture that lives in its counter. */
function word(text: string, p: Paint, gap: number, inside: Record<number, Px> = {}): Px {
  const { xs, w } = layout(text, gap);
  const mask = new Px(w, 6 * CELL);
  [...text].forEach((ch, i) => {
    const x0 = xs[i];
    if (x0 === null || x0 === undefined) return;
    LETTERS[ch]!.forEach((row, gy) => [...row].forEach((c, gx) => c === '#' && mask.rect(x0 + gx * CELL, gy * CELL, CELL, CELL, 'white')));
  });
  const face = paint(mask, p);
  // a glint on the top left corner of every letter
  xs.forEach((x0) => {
    if (x0 === null) return;
    for (let x = x0; x < x0 + 5 * CELL; x++) {
      if (face.get(x, 0) === 0) continue;
      face.set(x, 0, p.shine).set(x + 1, 0, p.shine).set(x, 1, p.shine);
      break;
    }
  });
  const out = block(face, p.side);
  for (const [i, pic] of Object.entries(inside)) {
    // the outline adds a pixel all around, and the push-out takes the top of the counter
    out.blit(pic, xs[Number(i)]! + 1 + Math.floor((5 * CELL - pic.w) / 2), 1 + Math.floor((6 * CELL - pic.h) / 2) + 1);
  }
  return out;
}

function heart(): Px {
  return art(['.p.r.', 'pprrr', 'rrrrR', '.rrR.', '..R..']);
}

/** A bug, because there is always one. */
function bug(): Px {
  return art(['.k.k.', '.GGG.', 'kGgGk', 'kgggk', '.k.k.']);
}

function laptop(): Px {
  const c = new Px(32, 18);
  c.rect(3, 0, 26, 13, 'steel2');
  c.hline(3, 0, 26, 'steel3');
  c.vline(3, 0, 13, 'steel3');
  c.rect(5, 2, 22, 9, 'ink1');
  c.set(15, 1, 'ink3').set(16, 1, 'ink3');
  // code on the left and right, the one idea in the middle
  c.hline(7, 4, 5, 'teal2').hline(7, 6, 3, 'orange2').hline(7, 8, 4, 'pink');
  c.hline(21, 5, 4, 'sky').hline(21, 7, 5, 'teal2').hline(22, 9, 3, 'orange2');
  c.blit(fxPx('bulbHot')!, 12, 2);
  // base
  c.rect(0, 13, 32, 4, 'steel3');
  c.hline(0, 13, 32, 'white');
  c.hline(0, 16, 32, 'steel1');
  c.hline(13, 13, 6, 'steel1');
  return c.outline('ink0');
}

export const LOGO_W = 190;
export const LOGO_H = 48;

let cache: Px | null = null;

/** The wordmark, 190 x 48. Every call returns its own copy. */
export function logoPx(): Px {
  if (!cache) {
    const c = new Px(LOGO_W, LOGO_H);
    const top = word('VIBE CODING', ORANGE, 8, { 6: heart() });
    const dev = word('DEV', TEAL, 0, { 0: bug() });
    const story = word('STORY', TEAL, 0);
    const y1 = 1;
    const y2 = y1 + top.h + 1;
    const x1 = Math.floor((LOGO_W - top.w) / 2);
    c.blit(top, x1, y1);
    c.blit(dev, x1, y2);
    c.blit(story, x1 + top.w - story.w, y2);
    // the laptop sits between DEV and STORY
    const lx = x1 + dev.w + Math.floor((top.w - dev.w - story.w - 32) / 2);
    c.blit(laptop(), lx, y2 + 2);
    c.blit(fxPx('sparkleSmall')!, 0, 0);
    c.blit(fxPx('sparkleSmall')!, LOGO_W - 5, 3);
    c.blit(fxPx('sparkleSmall')!, 1, LOGO_H - 6);
    cache = c;
  }
  return cache.clone();
}
