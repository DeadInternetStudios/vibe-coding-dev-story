import { describe, expect, it } from 'vitest';
import { HALL_SIZE } from '../../core/save';
import { GREYED_MAX, greyedSlots, morePlaces, slotJoke } from './hallRows';

describe('the places the Hall of Fame greys out', () => {
  it('shows at most three, whatever the board holds', () => {
    for (let n = 0; n <= HALL_SIZE + 5; n++) expect(greyedSlots(n, HALL_SIZE)).toBeLessThanOrEqual(GREYED_MAX);
    expect(greyedSlots(0, HALL_SIZE)).toBe(3);
    expect(greyedSlots(1, HALL_SIZE)).toBe(3);
  });

  it('never shows a place past the end of the board', () => {
    expect(greyedSlots(HALL_SIZE - 2, HALL_SIZE)).toBe(2);
    expect(greyedSlots(HALL_SIZE - 1, HALL_SIZE)).toBe(1);
    expect(greyedSlots(HALL_SIZE, HALL_SIZE)).toBe(0);
    expect(greyedSlots(HALL_SIZE + 3, HALL_SIZE)).toBe(0);
  });

  it('gives three places in a row three different lines, short enough to print whole', () => {
    for (let place = 1; place <= HALL_SIZE; place++) {
      const lines = new Set([slotJoke(place), slotJoke(place + 1), slotJoke(place + 2)]);
      expect(lines.size).toBe(3);
      // "#20 - " comes before it on a row that holds 44 letters
      expect(slotJoke(place).length).toBeLessThanOrEqual(38);
    }
  });

  it('says how many places there are past the greyed ones, and nothing when there are none', () => {
    expect(morePlaces(0, HALL_SIZE)).toBe('+17 more places. Only the best 20 runs stay.');
    expect(morePlaces(16, HALL_SIZE)).toBe('+1 more place. Only the best 20 runs stay.');
    expect(morePlaces(17, HALL_SIZE)).toBe('');
    expect(morePlaces(HALL_SIZE, HALL_SIZE)).toBe('');
  });
});
