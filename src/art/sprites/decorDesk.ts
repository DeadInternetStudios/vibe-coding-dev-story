/**
 * Desk items. They sit on the front edge of a desk, anchored at the bottom
 * center. The room puts each one 6 pixels right of the last, so they are drawn
 * narrow, 10 wide or less after the outline, to still read when the desk is
 * full.
 */
import type { Px } from '../pixel';
import { art } from './draw';

/** Second monitor: a blue screen of death with a sad face, so there are two places for the bug to hide. */
export function monitor(): Px {
  return art([
    'AAAAAAA',
    'AbwbwbA',
    'AbbbbbA',
    'AbwwwbA',
    'AwbbbwA',
    'aaamaaa',
    '.xxxxx.',
  ]).outline('ink0');
}

/** Mechanical keyboard with RGB on the top row and one key already gone. */
export function keyboard(): Px {
  return art([
    'xrOyGBx',
    'xwcwcwx',
    'xcwxwcx',
    'xwwwwwx',
    'aaaaaaa',
  ]).outline('ink0');
}

/** A standing desk, raised high and fast asleep. */
export function standing(): Px {
  return art([
    '....sss',
    '......s',
    '.....s.',
    '....s..',
    '....sss',
    'qqqqqqq',
    'nnnnnnn',
    '.xx.xx.',
  ]).outline('ink0');
}

/** A hardware security key, on a lanyard, lying on a desk. */
export function key(): Px {
  return art([
    '.rrrr.',
    'r....r',
    'r.aa.r',
    'r.ayyr',
    '.rxyyr',
    '..xxxa',
    '..AAAA',
    '..AeAA',
  ]).outline('ink0');
}

/** An ergonomic chair with too many levers. */
export function chair(): Px {
  return art([
    '.ttttt.',
    '.tTtTt.',
    '.TtTtT.',
    'A.ttt.A',
    '.aAAAa.',
    '.r.a.y.',
    '...a...',
    '.a.a.a.',
  ]).outline('ink0');
}
