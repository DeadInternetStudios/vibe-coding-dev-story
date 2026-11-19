import Phaser from 'phaser';
import { C, DEPTH, F, T } from '../core/theme';
import { app } from '../core/app';
import { button, label, panel, rect, uiEvents, type PanelObj } from './kit';
import { layoutOf } from './layout';
import type { BoxName } from '../art/sprites/ui';

export interface ModalOpts {
  w: number;
  h: number;
  title?: string;
  style?: BoxName;
  /** show an X and close on escape or a tap on the dim */
  closable?: boolean;
  onClose?: () => void;
  /** pause the game clock while this is open */
  hold?: () => () => void;
  /** stack above other modals */
  depth?: number;
  /** pin to the bottom of the screen instead of the middle, good for dialogue */
  anchor?: 'center' | 'bottom' | 'top';
  /** how dark the dim behind it is */
  dim?: number;
}

/**
 * A panel in the middle of the screen with a dim behind it. Children are placed
 * in the panel's own coordinates, 0,0 is its top left corner.
 */
export class Modal {
  readonly scene: Phaser.Scene;
  readonly root: Phaser.GameObjects.Container;
  readonly box: PanelObj;
  /** where children go */
  readonly body: Phaser.GameObjects.Container;
  readonly w: number;
  readonly h: number;
  readonly x: number;
  readonly y: number;
  private release: (() => void) | null;
  private closed = false;
  private opts: ModalOpts;
  titleObj: Phaser.GameObjects.BitmapText | null = null;

  constructor(scene: Phaser.Scene, opts: ModalOpts) {
    this.scene = scene;
    this.opts = opts;
    const L = layoutOf(scene);
    this.w = Math.min(opts.w, L.W - 4);
    this.h = Math.min(opts.h, L.H - 4);
    const anchor = opts.anchor ?? 'center';
    this.x = Math.floor((L.W - this.w) / 2);
    this.y = anchor === 'center' ? Math.floor((L.H - this.h) / 2) : anchor === 'bottom' ? L.H - this.h - 4 : 4;
    this.release = opts.hold ? opts.hold() : null;
    const depth = opts.depth ?? DEPTH.modal;
    this.root = scene.add.container(0, 0).setDepth(depth);
    const dim = rect(scene, 0, 0, L.W, L.H, C.ink0, opts.dim ?? 0.62).setInteractive();
    dim.on('pointerup', () => {
      if (opts.closable) this.close();
    });
    this.root.add(dim);
    this.box = panel(scene, this.x, this.y, this.w, this.h, opts.style ?? 'paper');
    this.root.add(this.box);
    this.body = scene.add.container(this.x, this.y);
    this.root.add(this.body);
    if (opts.title) {
      const dark = (opts.style ?? 'paper') !== 'paper' && opts.style !== 'paperDim';
      this.titleObj = label(scene, this.w / 2, 5, opts.title, { font: F.head, tint: dark ? T.onDark : C.ink1, origin: [0.5, 0] });
      this.body.add(this.titleObj);
    }
    if (opts.closable) {
      const x = button(scene, this.w - 15, 3, 12, 12, 'x', () => this.close(), { kind: 'berry', font: F.caps });
      this.body.add(x);
    }
    if (!app.settings.reducedMotion) {
      this.root.setAlpha(0);
      const sy = anchor === 'center' ? 6 : anchor === 'bottom' ? 10 : -10;
      this.body.y += sy;
      this.box.y += sy;
      scene.tweens.add({ targets: this.root, alpha: 1, duration: 120 });
      scene.tweens.add({ targets: [this.body, this.box], y: `-=${sy}`, duration: 160, ease: 'Back.easeOut' });
    }
    if (opts.closable) scene.input.keyboard?.once('keydown-ESC', () => this.close());
    uiEvents.emit('open');
  }

  add<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.body.add(obj);
    return obj;
  }

  get open(): boolean {
    return !this.closed;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.release?.();
    this.release = null;
    const done = () => {
      this.root.destroy();
      this.opts.onClose?.();
    };
    if (app.settings.reducedMotion) {
      done();
      return;
    }
    this.scene.tweens.add({ targets: this.root, alpha: 0, duration: 90, onComplete: done });
  }
}
