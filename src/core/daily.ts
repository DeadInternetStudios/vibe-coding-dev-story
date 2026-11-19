/**
 * The daily challenge: one seeded run per UTC date, the same start for everyone.
 * The difficulty is always normal. Your best score for each day stays on this device.
 */
import type { NewGameOptions } from '../sim/game';
import { hashSeed } from '../sim/rng';
import { readJson, writeJson } from './save';

const STORE_KEY = 'vcds.daily.v1';
/** days of scores kept, so the store never grows */
const KEEP_DAYS = 14;

export interface DailyBest {
  score: number;
  rank: string;
}

/** The UTC date of a moment, like 2026-11-19. Everyone on Earth gets the same one. */
export function dailyKey(at: Date | number = Date.now()): string {
  return new Date(at).toISOString().slice(0, 10);
}

export function dailySeed(key: string): number {
  return hashSeed(`vibe-coding-daily:${key}`);
}

/** The words for a run on that day, as shown in the Hall of Fame. */
export function dailyTag(key: string): string {
  return `DAILY ${key}`;
}

/** What a daily run fixes: the seed, normal difficulty, and the date it is for. */
export function dailyRun(key: string): Required<Pick<NewGameOptions, 'seed' | 'difficulty' | 'daily'>> {
  return { seed: dailySeed(key), difficulty: 'normal', daily: key };
}

function isBest(v: unknown): v is DailyBest {
  if (typeof v !== 'object' || v === null) return false;
  const b = v as Partial<DailyBest>;
  return typeof b.score === 'number' && Number.isFinite(b.score) && typeof b.rank === 'string';
}

function loadStore(): Record<string, DailyBest> {
  const raw = readJson<unknown>(STORE_KEY);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => isBest(v)));
}

export function loadDailyBest(key: string): DailyBest | null {
  return loadStore()[key] ?? null;
}

export interface DailyResult {
  /** the best score for that day, this run included */
  best: DailyBest;
  /** true when an earlier score for that day stood and this run beat it */
  improved: boolean;
}

/** Keep the score if it is the best of its day. Only the newest days are kept. */
export function recordDaily(key: string, run: DailyBest): DailyResult {
  const store = loadStore();
  const old = store[key];
  const improved = old !== undefined && run.score > old.score;
  const best = old === undefined || improved ? run : old;
  store[key] = best;
  const days = Object.keys(store).sort().slice(-KEEP_DAYS);
  writeJson(STORE_KEY, Object.fromEntries(days.map((d) => [d, store[d]])));
  return { best, improved };
}
