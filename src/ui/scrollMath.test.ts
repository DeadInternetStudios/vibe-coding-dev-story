import { describe, expect, it } from 'vitest';
import { clampScroll, coast, COAST_MS, COAST_STOP, stackRows, thumbRect } from './scrollMath';

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
