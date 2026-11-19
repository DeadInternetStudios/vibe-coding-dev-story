import { describe, expect, it } from 'vitest';
import { clampScroll, coast, COAST_MS, COAST_STOP, pagesOf, stackRows, thumbRect, type LetterSpan } from './scrollMath';

describe('stackRows', () => {
  it('puts rows under each other with a gap and no gap after the last', () => {
    expect(stackRows([10, 20, 30], 2)).toEqual({ tops: [0, 12, 34], total: 64 });
  });

  it('handles no rows and one row', () => {
    expect(stackRows([], 4)).toEqual({ tops: [], total: 0 });
    expect(stackRows([17], 4)).toEqual({ tops: [0], total: 17 });
  });
});

describe('clampScroll', () => {
  it('stays inside the content', () => {
    expect(clampScroll(-20, 300, 100)).toBe(0);
    expect(clampScroll(50, 300, 100)).toBe(50);
    expect(clampScroll(999, 300, 100)).toBe(200);
  });

  it('never moves content that already fits', () => {
    expect(clampScroll(30, 80, 100)).toBe(0);
    expect(clampScroll(30, 100, 100)).toBe(0);
  });
});

describe('thumbRect', () => {
  it('has no bar when everything fits', () => {
    expect(thumbRect(100, 100, 0, 80)).toBeNull();
    expect(thumbRect(50, 100, 0, 80)).toBeNull();
  });

  it('is as big as the share of the content you can see', () => {
    expect(thumbRect(400, 100, 0, 80)).toEqual({ y: 0, h: 20 });
  });

  it('starts at the top and ends at the bottom of the track', () => {
    const top = thumbRect(400, 100, 0, 80)!;
    const end = thumbRect(400, 100, 300, 80)!;
    expect(top.y).toBe(0);
    expect(end.y + end.h).toBe(80);
  });

  it('never gets smaller than the minimum, or bigger than the track', () => {
    expect(thumbRect(100000, 100, 0, 80, 8)!.h).toBe(8);
    expect(thumbRect(101, 100, 0, 4, 8)!.h).toBe(4);
  });
});

describe('coast', () => {
  it('slows down and stops', () => {
    let vel = 1.5;
    let frames = 0;
    while (vel !== 0 && frames < 1000) {
      vel = coast(vel, 16).vel;
      frames++;
    }
    expect(vel).toBe(0);
    expect(frames).toBeLessThan(120);
  });

  it('keeps the direction', () => {
    expect(coast(-1, 16).move).toBeLessThan(0);
    expect(coast(1, 16).move).toBeGreaterThan(0);
  });

  it('two short frames move exactly as far as one long one', () => {
    const one = coast(1, 32);
    const a = coast(1, 16);
    const b = coast(a.vel, 16);
    expect(a.move + b.move).toBeCloseTo(one.move, 9);
    expect(b.vel).toBeCloseTo(one.vel, 9);
  });

  it('travels about speed times COAST_MS before it stops, at any frame rate', () => {
    for (const dt of [8, 16, 33]) {
      let vel = 1;
      let dist = 0;
      while (vel !== 0) {
        const c = coast(vel, dt);
        dist += c.move;
        vel = c.vel;
      }
      expect(dist).toBeGreaterThan(COAST_MS - 8);
      expect(dist).toBeLessThanOrEqual(COAST_MS);
    }
  });

  it('stops by itself under the stop speed', () => {
    expect(coast(COAST_STOP * 1.01, 16).vel).toBe(0);
    expect(coast(0, 16)).toEqual({ move: 0, vel: 0 });
  });
});

/** Every letter is 5 pixels wide, spaces too. */
const monospaced = (text: string): LetterSpan[] => [...text].map((_, idx) => ({ idx, left: idx * 5, right: idx * 5 + 5 }));

describe('pagesOf', () => {
  it('one screenful when the line fits', () => {
    const text = 'SHORT NEWS';
    expect(pagesOf(text, monospaced(text), 100)).toEqual([{ from: 0, to: 50 }]);
  });

  it('ends a page at a word, and the next page starts at the next word', () => {
    const text = 'AAAA BBBB CCCC DDDD';
    // 50 pixels hold ten letters, but a page may not end half way into CCCC
    expect(pagesOf(text, monospaced(text), 50)).toEqual([
      { from: 0, to: 45 },
      { from: 50, to: 95 },
    ]);
    // 40 pixels hold eight letters: two words never fit, so one word each
    expect(pagesOf(text, monospaced(text), 40)).toEqual([
      { from: 0, to: 20 },
      { from: 25, to: 45 },
      { from: 50, to: 70 },
      { from: 75, to: 95 },
    ]);
  });

  it('shows every letter exactly once, none cut, whenever the longest word fits the window', () => {
    const text = 'THE FOUNDER POSTED ABOUT GRATITUDE AGAIN THEN RAN OUT OF CASH';
    const letters = monospaced(text);
    for (const window of [50, 60, 90, 120, 400]) {
      const pages = pagesOf(text, letters, window);
      pages.forEach((p) => expect(p.to - p.from).toBeLessThanOrEqual(window));
      for (const l of letters.filter((x) => text[x.idx] !== ' ')) {
        const holding = pages.filter((p) => p.from <= l.left && l.right <= p.to);
        expect(holding).toHaveLength(1);
      }
    }
  });

  it('cuts a word that is wider than the window, and still moves on', () => {
    const text = 'AB SUPERCALIFRAGILISTIC OK';
    const pages = pagesOf(text, monospaced(text), 30);
    expect(pages.length).toBeGreaterThan(3);
    pages.forEach((p) => expect(p.to - p.from).toBeLessThanOrEqual(30));
    expect(pages.at(-1)!.to).toBe(text.length * 5);
  });

  it('has nothing to say for an empty line', () => {
    expect(pagesOf('', [], 50)).toEqual([]);
  });
});
