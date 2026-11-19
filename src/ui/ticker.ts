import Phaser from 'phaser';
import { app } from '../core/app';
import { C, DEPTH, F } from '../core/theme';
import { Rng } from '../sim/rng';
import { label, rect } from './kit';
import type { Layout } from './layout';

/** Pixels the strip moves each second. Slow enough to read on a phone. */
const SPEED = 26;
const HEADS_PER_RUN = 5;
const BADGE_W = 27;
const HEIGHT = 9;
const SEPARATOR = '      +++      ';
/** how much of the band each 3 pixel step at its two ends covers, outermost last */
const FADE = [0.15, 0.35, 0.55, 0.75, 0.92, 1];
const FADE_STEP = 3;

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
  private text: Phaser.GameObjects.BitmapText | null = null;
  private bag: string[] = [];
  private x = 0;
  private held = 0;

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
    // the headline fades in at the right edge and out under the badge, so a word is never sliced by the screen
    FADE.forEach((a, i) => {
      const step = FADE_STEP;
      this.parts.push(
        rect(scene, L.x0 + L.cw - (FADE.length - i) * step, y, step, HEIGHT, C.ink0, a).setDepth(depth + 2),
        rect(scene, L.x0 + BADGE_W + (FADE.length - 1 - i) * step, y, step, HEIGHT, C.ink0, a).setDepth(depth + 2),
      );
    });
    const badge = rect(scene, L.x0, y, BADGE_W, HEIGHT + 1, C.berry1, 1).setDepth(depth + 3);
    const live = label(scene, L.x0 + 3, y + 1, 'LIVE', { font: F.caps, tint: C.white, depth: depth + 4 });
    this.parts.push(badge, live);
  }

  private show(y: number, depth: number): void {
    const text = label(this.scene, 0, y + 1, this.nextRun(), { font: F.body, tint: C.cream, depth: depth + 1 });
    this.text = text;
    this.parts.push(text);
    this.x = app.settings.reducedMotion ? this.L.x0 + BADGE_W + FADE.length * FADE_STEP : this.L.x0 + this.L.cw;
    text.x = Math.round(this.x);
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
    if (app.settings.reducedMotion) {
      this.held += dtMs;
      if (this.held > 7000) {
        this.held = 0;
        text.setText(this.nextRun());
      }
      return;
    }
    this.x -= (SPEED * dtMs) / 1000;
    if (this.x + text.width < this.L.x0 + BADGE_W) {
      text.setText(this.nextRun());
      this.x = this.L.x0 + this.L.cw;
    }
    text.x = Math.round(this.x);
  }

  destroy(): void {
    for (const p of this.parts) p.destroy();
    this.parts.length = 0;
    this.text = null;
  }
}
