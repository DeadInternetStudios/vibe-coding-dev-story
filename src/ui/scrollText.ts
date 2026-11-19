import type Phaser from 'phaser';
import { label, rect, type LabelOpts, type Scene } from './kit';

/** Where a letter of the run sits, measured once: its left edge and its right edge in pixels from the start of the run. */
interface Span {
  /** index of the letter in the string */
  idx: number;
  left: number;
  right: number;
  /** where a string that starts at this letter begins drawing, so the visible part can be redrawn from here */
  origin: number;
}

/**
 * One line of text that slides through a window and is only ever drawn in whole letters: a letter appears once all
 * of it is inside the window and goes as soon as any of it leaves. An edge never slices a word in half.
 */
export class ScrollText {
  readonly view: Phaser.GameObjects.BitmapText;
  private spans: Span[] = [];
  private full = '';
  private first = -1;
  private last = -1;
  private runX = 0;

  constructor(
    scene: Scene,
    private readonly y: number,
    private left: number,
    private right: number,
    opts: LabelOpts,
  ) {
    this.view = label(scene, 0, y, '', opts);
  }

  /** Width of the whole run. */
  get width(): number {
    return this.spans.length ? this.spans[this.spans.length - 1]!.right : 0;
  }

  /** x of the run's left end, as last placed. */
  get x(): number {
    return this.runX;
  }

  setWindow(left: number, right: number): void {
    this.left = left;
    this.right = right;
  }

  setRun(text: string): void {
    this.full = text;
    this.view.setText(text);
    const info = this.view.getTextBounds(true) as { characters: { idx: number; x: number; w: number; glyph: { xOffset: number } }[] };
    this.spans = info.characters.map((c) => ({ idx: c.idx, left: c.x, right: c.x + c.w, origin: c.x - c.glyph.xOffset }));
    this.first = -1;
    this.last = -1;
    this.view.setText('');
  }

  /** Puts the left end of the run at x and shows the letters that fit the window whole. */
  place(x: number): void {
    this.runX = Math.round(x);
    const lo = this.left - this.runX;
    const hi = this.right - this.runX;
    let a = -1;
    let b = -1;
    for (let i = 0; i < this.spans.length; i++) {
      const s = this.spans[i]!;
      if (s.left < lo) continue;
      if (s.right > hi) break;
      if (a < 0) a = i;
      b = i;
    }
    if (a !== this.first || b !== this.last) {
      this.first = a;
      this.last = b;
      this.view.setText(a < 0 ? '' : this.full.slice(this.spans[a]!.idx, this.spans[b]!.idx + 1));
    }
    if (a >= 0) this.view.x = this.runX + this.spans[a]!.origin;
  }

  setVisible(on: boolean): void {
    this.view.setVisible(on);
  }

  destroy(): void {
    this.view.destroy();
  }

  get top(): number {
    return this.y;
  }
}

/** How much of the band each step at an edge covers, outermost last. */
const FADE = [0.15, 0.35, 0.55, 0.75, 0.92, 1];

/**
 * Soft ends for a scrolling band: letters come out of the dark at one end and sink into it at the other, whole.
 * `step` is the width of one strip. Returns the strips so the caller can destroy them.
 */
export function bandEnds(scene: Scene, left: number, right: number, y: number, h: number, color: number, depth: number, step = 3): Phaser.GameObjects.Image[] {
  const out: Phaser.GameObjects.Image[] = [];
  FADE.forEach((a, i) => {
    out.push(
      rect(scene, right - (FADE.length - i) * step, y, step, h, color, a).setDepth(depth),
      rect(scene, left + (FADE.length - 1 - i) * step, y, step, h, color, a).setDepth(depth),
    );
  });
  return out;
}

/** Room the two soft ends take. */
export const BAND_END_W = FADE.length * 3;
