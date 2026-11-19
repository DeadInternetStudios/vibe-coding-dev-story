/**
 * Draws the app icon from the game's own pixel art and writes the PNGs the browser asks for
 * (home screen icons, the tab icon). Nothing to open, nothing to hear.
 *
 *   npx tsx tools/art/appicon.ts
 *
 * The picture is Clod, the AI who says yes to everything, on the night sky with the skyline behind.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { Px } from '../../src/art/pixel';
import { fxPx } from '../../src/art/sprites/fx';
import { portraitPx } from '../../src/art/sprites/portraits';
import { nightSky, skyline, stars } from '../../src/art/sprites/scenery';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../public/icons');

/** `n` x `n` pixels of art; the face is drawn at `faceScale` times its size. */
function icon(n: number, faceScale: number): Px {
  const c = nightSky(n, n);
  c.blit(stars(n, n, 3, Math.floor((n * n) / 200)), 0, 0);
  c.blit(skyline(n, Math.round(n * 0.38), 21, 0), 0, n - Math.round(n * 0.38));
  c.blit(skyline(n, Math.round(n * 0.24), 5, 1), 0, n - Math.round(n * 0.24));
  const face = portraitPx('clod');
  const big = new Px(face.w * faceScale, face.h * faceScale);
  for (let y = 0; y < big.h; y++) for (let x = 0; x < big.w; x++) big.set(x, y, face.get(Math.floor(x / faceScale), Math.floor(y / faceScale)));
  c.blit(big, Math.round((n - big.w) / 2), Math.round((n - big.h) / 2) - Math.round(n * 0.04));
  if (n >= 48) {
    const spark = fxPx('sparkle')!;
    c.blit(spark, Math.round(n * 0.2), Math.round(n * 0.14));
    c.blit(spark, Math.round(n * 0.74), Math.round(n * 0.2));
  }
  return c;
}

function png(px: Px, scale: number): Buffer {
  const data = px.rgba();
  const img = new PNG({ width: px.w * scale, height: px.h * scale });
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const s = ((Math.floor(y / scale) * px.w) + Math.floor(x / scale)) * 4;
      const d = (y * img.width + x) * 4;
      img.data[d] = data[s]!;
      img.data[d + 1] = data[s + 1]!;
      img.data[d + 2] = data[s + 2]!;
      img.data[d + 3] = 255;
    }
  }
  return PNG.sync.write(img);
}

mkdirSync(out, { recursive: true });
const big = icon(64, 2);
writeFileSync(resolve(out, 'icon-512.png'), png(big, 8));
writeFileSync(resolve(out, 'icon-192.png'), png(big, 3));
writeFileSync(resolve(out, 'apple-touch-icon.png'), png(icon(60, 2), 3));
writeFileSync(resolve(out, 'favicon-32.png'), png(icon(32, 1), 1));
console.log('wrote 4 icons to', out);
