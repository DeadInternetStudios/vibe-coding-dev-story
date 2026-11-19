/**
 * The art rules for every family of sprite, in one place. `check.ts` prints the
 * findings, `art.test.ts` fails the build on any error.
 *
 * Sizes come from docs/art-brief.md:
 *   icons    8 x 8, and 12 x 12 for kind_ niche_ tool_ chan_ card_
 *   decor    floor and corner up to 32 x 36, wall up to 32 x 24, desk up to 12 x 10
 *   portrait 16 x 17
 *   fx       8 x 8 or less
 *   logo     about 190 x 48
 */
import type { Px } from '../../src/art/pixel';
import { BIG_ICON_NAMES, ICON_NAMES, iconPx } from '../../src/art/sprites/icons';
import { DECOR, decorPx } from '../../src/art/sprites/decor';
import { PORTRAIT_LOOKS, portraitPx } from '../../src/art/sprites/portraits';
import { SHOP } from '../../src/sim/shop';
import { bounds, lintDistinct, lintSprite, type Finding } from './lint';

export const BIG_PREFIXES = ['kind_', 'niche_', 'tool_', 'chan_', 'card_'] as const;

export function isBigIconName(name: string): boolean {
  return BIG_PREFIXES.some((p) => name.startsWith(p));
}

/** Largest allowed size by where the item sits. */
export const DECOR_MAX: Record<string, { w: number; h: number }> = {
  floor: { w: 32, h: 36 },
  corner: { w: 32, h: 36 },
  wall: { w: 32, h: 24 },
  desk: { w: 12, h: 10 },
};

function sizeFinding(name: string, p: Px, w: number, h: number, exact: boolean): Finding[] {
  const bad = exact ? p.w !== w || p.h !== h : p.w > w || p.h > h;
  return bad ? [{ sprite: name, level: 'error', msg: `size ${p.w}x${p.h}, ${exact ? 'must be' : 'at most'} ${w}x${h}` }] : [];
}

export function checkIcons(): Finding[] {
  const out: Finding[] = [];
  const small: { name: string; px: Px }[] = [];
  for (const name of ICON_NAMES) {
    const p = iconPx(name)!;
    if (name === 'bubbleTail') continue;
    out.push(...sizeFinding(name, p, 8, 8, true));
    out.push(...lintSprite(name, p, { minColors: 2, minFill: 0.25 }));
    small.push({ name, px: p });
  }
  const big: { name: string; px: Px }[] = [];
  for (const name of BIG_ICON_NAMES) {
    const p = iconPx(name)!;
    out.push(...sizeFinding(name, p, 12, 12, true));
    out.push(...lintSprite(name, p, { minColors: 4, minFill: 0.4 }));
    if (!isBigIconName(name)) out.push({ sprite: name, level: 'error', msg: `12x12 icons must be named ${BIG_PREFIXES.join(' ')}` });
    big.push({ name, px: p });
  }
  // some small icons are the same picture on purpose (karma and the upvote arrow), so these are warnings
  out.push(...lintDistinct(small, 6, 'warn'));
  out.push(...lintDistinct(big, 14));
  return out;
}

export function checkDecor(): Finding[] {
  const out: Finding[] = [];
  const all: { name: string; px: Px }[] = [];
  for (const item of SHOP) {
    const p = decorPx(item.art);
    if (!p) {
      out.push({ sprite: item.art, level: 'error', msg: `no decor sprite for shop item ${item.id}` });
      continue;
    }
    const max = DECOR_MAX[item.spot]!;
    out.push(...sizeFinding(item.art, p, max.w, max.h, false));
    out.push(...lintSprite(item.art, p, { minColors: 5, minFill: 0.3 }));
    const b = bounds(p)!;
    // anchors: floor and desk things stand on the bottom row, wall things hang from the top row
    if (item.spot === 'wall' && b.y0 !== 0) out.push({ sprite: item.art, level: 'error', msg: `wall item must touch the top row, starts at y ${b.y0}` });
    if (item.spot !== 'wall' && b.y1 !== p.h - 1) out.push({ sprite: item.art, level: 'error', msg: `${item.spot} item must touch the bottom row, ends at y ${b.y1} of ${p.h - 1}` });
    // the room centers the sprite on the anchor, so the drawing should be centered in its box
    const mid = (b.x0 + b.x1) / 2;
    if (Math.abs(mid - (p.w - 1) / 2) > 1.5) out.push({ sprite: item.art, level: 'warn', msg: `drawing is off center by ${(mid - (p.w - 1) / 2).toFixed(1)}px, the anchor is the middle of the image` });
    all.push({ name: item.art, px: p });
  }
  for (const id of Object.keys(DECOR)) if (!SHOP.some((i) => i.art === id)) out.push({ sprite: id, level: 'warn', msg: 'decor sprite that no shop item uses' });
  out.push(...lintDistinct(all, 20));
  return out;
}

export function checkPortraits(): Finding[] {
  const out: Finding[] = [];
  const all: { name: string; px: Px }[] = [];
  for (const voice of Object.keys(PORTRAIT_LOOKS) as (keyof typeof PORTRAIT_LOOKS)[]) {
    const p = portraitPx(voice);
    out.push(...sizeFinding(voice, p, 16, 17, true));
    out.push(...lintSprite(voice, p, { openEdges: ['bottom'], minColors: 6, minFill: 0.5 }));
    all.push({ name: voice, px: p });
  }
  out.push(...lintDistinct(all, 40));
  return out;
}

export function checkAll(): Finding[] {
  return [...checkIcons(), ...checkDecor(), ...checkPortraits()];
}
