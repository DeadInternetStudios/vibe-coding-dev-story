import { describe, expect, it } from 'vitest';
import { KNEE_FROM_YEAR, SCOPES, SCOPE_KNEE, STAT_SOFT_CAP, kneeOf, scopeGrowth, scopedStat, type Scope } from './config';

const SCOPE_IDS = Object.keys(SCOPES) as Scope[];
const OPEN = (effort: number) => STAT_SOFT_CAP * (1 - Math.exp(-effort));

/** The same stat grown the way devStep grows it: a little at a time, each step scaled by what is left and by the scope. */
function grown(effort: number, scope: Scope, year: number, steps = 20000): number {
  let p = 0;
  for (let i = 0; i < steps; i++) p += (effort / steps) * STAT_SOFT_CAP * Math.max(0, 1 - p / STAT_SOFT_CAP) * scopeGrowth(scope, p, year);
  return p;
}

describe('what a small project can reach', () => {
  it('leaves year one alone, so the first launches are as kind as they were', () => {
    for (const scope of SCOPE_IDS) {
      for (const effort of [0.2, 1, 3, 8]) expect(scopedStat(effort, scope, KNEE_FROM_YEAR - 1)).toBeCloseTo(OPEN(effort), 9);
      expect(scopeGrowth(scope, STAT_SOFT_CAP - 1, KNEE_FROM_YEAR - 1)).toBe(1);
    }
  });

  it('grows at full pace under the knee in every year', () => {
    for (const scope of SCOPE_IDS) {
      const knee = kneeOf(scope, KNEE_FROM_YEAR);
      expect(scopeGrowth(scope, 0, KNEE_FROM_YEAR)).toBe(1);
      expect(scopeGrowth(scope, Math.min(knee.at, STAT_SOFT_CAP) - 0.01, KNEE_FROM_YEAR)).toBe(1);
      expect(scopedStat(0.2, scope, KNEE_FROM_YEAR)).toBeCloseTo(OPEN(0.2), 9);
    }
  });

  it('slows down past the knee on a hack and an MVP from year two, and never on the full thing', () => {
    for (const year of [KNEE_FROM_YEAR, KNEE_FROM_YEAR + 1]) {
      expect(scopeGrowth('hack', SCOPE_KNEE.hack.at, year)).toBe(SCOPE_KNEE.hack.slope);
      expect(scopeGrowth('mvp', SCOPE_KNEE.mvp.at, year)).toBe(SCOPE_KNEE.mvp.slope);
      expect(scopeGrowth('full', STAT_SOFT_CAP - 1, year)).toBe(1);
    }
    expect(SCOPE_KNEE.hack.slope).toBeLessThan(1);
    expect(SCOPE_KNEE.mvp.slope).toBeLessThan(1);
    expect(SCOPE_KNEE.hack.at).toBeLessThan(SCOPE_KNEE.mvp.at);
  });

  it('puts a bigger scope higher for the same effort, and more effort never lowers a stat', () => {
    for (const effort of [0.5, 1, 2, 4, 8]) {
      const [hack, mvp, full] = [scopedStat(effort, 'hack', 2), scopedStat(effort, 'mvp', 2), scopedStat(effort, 'full', 2)];
      expect(hack).toBeLessThanOrEqual(mvp);
      expect(mvp).toBeLessThanOrEqual(full);
    }
    for (const scope of SCOPE_IDS) {
      let last = -1;
      for (let effort = 0; effort <= 10; effort += 0.25) {
        const v = scopedStat(effort, scope, 3);
        expect(v).toBeGreaterThanOrEqual(last);
        expect(v).toBeLessThanOrEqual(STAT_SOFT_CAP);
        last = v;
      }
    }
  });

  it('keeps a strong team on a weekend hack well short of what the full app gets', () => {
    expect(scopedStat(3, 'hack', 2)).toBeLessThan(scopedStat(3, 'full', 2) * 0.65);
    expect(scopedStat(3, 'mvp', 2)).toBeLessThan(scopedStat(3, 'full', 2) * 0.85);
  });

  it('forecasts what the sim then grows, so the project wizard tells the truth', () => {
    for (const scope of SCOPE_IDS) {
      for (const year of [1, 2, 3]) {
        for (const effort of [0.3, 1, 2.5, 6]) {
          const closed = scopedStat(effort, scope, year);
          expect(Math.abs(closed - grown(effort, scope, year)) / STAT_SOFT_CAP).toBeLessThan(0.01);
        }
      }
    }
  });
});
