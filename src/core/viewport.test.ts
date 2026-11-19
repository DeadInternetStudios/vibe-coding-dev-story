import { describe, expect, it } from 'vitest';
import { computeViewport } from './viewport';

/** [name, css width, css height, dpr, expected logical w, expected logical h] */
const DEVICES: [string, number, number, number, number, number][] = [
  // phones get big pixels so the text reads and the office is the biggest thing on screen
  ['phone portrait 390x844@3', 390, 844, 3, 234, 507],
  ['phone portrait 360x640@3', 360, 640, 3, 270, 480],
  ['phone portrait 375x667@2', 375, 667, 2, 250, 445],
  ['small phone portrait 360x640@2', 360, 640, 2, 240, 427],
  ['phone landscape 844x390@3', 844, 390, 3, 507, 234],
  ['phone landscape 667x375@2', 667, 375, 2, 445, 250],
  // tablets and squarish windows get the smaller scale so the log and the chart fit
  ['tablet portrait 768x1024@2', 768, 1024, 2, 384, 512],
  ['tablet landscape 1024x768@2', 1024, 768, 2, 410, 308],
  ['desktop window 1024x768@1', 1024, 768, 1, 512, 384],
  // wide desktops stay as they were
  ['laptop 1440x900@1', 1440, 900, 1, 480, 300],
  ['full hd 1920x1080@1', 1920, 1080, 1, 480, 270],
  // big windows with one device pixel per CSS pixel: an art pixel is many pixels wide, so the canvas stops short of the edge instead of sticking out
  ['ultrawide 3440x1440@1', 3440, 1440, 1, 573, 240],
  ['4k 3840x2160@1', 3840, 2160, 1, 426, 240],
];

describe('viewport', () => {
  for (const [name, w, h, dpr, lw, lh] of DEVICES) {
    it(`${name} is ${lw}x${lh} art pixels`, () => {
      const v = computeViewport(w, h, dpr);
      expect([v.w, v.h]).toEqual([lw, lh]);
    });
  }

  it('always scales by a whole number of device pixels', () => {
    for (const [, w, h, dpr] of DEVICES) {
      const v = computeViewport(w, h, dpr);
      expect(Number.isInteger(v.scale)).toBe(true);
    }
  });

  it('never sticks out of the window by more than a pixel on a side, and never stops short by more than an art pixel', () => {
    for (const dpr of [1, 1.25, 1.5, 2, 2.625, 3]) {
      for (let w = 320; w <= 3840; w += 37) {
        for (const h of [568, 640, 844, 900, 1080, 1440, 2160]) {
          const v = computeViewport(w, h, dpr);
          for (const [art, dev] of [[v.w, Math.round(w * dpr)], [v.h, Math.round(h * dpr)]] as const) {
            const overhang = (art * v.scale - dev) / 2 / v.dpr;
            expect(overhang).toBeLessThanOrEqual(1);
            expect(dev - art * v.scale).toBeLessThan(v.scale);
          }
        }
      }
    }
  });

  it('a bigger UI choice keeps the big pixels even on a tablet', () => {
    const roomy = computeViewport(768, 1024, 2, 0);
    const big = computeViewport(768, 1024, 2, 1);
    expect(big.scale).toBeGreaterThan(roomy.scale);
  });
});
