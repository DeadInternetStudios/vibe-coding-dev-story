import { describe, expect, it } from 'vitest';
import { KINDS } from '../content/kinds';
import { fit, payWord } from './text';

describe('payWord', () => {
  it('gives every kind in the game a word, from the lowest paying to the highest', () => {
    const order = ['PEANUTS', 'A BIT', 'OK', 'WELL', 'HUGE'];
    const words = KINDS.map((k) => payWord(k.money));
    for (const w of words) expect(order).toContain(w);
    expect(new Set(words)).toEqual(new Set(order));
    for (let money = 2; money < 10; money++) expect(order.indexOf(payWord(money + 1))).toBeGreaterThanOrEqual(order.indexOf(payWord(money)));
  });

  it('fits the title row of the smallest wizard with its heading', () => {
    for (const money of [2, 4, 6, 8, 10]) expect(`PAYS ${payWord(money)}`.length).toBeLessThanOrEqual(12);
  });
});

describe('fit', () => {
  it('leaves short text alone', () => {
    expect(fit('Pipe Connect', 12)).toBe('Pipe Connect');
  });

  it('ends a cut in three dots and stays within the limit', () => {
    const cut = fit('Hermit Linux, the sequel', 12);
    expect(cut).toBe('Hermit Li...');
    expect(cut.length).toBeLessThanOrEqual(12);
  });

  it('does not leave a comma or a space before the dots', () => {
    expect(fit('Hermit Linux, the sequel', 16)).toBe('Hermit Linux...');
    expect(fit('Doggo & Co. Limited', 9)).toBe('Doggo...');
  });
});
