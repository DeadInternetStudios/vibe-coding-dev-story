/**
 * Effect sprites: the little things that fly, float and pop around the office.
 * Every one is 8 x 8 or smaller so a hundred fit in a particle emitter.
 *
 * Solid things (heart, coin, bulb, puff, sweat, notes, sparkles) wear the same
 * ink outline as the icons, so they read on cream paper and on the dark room.
 * Thin things (confetti, steam, the anger vein) skip the outline on purpose:
 * it would be thicker than the thing it surrounds.
 *
 * The `fx` group in catalog.ts lists them all; `fxPx(name)` makes a fresh canvas.
 */
import type { Px } from '../pixel';
import { art } from './draw';

const SOLID: Record<string, readonly string[]> = {
  // a heart that is allowed to be a little round
  heart: ['.p.r.', 'pprrr', 'rrrrR', '.rrR.', '..R..'],
  // a coin in three turns of its spin: face on, three quarters, edge on (flip the middle one for the way back)
  coin: ['.OYYO.', 'OyYYYo', 'OyYoYo', 'OYYoYo', 'oYYYYo', '.oooo.'],
  coinTurn: ['.OY.', 'OyYo', 'OyYo', 'OYYo', 'oYYo', '.oo.'],
  coinEdge: ['Oo', 'Yo', 'Yo', 'Yo', 'Yo', 'oo'],
  // four pointed stars: the big one has a white heart
  sparkle: ['..y..', '.ywy.', 'ywwwy', '.ywy.', '..y..'],
  sparkleSmall: ['.y.', 'ywy', '.y.'],
  // a quaver
  note: ['.VVV..', '.VvVV.', '.Vv.VV', '.Vv..V', 'VVv...', 'vv....'],
  // a drop of cold sweat
  sweat: ['.s..', '.ss.', 'swss', 'ssss', 'sBBB', '.BB.'],
  // smoke that came out of something it should not have, and is not impressed
  puff: ['.we.e.', 'weeeee', 'exeexA', 'eexxAA', '.AAAA.'],
  puffSmall: ['.we.', 'weee', '.AA.'],
  // a sleeper's letter, big and small
  zzz: ['wwwww', '...ss', '..ss.', '.ss..', 'sBBBB'],
  zzzSmall: ['www', '..s', '.s.', 'BBB'],
  // the hot idea, lit and unlit
  bulbHot: ['.yyy.', 'ywyyy', 'yyoyY', '.yoY.', '.AaA.', '..a..'],
  bulbOff: ['.eee.', 'ewAAA', 'eAxAa', '.AxA.', '.AaA.', '..a..'],
};

/** Thin things drawn without an outline. */
const THIN: Record<string, readonly string[]> = {
  confettiOrange: ['OOOO', 'oooo'],
  confettiYellow: ['yyY', 'yYY', 'YYo'],
  confettiTeal: ['Tt', 'Tt', 'tZ', 'tZ'],
  confettiPink: ['.p.', 'prp', '.r.'],
  confettiBlue: ['BB..', '.bB.', '..bb'],
  confettiGreen: ['GG', 'gg'],
  // anger vein: four brackets that never quite meet
  vein: ['OO...oo', 'O.....o', '.......', '.......', '.......', 'o.....d', 'oo...dd'],
  // a lazy S of vapour, white on the lit side
  steam: [2, 1, 1, 0, 1, 2, 3, 3].map((x) => '.'.repeat(x) + 'wA' + '.'.repeat(3 - x)),
};

const MAKERS: Record<string, () => Px> = {
  ...Object.fromEntries(Object.entries(SOLID).map(([name, rows]) => [name, () => art(rows).outline('ink0')])),
  ...Object.fromEntries(Object.entries(THIN).map(([name, rows]) => [name, () => art(rows)])),
};

export const FX_NAMES: readonly string[] = Object.keys(MAKERS);

/** Names drawn without the ink outline on purpose, for the lint. */
export const FX_THIN: readonly string[] = Object.keys(THIN);

export function hasFx(name: string): boolean {
  return name in MAKERS;
}

export function fxPx(name: string): Px | null {
  const make = MAKERS[name];
  return make ? make() : null;
}
