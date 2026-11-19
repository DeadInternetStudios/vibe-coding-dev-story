import Phaser from 'phaser';
import { app } from '../core/app';
import { C, DEPTH, F } from '../core/theme';
import { Rng } from '../sim/rng';
import { label, rect } from './kit';
import type { Layout } from './layout';
import type { Page } from './scrollMath';
import { BAND_END_W, bandEnds, ScrollText } from './scrollText';

/** Pixels the strip moves each second. Slow enough to read on a phone. */
const SPEED = 26;
const HEADS_PER_RUN = 5;
const BADGE_W = 27;
const HEIGHT = 9;
const SEPARATOR = '      +++      ';
/** With reduced motion nothing slides: a headline is read a screenful at a time, each held this long. */
const PAGE_MS = 2800;

/**
 * A news strip under the top bar. The world comments on your startup in the
 * background: the same jokes the paydays use, scrolling by while you work.
 */
export class Ticker {
  private readonly scene: Phaser.Scene;
  private readonly L: Layout;
  private readonly heads: string[];
  private readonly rng = new Rng(Math.floor(Math.random() * 1e9));
  private readonly parts: Phaser.GameObjects.GameObject[] = [];
  private text: ScrollText | null = null;
  private bag: string[] = [];
  private x = 0;
  private held = 0;
  private reduced = false;
  private pages: Page[] = [];
  private page = 0;

  constructor(scene: Phaser.Scene, L: Layout, y: number, headlines: readonly string[]) {
    this.scene = scene;
    this.L = L;
    this.heads = headlines.map((h) => h.toUpperCase());
    if (this.heads.length === 0) return;
    const depth = DEPTH.hud - 4;
    const band = rect(scene, L.x0, y, L.cw, HEIGHT, C.ink0, 0.78).setDepth(depth);
    const edge = rect(scene, L.x0, y + HEIGHT, L.cw, 1, C.ink2, 0.6).setDepth(depth);
    this.parts.push(band, edge);
    this.show(y, depth);
    // the headline comes out of the dark at the right edge and sinks into it under the badge, whole letters only
    this.parts.push(...bandEnds(scene, L.x0 + BADGE_W, L.x0 + L.cw, y, HEIGHT, C.ink0, depth + 2));
    const badge = rect(scene, L.x0, y, BADGE_W, HEIGHT + 1, C.berry1, 1).setDepth(depth + 3);
    const live = label(scene, L.x0 + 3, y + 1, 'LIVE', { font: F.caps, tint: C.white, depth: depth + 4 });
    this.parts.push(badge, live);
  }

  private show(y: number, depth: number): void {
    const text = new ScrollText(this.scene, y + 1, this.L.x0 + BADGE_W, this.L.x0 + this.L.cw, { font: F.body, tint: C.cream, depth: depth + 1 });
    this.text = text;
    this.parts.push(text.view);
    this.reduced = app.settings.reducedMotion;
    this.begin();
  }

  /** Start a new run of headlines in the way the player's motion setting asks for. */
  private begin(): void {
    const text = this.text!;
    const { x0, cw } = this.L;
    text.setRun(this.nextRun());
    if (this.reduced) {
      // the window is the clear middle of the strip, so no letter ever sits in a soft end
      const left = x0 + BADGE_W + BAND_END_W;
      const right = x0 + cw - BAND_END_W;
      this.pages = text.pages(right - left);
      this.page = 0;
      this.held = 0;
      text.showPage(this.pages[0]!, left);
      return;
    }
    text.setWindow(x0 + BADGE_W, x0 + cw);
    this.x = x0 + cw;
    text.place(this.x);
  }

  private nextRun(): string {
    const picked: string[] = [];
    const n = app.settings.reducedMotion ? 1 : HEADS_PER_RUN;
    while (picked.length < n) {
      if (this.bag.length === 0) this.bag = this.rng.shuffle(this.heads.slice());
      picked.push(this.bag.pop()!);
    }
    return picked.join(SEPARATOR);
  }

  update(dtMs: number): void {
    const text = this.text;
    if (!text) return;
    if (app.settings.reducedMotion !== this.reduced) {
      this.reduced = app.settings.reducedMotion;
      this.begin();
    }
    if (this.reduced) {
      this.held += dtMs;
      if (this.held < PAGE_MS) return;
      this.held = 0;
      this.page += 1;
      if (this.page >= this.pages.length) {
        this.begin();
        return;
      }
      text.showPage(this.pages[this.page]!, this.L.x0 + BADGE_W + BAND_END_W);
      return;
    }
    this.x -= (SPEED * dtMs) / 1000;
    if (this.x + text.width < this.L.x0 + BADGE_W) {
      text.setRun(this.nextRun());
      this.x = this.L.x0 + this.L.cw;
    }
    text.place(this.x);
  }

  destroy(): void {
    for (const p of this.parts) p.destroy();
    this.parts.length = 0;
    this.text = null;
  }
}
