import type { PixelFontSpec } from './fonts';

/** Every bitmap font the game bakes at boot. The keys are what theme.F points at. */
export const FONT_SPECS: PixelFontSpec[] = [
  // Tiny5 cuts the corner off its lowercase u, and at this size it reads as a c: "startcp"
  { key: 'tiny8', family: 'Tiny5', size: 8, patch: { u: '#.#/#.#/#.#/###' } },
  { key: 'silk8', family: 'Silkscreen', size: 8 },
  { key: 'silk8b', family: 'Silkscreen', size: 8, weight: 700 },
  // Jersey 15 draws its 6 with no hole in the bowl and its 9 with a bowl at the bottom: 62 read as 02
  { key: 'j15', family: 'Jersey 15', size: 15, patch: { '6': '.#####/######/###.../#####./######/###.##/###.##/######/.####.', '9': '.####./######/##.###/##.###/######/.#####/...###/######/#####.' } },
  { key: 'j20', family: 'Jersey 20', size: 20 },
  // VT323 at 16 px has strokes about two pixels thick and no room for three of them: m and M come out as solid blocks, w and W as
  // smudges, so "I'm in." read as "I'# in.". These four are drawn by hand a little wider, with a gap between the strokes.
  {
    key: 'vt16',
    family: 'VT323',
    size: 16,
    patch: {
      m: '#######./########/##.##.##/##.##.##/##.##.##/##.##.##/##.##.##',
      w: '##....##/##....##/##.##.##/##.##.##/##.##.##/########/.######.',
      M: '##....##/###..###/########/########/##.##.##/##.##.##/##.##.##/##.##.##/##.##.##',
      W: '##....##/##....##/##.##.##/##.##.##/##.##.##/##.##.##/##.##.##/########/.######.',
    },
  },
];
