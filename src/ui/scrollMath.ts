/**
 * The numbers behind a scrolling list. No Phaser in here, so they can be tested.
 * All sizes are in art pixels.
 */

export interface Stack {
  /** top of each row, counted from the top of the content */
  tops: number[];
  /** height of everything: the rows and the gaps between them */
  total: number;
}

/** Puts rows of the given heights one under the other with a gap between them. */
export function stackRows(heights: readonly number[], gap: number): Stack {
  const tops: number[] = [];
  let y = 0;
  for (const h of heights) {
    tops.push(y);
    y += h + gap;
  }
  return { tops, total: Math.max(0, y - gap) };
}

/** Keeps the scroll position inside the content. Content shorter than the window never scrolls. */
export function clampScroll(scroll: number, total: number, view: number): number {
  return Math.min(Math.max(0, total - view), Math.max(0, scroll));
}

export interface Thumb {
  y: number;
  h: number;
}

/** The handle of the scrollbar inside a track, or null when everything fits and there is no bar. */
export function thumbRect(total: number, view: number, scroll: number, track: number, minH = 8): Thumb | null {
  if (total <= view) return null;
  const h = Math.min(track, Math.max(minH, Math.round((track * view) / total)));
  const y = Math.round(((track - h) * scroll) / (total - view));
  return { y, h };
}

/** A flick slows down on its own. After this long a flick has lost about two thirds of its speed. */
export const COAST_MS = 260;

/** Under this speed, in pixels per millisecond, a coasting list just stops. */
export const COAST_STOP = 0.02;

export interface Coast {
  /** pixels to move this frame */
  move: number;
  /** speed left, 0 once it is slow enough to stop */
  vel: number;
}

/** One frame of a flick coasting to a stop. The same total distance whatever the frame rate. */
export function coast(vel: number, dtMs: number): Coast {
  const decay = Math.exp(-dtMs / COAST_MS);
  const next = vel * decay;
  return { move: vel * COAST_MS * (1 - decay), vel: Math.abs(next) < COAST_STOP ? 0 : next };
}
