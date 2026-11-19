import Phaser from 'phaser';
import { app } from '../core/app';
import { C, DEPTH } from '../core/theme';

/** Side of one wipe square, in art pixels. */
const CELL = 12;
/** A square at the very edge of the screen starts this late, as a share of the run. */
const SPREAD = 0.6;
/** Same colour the plain fade used, so calm mode and the wipe meet the same dark. */
const FADE_RGB = [18, 15, 36] as const;

/**
 * Squares fill the screen from the middle out, a violet edge leading, and the next scene empties them the same
 * way. Calm mode gets the plain fade.
 */
function run(scene: Phaser.Scene, ms: number, cover: boolean, done?: () => void): void {
  if (app.settings.reducedMotion) {
    const cam = scene.cameras.main;
    if (cover) {
      cam.fadeOut(ms, ...FADE_RGB);
      cam.once('camerafadeoutcomplete', () => done?.());
    } else cam.fadeIn(ms, ...FADE_RGB);
    return;
  }
  const W = scene.scale.width;
  const H = scene.scale.height;
  const cols = Math.ceil(W / CELL);
  const rows = Math.ceil(H / CELL);
  const g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.top + 50);
  const draw = (t: number) => {
    g.clear();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const d = (Math.abs(c + 0.5 - cols / 2) / (cols / 2) + Math.abs(r + 0.5 - rows / 2) / (rows / 2)) / 2;
        const p = Phaser.Math.Clamp((t - d * SPREAD) / (1 - SPREAD), 0, 1);
        const size = Math.round(CELL * (cover ? p : 1 - p));
        if (size <= 0) continue;
        const o = (CELL - size) >> 1;
        g.fillStyle(size >= CELL ? C.ink0 : C.violet1, 1);
        g.fillRect(c * CELL + o, r * CELL + o, size, size);
      }
    }
  };
  draw(0);
  const tween = scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: ms,
    onUpdate: (tw) => draw(tw.getValue() ?? 1),
    onComplete: () => {
      if (!cover) g.destroy();
      done?.();
    },
  });
  // a screen that rebuilds itself mid-wipe takes the squares with it
  g.once('destroy', () => tween.remove());
}

/** Cover the screen, then call `done`. */
export function wipeOut(scene: Phaser.Scene, done: () => void, ms = 240): void {
  run(scene, ms, true, done);
}

/** Start covered and empty out. Call once at the top of a scene's `create`. */
export function wipeIn(scene: Phaser.Scene, ms = 300): void {
  run(scene, ms, false);
}
