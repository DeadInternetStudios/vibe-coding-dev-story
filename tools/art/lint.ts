/**
 * Sprite hygiene rules, as code, so they run the same way every time. Pure
 * functions over `Px`, no files and no DOM. `check.ts` prints them, the vitest
 * suite next to it fails on any error.
 *
 * error: the art cannot ship (wrong size, open outline, duplicate, tiny dot).
 * warn:  look at it again (thin, few colors, stray pixel, unlined hole).
 */
import { CLEAR, Px, ink, inkName } from '../../src/art/pixel';

export interface Finding {
  sprite: string;
  level: 'error' | 'warn';
  msg: string;
}

export interface LintOpts {
  /** edges where the art is cropped on purpose, so the outline may be open there */
  openEdges?: readonly ('top' | 'bottom' | 'left' | 'right')[];
  /** lone pixels are part of the picture (sparkles, confetti) */
  allowStray?: boolean;
  /** pixels that may touch clear space without an ink0 outline (glows, highlights) */
  looseInks?: readonly string[];
  /** do not require a closed outline (backdrops, tiles, bars) */
  noOutline?: boolean;
  minColors?: number;
  minFill?: number;
}

const INK0 = ink('ink0');
const N4: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function onOpenEdge(p: Px, x: number, y: number, edges: readonly string[]): boolean {
  return (
    (edges.includes('top') && y === 0) ||
    (edges.includes('bottom') && y === p.h - 1) ||
    (edges.includes('left') && x === 0) ||
    (edges.includes('right') && x === p.w - 1)
  );
}

/** Clear pixels reachable from outside the canvas. Clear pixels not in here are holes. */
function outerClear(p: Px): Uint8Array {
  const seen = new Uint8Array(p.w * p.h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (!p.inside(x, y) || seen[y * p.w + x] || p.get(x, y) !== CLEAR) return;
    seen[y * p.w + x] = 1;
    stack.push(x, y);
  };
  for (let x = 0; x < p.w; x++) {
    push(x, 0);
    push(x, p.h - 1);
  }
  for (let y = 0; y < p.h; y++) {
    push(0, y);
    push(p.w - 1, y);
  }
  while (stack.length) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    for (const [dx, dy] of N4) push(x + dx, y + dy);
  }
  return seen;
}

export interface Exposed {
  x: number;
  y: number;
  color: string;
  /** `outer` shows the fill to the outside world, `hole` to an enclosed gap */
  kind: 'outer' | 'hole';
}

/** Pixels that show their fill: opaque, not ink0, next to clear space. */
export function exposedPixels(p: Px, o: LintOpts = {}): Exposed[] {
  const out: Exposed[] = [];
  const edges = o.openEdges ?? [];
  const outer = outerClear(p);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const v = p.get(x, y);
      if (v === CLEAR || v === INK0) continue;
      if (o.looseInks?.includes(inkName(v))) continue;
      let kind: Exposed['kind'] | null = null;
      for (const [dx, dy] of N4) {
        const nx = x + dx;
        const ny = y + dy;
        if (!p.inside(nx, ny)) {
          if (!onOpenEdge(p, x, y, edges)) kind = 'outer';
        } else if (p.get(nx, ny) === CLEAR) {
          if (outer[ny * p.w + nx]) kind = 'outer';
          else kind ??= 'hole';
        }
      }
      if (kind) out.push({ x, y, color: inkName(v), kind });
    }
  }
  return out;
}

export function strayPixels(p: Px): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (p.get(x, y) === CLEAR) continue;
      let lonely = true;
      for (let dy = -1; dy <= 1 && lonely; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && p.get(x + dx, y + dy) !== CLEAR) lonely = false;
      if (lonely) out.push({ x, y });
    }
  return out;
}

export function opaqueCount(p: Px): number {
  let n = 0;
  for (let i = 0; i < p.d.length; i++) if (p.d[i] !== CLEAR) n++;
  return n;
}

export function colorCount(p: Px): number {
  const seen = new Set<number>();
  for (let i = 0; i < p.d.length; i++) if (p.d[i] !== CLEAR) seen.add(p.d[i]!);
  return seen.size;
}

/** How many pixels differ between two sprites of the same size. */
export function distance(a: Px, b: Px): number {
  if (a.w !== b.w || a.h !== b.h) return Infinity;
  let n = 0;
  for (let i = 0; i < a.d.length; i++) if (a.d[i] !== b.d[i]) n++;
  return n;
}

/** The smallest box holding every opaque pixel. */
export function bounds(p: Px): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = p.w;
  let y0 = p.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++)
      if (p.get(x, y) !== CLEAR) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

function list(pts: { x: number; y: number; color?: string }[]): string {
  return pts
    .slice(0, 4)
    .map((e) => `${e.x},${e.y}${e.color ? ':' + e.color : ''}`)
    .join(' ') + (pts.length > 4 ? ' ...' : '');
}

export function lintSprite(name: string, p: Px, o: LintOpts = {}): Finding[] {
  const out: Finding[] = [];
  const add = (level: Finding['level'], msg: string) => out.push({ sprite: name, level, msg });
  if (opaqueCount(p) === 0) {
    add('error', 'empty sprite');
    return out;
  }
  if (!o.noOutline) {
    const ex = exposedPixels(p, o);
    const outer = ex.filter((e) => e.kind === 'outer');
    const holes = ex.filter((e) => e.kind === 'hole');
    if (outer.length > 0) add('error', `outline open at ${outer.length} pixel(s) ${list(outer)}`);
    if (holes.length > 0) add('warn', `unlined hole at ${holes.length} pixel(s) ${list(holes)}`);
  }
  if (!o.allowStray) {
    const lone = strayPixels(p);
    if (lone.length > 0) add('warn', `${lone.length} stray pixel(s) ${list(lone)}`);
  }
  const colors = colorCount(p);
  if (colors < (o.minColors ?? 3)) add('warn', `only ${colors} color(s)`);
  const fill = opaqueCount(p) / (p.w * p.h);
  if (fill < (o.minFill ?? 0.3)) add('warn', `thin: ${(fill * 100).toFixed(0)}% filled`);
  return out;
}

/** Flags every pair in a set that looks the same. `minDiff` is the fewest differing pixels allowed. */
export function lintDistinct(items: readonly { name: string; px: Px }[], minDiff: number, level: Finding['level'] = 'error'): Finding[] {
  const out: Finding[] = [];
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const d = distance(items[i]!.px, items[j]!.px);
      if (d < minDiff) out.push({ sprite: `${items[i]!.name} / ${items[j]!.name}`, level, msg: `look alike: only ${d} pixel(s) differ` });
    }
  return out;
}
