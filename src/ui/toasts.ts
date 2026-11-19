import Phaser from 'phaser';
import { app } from '../core/app';
import { C, DEPTH, F } from '../core/theme';
import type { Tone } from '../sim/types';
import { iconImg, label, panel, type PanelObj } from './kit';
import type { Layout } from './layout';

const TONE_ICON: Record<Tone, string> = { good: 'check', bad: 'warn', info: 'note', wow: 'star' };
const TONE_COLOR: Record<Tone, number> = { good: C.mint, bad: C.pink, info: C.cream, wow: C.yellow };

interface Toast {
  c: Phaser.GameObjects.Container;
  h: number;
  born: number;
}

/** A short stack of messages under the top bar. New ones slide in, old ones fade. */
export class Toasts {
  private scene: Phaser.Scene;
  private items: Toast[] = [];
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

  push(text: string, tone: Tone = 'info', icon?: string): void {
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
    if (this.items.length > 3) this.items.pop()?.c.destroy();
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
