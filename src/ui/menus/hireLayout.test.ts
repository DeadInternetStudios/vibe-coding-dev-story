import { describe, expect, it } from 'vitest';
import { HIRE_TOP, HIRE_WIDE_FOOT, hireLayout } from './hireLayout';

/** What `popupH` allows: the screen height less a margin. A phone on its side is 234 high, a laptop 300, an upright phone 427 and up. */
const CAPS = [
  ['phone on its side', 220],
  ['laptop', 296],
  ['big laptop', 410],
] as const;

describe('the job board on a screen of any height', () => {
  it.each(CAPS)('%s: every row and the line under them fit inside the card', (_name, cap) => {
    for (let rows = 1; rows <= 6; rows++) {
      const { rowH, h } = hireLayout(cap, rows, true);
      const lastRowBottom = HIRE_TOP + rows * (rowH + 2) - 2;
      expect(h).toBeLessThanOrEqual(cap);
      expect(lastRowBottom).toBeLessThanOrEqual(h - HIRE_WIDE_FOOT + 2);
    }
  });

  it('a row is never so short that its name, role, skills, traits and salary collide', () => {
    for (const [, cap] of CAPS) for (let rows = 1; rows <= 6; rows++) expect(hireLayout(cap, rows, true).rowH).toBeGreaterThanOrEqual(26);
  });

  it('a laptop keeps the full-height rows', () => {
    expect(hireLayout(296, 6, true).rowH).toBe(29);
  });

  it('a phone on its side gives six rows 27 px each', () => {
    expect(hireLayout(220, 6, true).rowH).toBe(27);
  });

  it('an upright phone has tall rows, and its card still fits the smallest upright screen', () => {
    expect(hireLayout(423, 6, false)).toEqual({ rowH: 44, h: 352 });
    expect(hireLayout(406, 6, false).h).toBeLessThanOrEqual(406);
  });
});
