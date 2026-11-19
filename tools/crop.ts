/**
 * Cut a rectangle out of a screenshot and blow it up with hard pixels, so tiny type can be read.
 *   npx tsx tools/crop.ts <in.png> <x> <y> <w> <h> [scale=3] [out.png]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [file, sx, sy, sw, sh, sc, outArg] = process.argv.slice(2);
if (!file || !sx || !sy || !sw || !sh) {
  console.error('usage: tsx tools/crop.ts <in.png> <x> <y> <w> <h> [scale] [out.png]');
  process.exit(1);
}
const src = PNG.sync.read(readFileSync(file));
const x0 = Number(sx);
const y0 = Number(sy);
const w = Math.min(Number(sw), src.width - x0);
const h = Math.min(Number(sh), src.height - y0);
const k = Number(sc ?? 3);
const out = new PNG({ width: w * k, height: h * k });
for (let y = 0; y < h * k; y++) {
  for (let x = 0; x < w * k; x++) {
    const from = ((y0 + Math.floor(y / k)) * src.width + x0 + Math.floor(x / k)) * 4;
    const to = (y * out.width + x) * 4;
    for (let c = 0; c < 4; c++) out.data[to + c] = src.data[from + c]!;
  }
}
const dest = outArg ?? '.100x/tmp/crop.png';
writeFileSync(dest, PNG.sync.write(out));
console.log(`${dest} ${out.width}x${out.height}`);
