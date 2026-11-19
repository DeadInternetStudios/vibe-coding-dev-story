import { afterEach, describe, expect, it, vi } from 'vitest';
import { FOUNDER_ORIGINS } from '../sim/config';
import { FIXTURE } from '../sim/fixtures';
import { Game } from '../sim/game';
import type { Look } from '../sim/types';
import { dailyKey, dailyRun, dailySeed, dailyTag, loadDailyBest, recordDaily } from './daily';
import { fakeStorage } from './storage.fake';

afterEach(() => vi.unstubAllGlobals());

describe('the date of the daily challenge', () => {
  it('is the UTC date, whatever the clock of the player says', () => {
    expect(dailyKey(Date.UTC(2026, 10, 19, 0, 0, 0))).toBe('2026-11-19');
    expect(dailyKey(Date.UTC(2026, 10, 19, 23, 59, 59, 999))).toBe('2026-11-19');
    expect(dailyKey(Date.UTC(2026, 10, 20, 0, 0, 0))).toBe('2026-11-20');
    expect(dailyKey(new Date('2026-11-19T23:30:00-08:00'))).toBe('2026-11-20');
    expect(dailyKey(new Date('2026-11-20T06:30:00+09:00'))).toBe('2026-11-19');
  });

  it('keeps a leading zero on short months and days, and turns over the year', () => {
    expect(dailyKey(Date.UTC(2027, 0, 5))).toBe('2027-01-05');
    expect(dailyKey(Date.UTC(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31');
    expect(dailyKey(Date.UTC(2027, 0, 1, 0, 0, 0))).toBe('2027-01-01');
  });

  it('follows the clock when asked for today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-19T12:00:00Z'));
    expect(dailyKey()).toBe('2026-11-19');
    vi.setSystemTime(new Date('2026-11-20T00:00:01Z'));
    expect(dailyKey()).toBe('2026-11-20');
    vi.useRealTimers();
  });
});

describe('the seed of a day', () => {
  it('never changes for a date, or everybody would play a different run', () => {
    expect(dailySeed('2026-11-19')).toBe(3269631800);
    expect(dailySeed('2026-11-20')).toBe(1239098616);
    expect(dailySeed('2027-01-01')).toBe(1026222361);
  });

  it('is a whole number the sim can use, and differs from day to day', () => {
    const seeds = new Set<number>();
    for (let d = 0; d < 366; d++) {
      const seed = dailySeed(dailyKey(Date.UTC(2026, 0, 1 + d)));
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
      seeds.add(seed);
    }
    expect(seeds.size).toBe(366);
  });
});

describe('the run a day fixes', () => {
  it('has the seed of the day, normal difficulty and the date', () => {
    expect(dailyRun('2026-11-19')).toEqual({ seed: dailySeed('2026-11-19'), difficulty: 'normal', daily: '2026-11-19' });
  });

  it('is worded for the Hall of Fame', () => {
    expect(dailyTag('2026-11-19')).toBe('DAILY 2026-11-19');
  });

  const look = (n: number): Look => ({ skin: n, hair: n, hairColor: n, outfit: n, accessory: n % 2 });
  const start = (key: string, origin: (typeof FOUNDER_ORIGINS)[number]['id'], name: string, n: number) =>
    Game.create(FIXTURE, { ...dailyRun(key), company: `${name} Labs`, founderName: name, origin, look: look(n) });

  it('marks the saved state, and a normal run carries no mark at all', () => {
    const daily = start('2026-11-19', 'bootcamp', 'Ada', 1).snapshot();
    expect(daily.daily).toBe('2026-11-19');
    expect(daily.seed).toBe(dailySeed('2026-11-19'));
    expect(daily.difficulty).toBe('normal');
    expect(JSON.parse(JSON.stringify(daily))).toEqual(daily);

    const normal = Game.create(FIXTURE, { seed: 5, company: 'A', founderName: 'B', origin: 'bootcamp', difficulty: 'normal' }).snapshot();
    expect('daily' in normal).toBe(false);
    expect(JSON.stringify(normal)).not.toContain('daily');
  });

  it('starts the same for everyone, whatever they type, wear or were before', () => {
    const base = start('2026-11-19', 'bootcamp', 'Ada', 1).snapshot();
    for (const [i, origin] of FOUNDER_ORIGINS.entries()) {
      const other = start('2026-11-19', origin.id, `Founder ${i}`, i + 2).snapshot();
      expect(other.rng).toBe(base.rng);
      expect(other.candidates).toEqual(base.candidates);
      expect(other.staff.filter((m) => !m.isFounder)).toEqual(base.staff.filter((m) => !m.isFounder));
    }
  });

  it('starts differently on another day', () => {
    const a = start('2026-11-19', 'bootcamp', 'Ada', 1).snapshot();
    const b = start('2026-11-20', 'bootcamp', 'Ada', 1).snapshot();
    expect(b.candidates).not.toEqual(a.candidates);
  });
});

describe('your best score of the day', () => {
  const run = (score: number, rank = 'B') => ({ score, rank });

  it('is empty at first, and the game goes on without any storage', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    expect(loadDailyBest('2026-11-19')).toBeNull();
    vi.stubGlobal('localStorage', undefined);
    expect(loadDailyBest('2026-11-19')).toBeNull();
    expect(recordDaily('2026-11-19', run(10))).toEqual({ best: run(10), improved: false });
  });

  it('keeps the first score, and calls it an improvement only when an earlier score is beaten', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    expect(recordDaily('2026-11-19', run(500, 'C'))).toEqual({ best: run(500, 'C'), improved: false });
    expect(loadDailyBest('2026-11-19')).toEqual(run(500, 'C'));

    expect(recordDaily('2026-11-19', run(900, 'A'))).toEqual({ best: run(900, 'A'), improved: true });
    expect(loadDailyBest('2026-11-19')).toEqual(run(900, 'A'));

    expect(recordDaily('2026-11-19', run(300, 'D'))).toEqual({ best: run(900, 'A'), improved: false });
    expect(recordDaily('2026-11-19', run(900, 'S'))).toEqual({ best: run(900, 'A'), improved: false });
    expect(loadDailyBest('2026-11-19')).toEqual(run(900, 'A'));
  });

  it('counts each day on its own', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    recordDaily('2026-11-19', run(900, 'A'));
    expect(loadDailyBest('2026-11-20')).toBeNull();
    expect(recordDaily('2026-11-20', run(100, 'F'))).toEqual({ best: run(100, 'F'), improved: false });
    expect(loadDailyBest('2026-11-19')).toEqual(run(900, 'A'));
  });

  it('keeps a score of zero, so a day you lost still shows', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    recordDaily('2026-11-19', run(0, 'F'));
    expect(loadDailyBest('2026-11-19')).toEqual(run(0, 'F'));
    expect(recordDaily('2026-11-19', run(40, 'F')).improved).toBe(true);
  });

  it('forgets the oldest days so the store stays small', () => {
    const store = fakeStorage();
    vi.stubGlobal('localStorage', store);
    for (let d = 0; d < 20; d++) recordDaily(dailyKey(Date.UTC(2026, 10, 1 + d)), run(d + 1));
    const kept = Object.keys(JSON.parse(store.getItem('vcds.daily.v1')!) as object);
    expect(kept).toHaveLength(14);
    expect(kept[0]).toBe('2026-11-07');
    expect(kept[13]).toBe('2026-11-20');
    expect(loadDailyBest('2026-11-06')).toBeNull();
    expect(loadDailyBest('2026-11-20')).toEqual(run(20));
  });

  it('ignores junk in the saved value', () => {
    for (const raw of ['not json', '[1,2]', '"x"', '7', '{"2026-11-19":5}', '{"2026-11-19":{"score":"9","rank":"A"}}', '{"2026-11-19":{"score":9}}', '{"2026-11-19":null}']) {
      vi.stubGlobal('localStorage', fakeStorage({ 'vcds.daily.v1': raw }));
      expect(loadDailyBest('2026-11-19')).toBeNull();
      expect(recordDaily('2026-11-19', run(5))).toEqual({ best: run(5), improved: false });
    }
  });

  it('does not mistake a name from the object prototype for a day', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    for (const key of ['constructor', 'toString', '__proto__']) {
      expect(loadDailyBest(key)).toBeNull();
      expect(recordDaily(key, run(5))).toEqual({ best: run(5), improved: false });
    }
  });

  it('keeps the good days when another day in the saved value is junk', () => {
    vi.stubGlobal('localStorage', fakeStorage({ 'vcds.daily.v1': '{"2026-11-18":{"score":70,"rank":"B"},"2026-11-19":"oops"}' }));
    expect(loadDailyBest('2026-11-18')).toEqual(run(70));
    expect(loadDailyBest('2026-11-19')).toBeNull();
  });
});
