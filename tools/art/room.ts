/**
 * Composes an office the way src/game/room.ts does (same spots, same anchors,
 * same depth order) so decor and room art can be judged in place, in Node,
 * with no browser.
 *
 *   npx tsx tools/art/room.ts <tier 0-3> [--items all|none|id,id] [--staff 4] [--zoom 3] [--out name]
 *
 * Writes tools/art/out/room<tier>.png. `--items all` buys the whole shop, in
 * shop order, so you see what happens when the office is full.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { PALETTE, hexToRgb } from '../../src/art/palette';
import type { Px, RoleColors } from '../../src/art/pixel';
import { decorPx } from '../../src/art/sprites/decor';
import { desk as deskPx, laptop } from '../../src/art/sprites/office';
import { buildPerson, roleColorsFor, type Look } from '../../src/art/sprites/people';
import { roomBackdrop } from '../../src/art/sprites/rooms';
import { roomSpec } from '../../src/game/roomSpecs';
import { SHOP, shopItem } from '../../src/sim/shop';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

function flag(name: string, fallback: string): string {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
}

const tier = Math.max(0, Math.min(3, Number(args[0] ?? '0')));
const zoom = Number(flag('zoom', '3'));
const itemArg = flag('items', 'none');
const staffN = Number(flag('staff', '4'));
const spec = roomSpec(tier);
const ids = itemArg === 'all' ? SHOP.map((i) => i.id) : itemArg === 'none' ? [] : itemArg.split(',');

interface Layer {
  px: Px;
  roles?: RoleColors;
  x: number;
  y: number;
  depth: number;
}
const layers: Layer[] = [];
/** top left of an image of size w x h whose origin is (ox, oy) placed at (x, y) */
const at = (px: Px, x: number, y: number, ox: number, oy: number) => ({ x: Math.round(x - px.w * ox), y: Math.round(y - px.h * oy) });

layers.push({ px: roomBackdrop(spec.look), x: 0, y: 0, depth: -1000 });
const desk = deskPx();
const lap = laptop('orange1');
for (const d of spec.desks) {
  layers.push({ px: desk, ...at(desk, d.x, d.y + 22, 0, 1), depth: d.y + 22 });
  layers.push({ px: lap, ...at(lap, d.x + 9, d.y + 18, 0, 1), depth: d.y + 22.2 });
}

let floorI = 0;
let wallI = 0;
const deskItems: string[] = [];
for (const id of ids) {
  const it = shopItem(id);
  if (it.spot === 'desk') {
    deskItems.push(id);
    continue;
  }
  const px = decorPx(it.art);
  if (!px) continue;
  if (it.spot === 'wall') {
    const s = spec.wallSpots[wallI++];
    if (s) layers.push({ px, ...at(px, s.x, s.y, 0.5, 0), depth: -500 });
  } else {
    const s = spec.floorSpots[floorI++];
    if (s) layers.push({ px, ...at(px, s.x, s.y, 0.5, 1), depth: s.y });
  }
}
deskItems.forEach((id, k) => {
  const px = decorPx(shopItem(id).art);
  if (!px) return;
  for (const d of spec.desks) layers.push({ px, ...at(px, d.x + 5 + k * 6, d.y + 9, 0.5, 1), depth: d.y + 22.4 });
});

const LOOKS: Look[] = [
  { skin: 0, hair: 0, hairColor: 0, outfit: 0, accessory: 0 },
  { skin: 1, hair: 2, hairColor: 1, outfit: 1, accessory: 1 },
  { skin: 2, hair: 3, hairColor: 3, outfit: 2, accessory: 0 },
  { skin: 3, hair: 4, hairColor: 5, outfit: 5, accessory: 2 },
  { skin: 4, hair: 5, hairColor: 4, outfit: 6, accessory: 1 },
  { skin: 5, hair: 6, hairColor: 2, outfit: 3, accessory: 0 },
  { skin: 1, hair: 1, hairColor: 0, outfit: 4, accessory: 3 },
  { skin: 0, hair: 7, hairColor: 7, outfit: 7, accessory: 0 },
];
spec.desks.slice(0, staffN).forEach((d, i) => {
  const look = LOOKS[i % LOOKS.length]!;
  const px = buildPerson(look, i % 2 ? 'typeA' : 'typeB', 'normal').crop(0, 0, 16, 19);
  layers.push({ px, roles: roleColorsFor(look), ...at(px, d.x + 16, d.y, 0.5, 1), depth: d.y + 21.5 });
});

// stable sort by depth, like Phaser's container.sort
const order = layers.map((l, i) => ({ l, i })).sort((a, b) => a.l.depth - b.l.depth || a.i - b.i).map((o) => o.l);

const W = spec.w;
const H = spec.h;
const rgba = new Uint8ClampedArray(W * H * 4);
const plum = hexToRgb(PALETTE.ink1);
for (let i = 0; i < W * H; i++) {
  rgba[i * 4] = plum[0];
  rgba[i * 4 + 1] = plum[1];
  rgba[i * 4 + 2] = plum[2];
  rgba[i * 4 + 3] = 255;
}
for (const l of order) {
  const data = l.px.rgba(l.roles);
  for (let y = 0; y < l.px.h; y++)
    for (let x = 0; x < l.px.w; x++) {
      const o = (y * l.px.w + x) * 4;
      if (data[o + 3] === 0) continue;
      const tx = l.x + x;
      const ty = l.y + y;
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      const t = (ty * W + tx) * 4;
      rgba[t] = data[o]!;
      rgba[t + 1] = data[o + 1]!;
      rgba[t + 2] = data[o + 2]!;
    }
}

const png = new PNG({ width: W * zoom, height: H * zoom });
for (let y = 0; y < H * zoom; y++)
  for (let x = 0; x < W * zoom; x++) {
    const s = (Math.floor(y / zoom) * W + Math.floor(x / zoom)) * 4;
    const o = (y * W * zoom + x) * 4;
    png.data[o] = rgba[s]!;
    png.data[o + 1] = rgba[s + 1]!;
    png.data[o + 2] = rgba[s + 2]!;
    png.data[o + 3] = 255;
  }
const outDir = resolve(here, 'out');
mkdirSync(outDir, { recursive: true });
const file = resolve(outDir, `${flag('out', `room${tier}`)}.png`);
writeFileSync(file, PNG.sync.write(png));
console.log(file);
console.log(`tier ${tier}: ${W}x${H}, ${spec.desks.length} desks, ${spec.floorSpots.length} floor spots, ${spec.wallSpots.length} wall spots, ${ids.length} items`);
