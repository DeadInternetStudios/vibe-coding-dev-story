/** The tall tower's rooftop sign, where the night city draws it. */
interface Sign {
  x: number;
  y: number;
  w: number;
}

/** The top band belongs to the sound switch, its hint and the best-rank chip: the logo starts under it. */
export const TITLE_BAND = 22;
/** The news strip along the bottom. */
export const STRIP_H = 13;
export const BUTTON_W = 128;
export const BUTTON_H = 22;
/** The narrowest lane beside the buttons that can hold a box of words. */
const LANE_MIN_W = 124;

/**
 * Where the logo goes on the title, and how big. The logo, the tagline and the buttons are one block that starts a third
 * of the way into the free space. On a short screen the last button would sit on the rooftop sign of the tall tower behind
 * it, so the block is lifted until its bottom clears the sign, but never into the band at the top.
 * `blockH` is the height from the top of the logo to the bottom of the last button.
 */
export function titleBlock(o: { W: number; H: number; cx: number; save: boolean; logo: { w: number; h: number }; sign: Sign }): {
  scale: number;
  logoH: number;
  logoY: number;
  menuH: number;
  blockH: number;
} {
  const buttons = o.save ? 4 : 3;
  const menuH = buttons * (BUTTON_H + 5) + (o.save ? 9 : 0);
  const fits = (sc: number) => TITLE_BAND + o.logo.h * sc + 14 + 14 + menuH + STRIP_H + 6 <= o.H;
  let scale = Math.max(1, Math.min(3, Math.floor((o.W - 16) / o.logo.w)));
  while (scale > 1 && !fits(scale)) scale--;
  const logoH = o.logo.h * scale;
  const free = o.H - STRIP_H - logoH - 14 - menuH - TITLE_BAND;
  const base = TITLE_BAND + Math.max(0, Math.floor(free * 0.32));
  const blockH = logoH + menuH + 15;
  const underButtons = o.sign.x + o.sign.w + 6 > o.cx - BUTTON_W / 2;
  const logoY = underButtons ? Math.max(TITLE_BAND, Math.min(base, o.sign.y - 4 - blockH)) : base;
  return { scale, logoH, logoY, menuH, blockH };
}

/**
 * Where a box goes on the title so that it never covers the buttons: in the free lane beside them when the screen is wide,
 * centred under them when it is narrow. `menuTop` is the top of the first button, `menuBottom` the bottom of the last one.
 */
export function freeSpot(o: { W: number; H: number; cx: number; menuTop: number; menuBottom: number; boxH: number }): { x: number; y: number; w: number } {
  const half = BUTTON_W / 2;
  const left = { x: 4, w: o.cx - half - 8 - 4 };
  const right = { x: o.cx + half + 8, w: o.W - 4 - (o.cx + half + 8) };
  const lane = right.w >= LANE_MIN_W ? right : left.w >= LANE_MIN_W ? left : null;
  if (lane) return { x: lane.x, y: o.menuTop + 6, w: Math.min(176, lane.w) };
  const w = Math.min(o.W - 12, 224);
  return { x: Math.floor((o.W - w) / 2), y: Math.min(o.menuBottom + 10, o.H - STRIP_H - 4 - o.boxH), w };
}
