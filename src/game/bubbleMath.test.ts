import { describe, expect, it } from 'vitest';
import { onScreen, placeBubble } from './bubbleMath';

const SCREEN = 240;

/** What the player sees: the bubble's left and right edge on the screen. */
const shown = (speakerX: number, boxW: number, roomX: number) => {
  const p = placeBubble(speakerX, boxW, roomX, SCREEN);
  return { left: roomX + p.x, right: roomX + p.x + boxW, tail: p.tail };
};

describe('placeBubble', () => {
  it('sits centred over the speaker when there is room', () => {
    const p = placeBubble(100, 60, 0, SCREEN);
    expect(p.x).toBe(70);
    expect(p.tail).toBe(Math.round(30 - 2.5));
  });

  it('stays whole on the screen wherever the room has been dragged, for a speaker anywhere in it', () => {
    for (const roomX of [0, -30, -77, -150, -208]) {
      for (let speakerX = 0; speakerX <= 448; speakerX += 7) {
        for (const boxW of [40, 76, 84]) {
          const { left, right } = shown(speakerX, boxW, roomX);
          expect(left).toBeGreaterThanOrEqual(2);
          expect(right).toBeLessThanOrEqual(SCREEN - 2);
        }
      }
    }
  });

  it('keeps the tail inside the bubble and pointing toward the speaker', () => {
    const atRight = shown(236, 76, 0);
    expect(atRight.right).toBe(SCREEN - 2);
    // the speaker is right of the bubble's middle, so the tail sits right of the middle
    expect(atRight.tail).toBeGreaterThan(76 / 2);
    expect(atRight.tail).toBeLessThanOrEqual(76 - 5 - 3);
    const atLeft = shown(4, 76, 0);
    expect(atLeft.left).toBe(2);
    expect(atLeft.tail).toBeLessThan(76 / 2);
    expect(atLeft.tail).toBeGreaterThanOrEqual(3);
  });

  it('keeps the old place in a room that fits the screen: the left edge of the room is as far as a bubble goes', () => {
    expect(placeBubble(4, 60, 16, SCREEN).x).toBe(2);
  });

  it('puts a bubble wider than the screen at the left edge instead of looping or going negative', () => {
    const p = placeBubble(120, 400, 0, SCREEN);
    expect(p.x).toBe(2);
    expect(p.tail).toBeGreaterThanOrEqual(3);
  });
});

describe('onScreen', () => {
  it('is true for someone you can see and false for someone the room has scrolled away', () => {
    expect(onScreen(100, 0, SCREEN)).toBe(true);
    expect(onScreen(100, -150, SCREEN)).toBe(false);
    expect(onScreen(300, -150, SCREEN)).toBe(true);
    expect(onScreen(4, 0, SCREEN)).toBe(false);
    expect(onScreen(236, 0, SCREEN)).toBe(false);
  });
});
