import { app } from './app';
import { feature } from './features';

/**
 * A short buzz on phones that can do it (Android browsers; iPhones ignore the call).
 * It follows the screen-shake switch and calm mode, so one setting covers both.
 */
export function buzz(pattern: number | readonly number[]): void {
  const s = app.settings;
  if (!feature('buzz') || !s.shake || s.reducedMotion || s.muted) return;
  try {
    navigator.vibrate?.(typeof pattern === 'number' ? pattern : [...pattern]);
  } catch {
    /* a browser that refuses is fine */
  }
}

export const BUZZ = { bump: 25, bad: [40, 30, 60], win: [20, 40, 20, 40, 60] } as const;
