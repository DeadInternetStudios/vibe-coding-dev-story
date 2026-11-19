import Phaser from 'phaser';
import { MAX_CONTENT_W } from '../core/viewport';

export interface Layout {
  /** logical canvas size in art pixels */
  W: number;
  H: number;
  portrait: boolean;
  /** width of the content column (wide screens get margins) */
  cw: number;
  /** left edge of the content column */
  x0: number;
  /** horizontal center */
  cx: number;
}

export function layoutOf(scene: Phaser.Scene): Layout {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const cw = Math.min(W, MAX_CONTENT_W);
  return { W, H, portrait: H > W * 1.02, cw, x0: Math.floor((W - cw) / 2), cx: Math.floor(W / 2) };
}

/** Run `build` now and again whenever the canvas size changes. `build` must make everything fresh. */
export function responsive(scene: Phaser.Scene, build: () => void, teardown?: () => void): void {
  let lastW = scene.scale.width;
  let lastH = scene.scale.height;
  const rebuild = () => {
    if (scene.scale.width === lastW && scene.scale.height === lastH) return;
    lastW = scene.scale.width;
    lastH = scene.scale.height;
    teardown?.();
    scene.children.removeAll(true);
    scene.tweens.killAll();
    build();
  };
  scene.scale.on('resize', rebuild);
  scene.events.once('shutdown', () => scene.scale.off('resize', rebuild));
  build();
}

export function fadeTo(scene: Phaser.Scene, key: string, data?: object, ms = 220): void {
  const cam = scene.cameras.main;
  cam.fadeOut(ms, 18, 15, 36);
  cam.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}
