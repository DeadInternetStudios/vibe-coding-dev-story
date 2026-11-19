/**
 * The game draws at a small logical resolution measured in art pixels and the
 * browser scales the canvas up by a whole number of device pixels. That keeps
 * every pixel the same size on screen at any window size and any DPR, costs
 * almost nothing to fill, and lets all layout code think in art pixels.
 */

export type UiSizePref = -1 | 0 | 1;

export interface Viewport {
  /** logical width in art pixels */
  w: number;
  /** logical height in art pixels */
  h: number;
  /** device pixels per art pixel, always a whole number */
  scale: number;
  /** device pixel ratio used, clamped */
  dpr: number;
  /** CSS pixels per art pixel, what Phaser's zoom wants */
  cssPerPx: number;
  portrait: boolean;
}

/** Shortest logical side we aim for, by orientation and the player's size preference. */
const TARGET_LANDSCAPE_H = 232;
const TARGET_PORTRAIT_W = 234;
/** The narrowest portrait canvas the layouts were drawn for. A bigger UI choice stops before it goes narrower. */
const MIN_PORTRAIT_W = 224;
const PREF_STEP = 40;
/**
 * The office needs this much room to show everything. Landscape: the room plus a log and a chart of 72 or more on each side.
 * Portrait: the room, the project card and the menus, with space above the room for the log and the chart. A tablet or a
 * squarish window gets a smaller scale (more art pixels) so those panels fit, unless the player asked for a bigger UI.
 */
const NEED_LANDSCAPE_W = 380;
const NEED_PORTRAIT_H = 420;

export function computeViewport(cssW: number, cssH: number, dprRaw: number, pref: UiSizePref = 0): Viewport {
  const dpr = Math.min(4, Math.max(1, dprRaw || 1));
  const devW = Math.max(1, Math.round(cssW * dpr));
  const devH = Math.max(1, Math.round(cssH * dpr));
  const portrait = cssH > cssW * 1.02;
  // pref -1 is a smaller UI (more logical pixels), +1 a bigger one
  const shift = -pref * PREF_STEP;
  const roomy = pref <= 0;
  let scale: number;
  if (portrait) {
    scale = Math.floor(devW / (TARGET_PORTRAIT_W + shift * 0.9));
    if (roomy) scale = Math.min(scale, Math.floor(devH / NEED_PORTRAIT_H));
    while (scale > 1 && devW / scale < MIN_PORTRAIT_W) scale -= 1;
  } else {
    scale = Math.floor(devH / (TARGET_LANDSCAPE_H + shift));
    if (roomy) scale = Math.min(scale, Math.floor(devW / NEED_LANDSCAPE_W));
  }
  scale = Math.max(1, scale);
  const w = coverSide(devW, scale, dpr);
  const h = coverSide(devH, scale, dpr);
  return { w, h, scale, dpr, cssPerPx: scale / dpr, portrait };
}

/** The most the canvas may stick out past the window on one side, in CSS pixels. Past this a page check calls it cut off. */
const MAX_OVERHANG = 1;

/**
 * How many art pixels one side of the window takes. Rounded up, so the art reaches the edge and no strip of bare page shows.
 * On a big window with one device pixel per CSS pixel an art pixel is many pixels wide, and rounding up could push the canvas
 * more than a pixel past each side. Then it is rounded down and the page's own colour fills the sliver.
 */
function coverSide(dev: number, scale: number, dpr: number): number {
  const up = Math.ceil(dev / scale);
  const overhang = (up * scale - dev) / 2 / dpr;
  return overhang <= MAX_OVERHANG ? up : Math.floor(dev / scale);
}

/** The widest block of UI we lay out, wider screens get side margins. */
export const MAX_CONTENT_W = 640;
