import type { PixelFontSpec } from './fonts';

/** Every bitmap font the game bakes at boot. The keys are what theme.F points at. */
export const FONT_SPECS: PixelFontSpec[] = [
  // Tiny5 cuts the corner off its lowercase u, and at this size it reads as a c: "startcp"
  { key: 'tiny8', family: 'Tiny5', size: 8, patch: { u: '#.#/#.#/#.#/###' } },
  { key: 'silk8', family: 'Silkscreen', size: 8 },
  { key: 'silk8b', family: 'Silkscreen', size: 8, weight: 700 },
  { key: 'j15', family: 'Jersey 15', size: 15 },
  { key: 'j20', family: 'Jersey 20', size: 20 },
  { key: 'vt16', family: 'VT323', size: 16 },
];
