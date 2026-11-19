import type { StatKey } from '../content/types';

/** What a thread's rating can be about: one of the app's stats, the whole app, or the hype around it. */
export type Judged = StatKey | 'overall' | 'hype';

const NAME: Record<Judged, string> = {
  vibes: 'VIBES',
  features: 'FEATURES',
  polish: 'POLISH',
  stability: 'STABILITY',
  security: 'SECURITY',
  overall: 'OVERALL',
  hype: 'HYPE',
};

/**
 * When a thread rates the same thing again, the next rating takes another word for it, so no tile reads as the one before it
 * with a number added. A thread has four ratings, so three more words per kind are enough. Eight letters is what the narrowest tile holds.
 */
const AGAIN: Record<Judged, readonly [string, string, string]> = {
  vibes: ['MOOD', 'ENERGY', 'AURA'],
  features: ['SCOPE', 'DEPTH', 'BELLS'],
  polish: ['LOOKS', 'SHINE', 'FINISH'],
  stability: ['UPTIME', 'SOLID', 'STEADY'],
  security: ['PRIVACY', 'TRUST', 'LOCKS'],
  overall: ['GUT', 'SELL', 'WOW'],
  hype: ['BUZZ', 'CLOUT', 'FAME'],
};

/** The one plain word that is long enough to be cut short ("STABI...") in the narrowest tile. */
const SHORT: Partial<Record<Judged, string>> = { stability: 'STABLE' };

/** The words for a thread's ratings, in the order they were handed out. `room` is how many letters the place for them holds. */
export function judgeNames(ratings: readonly Judged[], room = Infinity): string[] {
  const seen = new Map<Judged, number>();
  return ratings.map((kind) => {
    const nth = seen.get(kind) ?? 0;
    seen.set(kind, nth + 1);
    if (nth > 0) return AGAIN[kind][nth - 1] ?? NAME[kind];
    return NAME[kind].length > room ? (SHORT[kind] ?? NAME[kind]) : NAME[kind];
  });
}
