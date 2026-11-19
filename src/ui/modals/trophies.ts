/**
 * The trophy case, drawn into the content area of the Hall of Fame modal: a counter
 * with a bar on top and every achievement below it in a list that scrolls.
 */
import type Phaser from 'phaser';
import { app } from '../../core/app';
import { C, F } from '../../core/theme';
import { loadTrophies, trophyQuip, trophyView, type TrophyRow } from '../../core/trophies';
import { bar, iconImg, label, panel, type Scene } from '../kit';
import { rowWidth, scrollList, type ScrollRow } from '../scroll';

const TOP = 48;
const LIST_TOP = TOP + 30;
const TEXT_X = 24;

function buildRow(scene: Scene, r: TrophyRow, rw: number): ScrollRow {
  const dark = r.locked;
  const tagW = r.isNew ? 25 : 0;
  const name = label(scene, TEXT_X, 4, r.name, { font: F.caps, tint: dark ? C.ink4 : C.ink1, maxWidth: rw - TEXT_X - 4 - tagW });
  const text = label(scene, TEXT_X, 6 + name.height, r.text, { font: F.body, tint: dark ? C.ink3 : C.ink2, maxWidth: rw - TEXT_X - 5 });
  const h = Math.max(26, Math.ceil(11 + name.height + text.height));
  const plateY = Math.round((h - 14) / 2);
  const parts: Phaser.GameObjects.GameObject[] = [
    panel(scene, 0, 0, rw, h, dark ? 'plum' : 'chipLight', false),
    panel(scene, 4, plateY, 14, 14, dark ? 'well' : 'paperDim', false),
    iconImg(scene, r.icon, 7, plateY + 3),
    name,
    text,
  ];
  if (r.isNew) {
    parts.push(panel(scene, rw - 25, 4, 21, 11, 'btnOrange', false));
    parts.push(label(scene, rw - 14, 10, 'NEW', { font: F.caps, tint: C.white, origin: [0.5, 0.5], shadow: true }));
  }
  return { h, node: scene.add.container(0, 0, parts) };
}

/** `run` holds the achievements the open run has earned, they get a NEW tag. */
export function drawTrophies(scene: Scene, content: Phaser.GameObjects.Container, w: number, h: number, run: readonly string[]): void {
  const view = trophyView(app.content.achievements, loadTrophies(), run);
  const rw = rowWidth(w - 12);
  const rows = view.rows.map((r) => buildRow(scene, r, rw));
  const first = view.rows.findIndex((r) => r.isNew);
  content.add(
    scrollList(scene, {
      x: 6,
      y: LIST_TOP,
      w: w - 12,
      h: h - LIST_TOP - 7,
      rows,
      gap: 2,
      start: first < 0 ? undefined : first,
    }),
  );

  const counter = label(scene, 20, TOP - 1, `${view.got} / ${view.total}`, { font: F.read, tint: C.orange1 });
  const barX = 20 + Math.ceil(counter.width) + 8;
  content.add([
    iconImg(scene, 'trophy', 8, TOP + 4),
    counter,
    bar(scene, barX, TOP + 3, w - 8 - barX, 9, C.orange1, view.total > 0 ? view.got / view.total : 0),
    label(scene, w / 2, TOP + 18, trophyQuip(view.got, view.total), { font: F.body, tint: C.ink3, origin: [0.5, 0] }),
  ]);
}
