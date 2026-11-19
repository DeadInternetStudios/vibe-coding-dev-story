/**
 * Things the player buys for the office. One sprite per shop item `art` id.
 *
 * Anchors, so the room code can place everything without knowing the drawing:
 *   floor and corner  bottom center sits on the floor, up to 32 wide and 36 tall
 *   wall              top center hangs on the wall, up to 32 wide and 24 tall
 *   desk              bottom center sits on a desk top, up to 12 wide and 10 tall
 */
import type { Px } from '../pixel';
import { duck, plant } from './office';

export const DECOR: Record<string, () => Px> = {
  plant,
  duck,
};

export function decorPx(id: string): Px | null {
  const make = DECOR[id];
  return make ? make() : null;
}
