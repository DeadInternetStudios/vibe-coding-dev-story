/**
 * Where the three gauges on the second row of the top bar go. Karma, tokens and spaghetti
 * each carry their name over the icon, so nobody has to guess what a picture stands for.
 * They start at the left edge and end before the speed buttons; the bars give way when
 * the room is short, the words and numbers never do.
 */

/** the icon and the gap after it */
const ICON = 10;
/** room for the number: four digits, or "392K", or "100%" */
const NUMBER = 24;
/** between a bar and its number */
const BAR_GAP = 3;
const GAP = 5;
/** on a wide screen the gauges spread out a little */
const GAP_MAX = 14;
const MIN_BAR = 6;
const MAX_BAR = 26;

/** the karma cell is the icon and its number */
export const KARMA_W = ICON + NUMBER;

export interface GaugeRow {
  /** left edge of each gauge */
  karma: number;
  tokens: number;
  spaghetti: number;
  /** how wide the bars on tokens and spaghetti are */
  bar: number;
  /** right edge of the last gauge */
  end: number;
}

/** `left` is where the first gauge starts, `stop` the x its last number must stay left of. */
export function gaugeRow(left: number, stop: number): GaugeRow {
  const fixed = KARMA_W + GAP + (ICON + BAR_GAP + NUMBER) * 2 + GAP;
  const bar = Math.max(MIN_BAR, Math.min(MAX_BAR, Math.floor((stop - left - fixed) / 2)));
  const cell = ICON + bar + BAR_GAP + NUMBER;
  // what is left over once the bars are as fat as they get is shared between the gaps
  const gap = Math.max(GAP, Math.min(GAP_MAX, Math.floor((stop - left - KARMA_W - cell * 2) / 2)));
  const tokens = left + KARMA_W + gap;
  const spaghetti = tokens + cell + gap;
  return { karma: left, tokens, spaghetti, bar, end: spaghetti + cell };
}

/** The karma number as the bar prints it: whole up to four digits, then 12k, 125k, 1.2M, 12M. */
export function karmaText(karma: number): string {
  const n = Math.round(karma);
  if (Math.abs(n) < 10000) return `${n}`;
  const k = Math.round(n / 1000);
  if (Math.abs(k) < 1000) return `${k}k`;
  return Math.abs(n) < 1e7 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e6)}M`;
}
