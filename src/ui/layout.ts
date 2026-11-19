import Phaser from 'phaser';
import { MAX_CONTENT_W } from '../core/viewport';
import { wipeOut } from './wipe';

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

/** Height for a popup that wants `want`: on a short screen it keeps a margin so the page behind still frames it. */
export function popupH(L: Layout, want: number): number {
  return Math.min(L.H - (L.H < 270 ? 14 : 4), want);
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

const leaving = new WeakSet<Phaser.Scene>();

/** Wipe the screen over, then start another scene. A second tap during the wipe is ignored; Phaser would restart it each time and never finish. */
export function fadeTo(scene: Phaser.Scene, key: string, data?: object, ms = 240): void {
  if (leaving.has(scene)) return;
  leaving.add(scene);
  scene.events.once('shutdown', () => leaving.delete(scene));
  wipeOut(scene, () => scene.scene.start(key, data), ms);
}
