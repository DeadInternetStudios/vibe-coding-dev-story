import Phaser from 'phaser';
import { app } from '../core/app';
import { bake } from '../core/bake';
import { C, DEPTH } from '../core/theme';
import { fxPx } from '../art/sprites/fx';
import { rect } from './kit';

/** The texture of one of the little effect sprites (heart, coin, sweat, zzz...). */
export function fxKey(scene: Phaser.Scene, name: string): string {
  return bake(scene, `fx:${name}`, () => fxPx(name)!);
}

export interface FloatOpts {
  /** pixels it climbs */
  rise?: number;
  ms?: number;
  /** side to side wobble, pixels */
  sway?: number;
  delay?: number;
  depth?: number;
  /** a container to live in, so it moves with the room */
  parent?: Phaser.GameObjects.Container;
}

/** A small sprite that pops in above a point, drifts up and fades out. Cleans itself up. */
export function floatUp(scene: Phaser.Scene, name: string, x: number, y: number, opts: FloatOpts = {}): void {
  if (app.settings.reducedMotion) return;
  const rise = opts.rise ?? 14;
  const sway = opts.sway ?? 0;
  const ms = opts.ms ?? 1500;
  const img = scene.add.image(Math.round(x), Math.round(y), fxKey(scene, name)).setOrigin(0.5, 1).setDepth(opts.depth ?? 9600).setAlpha(0);
  opts.parent?.add(img);
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: ms,
    delay: opts.delay ?? 0,
    onUpdate: (tw) => {
      const k = tw.getValue() ?? 0;
      img.setPosition(Math.round(x + Math.sin(k * Math.PI * 2) * sway), Math.round(y - rise * (1 - (1 - k) * (1 - k))));
      img.setAlpha(k < 0.15 ? k / 0.15 : k > 0.6 ? (1 - k) / 0.4 : 1);
    },
    onComplete: () => img.destroy(),
  });
}

/** The way a coin turns: face, three quarters, edge, three quarters again. */
const COIN_TURN = ['coin', 'coinTurn', 'coinEdge', 'coinTurn'] as const;

/** Coins thrown up from a point that spin and fall. For money that is worth a fuss. */
export function coinShower(scene: Phaser.Scene, x: number, y: number, count = 8, depth: number = DEPTH.top): void {
  if (app.settings.reducedMotion) return;
  const coins = Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const v = 70 + Math.random() * 70;
    const img = scene.add.image(x, y, fxKey(scene, 'coin')).setOrigin(0.5, 0.5).setDepth(depth);
    return { img, vx: Math.cos(a) * v, vy: Math.sin(a) * v, spin: 7 + Math.random() * 4, phase: i };
  });
  const seconds = 1.6;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: seconds * 1000,
    onUpdate: (tw) => {
      const k = tw.getValue() ?? 0;
      const t = k * seconds;
      for (const c of coins) {
        if (!c.img.active) continue;
        const turn = Math.floor(t * c.spin + c.phase) % 4;
        c.img.setTexture(fxKey(scene, COIN_TURN[turn]!)).setFlipX(turn === 3);
        c.img.setPosition(Math.round(x + c.vx * t), Math.round(y + c.vy * t + 0.5 * GRAVITY * t * t)).setAlpha(k > 0.75 ? (1 - k) / 0.25 : 1);
      }
    },
    onComplete: () => coins.forEach((c) => c.img.destroy()),
  });
}

const COLORS = [C.yellow, C.pink, C.sky, C.mint, C.orange2, C.violet2, C.white];
/** pixels per second squared, scaled to the small canvas */
const GRAVITY = 170;

/**
 * Confetti thrown from a point: it flies up in a fan, slows, then falls and fades. One shot that
 * cleans itself up. Does nothing when reduced motion is on.
 */
export function confettiBurst(scene: Phaser.Scene, x: number, y: number, opts: { count?: number; power?: number; depth?: number } = {}): void {
  if (app.settings.reducedMotion) return;
  const n = opts.count ?? 34;
  const power = opts.power ?? 1;
  const depth = opts.depth ?? DEPTH.top;
  const parts = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2;
    const v = (50 + Math.random() * 90) * power;
    const piece = rect(scene, x, y, 2, 3, COLORS[i % COLORS.length]!, 1).setDepth(depth);
    return { piece, vx: Math.cos(a) * v, vy: Math.sin(a) * v };
  });
  const seconds = 1.9;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: seconds * 1000,
    onUpdate: (tw) => {
      const k = tw.getValue() ?? 0;
      const t = k * seconds;
      const fade = k > 0.7 ? (1 - k) / 0.3 : 1;
      for (const p of parts) p.piece.setPosition(Math.round(x + p.vx * t), Math.round(y + p.vy * t + 0.5 * GRAVITY * t * t)).setAlpha(fade);
    },
    onComplete: () => parts.forEach((p) => p.piece.destroy()),
  });
}

/** Gold light on a comment that got gilded: a bright bar sweeps across it once and a few sparkles blink over the award. */
export function gild(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, box: { x: number; y: number; w: number; h: number }, at: { x: number; y: number }): void {
  if (app.settings.reducedMotion) return;
  const bar = rect(scene, box.x, box.y, 10, box.h, C.yellow, 0.45).setBlendMode(Phaser.BlendModes.ADD);
  parent.add(bar);
  scene.tweens.add({ targets: bar, x: box.x + box.w - 10, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => bar.destroy() });
  const spots: [number, number][] = [[-6, -5], [9, -7], [15, 3], [-2, 6], [22, -4]];
  spots.forEach(([dx, dy], i) => {
    const sp = scene.add.image(Math.round(at.x + dx), Math.round(at.y + dy), fxKey(scene, i % 2 ? 'sparkleSmall' : 'sparkle')).setOrigin(0.5).setAlpha(0);
    parent.add(sp);
    scene.tweens.add({ targets: sp, alpha: 1, duration: 140, delay: 80 + i * 90, yoyo: true, hold: 60, onComplete: () => sp.destroy() });
  });
}
