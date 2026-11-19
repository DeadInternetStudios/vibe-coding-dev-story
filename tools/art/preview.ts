/**
 * Renders sprite groups from src/art/catalog.ts to PNG contact sheets so they
 * can be looked at (the Read tool opens images). Nothing here makes sound or
 * opens a window.
 *
 *   npx tsx tools/art/preview.ts <group> [--zoom 6] [--bg checker|plum|cream] [--cols 8] [--names a,b] [--label]
 *   npx tsx tools/art/preview.ts list
 *
 * Writes tools/art/out/<group>.png and prints the order of the sprites.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { CATALOG } from '../../src/art/catalog';
import { Px, type RoleColors } from '../../src/art/pixel';
import { PALETTE, hexToRgb } from '../../src/art/palette';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const group = args[0];

function flag(name: string, fallback: string): string {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
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
const label = args.includes('--label');
const pick = only ? items.filter((i) => only.split(',').includes(i.name)) : items;

const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
};

const rendered = pick.map((i) => ({ name: i.name, px: i.make(), roles: i.roles }));
const cellW = Math.max(...rendered.map((r) => r.px.w)) + 4;
const cellH = Math.max(...rendered.map((r) => r.px.h)) + (label ? 10 : 4);
const perRow = cols > 0 ? cols : Math.max(1, Math.min(rendered.length, Math.floor(900 / (cellW * zoom))));
const rows = Math.ceil(rendered.length / perRow);
const W = perRow * cellW * zoom;
const H = rows * cellH * zoom;
const png = new PNG({ width: W, height: H });

const bgA = hexToRgb(bg === 'cream' ? PALETTE.cream : bg === 'checker' ? '#5a4a78' : PALETTE.ink1);
const bgB = hexToRgb(bg === 'cream' ? PALETTE.wood4 : bg === 'checker' ? '#4d3d6b' : PALETTE.ink1);

function put(x: number, y: number, rgb: readonly number[]) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 4;
  png.data[o] = rgb[0]!;
  png.data[o + 1] = rgb[1]!;
  png.data[o + 2] = rgb[2]!;
  png.data[o + 3] = 255;
}

for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const cx = Math.floor(x / zoom);
  const cy = Math.floor(y / zoom);
  put(x, y, (cx + cy) % 2 === 0 ? bgA : bgB);
}

function drawPx(p: Px, ox: number, oy: number, roles?: RoleColors) {
  const data = p.rgba(roles);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const o = (y * p.w + x) * 4;
    if (data[o + 3] === 0) continue;
    for (let zy = 0; zy < zoom; zy++) for (let zx = 0; zx < zoom; zx++) {
      put((ox + x) * zoom + zx, (oy + y) * zoom + zy, [data[o]!, data[o + 1]!, data[o + 2]!]);
    }
  }
}

function drawNumber(n: number, ox: number, oy: number) {
  const s = String(n);
  const dots: Px = new Px(s.length * 4, 5);
  for (let k = 0; k < s.length; k++) {
    const g = DIGITS[s[k]!]!;
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (g[y]![x] === '1') dots.set(k * 4 + x, y, 'white');
  }
  drawPx(dots, ox, oy);
}

rendered.forEach((r, i) => {
  const col = i % perRow;
  const row = Math.floor(i / perRow);
  const ox = col * cellW + 2;
  const oy = row * cellH + 2;
  drawPx(r.px, ox, oy, r.roles);
  if (label) drawNumber(i, ox, oy + r.px.h + 2);
});

const outDir = resolve(here, 'out');
mkdirSync(outDir, { recursive: true });
const file = resolve(outDir, `${flag('out', group)}.png`);
writeFileSync(file, PNG.sync.write(png));
console.log(file);
console.log(rendered.map((r, i) => `${i}:${r.name}(${r.px.w}x${r.px.h})`).join(' '));
