/**
 * The one palette. Every pixel in the game is one of these 50 colors (plus the
 * recolorable role colors below), so the art, the UI and the effects look like
 * one game.
 *
 * Visual thesis: warm, chunky, cheeky. A cramped startup office at golden hour
 * lit by monitors, coffee rings, cables, sticky notes and one sad plant.
 * Plum ink instead of black, butter and cream for light, tomato orange for the
 * accent (the upvote), mint teal for terminals, sky blue for screens.
 */
export const PALETTE = {
  // plum ink: outlines, shadows, UI frames
  ink0: '#17102a',
  ink1: '#2e2247',
  ink2: '#4d3d6b',
  ink3: '#7a6a96',
  ink4: '#b3a8c9',
  ink5: '#e8e0f0',
  white: '#fff8ec',
  // wood and cream: floors, furniture, paper
  wood0: '#3b1f22',
  wood1: '#6d3b2e',
  wood2: '#a35f3c',
  wood3: '#d4915a',
  wood4: '#f2c98a',
  cream: '#fbe8bf',
  // tomato orange: the accent
  orange0: '#a8330f',
  orange1: '#e8501c',
  orange2: '#ff8a30',
  orange3: '#ffc04d',
  yellow: '#ffe66b',
  // mint teal: terminals, success
  teal0: '#124f5e',
  teal1: '#1f8a8a',
  teal2: '#3fc2a3',
  mint: '#a6f0c9',
  // blue: screens, sky
  blue0: '#23356e',
  blue1: '#3f6bd1',
  blue2: '#72aaf5',
  sky: '#c3e2ff',
  // green: plants, money
  green0: '#1f5b3c',
  green1: '#3d9a4a',
  green2: '#8fd35c',
  // berry: love, danger
  berry0: '#7b1f45',
  berry1: '#d63b64',
  pink: '#ff86a0',
  // violet: magic, AI
  violet0: '#46257a',
  violet1: '#7a4ad1',
  violet2: '#b78cff',
  // skin
  skin0: '#7a4630',
  skin1: '#b06f45',
  skin2: '#dc9a68',
  skin3: '#f2c394',
  skin4: '#ffe0c2',
  // extra neutrals for UI and metal
  steel0: '#3a3f5c',
  steel1: '#6b7394',
  steel2: '#a4adc9',
  steel3: '#d6dcee',
  // extra warm tones for roofs, bricks, leather
  brick0: '#5a2230',
  brick1: '#8f3a3a',
  brick2: '#c2634f',
} as const;

export type ColorName = keyof typeof PALETTE;
export const COLOR_NAMES = Object.keys(PALETTE) as ColorName[];

/**
 * Colors that change per character or per item. A sprite drawn with roles can
 * be baked many times in many outfits. Each ramp is light, mid, dark.
 */
export const ROLE_NAMES = [
  'skinL', 'skin', 'skinD',
  'hairL', 'hair', 'hairD',
  'shirtL', 'shirt', 'shirtD',
  'pantsL', 'pants', 'pantsD',
  'accL', 'acc', 'accD',
  'shoe',
] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/** Skin ramps (light, mid, dark), one per skin tone index. */
export const SKIN_RAMPS: readonly (readonly [ColorName, ColorName, ColorName])[] = [
  ['skin4', 'skin3', 'skin2'],
  ['skin3', 'skin2', 'skin1'],
  ['skin2', 'skin1', 'skin0'],
  ['wood4', 'wood3', 'wood2'],
  ['skin1', 'skin0', 'wood0'],
  ['cream', 'skin4', 'skin3'],
];

/** Hair ramps (light, mid, dark). */
export const HAIR_RAMPS: readonly (readonly [ColorName, ColorName, ColorName])[] = [
  ['wood2', 'wood1', 'wood0'], // brown
  ['ink2', 'ink1', 'ink0'], // black
  ['yellow', 'orange3', 'wood3'], // blond
  ['orange2', 'orange1', 'orange0'], // ginger
  ['ink5', 'ink4', 'ink3'], // gray
  ['pink', 'berry1', 'berry0'], // pink
  ['teal2', 'teal1', 'teal0'], // teal
  ['violet2', 'violet1', 'violet0'], // purple
  ['white', 'ink5', 'ink4'], // white
  ['blue2', 'blue1', 'blue0'], // blue
];

/** Clothing ramps (light, mid, dark). */
export const CLOTH_RAMPS: readonly (readonly [ColorName, ColorName, ColorName])[] = [
  ['orange3', 'orange1', 'orange0'], // tomato
  ['mint', 'teal2', 'teal0'], // mint
  ['sky', 'blue1', 'blue0'], // blue
  ['pink', 'berry1', 'berry0'], // berry
  ['violet2', 'violet1', 'violet0'], // violet
  ['green2', 'green1', 'green0'], // green
  ['yellow', 'orange3', 'wood2'], // mustard
  ['ink5', 'ink4', 'ink3'], // light gray
  ['steel2', 'steel1', 'steel0'], // slate
  ['white', 'ink5', 'ink4'], // white
  ['ink3', 'ink2', 'ink1'], // charcoal
  ['wood3', 'wood2', 'wood1'], // brown
];
