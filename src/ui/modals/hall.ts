import type Phaser from 'phaser';
import { dailyTag } from '../../core/daily';
import { HALL_SIZE, loadHall, type HallEntry } from '../../core/save';
import { C, F } from '../../core/theme';
import { shortMoney } from '../../sim/format';
import { fit, label, panel, type Scene } from '../kit';
import { tabs } from '../menus/common';
import { Modal } from '../modal';
import { layoutOf } from '../layout';
import { rowWidth, scrollList, type ScrollRow } from '../scroll';
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

const EMPTY_JOKES = [
  'Waiting for a brave founder.',
  'Reserved for your next pivot.',
  'Held open by a tiny hope.',
  'Currently a prompt, not a plan.',
  'Ship something. Anything.',
  'The office cat sits here for now.',
];

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
  const sub = label(scene, 22, 14, fit(`#${place} - ${EMPTY_JOKES[place % EMPTY_JOKES.length]!}`, 44), { font: F.body, tint: C.ink3 });
  return { h: ROW_H, node: scene.add.container(0, 0, [panel(scene, 0, 0, rw, ROW_H, 'plum', false), mark, name, sub]) };
}

function drawScores(scene: Scene, content: Phaser.GameObjects.Container, w: number, h: number): void {
  const hall = loadHall();
  const rw = rowWidth(w - 12);
  const rows = [
    ...hall.map((e, i) => scoreRow(scene, e, i + 1, rw)),
    ...Array.from({ length: Math.max(0, HALL_SIZE - hall.length) }, (_, i) => emptyRow(scene, hall.length + i + 1, rw)),
  ];
  content.add(scrollList(scene, { x: 6, y: LIST_TOP, w: w - 12, h: h - LIST_TOP - 7, rows, gap: 2 }));
}

/** Past runs, best first, and every trophy. */
export function openHall(scene: Phaser.Scene, o: HallOpts = {}): Modal {
  const L = layoutOf(scene);
  const w = Math.min(L.W - 8, 286);
  const h = Math.min(L.H - 12, L.portrait ? 470 : 252);
  const m = new Modal(scene, { w, h, title: 'HALL OF FAME', closable: true, hold: o.hold });
  const draw = (i: number, content: Phaser.GameObjects.Container) => (i === 0 ? drawScores(scene, content, w, h) : drawTrophies(scene, content, w, h, o.run ?? []));
  tabs(m, 6, TABS_Y, w - 12, ['SCORES', 'TROPHIES'], draw, o.tab === 'trophies' ? 1 : 0, { h: TAB_H, below: true });
  return m;
}
