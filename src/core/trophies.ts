/**
 * The trophy case. It remembers every achievement this player ever earned, across
 * runs, in the same place as the hall of fame. Everything here is plain data and
 * plain text, so the modal only has to draw it.
 */
import type { Achievement } from '../content/types';
import { hashSeed } from '../sim/rng';
import { readJson, writeJson } from './save';

const TROPHIES_KEY = 'vcds.trophies.v1';

/** Ids of every trophy earned in any run. */
export function loadTrophies(): string[] {
  const v = readJson<unknown>(TROPHIES_KEY);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Adds ids to the saved list. It only ever grows. Returns the whole list. */
export function recordTrophies(ids: readonly string[]): string[] {
  const have = loadTrophies();
  const next = [...new Set([...have, ...ids])];
  if (next.length !== have.length) writeJson(TROPHIES_KEY, next);
  return next;
}

/** One small icon for each trophy. A trophy without one gets the cup. */
export const TROPHY_ICONS: Record<string, string> = {
  'first-ship': 'ship',
  'ship-5': 'features',
  'ship-10': 'save',
  'rating-20': 'moodOk',
  'rating-30': 'arrowUp',
  'rating-36': 'awardSilver',
  perfect: 'star',
  viral: 'awardRocket',
  'karma-1k': 'karma',
  'karma-9k': 'bolt',
  'friday-1': 'calendar',
  'friday-5': 'bell',
  'year-1': 'clock',
  'year-2': 'moodHappy',
  'year-3': 'trophy',
  scare: 'warn',
  'dead-cat': 'awardDeceased',
  'cash-100k': 'cash',
  'cash-1m': 'awardGold',
  'hire-12': 'team',
  'fire-1': 'arrowDown',
  'office-1': 'tools',
  'office-3': 'office',
  'spaghetti-90': 'spaghetti',
  'clean-code': 'polish',
  'tests-deleted': 'check',
  'accept-all': 'plus',
  rewrites: 'gear',
  slopsquatted: 'debug',
  'keys-leaked': 'security',
  'prod-deleted': 'moodPanic',
  pivots: 'dice',
  'all-nighters': 'bulb',
  'duck-talks': 'bubble',
  'cat-pets': 'heart',
  'coffee-crisis': 'moodSad',
  'merge-conflicts': 'awardFacepalm',
  'legal-letter': 'plan',
  'vc-pitch': 'hustle',
  bounty: 'awardHelp',
  naps: 'pause',
  'hire-duck': 'hire',
  'hire-ghost': 'paranoia',
  'hire-hacker': 'prompt',
  'hire-tenx': 'vibes',
  'hire-agi': 'token',
  'full-roster': 'awardWholesome',
  'trait-vim': 'cross',
  'trait-arch': 'speaker',
};

export function trophyIcon(id: string): string {
  return TROPHY_ICONS[id] ?? 'trophy';
}

const SECRET_HINTS = [
  'Secret. You will know when it happens.',
  'Secret. Try being weird.',
  'Secret. Nobody is going to tell you.',
  'Secret. Not even the cat knows.',
  'Secret. Look under the hood.',
];

/**
 * What a locked trophy says instead of its text. The achievement's own `hint` if it
 * has one, a teaser for a secret one, and otherwise its first sentence: the goal
 * stays visible and the joke after it is the reward.
 */
export function trophyHint(a: Achievement): string {
  if (a.hint) return a.hint;
  if (a.secret) return SECRET_HINTS[hashSeed(a.id) % SECRET_HINTS.length]!;
  return /^.*?[.!?](?=\s|$)/s.exec(a.desc)?.[0] ?? a.desc;
}

export interface TrophyRow {
  id: string;
  icon: string;
  name: string;
  /** the full text once earned, the teaser before */
  text: string;
  locked: boolean;
  /** earned in the run that is open right now */
  isNew: boolean;
}

export interface TrophyView {
  rows: TrophyRow[];
  got: number;
  total: number;
}

/**
 * Every achievement as a row, in content order. `saved` is what earlier runs earned,
 * `run` is what the open run has earned so far.
 */
export function trophyView(all: readonly Achievement[], saved: readonly string[], run: readonly string[]): TrophyView {
  const have = new Set([...saved, ...run]);
  const fresh = new Set(run);
  const rows = all.map((a): TrophyRow => {
    if (have.has(a.id)) return { id: a.id, icon: trophyIcon(a.id), name: a.name, text: a.desc, locked: false, isNew: fresh.has(a.id) };
    return { id: a.id, icon: a.secret ? 'question' : 'lock', name: a.secret ? '???' : a.name, text: trophyHint(a), locked: true, isNew: false };
  });
  return { rows, got: rows.filter((r) => !r.locked).length, total: rows.length };
}

/** A short line under the counter that changes as the shelf fills up. */
export function trophyQuip(got: number, total: number): string {
  if (got <= 0) return 'The shelf is empty. Go ship something.';
  if (got >= total) return 'All of them. Frame this screen.';
  const f = got / total;
  if (f < 0.25) return 'Not bad. The shelf has a vibe.';
  if (f < 0.5) return 'The shelf is filling up fast.';
  if (f < 0.75) return 'Over half. This is a personality.';
  return 'Nearly all. Go touch some grass.';
}
