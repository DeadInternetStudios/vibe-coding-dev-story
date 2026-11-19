/**
 * Colors and type for the screens. Everything points at the one palette.
 */
import { PALETTE, hexToRgb, type ColorName } from '../art/palette';

export function hex(name: ColorName): number {
  const [r, g, b] = hexToRgb(PALETTE[name]);
  return (r << 16) | (g << 8) | b;
}

export const C = {
  ink0: hex('ink0'),
  ink1: hex('ink1'),
  ink2: hex('ink2'),
  ink3: hex('ink3'),
  ink4: hex('ink4'),
  ink5: hex('ink5'),
  white: hex('white'),
  cream: hex('cream'),
  wood2: hex('wood2'),
  wood3: hex('wood3'),
  wood4: hex('wood4'),
  orange0: hex('orange0'),
  orange1: hex('orange1'),
  orange2: hex('orange2'),
  orange3: hex('orange3'),
  yellow: hex('yellow'),
  teal0: hex('teal0'),
  teal1: hex('teal1'),
  teal2: hex('teal2'),
  mint: hex('mint'),
  blue0: hex('blue0'),
  blue1: hex('blue1'),
  blue2: hex('blue2'),
  sky: hex('sky'),
  green0: hex('green0'),
  green1: hex('green1'),
  green2: hex('green2'),
  berry0: hex('berry0'),
  berry1: hex('berry1'),
  pink: hex('pink'),
  violet0: hex('violet0'),
  violet1: hex('violet1'),
  violet2: hex('violet2'),
};

/** Baked bitmap fonts. See scenes/BootScene for the specs. */
export const F = {
  /** 8px, small text and numbers */
  body: 'tiny8',
  /** 8px caps, labels and buttons */
  caps: 'silk8',
  capsBold: 'silk8b',
  /** 15px display, headings */
  head: 'j15',
  /** 20px display, titles */
  title: 'j20',
  /** 16px, a readable body for long text */
  read: 'vt16',
} as const;

export type FontKey = (typeof F)[keyof typeof F];

/** Tints for text on light or dark panels. */
export const T = {
  onDark: C.cream,
  onDarkDim: C.ink4,
  onLight: C.ink1,
  onLightDim: C.ink3,
  accent: C.orange1,
  good: C.green1,
  goodOnDark: C.green2,
  bad: C.berry1,
  badOnDark: C.pink,
  money: C.green2,
  karma: C.orange2,
  token: C.violet2,
  link: C.blue1,
};

export const DEPTH = {
  bg: 0,
  room: 10,
  people: 20,
  fx: 30,
  hud: 100,
  panel: 200,
  modal: 300,
  toast: 400,
  top: 500,
};
