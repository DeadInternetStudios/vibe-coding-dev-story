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

/** Where one letter of a line sits: its index in the text and its left and right edge, in pixels from the start of the line. */
export interface LetterSpan {
  idx: number;
  left: number;
  right: number;
}

/** One screenful of a line: the letters from `from` to `to`, in pixels from the start of the line. */
export interface Page {
  from: number;
  to: number;
}

/**
 * The screenfuls of a line that is read a window at a time, for a line that does not move: each is held for a moment,
 * then the next. No word is cut, except one that is wider than the window, which is cut where the window ends.
 */
export function pagesOf(text: string, letters: readonly LetterSpan[], window: number): Page[] {
  const pages: Page[] = [];
  let i = 0;
  while (i < letters.length) {
    const from = letters[i]!.left;
    let last = i;
    let lastWordEnd = -1;
    for (let j = i; j < letters.length && letters[j]!.right - from <= window; j++) {
      last = j;
      const after = letters[j + 1];
      if (!after || text[after.idx] === ' ') lastWordEnd = j;
    }
    const end = lastWordEnd >= i ? lastWordEnd : last;
    pages.push({ from, to: letters[end]!.right });
    i = end + 1;
    while (i < letters.length && text[letters[i]!.idx] === ' ') i++;
  }
  return pages;
}
