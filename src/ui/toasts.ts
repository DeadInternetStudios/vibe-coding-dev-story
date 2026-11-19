import Phaser from 'phaser';
import { app } from '../core/app';
import { C, DEPTH, F } from '../core/theme';
import type { Tone } from '../sim/types';
import { iconImg, label, panel, type PanelObj } from './kit';
import type { Layout } from './layout';

const TONE_ICON: Record<Tone, string> = { good: 'check', bad: 'warn', info: 'note', wow: 'star' };
const TONE_COLOR: Record<Tone, number> = { good: C.mint, bad: C.pink, info: C.cream, wow: C.yellow };

/** How many show at once. The ones under the top bar sit over the log and the chart, so a short stack keeps them readable. */
const MAX_SHOWN = 2;

interface Toast {
  c: Phaser.GameObjects.Container;
  h: number;
  born: number;
}

/**
 * A short stack of messages under the top bar. New ones slide in, old ones fade.
 * They never print over a story box: the box has words the player has to read, so a message that
 * arrives while one is up waits for it, and the ones already showing step aside and come back after.
 */
export class Toasts {
  private scene: Phaser.Scene;
  private items: Toast[] = [];
  private waiting: { text: string; tone: Tone; icon?: string }[] = [];
  private L: Layout;
  private topY: number;
  private clock = 0;

  constructor(scene: Phaser.Scene, L: Layout, topY: number) {
    this.scene = scene;
    this.L = L;
    this.topY = topY;
  }

  relayout(L: Layout, topY: number): void {
    this.L = L;
    this.topY = topY;
    for (const t of this.items) t.c.destroy();
    this.items = [];
  }

  private talking(): boolean {
    return !!this.scene.children.getByName('dialogue');
  }

  push(text: string, tone: Tone = 'info', icon?: string): void {
    if (this.talking()) {
      this.waiting.push({ text, tone, icon });
      if (this.waiting.length > 3) this.waiting.shift();
      return;
    }
    this.show(text, tone, icon);
  }

  private show(text: string, tone: Tone, icon?: string): void {
    const s = this.scene;
    const maxW = Math.min(this.L.cw - 16, 250);
    const t = label(s, 14, 3, text, { font: F.body, tint: tone === 'info' ? C.cream : TONE_COLOR[tone], maxWidth: maxW - 20 });
    const w = Math.min(maxW, Math.max(60, t.width + 22));
    const h = Math.max(13, t.height + 6);
    const bg: PanelObj = panel(s, 0, 0, w, h, 'night', true);
    const ic = iconImg(s, icon ?? TONE_ICON[tone], 3, Math.floor((h - 8) / 2));
    const c = s.add.container(Math.round((this.L.W - w) / 2), this.topY, [bg, ic, t]);
    c.setDepth(DEPTH.toast);
    const item: Toast = { c, h, born: this.clock };
    this.items.unshift(item);
    if (this.items.length > MAX_SHOWN) this.items.pop()?.c.destroy();
    if (!app.settings.reducedMotion) {
      c.setAlpha(0);
      s.tweens.add({ targets: c, alpha: 1, duration: 140 });
    }
    this.layout();
  }

  private layout(): void {
    let y = this.topY + 3;
    for (const t of this.items) {
      const target = Math.round(y);
      if (t.c.y !== target) this.scene.tweens.add({ targets: t.c, y: target, duration: 140, ease: 'Sine.easeOut' });
      y += t.h + 3;
    }
  }

  update(dtMs: number): void {
    const talking = this.talking();
    for (const t of this.items) t.c.setVisible(!talking);
    // the clock stands still while a box is up, so nothing runs out before the player could see it
    if (talking) return;
    for (const w of this.waiting.splice(0)) this.show(w.text, w.tone, w.icon);
    this.clock += dtMs / 1000;
    let changed = false;
    this.items = this.items.filter((t) => {
      const age = this.clock - t.born;
      if (age > 3.4) {
        this.scene.tweens.add({ targets: t.c, alpha: 0, duration: 200, onComplete: () => t.c.destroy() });
        changed = true;
        return false;
      }
      return true;
    });
    if (changed) this.layout();
  }
}
