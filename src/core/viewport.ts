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
const TARGET_PORTRAIT_W = 252;
const PREF_STEP = 40;

export function computeViewport(cssW: number, cssH: number, dprRaw: number, pref: UiSizePref = 0): Viewport {
  const dpr = Math.min(4, Math.max(1, dprRaw || 1));
  const devW = Math.max(1, Math.round(cssW * dpr));
  const devH = Math.max(1, Math.round(cssH * dpr));
  const portrait = cssH > cssW * 1.02;
  // pref -1 is a smaller UI (more logical pixels), +1 a bigger one
  const shift = -pref * PREF_STEP;
  const scale = portrait
    ? Math.max(1, Math.floor(devW / (TARGET_PORTRAIT_W + shift * 0.9)))
    : Math.max(1, Math.floor(devH / (TARGET_LANDSCAPE_H + shift)));
  const w = Math.ceil(devW / scale);
  const h = Math.ceil(devH / scale);
  return { w, h, scale, dpr, cssPerPx: scale / dpr, portrait };
}

/** The widest block of UI we lay out, wider screens get side margins. */
export const MAX_CONTENT_W = 640;
