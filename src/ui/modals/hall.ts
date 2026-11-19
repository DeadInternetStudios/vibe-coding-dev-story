import type Phaser from 'phaser';
import { emptyCase } from '../../art/sprites/decorWall';
import { bake } from '../../core/bake';
import { dailyTag } from '../../core/daily';
import { feature } from '../../core/features';
import { HALL_SIZE, loadHall, type HallEntry } from '../../core/save';
import { C, F } from '../../core/theme';
import { shortMoney } from '../../sim/format';
import { fit, label, panel, type LabelOpts, type Scene } from '../kit';
import { tabs } from '../menus/common';
import { Modal } from '../modal';
import { layoutOf } from '../layout';
import { rowWidth, roomIn, scrollList, type ScrollRow } from '../scroll';
import { stackRows } from '../scrollMath';
import { greyedSlots, morePlaces, slotJoke } from './hallRows';
import { drawTrophies } from './trophies';

export interface HallOpts {
  hold?: () => () => void;
  tab?: 'scores' | 'trophies';
  /** the achievements the open run has earned, they get a NEW tag in the case */
  run?: readonly string[];
}

const TABS_Y = 20;
const TAB_H = 24;
const LIST_TOP = TABS_Y + TAB_H + 6;
const ROW_H = 25;
const GAP = 2;

function scoreRow(scene: Scene, e: HallEntry, place: number, rw: number): ScrollRow {
  const rank = label(scene, 7, 5, e.rank, { font: F.head, tint: e.rank === 'S' ? C.orange1 : e.bankrupt ? C.berry1 : C.ink1 });
  const name = label(scene, 22, 4, fit(e.company, 22), { font: F.caps, tint: C.ink1 });
  const score = label(scene, rw - 6, 4, shortMoney(e.score), { font: F.caps, tint: C.green1, origin: [1, 0] });
  const parts = [`#${place}`, e.founder, `${e.apps} ${e.apps === 1 ? 'app' : 'apps'}`];
  // a daily run is always on normal difficulty, so its tag takes the place of the difficulty
  const sub = label(scene, 22, 14, e.daily ? fit(parts.join(' - '), 32) : fit([...parts, e.difficulty].join(' - '), 44), { font: F.body, tint: C.ink3 });
  const tag = e.daily ? [label(scene, rw - 6, 14, dailyTag(e.daily), { font: F.body, tint: C.violet1, origin: [1, 0] })] : [];
  return { h: ROW_H, node: scene.add.container(0, 0, [panel(scene, 0, 0, rw, ROW_H, 'chipLight', false), rank, name, score, sub, ...tag]) };
}

/** A place on the board nobody has earned yet. */
function emptyRow(scene: Scene, place: number, rw: number): ScrollRow {
  const mark = label(scene, 7, 5, '-', { font: F.head, tint: C.ink3 });
  const name = label(scene, 22, 4, 'EMPTY SLOT', { font: F.caps, tint: C.ink4 });
  const sub = label(scene, 22, 14, fit(`#${place} - ${slotJoke(place)}`, 44), { font: F.body, tint: C.ink3 });
  return { h: ROW_H, node: scene.add.container(0, 0, [panel(scene, 0, 0, rw, ROW_H, 'plum', false), mark, name, sub]) };
}

/**
 * What a board with no runs on it says, over a case with a dark print where each cup will stand.
 * The picture sits beside the words on a wide screen and over them on a tall one, as large as the
 * window leaves room for, so the greyed places under it stay in view.
 */
function emptyCard(scene: Scene, rw: number, wide: boolean, room: number): ScrollRow {
  const pic = scene.add.image(0, 0, bake(scene, 'hall:empty-case', emptyCase)).setOrigin(0, 0);
  const textX = (scale: number) => (wide ? 6 + pic.width * scale + 8 : rw / 2);
  const at = (scale: number): LabelOpts => ({ origin: [wide ? 0 : 0.5, 0], maxWidth: wide ? rw - textX(scale) - 8 : rw - 16, align: wide ? 'left' : 'center' });
  const words = (scale: number) => ({
    head: label(scene, textX(scale), 0, 'THE CASE IS EMPTY', { font: F.head, tint: C.ink1, ...at(scale) }),
    body: label(scene, textX(scale), 0, 'Finish a run and it gets framed here, ranked by score. Going bankrupt counts too.', { font: F.body, tint: C.ink2, ...at(scale) }),
  });
  const heightAt = (scale: number, text: number) => Math.ceil(wide ? Math.max(pic.height * scale, text) + 12 : pic.height * scale + text + 20);
  let scale = 4;
  let { head, body } = words(scale);
  while (scale > 1 && heightAt(scale, head.height + 4 + body.height) > room) {
    head.destroy();
    body.destroy();
    scale -= 1;
    ({ head, body } = words(scale));
  }
  pic.setScale(scale);
  const textH = head.height + 4 + body.height;
  const h = heightAt(scale, textH);
  const textY = wide ? Math.round((h - textH) / 2) : 6 + pic.displayHeight + 6;
  pic.setPosition(wide ? 6 : Math.round((rw - pic.displayWidth) / 2), wide ? Math.round((h - pic.displayHeight) / 2) : 6);
  head.setY(textY);
  body.setY(textY + head.height + 4);
  return { h, node: scene.add.container(0, 0, [panel(scene, 0, 0, rw, h, 'chipLight', false), pic, head, body]) };
}

/** The line after the greyed places, so three of them do not look like the whole board. */
function moreRow(scene: Scene, rw: number, text: string): ScrollRow {
  const line = label(scene, rw / 2, 3, text, { font: F.body, tint: C.ink4, origin: [0.5, 0], maxWidth: rw - 12, align: 'center' });
  return { h: Math.ceil(line.height) + 6, node: scene.add.container(0, 0, [line]) };
}

function drawScores(scene: Scene, content: Phaser.GameObjects.Container, w: number, h: number, wide: boolean, top = LIST_TOP): void {
  const hall = loadHall();
  const rw = rowWidth(w - 12);
  const more = morePlaces(hall.length, HALL_SIZE);
  const rest = [
    ...hall.map((e, i) => scoreRow(scene, e, i + 1, rw)),
    ...Array.from({ length: greyedSlots(hall.length, HALL_SIZE) }, (_, i) => emptyRow(scene, hall.length + i + 1, rw)),
    ...(more ? [moreRow(scene, rw, more)] : []),
  ];
  const listH = h - top - 7;
  const room = roomIn(listH) - stackRows(rest.map((r) => r.h), GAP).total - GAP;
  const rows = hall.length ? rest : [emptyCard(scene, rw, wide, room), ...rest];
  content.add(scrollList(scene, { x: 6, y: top, w: w - 12, h: listH, rows, gap: GAP }));
}

/** Past runs, best first, and every trophy. */
export function openHall(scene: Phaser.Scene, o: HallOpts = {}): Modal {
  const L = layoutOf(scene);
  const w = Math.min(L.W - 8, 286);
  const h = Math.min(L.H - 12, L.portrait ? 470 : 252);
  const m = new Modal(scene, { w, h, title: 'HALL OF FAME', closable: true, hold: o.hold });
  if (!feature('trophies')) {
    const content = scene.add.container(0, 0);
    m.add(content);
    drawScores(scene, content, w, h, !L.portrait, TABS_Y);
    return m;
  }
  const draw = (i: number, content: Phaser.GameObjects.Container) => (i === 0 ? drawScores(scene, content, w, h, !L.portrait) : drawTrophies(scene, content, w, h, o.run ?? []));
  tabs(m, 6, TABS_Y, w - 12, ['SCORES', 'TROPHIES'], draw, o.tab === 'trophies' ? 1 : 0, { h: TAB_H, below: true });
  return m;
}
