/**
 * Wall items. They hang from the top center and are 32 wide and 24 tall at
 * most after the outline, so the top row of each drawing touches the wall.
 */
import { glyphs } from '../glyphs';
import { Px, ink, type InkName } from '../pixel';
import { bevel, stamp } from './draw';

/** An arrow from (x0, y0) to (x1, y1) with a two pixel head. */
function arrow(p: Px, x0: number, y0: number, x1: number, y1: number, c: InkName): void {
  p.line(x0, y0, x1, y1, c);
  const dx = Math.sign(x1 - x0);
  const dy = Math.sign(y1 - y0);
  if (dy === 0) {
    p.set(x1 - dx, y1 - 1, c);
    p.set(x1 - dx, y1 + 1, c);
  } else {
    p.set(x1 - dx, y1, c);
    p.set(x1, y1 - dy, c);
  }
}

/** Boxes. Arrows. A very confident circle. Three arrows feed one box labeled AI. */
export function whiteboard(): Px {
  const c = new Px(30, 18);
  // aluminium frame, lit from the top left
  bevel(c, 0, 0, 30, 16, ['steel3', 'steel2', 'steel1']);
  // the board, with the frame's shadow on the top and left
  c.rect(1, 1, 28, 14, 'white');
  c.hline(1, 1, 28, 'ink5');
  c.vline(1, 1, 14, 'ink5');
  // three sticky notes that all lead to the same place
  c.rect(2, 2, 4, 3, 'yellow');
  c.rect(2, 7, 4, 3, 'pink');
  c.rect(2, 11, 4, 3, 'mint');
  arrow(c, 7, 3, 11, 5, 'blue0');
  arrow(c, 7, 8, 11, 8, 'orange1');
  arrow(c, 7, 12, 11, 10, 'green1');
  // the very confident circle
  c.ellipse(20, 8, 7.4, 5.2, 'orange1');
  c.ellipse(20, 8, 6.4, 4.2, 'white');
  // the box
  c.rect(16, 5, 9, 7, 'blue1');
  c.hline(16, 5, 9, 'blue2');
  c.hline(16, 11, 9, 'blue0');
  glyphs(c, 'AI', 17, 6, 'white');
  // tray with three markers
  c.rect(4, 16, 22, 2, 'steel2');
  c.hline(4, 17, 22, 'steel1');
  c.rect(7, 15, 4, 1, 'orange1');
  c.rect(13, 15, 4, 1, 'blue1');
  c.rect(19, 15, 4, 1, 'green1');
  return c.outline('ink0');
}

/** A pink neon sign on chains. The first I is flickering, and a spark says it is not going to last. */
export function neon(): Px {
  const c = new Px(29, 15);
  for (const x of [5, 23]) {
    c.set(x, 0, 'steel2');
    c.set(x, 1, 'steel1');
    c.set(x, 2, 'steel2');
  }
  c.rect(0, 3, 29, 12, 'ink1');
  c.frame(0, 3, 29, 12, 'ink2');
  c.hline(1, 14, 27, 'ink0');

  // the letters first, on a scratch canvas, so the glow can follow their shape
  const letters = new Px(29, 15);
  glyphs(letters, 'SHIP', 2, 6, 'pink');
  glyphs(letters, 'IT', 20, 6, 'pink');
  const flicker = new Px(29, 15);
  for (let y = 6; y < 11; y++) {
    for (let x = 10; x < 13; x++) {
      if (!letters.get(x, y)) continue;
      flicker.set(x, y, 'berry1');
      letters.set(x, y, 'clear');
    }
  }
  // glow only on cells that touch the letters from one side, so the gaps between strokes stay dark and legible
  const plate = ink('ink1');
  const lit = (x: number, y: number) => letters.get(x, y) !== 0 || flicker.get(x, y) !== 0;
  for (let y = 4; y < 14; y++) {
    for (let x = 1; x < 28; x++) {
      if (c.get(x, y) !== plate || lit(x, y)) continue;
      const across = (lit(x - 1, y) && lit(x + 1, y)) || (lit(x, y - 1) && lit(x, y + 1));
      const near = lit(x - 1, y) || lit(x + 1, y) || lit(x, y - 1) || lit(x, y + 1);
      if (near && !across && letters.get(x - 1, y) + letters.get(x + 1, y) + letters.get(x, y - 1) + letters.get(x, y + 1) > 0) c.set(x, y, 'berry0');
    }
  }
  c.blit(letters, 0, 0);
  c.blit(flicker, 0, 0);
  c.set(11, 4, 'yellow');
  c.set(13, 5, 'orange3');

  // an underline that buzzes
  c.hline(3, 12, 8, 'pink');
  c.hline(13, 12, 13, 'pink');
  return c.outline('ink0');
}

/** A trophy shelf: one real cup, one star, one medal, and a row of the same little cup for everybody. */
export function trophy(): Px {
  const c = new Px(30, 22);
  bevel(c, 0, 0, 30, 22, ['wood4', 'wood3', 'wood1']);
  c.rect(2, 2, 26, 18, 'wood1');
  c.hline(2, 2, 26, 'wood0');
  c.vline(2, 2, 18, 'wood0');
  // middle shelf
  c.rect(2, 10, 26, 2, 'wood3');
  c.hline(2, 10, 26, 'wood4');
  c.hline(2, 11, 26, 'wood2');
  // the one real trophy
  stamp(c, 4, 2, [
    '.wyyyyY.',
    'Yywyyyyy',
    'Y.yyyY.Y',
    '.Yyyyyy.',
    '..Yyyy..',
    '...YY...',
    '..OOOO..',
    '.OOOOOO.',
  ]);
  // a golden star on a block
  stamp(c, 13, 4, [
    '..y..',
    '.yyy.',
    'yywyy',
    '.yyY.',
    '.YOO.',
    '.OOO.',
  ]);
  // a medal on a blue ribbon
  stamp(c, 21, 2, [
    'b...b',
    'bB.Bb',
    '.bBb.',
    '..y..',
    '.ywy.',
    '.yyY.',
    '..Y..',
  ]);
  // the participation row: all the same, all golden
  for (let i = 0; i < 4; i++) {
    stamp(c, 3 + i * 6, 15, [
      'yyyyY',
      'ywyYY',
      '.yyY.',
      '..Y..',
      '.OOO.',
    ]);
  }
  return c.outline('ink0');
}
