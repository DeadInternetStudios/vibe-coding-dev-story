/**
 * What the Hall of Fame lists after the runs it holds. A board that keeps twenty runs
 * does not print twenty empty rows: a few greyed places show what is up for grabs and
 * one line says how many more there are.
 */

/** the most greyed places shown under the runs */
export const GREYED_MAX = 3;

const SLOT_JOKES = [
  'Waiting for a brave founder.',
  'Reserved for your next pivot.',
  'Held open by a tiny hope.',
  'Currently a prompt, not a plan.',
  'Ship something. Anything.',
  'The office cat sits here for now.',
];

/** how many greyed places follow `entries` runs on a board that keeps `size` */
export function greyedSlots(entries: number, size: number): number {
  return Math.max(0, Math.min(GREYED_MAX, size - entries));
}

/** The line under an empty place. Places next to each other never share one. */
export function slotJoke(place: number): string {
  return SLOT_JOKES[place % SLOT_JOKES.length]!;
}

/** The line after the greyed places, empty when the board has no more places than those. */
export function morePlaces(entries: number, size: number): string {
  const more = size - entries - greyedSlots(entries, size);
  if (more <= 0) return '';
  return `+${more} more ${more === 1 ? 'place' : 'places'}. Only the best ${size} runs stay.`;
}
