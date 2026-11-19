import Phaser from 'phaser';
import { C, F } from '../../core/theme';
import { button, label, rect, type ButtonObj } from '../kit';
import type { Modal } from '../modal';
import type { UiCtx } from '../ctx';

export interface Tabs {
  /** put things for the open tab in here, it is emptied on every switch */
  content: Phaser.GameObjects.Container;
  buttons: ButtonObj[];
  select(i: number): void;
}

export interface TabsOpts {
  /** button height, 13 by default */
  h?: number;
  /** keep the content under the title and the buttons, for content that draws over a wide area */
  below?: boolean;
}

/** A row of tab buttons along the top of a modal. */
export function tabs(modal: Modal, x: number, y: number, w: number, names: string[], onSelect: (i: number, content: Phaser.GameObjects.Container) => void, start = 0, opts: TabsOpts = {}): Tabs {
  const scene = modal.scene;
  const content = scene.add.container(0, 0);
  const gap = 2;
  const bw = Math.floor((w - gap * (names.length - 1)) / names.length);
  const buttons: ButtonObj[] = [];
  const t: Tabs = {
    content,
    buttons,
    select: (i: number) => {
      buttons.forEach((b, j) => b.setKind(j === i ? 'orange' : 'plum'));
      content.removeAll(true);
      onSelect(i, content);
    },
  };
  names.forEach((n, i) => {
    const b = button(scene, x + i * (bw + gap), y, bw, opts.h ?? 13, n, () => t.select(i), { kind: i === start ? 'orange' : 'plum', font: F.caps });
    modal.add(b);
    buttons.push(b);
  });
  if (opts.below) modal.body.addAt(content, 0);
  else modal.add(content);
  t.select(start);
  return t;
}

/** A labeled skill meter on a light panel. */
export function skillRow(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, w: number, name: string, value: number, color: number, max = 40): void {
  parent.add(label(scene, x, y, name, { font: F.body, tint: C.ink2 }));
  const bw = w - 62;
  const well = rect(scene, x + 38, y + 1, bw, 5, C.ink1);
  const fill = rect(scene, x + 39, y + 2, Math.max(1, Math.round(Math.min(1, value / max) * (bw - 2))), 3, color);
  parent.add([well, fill]);
  parent.add(label(scene, x + w - 2, y, `${value}`, { font: F.body, tint: C.ink1, origin: [1, 0] }));
}

/** What a tap on a button that cannot work does: the reason, in the red toast every other no uses. The button itself shakes. */
export function because(ctx: UiCtx, why: string | (() => string)): () => void {
  return () => ctx.toast(typeof why === 'function' ? why() : why, 'bad');
}
