import type Phaser from 'phaser';
import { app } from '../core/app';
import { C, DEPTH } from '../core/theme';
import { rect } from './kit';

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
