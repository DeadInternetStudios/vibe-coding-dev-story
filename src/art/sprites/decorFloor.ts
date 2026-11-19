/**
 * Furniture that stands on the floor. Anchored at the bottom center, up to 32
 * wide and 36 tall after the outline, so the content is at most 30 x 34.
 */
import { glyphs } from '../glyphs';
import { Px } from '../pixel';
import { bevel, blob, stamp } from './draw';

/** Espresso machine with a tiny queue sign. The sign says 7. */
export function coffee(): Px {
  const c = new Px(24, 22);
  stamp(c, 0, 0, [
    '....eeeeeeee....',
    '....swsssssB....',
    '....swsssssB....',
    '....hnhhhnhh....',
    '....hhhnhhhh....',
    '....hhnhhhnh....',
    '.....aaaaaa.....',
    'pppppppppppppppr',
    'peeeeeeeeeeeeeeR',
    'paaaaaaaaaaaaaaR',
    'prAAreeeeeerAArR',
    'pAwrAAAAAAAArwAR',
    'pAwwAKaaaaKAwwAR',
    'prAArKKnKKKrAArR',
    'prrrrKKnKKKrrrrR',
    'pryrrKchhcKrrOrR',
    'prrrrKccccKrrrrR',
    'rRRRRwwwwwwRRRRR',
    '.AAAAAAAAAAAAAA.',
    '.axaxaxaxaxaxax.',
    '..KKK......KKK..',
    '..KKK......KKK..',
  ]);
  // the queue sign
  c.rect(17, 6, 7, 9, 'white');
  c.frame(17, 6, 7, 9, 'orange1');
  glyphs(c, '7', 19, 8, 'orange0');
  c.vline(20, 15, 6, 'steel1');
  c.hline(18, 21, 5, 'ink1');
  return c.outline('ink0');
}

/** Water cooler. The speech bubble over it is the rumor of the hour. */
export function cooler(): Px {
  const c = new Px(14, 28);
  // rumor bubble
  c.rect(7, 0, 7, 7, 'white');
  for (const [x, y] of [[7, 0], [13, 0], [7, 6], [13, 6]] as const) c.set(x, y, 'clear');
  c.set(8, 7, 'white');
  c.set(7, 8, 'white');
  glyphs(c, '!', 9, 1, 'berry1');
  // water jug
  c.rect(5, 9, 4, 1, 'sky');
  c.rect(4, 10, 6, 1, 'sky');
  c.rect(3, 11, 8, 6, 'sky');
  c.rect(4, 17, 6, 1, 'sky');
  c.rect(3, 13, 8, 4, 'blue2');
  c.rect(4, 17, 6, 1, 'blue2');
  c.hline(3, 13, 8, 'sky');
  c.vline(4, 10, 3, 'white');
  c.set(7, 15, 'white');
  c.set(6, 14, 'white');
  c.set(8, 16, 'sky');
  c.rect(5, 18, 4, 1, 'ink4');
  // cabinet with a dark recess, two taps and a cup
  bevel(c, 1, 19, 12, 9, ['white', 'ink5', 'ink4']);
  c.rect(3, 21, 8, 5, 'ink2');
  c.rect(5, 22, 1, 2, 'blue1');
  c.set(5, 22, 'blue2');
  c.rect(8, 22, 1, 2, 'berry1');
  c.set(8, 22, 'pink');
  c.set(5, 24, 'sky');
  c.rect(7, 24, 3, 2, 'white');
  c.hline(3, 25, 4, 'steel1');
  c.hline(1, 27, 12, 'ink3');
  return c.outline('ink0');
}

/** Snack fridge with a very firm note on the door. */
export function fridge(): Px {
  const c = new Px(14, 30);
  // sparkling water on top
  c.hline(2, 0, 3, 'steel2');
  c.rect(2, 1, 3, 3, 'blue2');
  c.hline(2, 2, 3, 'white');
  bevel(c, 0, 4, 14, 24, ['mint', 'teal2', 'teal1']);
  c.hline(1, 12, 12, 'teal0');
  c.set(2, 6, 'yellow');
  // handles
  c.rect(11, 6, 2, 4, 'steel2');
  c.vline(11, 6, 4, 'steel3');
  c.rect(11, 14, 2, 8, 'steel2');
  c.vline(11, 14, 8, 'steel3');
  // the note, held on by one magnet
  c.rect(1, 15, 9, 8, 'yellow');
  c.hline(1, 22, 9, 'orange3');
  c.set(5, 15, 'berry1');
  glyphs(c, 'NO', 2, 17, 'orange1');
  // feet
  c.rect(1, 28, 3, 2, 'ink1');
  c.rect(10, 28, 3, 2, 'ink1');
  return c.outline('ink0');
}

/** A beanbag with a developer in it. Nobody has gotten out since Tuesday. */
export function beanbag(): Px {
  const c = new Px(26, 17);
  blob(c, 13, 10, 12, 6, ['violet2', 'violet1', 'violet0']);
  c.ellipse(13, 6, 5.4, 2.2, 'violet0');
  // the developer, sunk to the chin
  stamp(c, 10, 1, [
    '..hnhh.',
    '.hhhhhh',
    '.SkSSkS',
    '.SSSSSS',
    '.SSkkSS',
  ]);
  c.rect(9, 6, 8, 1, 'violet1');
  c.hline(10, 7, 6, 'violet1');
  // seams
  c.vline(6, 9, 5, 'violet0');
  c.vline(20, 9, 5, 'violet0');
  c.vline(13, 11, 4, 'violet0');
  // sleep
  glyphs(c, 'Z', 21, 0, 'sky');
  stamp(c, 18, 3, ['sss', '.s.', 'sss']);
  return c.outline('ink0');
}

/** Questionable couch: stain, duct tape, a blanket nobody washed, and a smell. */
export function couch(): Px {
  const c = new Px(30, 20);
  const tone = ['wood3', 'wood2', 'wood1'] as const;
  bevel(c, 3, 5, 24, 9, tone);
  c.set(3, 5, 'clear');
  c.set(26, 5, 'clear');
  bevel(c, 0, 8, 5, 10, tone);
  bevel(c, 25, 8, 5, 10, tone);
  c.set(0, 8, 'clear');
  c.set(29, 8, 'clear');
  bevel(c, 5, 12, 10, 5, tone);
  bevel(c, 15, 12, 10, 5, tone);
  c.rect(4, 17, 22, 2, 'wood1');
  c.hline(4, 18, 22, 'wood0');
  c.rect(2, 19, 2, 1, 'wood0');
  c.rect(26, 19, 2, 1, 'wood0');
  // pillow
  c.rect(6, 6, 5, 4, 'cream');
  c.hline(6, 9, 5, 'ink4');
  c.set(10, 6, 'white');
  // stain on one cushion, duct tape on the other
  c.ellipse(20, 14, 2.4, 1.1, 'wood0');
  c.set(21, 16, 'wood0');
  c.rect(8, 13, 4, 2, 'steel2');
  c.hline(8, 14, 4, 'steel1');
  // blanket over the right arm
  blob(c, 27, 11, 2.6, 4, ['violet2', 'violet1', 'violet0']);
  // stink lines, after the outline so they stay thin
  const out = c.outline('ink0');
  for (const x of [10, 16, 22]) {
    for (let i = 0; i < 5; i++) out.set(x + (i % 2), i, 'green2');
  }
  return out;
}

/** Ping pong table. Nobody plays: the scoreboard says 0 and the net has a cobweb. */
export function pingpong(): Px {
  const c = new Px(30, 18);
  // a card on the far end with the games played
  c.rect(24, 0, 5, 7, 'white');
  c.frame(24, 0, 5, 7, 'ink4');
  glyphs(c, '0', 25, 1, 'berry1');
  // table top
  bevel(c, 0, 4, 30, 8, ['teal2', 'teal1', 'teal0']);
  c.hline(1, 5, 28, 'white');
  c.hline(1, 10, 28, 'white');
  c.hline(1, 7, 28, 'teal2');
  c.dither(1, 7, 28, 1, 'teal2', 'teal1');
  c.rect(0, 12, 30, 2, 'teal0');
  // the net
  for (let y = 1; y < 11; y++) {
    c.set(14, y, y % 2 ? 'ink5' : 'ink4');
    c.set(15, y, y % 2 ? 'ink4' : 'ink5');
  }
  c.hline(13, 1, 4, 'white');
  // a cobweb in the near corner: three spokes and two threads
  c.hline(1, 6, 5, 'ink5');
  c.vline(1, 6, 4, 'ink5');
  c.line(1, 6, 5, 9, 'ink5');
  c.set(3, 8, 'teal1');
  c.set(2, 7, 'teal1');
  // paddle and ball
  c.ellipse(21, 8, 2.1, 1.4, 'berry1');
  c.hline(23, 8, 3, 'wood2');
  c.set(11, 8, 'white');
  // legs
  c.rect(2, 14, 2, 4, 'steel1');
  c.rect(26, 14, 2, 4, 'steel1');
  c.vline(2, 14, 4, 'steel2');
  c.vline(26, 14, 4, 'steel2');
  c.hline(1, 17, 4, 'ink1');
  c.hline(25, 17, 4, 'ink1');
  return c.outline('ink0');
}
