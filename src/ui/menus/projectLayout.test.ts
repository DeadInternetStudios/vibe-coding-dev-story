import { describe, expect, it } from 'vitest';
import { FACE_H, FACE_ROW_H, FORECAST_NOTE_BOTTOM, NAME_H, START_FROM_BOTTOM, wizardRows } from './projectLayout';

const facesBottom = (r: ReturnType<typeof wizardRows>) => r.faceY + (r.faceRows - 1) * FACE_ROW_H + FACE_H;

// the card widths the layout code can get: portrait canvases are 224 to 330 art pixels wide, the wide card is 380 to 410 wide
const NARROW = [220, 234, 246].map((w) => ({ w, lw: w - 12, rx: 6, rw: w - 12 }));
const WIDE = [376, 410].map((w) => ({ w, lw: 196, rx: 210, rw: w - 210 - 6 }));
const STAFF = Array.from({ length: 16 }, (_, i) => i + 1);

describe('new project card layout', () => {
  it('narrow card: faces, name row, forecast and the START button never sit on top of each other, for 1 to 16 people', () => {
    for (const c of NARROW) {
      for (const n of STAFF) {
        const r = wizardRows(false, n, c.lw, c.rx, c.rw);
        expect(facesBottom(r), `${n} people at ${c.w} wide: faces run into the name row`).toBeLessThanOrEqual(r.nameY);
        expect(r.nameY + NAME_H, `${n} people at ${c.w} wide: name row runs into the forecast`).toBeLessThanOrEqual(r.fy);
        expect(r.fy + FORECAST_NOTE_BOTTOM, `${n} people at ${c.w} wide: forecast text runs into START`).toBeLessThanOrEqual(r.want - START_FROM_BOTTOM);
      }
    }
  });

  it('narrow card: the tallest card still fits the shortest phone canvas the game aims for (420 art pixels, 4 spare)', () => {
    for (const c of NARROW) for (const n of STAFF) expect(wizardRows(false, n, c.lw, c.rx, c.rw).want).toBeLessThanOrEqual(416);
  });

  it('narrow card: a team of one row leaves the forecast where it always was', () => {
    const r = wizardRows(false, 5, 222, 6, 222);
    expect([r.faceRows, r.fy, r.want]).toEqual([1, 246, 372]);
  });

  it('wide card: the right column reads forecast, who builds, START, and the whole team fits on a short landscape phone (228 high)', () => {
    for (const c of WIDE) {
      for (const n of STAFF) {
        const r = wizardRows(true, n, c.lw, c.rx, c.rw);
        const h = Math.min(228, r.want);
        expect(r.fy + FORECAST_NOTE_BOTTOM, `${n} people at ${c.w} wide: forecast text runs into the team`).toBeLessThanOrEqual(r.teamY);
        expect(facesBottom(r), `${n} people at ${c.w} wide: the faces reach the START button`).toBeLessThanOrEqual(h - START_FROM_BOTTOM);
        expect(r.nameY + NAME_H, `${n} people at ${c.w} wide: the name row falls off the card`).toBeLessThanOrEqual(h - 6);
      }
    }
  });

  it('a team of 16 takes two rows, never three', () => {
    for (const c of [...NARROW, ...WIDE]) expect(wizardRows(c.rx !== 6, 16, c.lw, c.rx, c.rw).faceRows).toBeLessThanOrEqual(2);
  });
});
