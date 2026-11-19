/**
 * A tiny pixel canvas. Pixels hold palette indexes, not colors, so a sprite can
 * be drawn once and baked in any outfit: role pixels (skin, hair, shirt...)
 * resolve to whatever colors the baker passes in. No DOM in here, so the
 * same code runs in the game and in the Node preview tool.
 */
import { COLOR_NAMES, PALETTE, ROLE_NAMES, hexToRgb, type ColorName, type RoleName } from './palette';

/** Palette index. 0 is clear, 1..N are palette colors, 100+ are role colors. */
export type Ink = number;
export const CLEAR: Ink = 0;
const COLOR_BASE = 1;
const ROLE_BASE = 100;

const COLOR_INDEX = new Map<string, number>(COLOR_NAMES.map((n, i) => [n, COLOR_BASE + i]));
const ROLE_INDEX = new Map<string, number>(ROLE_NAMES.map((n, i) => [n, ROLE_BASE + i]));

export type InkName = ColorName | RoleName | 'clear';

export function ink(name: InkName): Ink {
  if (name === 'clear') return CLEAR;
  const c = COLOR_INDEX.get(name);
  if (c !== undefined) return c;
  const r = ROLE_INDEX.get(name);
  if (r !== undefined) return r;
  throw new Error(`unknown ink: ${name}`);
}

export function inkName(i: Ink): string {
  if (i === CLEAR) return 'clear';
  if (i >= ROLE_BASE) return ROLE_NAMES[i - ROLE_BASE] ?? `role${i}`;
  return COLOR_NAMES[i - COLOR_BASE] ?? `color${i}`;
}

export type RoleColors = Partial<Record<RoleName, string>>;

/** Neutral role colors for sprites baked without an outfit. */
export const DEFAULT_ROLES: Record<RoleName, string> = {
  skinL: PALETTE.skin4,
  skin: PALETTE.skin3,
  skinD: PALETTE.skin2,
  hairL: PALETTE.wood2,
  hair: PALETTE.wood1,
  hairD: PALETTE.wood0,
  shirtL: PALETTE.orange3,
  shirt: PALETTE.orange1,
  shirtD: PALETTE.orange0,
  pantsL: PALETTE.steel1,
  pants: PALETTE.steel0,
  pantsD: PALETTE.ink1,
  accL: PALETTE.mint,
  acc: PALETTE.teal2,
  accD: PALETTE.teal0,
  shoe: PALETTE.ink1,
};

export type Legend = Record<string, InkName>;

/** Letters every sprite sheet shares. A sprite may override or extend them. */
export const BASE_LEGEND: Legend = {
  '.': 'clear',
  ' ': 'clear',
  k: 'ink0',
  K: 'ink1',
  i: 'ink2',
  g: 'ink3',
  G: 'ink4',
  W: 'ink5',
  w: 'white',
  s: 'skin',
  S: 'skinD',
  l: 'skinL',
  h: 'hair',
  H: 'hairD',
  j: 'hairL',
  t: 'shirt',
  T: 'shirtD',
  y: 'shirtL',
  p: 'pants',
  P: 'pantsD',
  q: 'pantsL',
  a: 'acc',
  A: 'accD',
  e: 'accL',
  o: 'shoe',
};

export class Px {
  readonly d: Uint8Array;

  constructor(
    readonly w: number,
    readonly h: number,
    d?: Uint8Array,
  ) {
    this.d = d ?? new Uint8Array(w * h);
  }

  /** Build from rows of letters. All rows must be the same length. */
  static fromRows(rows: readonly string[], legend: Legend = {}): Px {
    const h = rows.length;
    const w = rows[0]?.length ?? 0;
    const map = { ...BASE_LEGEND, ...legend };
    const p = new Px(w, h);
    for (let y = 0; y < h; y++) {
      const row = rows[y]!;
      if (row.length !== w) {
        throw new Error(`row ${y} has ${row.length} columns, expected ${w}: "${row}"`);
      }
      for (let x = 0; x < w; x++) {
        const ch = row[x]!;
        const name = map[ch];
        if (name === undefined) throw new Error(`no legend for "${ch}" at ${x},${y}`);
        p.d[y * w + x] = ink(name);
      }
    }
    return p;
  }

  clone(): Px {
    return new Px(this.w, this.h, this.d.slice());
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): Ink {
    return this.inside(x, y) ? this.d[y * this.w + x]! : CLEAR;
  }

  set(x: number, y: number, c: Ink | InkName): this {
    if (this.inside(x, y)) this.d[y * this.w + x] = typeof c === 'number' ? c : ink(c);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: Ink | InkName): this {
    const v = typeof c === 'number' ? c : ink(c);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, v);
    return this;
  }

  /** One pixel outline of a rectangle. */
  frame(x: number, y: number, w: number, h: number, c: Ink | InkName): this {
    this.hline(x, y, w, c).hline(x, y + h - 1, w, c).vline(x, y, h, c).vline(x + w - 1, y, h, c);
    return this;
  }

  hline(x: number, y: number, w: number, c: Ink | InkName): this {
    return this.rect(x, y, w, 1, c);
  }

  vline(x: number, y: number, h: number, c: Ink | InkName): this {
    return this.rect(x, y, 1, h, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Ink | InkName): this {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.set(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
    return this;
  }

  /** Filled ellipse centered on a pixel center. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Ink | InkName): this {
    const v = typeof c === 'number' ? c : ink(c);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / (rx + 0.35);
        const ny = (y - cy) / (ry + 0.35);
        if (nx * nx + ny * ny <= 1) this.set(x, y, v);
      }
    }
    return this;
  }

  /** Checker or other ordered dither of two inks over a rectangle. */
  dither(x: number, y: number, w: number, h: number, a: Ink | InkName, b: Ink | InkName, kind: 'checker' | 'quarter' | 'rows' = 'checker'): this {
    const va = typeof a === 'number' ? a : ink(a);
    const vb = typeof b === 'number' ? b : ink(b);
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        let useB: boolean;
        if (kind === 'checker') useB = (xx + yy) % 2 === 1;
        else if (kind === 'rows') useB = yy % 2 === 1;
        else useB = xx % 2 === 1 && yy % 2 === 1;
        this.set(x + xx, y + yy, useB ? vb : va);
      }
    }
    return this;
  }

  /** Copy another canvas on top. Clear pixels in the source are skipped. */
  blit(src: Px, x: number, y: number, opts: { flipX?: boolean } = {}): this {
    for (let sy = 0; sy < src.h; sy++) {
      for (let sx = 0; sx < src.w; sx++) {
        const v = src.d[sy * src.w + (opts.flipX ? src.w - 1 - sx : sx)]!;
        if (v !== CLEAR) this.set(x + sx, y + sy, v);
      }
    }
    return this;
  }

  /** Replace one ink with another everywhere. */
  swap(from: Ink | InkName, to: Ink | InkName): this {
    const f = typeof from === 'number' ? from : ink(from);
    const t = typeof to === 'number' ? to : ink(to);
    for (let i = 0; i < this.d.length; i++) if (this.d[i] === f) this.d[i] = t;
    return this;
  }

  flipX(): Px {
    const p = new Px(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.d[y * this.w + x] = this.d[y * this.w + (this.w - 1 - x)]!;
    return p;
  }

  crop(x: number, y: number, w: number, h: number): Px {
    const p = new Px(w, h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) p.d[yy * w + xx] = this.get(x + xx, y + yy);
    return p;
  }

  /** A copy with transparent margins added. */
  pad(l: number, t: number, r: number, b: number): Px {
    const p = new Px(this.w + l + r, this.h + t + b);
    p.blit(this, l, t);
    return p;
  }

  /**
   * Draws a 1 pixel outline around every opaque shape, outside it. The result
   * is 2 pixels wider and taller. With `inner`, pixels that touch clear space
   * inside the sprite stay as they are.
   */
  outline(c: Ink | InkName, opts: { corners?: boolean } = {}): Px {
    const v = typeof c === 'number' ? c : ink(c);
    const src = this.pad(1, 1, 1, 1);
    const out = src.clone();
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        if (src.d[y * src.w + x] !== CLEAR) continue;
        let touch = src.get(x - 1, y) !== CLEAR || src.get(x + 1, y) !== CLEAR || src.get(x, y - 1) !== CLEAR || src.get(x, y + 1) !== CLEAR;
        if (!touch && opts.corners) {
          touch = src.get(x - 1, y - 1) !== CLEAR || src.get(x + 1, y - 1) !== CLEAR || src.get(x - 1, y + 1) !== CLEAR || src.get(x + 1, y + 1) !== CLEAR;
        }
        if (touch) out.d[y * src.w + x] = v;
      }
    }
    return out;
  }

  /**
   * Same as `outline` but keeps the canvas size: clear pixels that touch an
   * opaque one become the outline color. The sprite needs a clear margin.
   */
  halo(c: Ink | InkName, opts: { corners?: boolean } = {}): Px {
    const v = typeof c === 'number' ? c : ink(c);
    const out = this.clone();
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.d[y * this.w + x] !== CLEAR) continue;
        let touch = this.get(x - 1, y) !== CLEAR || this.get(x + 1, y) !== CLEAR || this.get(x, y - 1) !== CLEAR || this.get(x, y + 1) !== CLEAR;
        if (!touch && opts.corners) {
          touch = this.get(x - 1, y - 1) !== CLEAR || this.get(x + 1, y - 1) !== CLEAR || this.get(x - 1, y + 1) !== CLEAR || this.get(x + 1, y + 1) !== CLEAR;
        }
        if (touch) out.d[y * this.w + x] = v;
      }
    }
    return out;
  }

  /** Lighten or darken by moving every pixel one step along a ramp of inks. */
  ramp(steps: readonly (Ink | InkName)[], delta: number): this {
    const list = steps.map((s) => (typeof s === 'number' ? s : ink(s)));
    for (let i = 0; i < this.d.length; i++) {
      const at = list.indexOf(this.d[i]!);
      if (at >= 0) this.d[i] = list[Math.max(0, Math.min(list.length - 1, at + delta))]!;
    }
    return this;
  }

  count(c: Ink | InkName): number {
    const v = typeof c === 'number' ? c : ink(c);
    let n = 0;
    for (let i = 0; i < this.d.length; i++) if (this.d[i] === v) n++;
    return n;
  }

  /** Resolve to RGBA bytes. Roles come from `roles`, then the defaults. */
  rgba(roles: RoleColors = {}): Uint8ClampedArray {
    const out = new Uint8ClampedArray(this.w * this.h * 4);
    const lut = new Map<number, [number, number, number]>();
    const resolve = (v: number): [number, number, number] => {
      let hit = lut.get(v);
      if (!hit) {
        if (v >= ROLE_BASE) {
          const name = ROLE_NAMES[v - ROLE_BASE]!;
          hit = hexToRgb(roles[name] ?? DEFAULT_ROLES[name]);
        } else {
          hit = hexToRgb(PALETTE[COLOR_NAMES[v - COLOR_BASE]!]);
        }
        lut.set(v, hit);
      }
      return hit;
    };
    for (let i = 0; i < this.d.length; i++) {
      const v = this.d[i]!;
      if (v === CLEAR) continue;
      const [r, g, b] = resolve(v);
      out[i * 4] = r;
      out[i * 4 + 1] = g;
      out[i * 4 + 2] = b;
      out[i * 4 + 3] = 255;
    }
    return out;
  }
}

/** Convenience: `px(['..k..', ...], { x: 'orange1' })`. */
export function px(rows: readonly string[], legend: Legend = {}): Px {
  return Px.fromRows(rows, legend);
}
