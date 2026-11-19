import Phaser from 'phaser';
import { bakeIcon, bakePerson, bakeSeated } from '../core/bake';
import { C, F } from '../core/theme';
import type { Face, Pose } from '../art/sprites/people';
import type { Staff } from '../sim/types';
import { floatUp } from '../ui/fx';
import { label, panel } from '../ui/kit';

export type Mode = 'desk' | 'roam' | 'away' | 'arrive' | 'leave';

export function faceFor(mood: number, tired: boolean): Face {
  if (tired) return 'sleep';
  if (mood >= 78) return 'happy';
  if (mood >= 48) return 'normal';
  if (mood >= 26) return 'sad';
  if (mood >= 12) return 'panic';
  return 'angry';
}

/**
 * One person in the office. At a desk they type, think and sleep; support
 * staff wander; new hires walk in; quitters walk out.
 */
export class StaffSprite {
  readonly scene: Phaser.Scene;
  readonly root: Phaser.GameObjects.Container;
  private img: Phaser.GameObjects.Image;
  private bulb: Phaser.GameObjects.Image | null = null;
  private bubble: Phaser.GameObjects.Container | null = null;
  private bubbleUntil = 0;
  private tag: Phaser.GameObjects.Container | null = null;
  mode: Mode = 'desk';
  /** the desk seat, bottom center of the person image */
  seat = { x: 0, y: 0 };
  /** float position while walking */
  private fx = 0;
  private fy = 0;
  private target: { x: number; y: number } | null = null;
  private wait = 0;
  private t = Math.random() * 10;
  private flip = false;
  /** override pose for a moment (cheer, slump) */
  private flash: { pose: Pose; face: Face; until: number } | null = null;
  working = false;
  tired = false;
  /** seconds until the next little thing floats off this person */
  private fxIn = 2 + Math.random() * 5;
  staff: Staff;
  private lastKey = '';
  roam = { x0: 0, y0: 0, x1: 100, y1: 100 };
  onTap: (() => void) | null = null;
  onArrived: (() => void) | null = null;
  onLeft: (() => void) | null = null;

  private parent: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, staff: Staff, parent: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.staff = staff;
    this.parent = parent;
    this.root = scene.add.container(0, 0);
    parent.add(this.root);
    this.img = scene.add.image(0, 0, bakeSeated(scene, staff.look, 'stand', 'normal')).setOrigin(0.5, 1);
    this.root.add(this.img);
    this.root.setSize(18, 22);
    this.img.setInteractive({ useHandCursor: true });
    this.img.on('pointerup', () => this.onTap?.());
  }

  setSeat(x: number, y: number): void {
    this.seat = { x, y };
  }

  place(x: number, y: number): void {
    this.fx = x;
    this.fy = y;
    this.root.setPosition(Math.round(x), Math.round(y));
  }

  sitDown(): void {
    this.mode = 'desk';
    this.target = null;
    this.place(this.seat.x, this.seat.y);
    this.flip = false;
  }

  /** Walk from `from` to the seat. */
  arriveFrom(from: { x: number; y: number }): void {
    this.mode = 'arrive';
    this.place(from.x, from.y);
    this.target = { ...this.seat };
  }

  leaveTo(door: { x: number; y: number }): void {
    this.mode = 'leave';
    this.target = { ...door };
    this.clearTag();
  }

  goAway(why: string): void {
    this.mode = 'away';
    this.root.setVisible(false);
    this.showTag(why);
  }

  comeBack(): void {
    this.clearTag();
    this.root.setVisible(true);
    this.sitDown();
  }

  private showTag(text: string): void {
    this.clearTag();
    const w = Math.min(60, text.length * 4 + 10);
    const c = this.scene.add.container(this.seat.x - w / 2, this.seat.y - 14);
    const p = panel(this.scene, 0, 0, w, 11, 'night', false);
    const t = label(this.scene, w / 2, 3, text, { font: F.body, tint: C.cream, origin: [0.5, 0] });
    c.add([p, t]);
    this.parent.add(c);
    c.setDepth(9000);
    this.tag = c;
  }

  private clearTag(): void {
    this.tag?.destroy();
    this.tag = null;
  }

  setDepth(d: number): void {
    this.root.setDepth(d);
  }

  /** Show the idea bulb above the head. */
  showBulb(on: boolean): void {
    if (on && !this.bulb) {
      this.bulb = this.scene.add.image(0, -22, bakeIcon(this.scene, 'bulb')).setOrigin(0.5, 1);
      this.bulb.setInteractive({ useHandCursor: true });
      this.root.add(this.bulb);
      this.scene.tweens.add({ targets: this.bulb, y: -25, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (!on && this.bulb) {
      this.scene.tweens.killTweensOf(this.bulb);
      this.bulb.destroy();
      this.bulb = null;
    }
  }

  get bulbObj(): Phaser.GameObjects.Image | null {
    return this.bulb;
  }

  /** A burst pose: cheer on level up, slump on bad news. */
  emote(pose: Pose, face: Face, ms = 1400): void {
    this.flash = { pose, face, until: this.t + ms / 1000 };
    if (pose === 'cheer') {
      this.puff('heart', -5, 0);
      this.puff('heart', 5, 220);
      this.puff('sparkle', 0, 110);
    } else if (pose === 'slump') {
      this.puff('sweat', 6, 0);
      this.puff('puffSmall', -5, 260);
    }
  }

  /** One effect sprite floating up from just above the head. */
  private puff(name: string, dx: number, delay = 0, rise = 14): void {
    const top = this.mode === 'desk' ? this.root.y - 22 : this.root.y - 25;
    floatUp(this.scene, name, this.root.x + dx, top, { parent: this.parent, delay, rise, sway: name === 'zzz' || name === 'zzzSmall' ? 2 : 1 });
  }

  /** Moods you can see: a sleeper snores, a happy one sends up a heart, a furious one steams. */
  private ambient(): void {
    if (this.tired && this.mode === 'desk') {
      this.puff('zzz', 5, 0, 16);
      this.puff('zzzSmall', 8, 500, 14);
      return;
    }
    const mood = this.staff.mood;
    if (mood >= 82 && Math.random() < 0.7) this.puff('heart', 3);
    else if (mood < 22) this.puff(Math.random() < 0.5 ? 'vein' : 'sweat', 5);
  }

  say(text: string, ms = 3200): void {
    this.bubble?.destroy();
    const t = label(this.scene, 0, 0, text, { font: F.body, tint: C.ink1, maxWidth: 76 });
    const w = Math.max(18, t.width + 8);
    const h = t.height + 6;
    const c = this.scene.add.container(0, 0);
    const p = panel(this.scene, 0, 0, w, h, 'paper', true);
    t.setPosition(4, 3);
    const tail = this.scene.add.image(Math.round(w / 2) - 1, h, bakeIcon(this.scene, 'bubbleTail')).setOrigin(0, 0);
    c.add([p, t, tail]);
    this.parent.add(c);
    this.bubble = c;
    this.bubbleUntil = this.t + ms / 1000;
    c.setDepth(10000);
    this.followBubble();
  }

  get talking(): boolean {
    return this.bubble !== null;
  }

  private followBubble(): void {
    if (!this.bubble) return;
    const p = this.bubble.list[0] as unknown as { boxW: number; boxH: number };
    const top = this.mode === 'desk' ? this.root.y - 22 : this.root.y - 25;
    const x = Phaser.Math.Clamp(Math.round(this.root.x - p.boxW / 2), 2, 9999);
    this.bubble.setPosition(x, Math.round(top - p.boxH - 4));
  }

  destroy(): void {
    this.bubble?.destroy();
    this.clearTag();
    this.root.destroy();
  }

  /** Per frame. `speed` scales walking so fast forward looks fast. */
  update(dt: number, running: boolean): void {
    const ds = dt / 1000;
    this.t += ds;
    if (this.bubble && this.t > this.bubbleUntil) {
      this.bubble.destroy();
      this.bubble = null;
    }

    let pose: Pose = 'stand';
    let face = faceFor(this.staff.mood, this.tired);
    const walking = this.mode === 'roam' || this.mode === 'arrive' || this.mode === 'leave';

    if (walking) {
      pose = Math.floor(this.t * 6) % 2 ? 'walkA' : 'walkB';
      this.step(ds, running);
    } else if (this.mode === 'desk') {
      if (this.tired) pose = 'slump';
      else if (this.working && running) pose = Math.floor(this.t * (3 + (this.staff.skills.prompt % 4))) % 2 ? 'typeA' : 'typeB';
      else pose = Math.floor(this.t / 2.6 + this.seat.x) % 3 === 0 ? 'think' : 'typeA';
    }
    if (this.flash) {
      if (this.t < this.flash.until) {
        pose = this.flash.pose;
        face = this.flash.face;
      } else this.flash = null;
    }

    const seated = this.mode === 'desk';
    const key = seated ? bakeSeated(this.scene, this.staff.look, pose, face) : bakePerson(this.scene, this.staff.look, pose, face);
    if (key !== this.lastKey) {
      this.img.setTexture(key);
      this.lastKey = key;
    }
    this.img.setFlipX(this.flip);
    this.followBubble();
    if (running && (this.mode === 'desk' || this.mode === 'roam')) {
      this.fxIn -= ds;
      if (this.fxIn <= 0) {
        this.fxIn = 4 + Math.random() * 6;
        this.ambient();
      }
    }
  }

  private step(ds: number, running: boolean): void {
    if (!this.target) {
      if (this.mode === 'roam') {
        this.wait -= ds;
        if (this.wait <= 0) this.pickTarget();
      }
      return;
    }
    const speed = running ? 22 : 8;
    const dx = this.target.x - this.fx;
    const dy = this.target.y - this.fy;
    const dist = Math.hypot(dx, dy);
    if (dist < 1.2) {
      this.place(this.target.x, this.target.y);
      this.target = null;
      if (this.mode === 'arrive') {
        this.sitDown();
        this.onArrived?.();
      } else if (this.mode === 'leave') {
        this.onLeft?.();
      } else this.wait = 1.5 + Math.random() * 3;
      return;
    }
    if (Math.abs(dx) > 0.4) this.flip = dx < 0;
    const s = Math.min(dist, speed * ds);
    this.place(this.fx + (dx / dist) * s, this.fy + (dy / dist) * s);
  }

  startRoaming(area: { x0: number; y0: number; x1: number; y1: number }): void {
    this.roam = area;
    this.mode = 'roam';
    this.wait = Math.random() * 2;
    this.root.setVisible(true);
  }

  private pickTarget(): void {
    const r = this.roam;
    this.target = { x: r.x0 + Math.random() * (r.x1 - r.x0), y: r.y0 + Math.random() * (r.y1 - r.y0) };
  }

  get x(): number {
    return this.root.x;
  }
  get y(): number {
    return this.root.y;
  }
}
