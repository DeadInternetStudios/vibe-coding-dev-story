/**
 * Small drawing helpers shared by the furniture, room and logo sprites.
 * Light comes from the top left, so every solid has a light edge on the top and
 * left, a shade edge on the bottom and right, and a mid tone for the face.
 */
import { Px, type InkName, type Legend } from '../pixel';
import { ICON_LEGEND } from './icons';

/** light, mid, dark */
export type Tones = readonly [InkName, InkName, InkName];

/** A box lit from the top left. The top right and bottom left corners keep the mid tone. */
export function bevel(p: Px, x: number, y: number, w: number, h: number, t: Tones): Px {
  p.rect(x, y, w, h, t[1]);
  if (w > 2 && h > 2) {
    p.hline(x, y, w - 1, t[0]);
    p.vline(x, y, h - 1, t[0]);
    p.hline(x + 1, y + h - 1, w - 1, t[2]);
    p.vline(x + w - 1, y + 1, h - 1, t[2]);
  }
  return p;
}

/** A rounded blob lit from the top left, for cushions, jugs and cups. */
export function blob(p: Px, cx: number, cy: number, rx: number, ry: number, t: Tones): Px {
  p.ellipse(cx, cy, rx, ry, t[1]);
  // shade crescent on the bottom right, light crescent on the top left
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x - cx) / (rx + 0.35);
      const ny = (y - cy) / (ry + 0.35);
      if (nx * nx + ny * ny > 1) continue;
      const d = nx * 0.7 + ny * 0.7;
      if (d > 0.55) p.set(x, y, t[2]);
      else if (d < -0.5) p.set(x, y, t[0]);
    }
  }
  return p;
}

/** Letter map with the shared icon legend (see ICON_LEGEND), plus overrides. */
export function art(rows: readonly string[], extra: Legend = {}): Px {
  return Px.fromRows(rows, { ...ICON_LEGEND, ...extra });
}

/** Paint a letter map onto a canvas, clear pixels are skipped. */
export function stamp(p: Px, x: number, y: number, rows: readonly string[], extra: Legend = {}): Px {
  return p.blit(art(rows, extra), x, y);
}
