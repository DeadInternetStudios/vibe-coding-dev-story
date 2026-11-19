/**
 * Where a speech bubble goes. No Phaser in here, so it can be tested.
 * The room can be wider than the screen and dragged, so a bubble over someone at the edge has to stay on the screen to be read.
 */

export interface BubblePlace {
  /** left edge of the bubble, in room pixels */
  x: number;
  /** left edge of the little tail under the bubble, counted from the bubble's left edge */
  tail: number;
}

/** Air kept between a bubble and the edge of the screen. */
const EDGE = 2;
/** The tail is this wide, and stays this far inside the bubble's corners. */
const TAIL_W = 5;
const TAIL_INSET = 3;

/**
 * `speakerX` is where the person stands and `roomX` is where the room's left edge is on the screen, both in pixels.
 * The bubble is centred over the speaker, then pulled inside the part of the room the screen shows, and the tail keeps
 * pointing at the speaker from wherever the bubble ends up.
 */
export function placeBubble(speakerX: number, boxW: number, roomX: number, screenW: number): BubblePlace {
  const left = Math.max(EDGE, EDGE - roomX);
  const right = screenW - roomX - EDGE;
  const x = Math.min(Math.max(Math.round(speakerX - boxW / 2), left), Math.max(left, right - boxW));
  const tail = Math.min(Math.max(Math.round(speakerX - x - TAIL_W / 2), TAIL_INSET), Math.max(TAIL_INSET, boxW - TAIL_W - TAIL_INSET));
  return { x, tail };
}

/** True when the person stands on the screen with a little room to spare, so a joke from them can be read. */
export function onScreen(speakerX: number, roomX: number, screenW: number, margin = 8): boolean {
  const x = roomX + speakerX;
  return x > margin && x < screenW - margin;
}
