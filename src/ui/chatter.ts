import Phaser from 'phaser';
import { app } from '../core/app';
import { bakePortrait } from '../core/bake';
import { C, DEPTH, F, T } from '../core/theme';
import type { VoiceLine } from '../content/vo';
import { VOICE_NAMES } from '../content/voiceNames';
import { label, panel, rect } from './kit';
import type { Layout } from './layout';
import { Speech } from './speech';

/**
 * One remark at a time, low in the room view: a face, a name, and the words as they are spoken.
 * The office talks to itself here, and the narrator opens each month. It never holds the clock and never needs a tap.
 */
export class Chatter {
  private scene: Phaser.Scene;
  private L: Layout;
  private bottom: number;
  private root: Phaser.GameObjects.Container | null = null;
  private speech: Speech | null = null;
  private bye: Phaser.Time.TimerEvent | null = null;
  /** the quiet state of the lane on a tall screen: a slim bar with a typing line, so the gap under the room has a reason */
  private idle: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene, L: Layout, bottom: number) {
    this.scene = scene;
    this.L = L;
    this.bottom = bottom;
    if (L.portrait) this.buildIdle();
  }

  private buildIdle(): void {
    const scene = this.scene;
    const w = Math.min(this.L.W - 8, 300);
    const x = Math.floor((this.L.W - w) / 2);
    const root = scene.add.container(x, Math.round(this.bottom - 25)).setDepth(DEPTH.hud - 1);
    root.add(panel(scene, 0, 0, w, 14, 'night', false));
    root.add(label(scene, 5, 3, '#OFFICE-CHAT', { font: F.caps, tint: C.yellow }));
    const typing = label(scene, w - 5, 3, 'someone is typing', { font: F.body, tint: T.onDarkDim, origin: [1, 0] });
    root.add(typing);
    this.idle = root;
    if (app.settings.reducedMotion) return;
    let dots = 0;
    scene.time.addEvent({
      delay: 480,
      loop: true,
      callback: () => {
        if (!typing.active) return;
        dots = (dots + 1) % 4;
        typing.setText(`someone is typing${'.'.repeat(dots)}`);
      },
    });
  }

  get busy(): boolean {
    return this.root !== null;
  }

  say(voice: VoiceLine['voice'], text: string, line?: VoiceLine): void {
    if (this.root) return;
    const scene = this.scene;
    this.idle?.setVisible(false);
    const w = Math.min(this.L.W - 8, 300);
    const textX = 27;
    const probe = label(scene, -999, -999, text, { font: F.body, maxWidth: w - textX - 6 });
    const th = probe.height;
    probe.destroy();
    const h = Math.max(24, 14 + th + 5);
    const x = Math.floor((this.L.W - w) / 2);
    const y = Math.round(this.bottom - h - 3);
    const root = scene.add.container(x, y).setDepth(DEPTH.panel + 20);
    root.add(panel(scene, 0, 0, w, h, 'night', true));
    const fy = Math.floor((h - 18) / 2);
    root.add(rect(scene, 3, fy, 18, 18, C.ink0, 1));
    root.add(rect(scene, 4, fy + 1, 16, 16, C.sky, 1));
    root.add(scene.add.image(4, fy + 1, bakePortrait(scene, voice)).setOrigin(0, 0));
    root.add(label(scene, textX, 3, (VOICE_NAMES[voice] ?? voice).toUpperCase(), { font: F.caps, tint: C.yellow }));
    const body = label(scene, textX, 13, '', { font: F.body, tint: C.cream, maxWidth: w - textX - 6 });
    root.add(body);
    this.root = root;
    if (!app.settings.reducedMotion) {
      root.setAlpha(0);
      root.y += 5;
      scene.tweens.add({ targets: root, alpha: 1, y, duration: 180, ease: 'Sine.easeOut' });
    }
    const sp = new Speech(scene, body);
    this.speech = sp;
    void sp.say(text, line);
    void sp.done.then(() => {
      if (this.speech !== sp) return;
      this.bye = scene.time.delayedCall(1400, () => this.hide(false));
    });
  }

  private hide(instant: boolean): void {
    const root = this.root;
    if (!root) return;
    this.root = null;
    this.bye?.remove();
    this.bye = null;
    this.speech?.stop();
    this.speech = null;
    if (instant || app.settings.reducedMotion) {
      root.destroy();
      this.idle?.setVisible(true);
      return;
    }
    this.scene.tweens.add({
      targets: root,
      alpha: 0,
      y: root.y + 4,
      duration: 220,
      onComplete: () => {
        root.destroy();
        if (!this.root) this.idle?.setVisible(true);
      },
    });
  }

  /** Cut it off now, for anything that wants the screen. */
  stop(): void {
    this.hide(true);
  }
}
