import Phaser from 'phaser';

/**
 * Pixel fonts, baked once at boot into bitmap fonts so every label is made of
 * real pixels. A web font is drawn at its native grid size, cut to one bit,
 * and packed into an atlas. Three looks come out of each font: plain, outlined
 * and shadowed. Outline and shadow are baked in black, so tinting a
 * BitmapText recolors the glyph and keeps the outline dark.
 */

export interface PixelFontSpec {
  /** cache key stem, the variants add -o (outline) and -s (shadow) */
  key: string;
  family: string;
  /** native pixel size to rasterize at */
  size: number;
  weight?: number | string;
  chars?: string;
  /** extra px between glyphs */
  letterSpacing?: number;
  /** px between baselines, default is ascent + descent + 1 */
  lineHeight?: number;
  /** alpha cutoff for the one bit cut, 0 to 255 */
  threshold?: number;
  /** move the glyphs down (positive) or up (negative) inside the line */
  yShift?: number;
}

const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');

export async function loadWebFonts(specs: PixelFontSpec[]): Promise<void> {
  await Promise.all(
    specs.map((s) => document.fonts.load(`${s.weight ?? 400} ${s.size}px "${s.family}"`, 'AaBbMm09')),
  );
  await document.fonts.ready;
}

interface Glyph {
  ch: string;
  adv: number;
  left: number;
  top: number;
  w: number;
  h: number;
  /** 1 bit pixels, row major, length w * h */
  bits: Uint8Array;
}

function rasterize(spec: PixelFontSpec): { glyphs: Glyph[]; ascent: number; descent: number } {
  const chars = spec.chars ?? ASCII;
  const pad = 4;
  const probe = document.createElement('canvas');
  const pctx = probe.getContext('2d', { willReadFrequently: true })!;
  const font = `${spec.weight ?? 400} ${spec.size}px "${spec.family}"`;
  pctx.font = font;
  const metrics = pctx.measureText('Hxgjpq|');
  const ascent = Math.ceil(metrics.actualBoundingBoxAscent) + 1;
  const descent = Math.ceil(metrics.actualBoundingBoxDescent);
  const cellH = ascent + descent + pad * 2;
  const threshold = spec.threshold ?? 110;
  const glyphs: Glyph[] = [];

  for (const ch of chars) {
    const m = (pctx.measureText(ch) as TextMetrics);
    const adv = Math.max(1, Math.round(m.width)) + (spec.letterSpacing ?? 0);
    const cellW = Math.ceil(m.width) + pad * 2 + 2;
    const c = document.createElement('canvas');
    c.width = cellW;
    c.height = cellH;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.font = font;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    ctx.fillText(ch, pad, pad + ascent + (spec.yShift ?? 0));
    const data = ctx.getImageData(0, 0, cellW, cellH).data;
    let minX = cellW, maxX = -1, minY = cellH, maxY = -1;
    const on = new Uint8Array(cellW * cellH);
    for (let y = 0; y < cellH; y++) {
      for (let x = 0; x < cellW; x++) {
        if ((data[(y * cellW + x) * 4 + 3] ?? 0) >= threshold) {
          on[y * cellW + x] = 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) {
      glyphs.push({ ch, adv, left: 0, top: 0, w: 0, h: 0, bits: new Uint8Array(0) });
      continue;
    }
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const bits = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) bits[y * w + x] = on[(minY + y) * cellW + (minX + x)] ?? 0;
    // left is relative to the pen x, top is relative to the baseline row (negative above it)
    glyphs.push({ ch, adv, left: minX - pad, top: minY - pad - ascent, w, h, bits });
  }
  return { glyphs, ascent, descent };
}

type Look = 'plain' | 'outline' | 'shadow';

function bakeLook(spec: PixelFontSpec, look: Look, raster: ReturnType<typeof rasterize>): { canvas: HTMLCanvasElement; data: Phaser.Types.GameObjects.BitmapText.BitmapFontData } {
  const { glyphs, ascent, descent } = raster;
  const border = look === 'outline' ? 1 : 0;
  const extraR = look === 'shadow' ? 1 : 0;
  const extraB = look === 'shadow' ? 1 : 0;
  const lineHeight = (spec.lineHeight ?? ascent + descent + 1) + (look === 'plain' ? 0 : look === 'outline' ? 1 : 1);
  const gap = 1;
  // pack in rows
  const maxRow = 256;
  let x = 0, y = 0, rowH = 0;
  const placed: { g: Glyph; x: number; y: number; cw: number; ch: number }[] = [];
  for (const g of glyphs) {
    const cw = g.w + border * 2 + extraR;
    const chh = g.h + border * 2 + extraB;
    if (x + cw + gap > maxRow) { x = 0; y += rowH + gap; rowH = 0; }
    placed.push({ g, x, y, cw, ch: chh });
    x += cw + gap;
    rowH = Math.max(rowH, chh);
  }
  const W = maxRow;
  let H = 1;
  while (H < y + rowH + gap) H *= 2;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.createImageData(W, H);
  const px = img.data;
  const put = (ax: number, ay: number, r: number, gg: number, b: number) => {
    const i = (ay * W + ax) * 4;
    px[i] = r; px[i + 1] = gg; px[i + 2] = b; px[i + 3] = 255;
  };
  const OUT = [14, 10, 28];
  for (const p of placed) {
    const { g } = p;
    const at = (gx: number, gy: number) => (gx < 0 || gy < 0 || gx >= g.w || gy >= g.h ? 0 : g.bits[gy * g.w + gx] ?? 0);
    if (look === 'outline') {
      for (let gy = -1; gy <= g.h; gy++) {
        for (let gx = -1; gx <= g.w; gx++) {
          if (at(gx, gy)) continue;
          let near = false;
          for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && at(gx + dx, gy + dy)) { near = true; break; }
          if (near) put(p.x + gx + 1, p.y + gy + 1, OUT[0]!, OUT[1]!, OUT[2]!);
        }
      }
    } else if (look === 'shadow') {
      for (let gy = 0; gy < g.h; gy++) for (let gx = 0; gx < g.w; gx++) if (at(gx, gy) && !at(gx + 1, gy + 1)) put(p.x + gx + 1, p.y + gy + 1, OUT[0]!, OUT[1]!, OUT[2]!);
    }
    for (let gy = 0; gy < g.h; gy++) for (let gx = 0; gx < g.w; gx++) if (at(gx, gy)) put(p.x + gx + border, p.y + gy + border, 255, 255, 255);
  }
  ctx.putImageData(img, 0, 0);

  const chars: Record<number, Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData> = {};
  for (const p of placed) {
    const { g } = p;
    const code = g.ch.charCodeAt(0);
    const pad = look === 'plain' ? 0 : look === 'outline' ? 1 : 0;
    chars[code] = {
      x: p.x, y: p.y, width: p.cw, height: p.ch,
      centerX: Math.floor(p.cw / 2), centerY: Math.floor(p.ch / 2),
      xOffset: g.left - border, yOffset: ascent + g.top - border,
      xAdvance: g.adv + pad,
      data: {}, kerning: {},
      u0: p.x / W, v0: 1 - p.y / H, u1: (p.x + p.cw) / W, v1: 1 - (p.y + p.ch) / H,
    } as Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData;
  }
  const key = look === 'plain' ? spec.key : look === 'outline' ? `${spec.key}-o` : `${spec.key}-s`;
  return { canvas, data: { retroFont: false, font: key, size: spec.size, lineHeight, chars } };
}

export function bakeBitmapFont(scene: Phaser.Scene, spec: PixelFontSpec): void {
  const raster = rasterize(spec);
  for (const look of ['plain', 'outline', 'shadow'] as Look[]) {
    const { canvas, data } = bakeLook(spec, look, raster);
    const key = data.font;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
    scene.cache.bitmapFont.add(key, { data, texture: key, frame: null as unknown as string });
  }
}
