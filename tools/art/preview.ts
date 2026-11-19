/**
 * Renders sprite groups from src/art/catalog.ts to PNG contact sheets so they
 * can be looked at (the Read tool opens images). Nothing here makes sound or
 * opens a window.
 *
 *   npx tsx tools/art/preview.ts <group> [--zoom 6] [--bg plum] [--cols 8] [--names a,b] [--label] [--out file]
 *   npx tsx tools/art/preview.ts list
 *
 * --bg      plum | cream | checker | both | any palette color name | #rrggbb.
 *           `both` stacks one sheet on cream paper over one on plum ink, the two
 *           surfaces the UI really uses.
 * --label   writes each sprite's name under it. `--label idx` writes its number.
 * --names   only these sprites, in this order.
 *
 * Writes tools/art/out/<group>.png and prints the order of the sprites.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { CATALOG } from '../../src/art/catalog';
import { Px, type RoleColors } from '../../src/art/pixel';
import { PALETTE, hexToRgb, type ColorName } from '../../src/art/palette';
import { drawText, textWidth } from './tinyfont';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const group = args[0];

function flag(name: string, fallback: string): string {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1]!.startsWith('--') ? args[i + 1]! : fallback;
}

if (!group || group === 'list') {
  for (const [g, items] of Object.entries(CATALOG)) console.log(`${g}: ${items.map((i) => i.name).join(', ')}`);
  process.exit(0);
}

const items = CATALOG[group];
if (!items) {
  console.error(`no group "${group}". groups: ${Object.keys(CATALOG).join(', ')}`);
  process.exit(1);
}

const zoom = Number(flag('zoom', '6'));
const bg = flag('bg', 'plum');
const cols = Number(flag('cols', '0'));
const only = flag('names', '');
const labelMode = args.includes('--label') ? flag('label', 'name') : '';
const pick = only ? only.split(',').map((n) => items.find((i) => i.name === n)).filter((i): i is NonNullable<typeof i> => !!i) : items;

const rendered = pick.map((i) => ({ name: i.name, px: i.make(), roles: i.roles }));
const LABEL_SCALE = 2;
const LABEL_H = labelMode ? 5 * LABEL_SCALE + 4 : 0;
const longest = Math.max(0, ...rendered.map((r) => (labelMode === 'idx' ? String(rendered.indexOf(r)) : r.name).length));
const labelW = labelMode ? textWidth('0'.repeat(longest), LABEL_SCALE) + 4 : 0;
const cellW = Math.max((Math.max(...rendered.map((r) => r.px.w)) + 4) * zoom, labelW);
const cellH = (Math.max(...rendered.map((r) => r.px.h)) + 4) * zoom + LABEL_H;
const perRow = cols > 0 ? cols : Math.max(1, Math.min(rendered.length, Math.floor(1000 / cellW)));
const rows = Math.ceil(rendered.length / perRow);
const W = perRow * cellW;
const H1 = rows * cellH;

type Surface = { a: readonly number[]; b: readonly number[] };

function surfaceFor(name: string): Surface {
  if (name === 'cream') return { a: hexToRgb(PALETTE.cream), b: hexToRgb(PALETTE.cream) };
  if (name === 'checker') return { a: hexToRgb('#5a4a78'), b: hexToRgb('#4d3d6b') };
  if (name === 'plum') return { a: hexToRgb(PALETTE.ink1), b: hexToRgb(PALETTE.ink1) };
  if (name.startsWith('#')) return { a: hexToRgb(name), b: hexToRgb(name) };
  if (name in PALETTE) return { a: hexToRgb(PALETTE[name as ColorName]), b: hexToRgb(PALETTE[name as ColorName]) };
  throw new Error(`unknown --bg ${name}`);
}

const surfaces = bg === 'both' ? ['cream', 'plum'] : [bg];
const H = H1 * surfaces.length;
const png = new PNG({ width: W, height: H });

function put(x: number, y: number, rgb: readonly number[]) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 4;
  png.data[o] = rgb[0]!;
  png.data[o + 1] = rgb[1]!;
  png.data[o + 2] = rgb[2]!;
  png.data[o + 3] = 255;
}

function drawPx(p: Px, sx: number, sy: number, roles?: RoleColors) {
  const data = p.rgba(roles);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const o = (y * p.w + x) * 4;
      if (data[o + 3] === 0) continue;
      const rgb = [data[o]!, data[o + 1]!, data[o + 2]!];
      for (let zy = 0; zy < zoom; zy++) for (let zx = 0; zx < zoom; zx++) put(sx + x * zoom + zx, sy + y * zoom + zy, rgb);
    }
}

surfaces.forEach((surfaceName, si) => {
  const surf = surfaceFor(surfaceName);
  const y0 = si * H1;
  const dark = surfaceName === 'plum' || surfaceName === 'checker' || surfaceName.startsWith('ink');
  const labelRgb = hexToRgb(dark ? PALETTE.cream : PALETTE.ink1);
  for (let y = 0; y < H1; y++)
    for (let x = 0; x < W; x++) {
      const cx = Math.floor(x / zoom);
      const cy = Math.floor(y / zoom);
      put(x, y0 + y, (cx + cy) % 2 === 0 ? surf.a : surf.b);
    }
  rendered.forEach((r, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const ox = col * cellW + Math.floor((cellW - r.px.w * zoom) / 2);
    const oy = y0 + row * cellH + 2 * zoom;
    drawPx(r.px, ox, oy, r.roles);
    if (labelMode) {
      const text = labelMode === 'idx' ? String(i) : r.name;
      const tx = col * cellW + Math.floor((cellW - textWidth(text, LABEL_SCALE)) / 2);
      drawText((x, y) => put(x, y, labelRgb), text, tx, y0 + row * cellH + (r.px.h + 2) * zoom + 4, LABEL_SCALE);
    }
  });
});

const outDir = resolve(here, 'out');
mkdirSync(outDir, { recursive: true });
const file = resolve(outDir, `${flag('out', group)}.png`);
writeFileSync(file, PNG.sync.write(png));
console.log(file);
console.log(rendered.map((r, i) => `${i}:${r.name}(${r.px.w}x${r.px.h})`).join(' '));
