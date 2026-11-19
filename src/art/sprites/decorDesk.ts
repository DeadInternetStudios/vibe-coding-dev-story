/**
 * Desk items. They sit on the front edge of a desk, anchored at the bottom
 * center, and are 12 x 10 at most after the outline. Drawn from the front so
 * the shop picture shows the joke.
 */
import type { Px } from '../pixel';
import { art } from './draw';

/** Second monitor: a blue screen of death with a sad face, so there are two places for the bug to hide. */
export function monitor(): Px {
  return art([
    'AAAAAAAAAa',
    'Azzzzzzzza',
    'Azzwzzwzza',
    'Azzzzzzzza',
    'Azzzwwzzza',
    'Azzwzzwzza',
    'aaaaaaamaa',
    '..xxxxxx..',
  ]).outline('ink0');
}

/** Mechanical keyboard with RGB on the top row and one key already gone. */
export function keyboard(): Px {
  return art([
    '.xxxxxxxx.',
    'xrOyGBVrOx',
    'xwcwcwcwcx',
    'xcwcwxwcwx',
    'xwwwwwwwwx',
    'aaaaaaaaaa',
  ]).outline('ink0');
}

/** A standing desk, raised high and fast asleep. */
export function standing(): Px {
  return art([
    '......sss.',
    '.......s..',
    '......sss.',
    'qqqqqqqqqq',
    'nnnnnnnnnn',
    '..Aa..Aa..',
    '..Aa..Aa..',
    '.xxxa.xxxa',
  ]).outline('ink0');
}

/** A hardware security key, on a lanyard, lying on a desk. */
export function key(): Px {
  return art([
    '...rrrr...',
    '..r....r..',
    '..r.aa.r..',
    '..r.ayyr..',
    '...rxyyr..',
    '....xxxa..',
    '....AAAA..',
    '....AeAA..',
  ]).outline('ink0');
}

/** An ergonomic chair with too many levers. */
export function chair(): Px {
  return art([
    '..tttttt..',
    '..tTtTtt..',
    '..tTtTtt..',
    'AA.tttt.AA',
    '.aAAAAAAa.',
    '.r.aaaa.y.',
    '....aa....',
    '.aa.aa.aa.',
  ]).outline('ink0');
}
