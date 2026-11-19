/**
 * Extras built behind one seam each. Add `?off=keys,share` to the address to start the game without them: the cut test,
 * and the way to hand someone a plainer game. Everything else in the game works the same with any of them off.
 *
 *   keys      desktop keyboard play (SPACE, 1-4, H T S O R, number keys on popups)
 *   share     the share popup with the picture card; off, SHARE just copies the post
 *   install   offline play and the install prompt (the service worker)
 *   buzz      phone vibration on shakes and wins
 *   trophies  the trophy case
 *   daily     the daily challenge
 */
export type FeatureName = 'keys' | 'share' | 'install' | 'buzz' | 'trophies' | 'daily';

const off = new Set(
  (typeof location === 'undefined' ? '' : (new URLSearchParams(location.search).get('off') ?? ''))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

export function feature(name: FeatureName): boolean {
  return !off.has(name);
}
