/**
 * The tall pieces: arcade cabinet, server rack, massage chair, barista robot.
 * Anchored at the bottom center, up to 36 tall after the outline.
 */
import { glyphs } from '../glyphs';
import { Px } from '../pixel';
import { bevel, stamp } from './draw';

/** Arcade cabinet. The high score belongs to INT, and nobody knows how. */
export function arcade(): Px {
  const c = new Px(19, 32);
  const body = '..V' + 'v'.repeat(13) + 'u..';
  const rows: string[] = [];
  rows.push('.' + 'V'.repeat(16) + 'v.');
  for (let i = 0; i < 5; i++) rows.push('.V' + 'o'.repeat(15) + 'v.');
  rows.push('.' + 'u'.repeat(17) + '.');
  rows.push(body);
  rows.push('..V' + 'K'.repeat(13) + 'u..');
  for (let i = 0; i < 11; i++) rows.push('..VK' + 'z'.repeat(11) + 'Ku..');
  rows.push('..V' + 'K'.repeat(13) + 'u..');
  rows.push('A'.repeat(19));
  rows.push('e' + 'i'.repeat(17) + 'a');
  rows.push('e' + 'i'.repeat(17) + 'a');
  rows.push('A' + 'a'.repeat(17) + 'x');
  for (let i = 0; i < 6; i++) rows.push(body);
  rows.push('.' + 'K'.repeat(17) + '.');
  stamp(c, 0, 0, rows);
  // marquee and screen
  glyphs(c, 'BUG', 4, 1, 'yellow');
  glyphs(c, 'INT', 4, 11, 'yellow');
  for (const x of [5, 11]) {
    c.hline(x, 17, 1, 'green2');
    c.hline(x + 2, 17, 1, 'green2');
    c.hline(x, 18, 3, 'green2');
  }
  c.set(9, 17, 'mint');
  c.set(9, 18, 'mint');
  // stick and buttons
  c.rect(3, 22, 2, 2, 'berry1');
  c.set(3, 22, 'pink');
  c.rect(9, 22, 2, 2, 'yellow');
  c.rect(12, 22, 2, 2, 'blue2');
  c.rect(15, 22, 2, 2, 'green2');
  // coin door
  c.rect(6, 26, 7, 4, 'ink1');
  c.set(8, 27, 'yellow');
  c.set(10, 27, 'yellow');
  c.hline(8, 29, 3, 'berry1');
  return c.outline('ink0');
}

/** Server rack. It blinks green. Green means something. Probably. */
export function rack(): Px {
  const c = new Px(16, 34);
  const lit = (rows: string[]) => ['a' + 'j'.repeat(14) + 'x', ...rows.map((r) => 'a' + r + 'x'), 'a' + 'K'.repeat(14) + 'x'];
  const server = lit(['iGiaaaaiaaaaii', 'iiiaaaaiaaaaii', 'iriiiiiiiiiiii']);
  const sw = lit(['iGiGiGiGiGiGii', 'iKiKiKiKiKiKii', 'iiiiiiiiiiiiii']);
  const warm = lit(['iyiaaaaiaaaaii', 'iiiaaaaiaaaaii', 'iOiiiiiiiiiiii']);
  const vent = lit(['iKKKKKKKKKKKKi', 'iiiiiiiiiiiiii', 'iKKKKKKKKKKKKi']);
  const ups = lit(['iiKGGGKiiaaaii', 'iiKKKKKiiaaaii', 'iiiiiiiiiiiiii']);
  const rows = ['.' + 'A'.repeat(14) + '.', 'a' + 'e'.repeat(14) + 'x', ...sw, ...server, ...server, ...warm, ...vent, ...ups, 'x'.repeat(16), 'K'.repeat(16)];
  stamp(c, 0, 0, rows.slice(0, 34));
  // a sticky note that asks the question for everyone
  c.rect(9, 3, 5, 7, 'yellow');
  c.hline(9, 9, 5, 'orange3');
  glyphs(c, '?', 10, 4, 'orange1');
  // cables on the floor
  for (let x = 1; x < 15; x++) c.set(x, 33, (['berry1', 'blue1', 'yellow', 'green1'] as const)[x % 4]!);
  return c.outline('ink0');
}

/** Massage chair. The bug count goes down. The snoring goes up. */
export function massage(): Px {
  const c = new Px(24, 30);
  const leather = ['brick2', 'brick1', 'brick0'] as const;
  // sleeping developer
  stamp(c, 8, 1, [
    '.hhhhh.',
    'hhnhhhh',
    'SSSSSSS',
    'SkSSSkS',
    'SSSSSSS',
    'SSSkkSS',
  ]);
  // headrest and back, with two roller tracks
  bevel(c, 7, 6, 9, 4, leather);
  c.set(7, 6, 'clear');
  c.set(15, 6, 'clear');
  bevel(c, 5, 9, 13, 13, leather);
  c.rect(7, 11, 2, 9, 'brick0');
  c.rect(14, 11, 2, 9, 'brick0');
  for (const y of [12, 16]) {
    c.rect(7, y, 2, 2, 'cream');
    c.rect(14, y, 2, 2, 'cream');
  }
  // arms with pads and a remote
  for (const x of [0, 18]) {
    bevel(c, x, 15, 5, 3, leather);
    c.rect(x + 1, 18, 3, 6, 'brick1');
    c.vline(x + 3, 18, 6, 'brick0');
  }
  c.set(0, 15, 'clear');
  c.set(22, 15, 'clear');
  c.rect(19, 16, 3, 1, 'ink1');
  c.set(19, 16, 'green2');
  c.set(21, 16, 'berry1');
  // seat, footrest and base
  bevel(c, 3, 22, 18, 5, leather);
  c.hline(4, 23, 16, 'brick2');
  bevel(c, 6, 27, 12, 2, leather);
  c.set(9, 27, 'cream');
  c.set(14, 27, 'cream');
  c.hline(3, 29, 18, 'ink1');
  // snoring and the hum of the rollers
  glyphs(c, 'Z', 19, 0, 'sky');
  stamp(c, 16, 4, ['sss', '.s.', 'sss']);
  const out = c.outline('ink0');
  for (const [x, y] of [[2, 11], [1, 12], [2, 13], [25, 11], [26, 12], [25, 13]] as const) out.set(x, y, 'sky');
  return out;
}

/** Barista robot. Latte art. Zero emotions. It draws a tiny cursor in the foam. */
export function barista(): Px {
  const c = new Px(30, 34);
  // antenna
  c.rect(11, 0, 2, 2, 'berry1');
  c.set(11, 0, 'pink');
  c.vline(11, 2, 2, 'steel2');
  c.vline(12, 2, 2, 'steel1');
  // head with a visor
  bevel(c, 6, 4, 12, 10, ['white', 'ink5', 'ink4']);
  for (const [x, y] of [[6, 4], [17, 4], [6, 13], [17, 13]] as const) c.set(x, y, 'clear');
  c.rect(8, 6, 8, 6, 'ink1');
  c.rect(10, 7, 1, 2, 'mint');
  c.rect(13, 7, 1, 2, 'mint');
  c.hline(10, 10, 4, 'mint');
  c.rect(5, 8, 1, 3, 'steel2');
  c.rect(18, 8, 1, 3, 'steel2');
  // neck, body, apron
  c.rect(10, 14, 4, 1, 'steel1');
  bevel(c, 5, 15, 14, 8, ['white', 'ink5', 'ink4']);
  c.rect(8, 17, 8, 6, 'orange2');
  c.vline(15, 17, 6, 'orange1');
  c.hline(8, 16, 8, 'orange1');
  c.rect(9, 20, 3, 2, 'orange1');
  c.set(14, 18, 'yellow');
  // arms
  bevel(c, 2, 16, 3, 7, ['steel3', 'steel2', 'steel1']);
  bevel(c, 19, 16, 3, 7, ['steel3', 'steel2', 'steel1']);
  // counter
  bevel(c, 0, 22, 24, 12, ['wood4', 'wood2', 'wood1']);
  c.rect(1, 23, 22, 4, 'wood3');
  c.hline(1, 23, 22, 'wood4');
  for (const x of [6, 12, 18]) c.vline(x, 28, 5, 'wood1');
  c.hline(1, 33, 22, 'wood0');
  // a mug on the counter
  c.rect(15, 20, 5, 5, 'white');
  c.hline(15, 20, 5, 'wood1');
  c.vline(19, 21, 4, 'ink5');
  c.set(20, 21, 'ink5');
  c.set(20, 22, 'ink5');
  // close up of the latte: foam with a cursor in it
  c.ellipse(24, 4, 4, 4, 'white');
  c.ellipse(24, 4, 3, 3, 'wood2');
  c.ellipse(24, 4, 2, 2, 'cream');
  stamp(c, 23, 2, ['h..', 'hh.', 'hhh', '.h.']);
  c.vline(29, 3, 3, 'ink5');
  return c.outline('ink0');
}
