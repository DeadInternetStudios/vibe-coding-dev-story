import { describe, expect, it } from 'vitest';
import { gaugeRow, karmaText, KARMA_W } from './hudLayout';

/** the speed buttons start this far from the right edge: five of them, 16 apart, 4 in */
const stopFor = (contentW: number) => contentW - 4 - 5 * 16 + 1 - 4;

describe('the gauges on the second row of the top bar', () => {
  it('end before the speed buttons on every width the layouts are drawn for', () => {
    for (let w = 224; w <= 640; w++) {
      const g = gaugeRow(4, stopFor(w));
      expect(g.end, `content ${w} wide`).toBeLessThanOrEqual(stopFor(w));
    }
  });

  it('sit left to right without touching', () => {
    for (const w of [224, 234, 240, 380, 427, 640]) {
      const g = gaugeRow(4, stopFor(w));
      expect(g.karma + KARMA_W).toBeLessThan(g.tokens);
      expect(g.tokens).toBeLessThan(g.spaghetti);
      expect(g.spaghetti).toBeLessThan(g.end);
    }
  });

  it('keep the bars useful: never thinner than 6, never fatter than 26', () => {
    for (let w = 224; w <= 640; w++) {
      const { bar } = gaugeRow(4, stopFor(w));
      expect(bar).toBeGreaterThanOrEqual(6);
      expect(bar).toBeLessThanOrEqual(26);
    }
    expect(gaugeRow(4, stopFor(240)).bar).toBe(15);
    expect(gaugeRow(4, stopFor(640)).bar).toBe(26);
  });

  it('spread out a little on a wide screen and stay close on a phone', () => {
    const gap = (w: number) => {
      const g = gaugeRow(4, stopFor(w));
      return g.tokens - (g.karma + KARMA_W);
    };
    expect(gap(240)).toBe(5);
    expect(gap(427)).toBe(14);
  });
});

describe('the karma number', () => {
  it('is whole while it fits and short after that', () => {
    expect(karmaText(0)).toBe('0');
    expect(karmaText(1525.4)).toBe('1525');
    expect(karmaText(9999)).toBe('9999');
    expect(karmaText(10000)).toBe('10k');
    expect(karmaText(125400)).toBe('125k');
    expect(karmaText(999600)).toBe('1.0M');
    expect(karmaText(1234567)).toBe('1.2M');
  });

  it('never runs wider than the room set aside for it', () => {
    for (const n of [0, 7, 99, 1234, 9999, 10000, 99999, 125400, 999999, 1500000, 12345678]) expect(karmaText(n).length).toBeLessThanOrEqual(4);
  });
});
