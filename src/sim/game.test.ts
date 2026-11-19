import { describe, expect, it } from 'vitest';
import { STAT_KEYS } from '../content/types';
import { playBot, type Strategy } from './bot';
import { FIXTURE } from './fixtures';
import { OFFICE_TIERS, STAT_SOFT_CAP, TOTAL_DAYS } from './config';
import type { Game } from './game';

function invariants(g: Game): void {
  const s = g.s;
  expect(Number.isFinite(s.company.cash)).toBe(true);
  expect(Number.isFinite(s.company.tokens)).toBe(true);
  expect(s.company.spaghetti).toBeGreaterThanOrEqual(0);
  expect(s.company.spaghetti).toBeLessThanOrEqual(100);
  expect(s.staff.length).toBeLessThanOrEqual(OFFICE_TIERS[s.company.officeTier]!.desks);
  for (const m of s.staff) {
    expect(m.mood).toBeGreaterThanOrEqual(0);
    expect(m.mood).toBeLessThanOrEqual(100);
    for (const v of Object.values(m.skills)) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(99);
    }
  }
  const p = s.project;
  if (p) {
    expect(p.progress).toBeGreaterThanOrEqual(0);
    expect(p.progress).toBeLessThanOrEqual(100);
    for (const k of STAT_KEYS) {
      expect(Number.isFinite(p.stats[k])).toBe(true);
      expect(p.stats[k]).toBeGreaterThanOrEqual(0);
      expect(p.stats[k]).toBeLessThanOrEqual(STAT_SOFT_CAP);
    }
  }
}

describe('the sim', () => {
  const strategies: Strategy[] = ['smart', 'random', 'idle', 'yolo'];

  for (const strategy of strategies) {
    it(`plays a whole game as a ${strategy} bot without breaking`, () => {
      for (const seed of [1, 2, 3]) {
        const r = playBot(FIXTURE, seed, strategy, 'normal', (g) => {
          if (g.s.day % 7 === 0) invariants(g);
        });
        expect(r.endDay).toBeLessThanOrEqual(TOTAL_DAYS + 1);
        expect(r.game.s.ending).not.toBeNull();
        expect(Number.isFinite(r.score)).toBe(true);
      }
    });
  }

  it('is deterministic for a seed', () => {
    const a = playBot(FIXTURE, 42, 'smart');
    const b = playBot(FIXTURE, 42, 'smart');
    expect(JSON.stringify(a.game.snapshot())).toBe(JSON.stringify(b.game.snapshot()));
  });

  it('never locks a company out of launching: a free channel works even with cash far below the credit line', () => {
    const free = FIXTURE.channels.find((c) => c.cost === 0)!;
    const paid = FIXTURE.channels.find((c) => c.cost > 0)!;
    const tried: string[] = [];
    playBot(FIXTURE, 5, 'smart', 'normal', (g) => {
      if (tried.length === 0 && g.pending?.t === 'ready') {
        g.s.company.cash = -23000;
        tried.push(g.launch(paid.id).t, g.launch(free.id).t);
      }
    });
    expect(tried).toEqual(['invalid', expect.not.stringMatching(/^invalid$/)]);
  });

  it('round trips through JSON', () => {
    const r = playBot(FIXTURE, 7, 'smart');
    const text = JSON.stringify(r.game.snapshot());
    expect(JSON.parse(text)).toEqual(r.game.snapshot());
  });
});
