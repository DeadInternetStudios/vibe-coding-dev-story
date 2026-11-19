import Phaser from 'phaser';
import { app } from '../core/app';
import { C, DEPTH, F } from '../core/theme';
import type { Session } from '../game/session';
import { nextRank, rankFor } from '../sim/economy';
import { shortMoney } from '../sim/format';
import { bar, fit, label, panel, rect } from './kit';
import type { Layout } from './layout';
import { RANK_COLOR } from './ranks';

export type TermKind = 'commit' | 'cmd' | 'warn' | 'ok';
export interface TermLine {
  head: string;
  text: string;
  kind: TermKind;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const KEEP = 60;
const SCORE_STRIP = 32;
const HEAD_W = 34;
const HEAD: Record<TermKind, number> = { commit: C.yellow, cmd: C.mint, warn: C.pink, ok: C.green2 };
const TEXT: Record<TermKind, number> = { commit: C.cream, cmd: C.sky, warn: C.pink, ok: C.mint };

/** A random short hash, the way git prints one. */
export function hash7(): string {
  let s = '';
  for (let i = 0; i < 7; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

/** The repo on a dark terminal. Newest at the bottom, the way a terminal does it. */
class Terminal {
  private readonly scene: Phaser.Scene;
  private readonly box: Box;
  private readonly log: TermLine[];
  private readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.BitmapText;
  private readonly blink: Phaser.Tweens.Tween | null;

  constructor(scene: Phaser.Scene, box: Box, log: TermLine[], depth: number) {
    this.scene = scene;
    this.box = box;
    this.log = log;
    const { w, h } = box;
    this.root = scene.add.container(Math.round(box.x), Math.round(box.y)).setDepth(depth);
    this.root.add(panel(scene, 0, 0, w, h, 'night', true));
    this.title = label(scene, 5, 3, '', { font: F.body, tint: C.ink4, maxWidth: w - 10 });
    this.root.add([rect(scene, 3, 12, w - 6, 1, C.ink2, 1), this.title]);
    this.body = scene.add.container(0, 0);
    this.root.add(this.body);
    this.root.add(label(scene, 5, h - 10, '$', { font: F.body, tint: C.mint }));
    const cursor = rect(scene, 13, h - 9, 4, 6, C.mint, 1);
    this.root.add(cursor);
    this.blink = app.settings.reducedMotion ? null : scene.tweens.add({ targets: cursor, alpha: { from: 1, to: 0.1 }, duration: 480, yoyo: true, repeat: -1, hold: 140 });
    this.render();
  }

  setProject(name: string | null): void {
    const slug = name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '';
    this.title.setText(slug ? `~/${slug} (main)` : '~/ (nothing yet)');
  }

  render(): void {
    this.body.removeAll(true);
    const textX = 5 + HEAD_W;
    const maxW = this.box.w - textX - 4;
    let y = this.box.h - 12;
    for (let i = this.log.length - 1; i >= 0; i--) {
      const ln = this.log[i]!;
      const t = label(this.scene, textX, 0, ln.text, { font: F.body, tint: TEXT[ln.kind], maxWidth: maxW });
      y -= Math.max(8, t.height) + 1;
      if (y < 14) {
        t.destroy();
        break;
      }
      t.y = y;
      this.body.add([label(this.scene, 5, y, ln.head, { font: F.body, tint: HEAD[ln.kind] }), t]);
    }
  }

  destroy(): void {
    this.blink?.remove();
    this.root.destroy();
  }
}

/** Revenue by month against what the company burns, and the apps that earn it. */
class RevenuePanel {
  private readonly scene: Phaser.Scene;
  private readonly session: Session;
  private readonly box: Box;
  private readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  private seen = '';

  constructor(scene: Phaser.Scene, box: Box, session: Session, depth: number) {
    this.scene = scene;
    this.session = session;
    this.box = box;
    this.root = scene.add.container(Math.round(box.x), Math.round(box.y)).setDepth(depth);
    this.root.add(panel(scene, 0, 0, box.w, box.h, 'night', true));
    this.root.add([label(scene, 5, 3, 'REVENUE / MONTH', { font: F.body, tint: C.ink4 }), rect(scene, 3, 12, box.w - 6, 1, C.ink2, 1)]);
    this.body = scene.add.container(0, 0);
    this.root.add(this.body);
    this.refresh();
  }

  refresh(): void {
    const s = this.session.s;
    const burn = Math.round(this.session.game.monthlyBurn());
    const { w, h } = this.box;
    const n = Math.max(3, Math.min(12, Math.floor((w - 12) / 9)));
    const months = s.company.monthlyRevenue.slice(-(n - 1));
    const now = Math.round(s.tally.revenue);
    const apps = s.shipped.slice(-8).reverse();
    const score = this.session.game.scoreNow();
    const sig = [burn, now, months.map(Math.round).join(','), apps.map((a) => shortMoney(a.earned)).join(','), rankFor(score), Math.round(score / 20_000)].join('|');
    if (sig === this.seen) return;
    this.seen = sig;
    this.body.removeAll(true);

    const chartH = Math.max(16, Math.min(52, h - 15 - 24));
    const top = 16;
    const base = top + chartH;
    const series = [...months, now];
    const scale = Math.max(burn * 1.25, Math.max(...series) * 1.05, 1);
    const x0 = Math.round((w - series.length * 9 + 3) / 2);
    series.forEach((v, i) => {
      const bh = v > 0 ? Math.max(2, Math.round((v / scale) * chartH)) : 1;
      const live = i === series.length - 1;
      const tint = v <= 0 ? C.ink3 : v >= burn ? C.green2 : C.pink;
      this.body.add(rect(this.scene, x0 + i * 9, base - bh, 6, bh, tint, live ? 0.55 : 1));
    });
    if (series.every((v) => v <= 0)) {
      this.body.add(label(this.scene, Math.round(w / 2), top + Math.round(chartH / 2) - 4, 'no revenue yet. vibes only.', { font: F.body, tint: C.ink3, origin: [0.5, 0.5], align: 'center', maxWidth: w - 12 }));
    }
    const by = base - Math.min(chartH, Math.round((burn / scale) * chartH));
    for (let x = 4; x < w - 4; x += 6) this.body.add(rect(this.scene, x, by, 3, 1, C.yellow, 0.9));
    this.body.add(rect(this.scene, 3, base, w - 6, 1, C.ink2, 1));

    let y = base + 3;
    this.body.add(label(this.scene, 5, y, `Burn ${shortMoney(burn)}/mo`, { font: F.body, tint: C.yellow }));
    y += 9;
    this.body.add(label(this.scene, 5, y, `This month ${shortMoney(now)}`, { font: F.body, tint: now >= burn ? C.green2 : C.cream }));
    y += 12;
    const strip = h >= 96 ? SCORE_STRIP : 0;
    if (strip) this.scoreStrip(score, h - strip);
    if (y + 20 > h - strip || apps.length === 0) return;
    this.body.add(label(this.scene, 5, y, 'YOUR APPS', { font: F.body, tint: C.ink4 }));
    this.body.add(rect(this.scene, 3, y + 9, w - 6, 1, C.ink2, 1));
    y += 12;
    for (const a of apps) {
      if (y + 9 > h - 3 - strip) break;
      // the name gets whatever the money leaves it, so a narrow column still shows most of the name
      const earned = label(this.scene, w - 5, y, shortMoney(a.earned), { font: F.body, tint: C.green2, origin: [1, 0] });
      this.body.add([label(this.scene, 5, y, fit(a.name, Math.max(4, Math.floor((w - 14 - earned.width) / 5))), { font: F.body, tint: C.cream }), earned]);
      y += 9;
    }
  }

  /** The rank this run would get if it ended today, and how far the next one is. */
  private scoreStrip(score: number, y: number): void {
    const { w } = this.box;
    const rank = rankFor(score);
    const next = nextRank(score);
    this.body.add(rect(this.scene, 3, y, w - 6, 1, C.ink2, 1));
    this.body.add(label(this.scene, 5, y + 4, 'IF YOU QUIT NOW', { font: F.body, tint: C.ink4 }));
    this.body.add(rect(this.scene, 5, y + 13, 12, 12, C.ink0, 1));
    this.body.add(rect(this.scene, 6, y + 14, 10, 10, RANK_COLOR[rank] ?? C.cream, 1));
    this.body.add(label(this.scene, 11, y + 16, rank, { font: F.capsBold, tint: C.ink0, origin: [0.5, 0] }));
    this.body.add(label(this.scene, 21, y + 16, shortMoney(score), { font: F.body, tint: C.cream }));
    if (!next) return;
    const track = bar(this.scene, w - 5 - 30, y + 14, 30, 5, RANK_COLOR[next.rank] ?? C.cream, 0);
    track.set(Math.max(0, Math.min(1, (score - next.from) / (next.min - next.from))), false);
    this.body.add(track);
    this.body.add(label(this.scene, w - 5, y + 21, `${next.rank} at ${shortMoney(next.min)}`, { font: F.body, tint: C.ink4, origin: [1, 0] }));
  }

  destroy(): void {
    this.root.destroy();
  }
}

/**
 * Money for an office too wide for the side panels: one slim strip under the room with the same
 * numbers, chart, burn, best apps and rank. A rich player should never lose sight of the money.
 */
class RevenueStrip {
  private readonly scene: Phaser.Scene;
  private readonly session: Session;
  private readonly box: Box;
  private readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  private seen = '';

  constructor(scene: Phaser.Scene, box: Box, session: Session, depth: number) {
    this.scene = scene;
    this.session = session;
    this.box = box;
    this.root = scene.add.container(Math.round(box.x), Math.round(box.y)).setDepth(depth);
    this.root.add(panel(scene, 0, 0, box.w, box.h, 'night', true));
    this.body = scene.add.container(0, 0);
    this.root.add(this.body);
    this.refresh();
  }

  refresh(): void {
    const s = this.session.s;
    const { w, h } = this.box;
    const burn = Math.round(this.session.game.monthlyBurn());
    const months = s.company.monthlyRevenue.slice(-11);
    const now = Math.round(s.tally.revenue);
    const apps = s.shipped.slice(-2).reverse();
    const score = this.session.game.scoreNow();
    const sig = [burn, now, months.map(Math.round).join(','), apps.map((a) => shortMoney(a.earned)).join(','), rankFor(score)].join('|');
    if (sig === this.seen) return;
    this.seen = sig;
    this.body.removeAll(true);

    // chart, the same bars as the side panel: green over the burn line, pink under it, the live month faint
    const series = [...months, now];
    const base = h - 5;
    const chartH = h - 11;
    const scale = Math.max(burn * 1.25, Math.max(...series) * 1.05, 1);
    series.forEach((v, i) => {
      const bh = v > 0 ? Math.max(2, Math.round((v / scale) * chartH)) : 1;
      const tint = v <= 0 ? C.ink3 : v >= burn ? C.green2 : C.pink;
      this.body.add(rect(this.scene, 5 + i * 9, base - bh, 6, bh, tint, i === series.length - 1 ? 0.55 : 1));
    });
    const by = base - Math.min(chartH, Math.round((burn / scale) * chartH));
    const chartW = series.length * 9;
    for (let x = 4; x < chartW + 6; x += 6) this.body.add(rect(this.scene, x, by, 3, 1, C.yellow, 0.9));
    this.body.add(rect(this.scene, 3, base, chartW + 4, 1, C.ink2, 1));

    // the numbers
    let x = chartW + 14;
    this.body.add(rect(this.scene, x - 5, 4, 1, h - 8, C.ink2, 1));
    this.body.add(label(this.scene, x, 4, 'REVENUE / MONTH', { font: F.body, tint: C.ink4 }));
    this.body.add(label(this.scene, x, 13, `Burn ${shortMoney(burn)}/mo`, { font: F.body, tint: C.yellow }));
    this.body.add(label(this.scene, x, 22, `This month ${shortMoney(now)}`, { font: F.body, tint: now >= burn ? C.green2 : C.cream }));
    x += 96;

    // the two latest apps
    if (apps.length && x + 90 < w) {
      this.body.add(rect(this.scene, x - 5, 4, 1, h - 8, C.ink2, 1));
      this.body.add(label(this.scene, x, 4, 'YOUR APPS', { font: F.body, tint: C.ink4 }));
      apps.forEach((a, i) => {
        const earned = label(this.scene, x + 90, 13 + i * 9, shortMoney(a.earned), { font: F.body, tint: C.green2, origin: [1, 0] });
        this.body.add([label(this.scene, x, 13 + i * 9, fit(a.name, Math.max(4, Math.floor((90 - 4 - earned.width) / 5))), { font: F.body, tint: C.cream }), earned]);
      });
      x += 100;
    }

    // what the run would be worth if it ended today
    if (x + 80 < w) {
      const rank = rankFor(score);
      this.body.add(rect(this.scene, x - 5, 4, 1, h - 8, C.ink2, 1));
      this.body.add(label(this.scene, x, 4, 'IF YOU QUIT NOW', { font: F.body, tint: C.ink4 }));
      this.body.add(rect(this.scene, x, 14, 12, 12, C.ink0, 1));
      this.body.add(rect(this.scene, x + 1, 15, 10, 10, RANK_COLOR[rank] ?? C.cream, 1));
      this.body.add(label(this.scene, x + 6, 17, rank, { font: F.capsBold, tint: C.ink0, origin: [0.5, 0] }));
      this.body.add(label(this.scene, x + 16, 17, shortMoney(score), { font: F.body, tint: C.cream }));
    }
  }

  destroy(): void {
    this.root.destroy();
  }
}

/**
 * The two panels around the room: the repo log and the revenue chart. They live in
 * the space the room leaves free and appear only when there is room for them.
 */
export class Dash {
  private terminal: Terminal | null = null;
  private revenue: RevenuePanel | RevenueStrip | null = null;
  private since = 0;

  constructor(scene: Phaser.Scene, session: Session, L: Layout, room: Box, view: Box, log: TermLine[]) {
    const depth = DEPTH.hud - 6;
    const gap = 4;
    const top = view.y + 12;
    if (!L.portrait) {
      const lw = room.x - 3 - gap * 2;
      const rx = room.x + room.w + 3 + gap;
      const rw = L.W - rx - gap;
      const h = view.y + view.h - top - 2;
      if (lw >= 72) this.terminal = new Terminal(scene, { x: gap, y: top, w: lw, h }, log, depth);
      if (rw >= 72) this.revenue = new RevenuePanel(scene, { x: rx, y: top, w: rw, h }, session, depth);
      if (!this.terminal && !this.revenue) {
        // a room that fills the screen: the money goes in a slim strip under it (below the drag track when the room is wider than the screen)
        const sy = room.y + room.h + (room.w > L.W ? 11 : 3);
        const sh = Math.min(34, view.y + view.h - sy - 2);
        const sx = Math.max(gap, room.x);
        const sw = Math.min(L.W - gap, room.x + room.w) - sx;
        if (sh >= 28 && sw >= 300) this.revenue = new RevenueStrip(scene, { x: sx, y: sy, w: sw, h: sh }, session, depth);
      }
    } else {
      const h = room.y - 3 - gap - top;
      if (h >= 50) {
        const tw = Math.floor((L.W - gap * 3) * 0.56);
        this.terminal = new Terminal(scene, { x: gap, y: top, w: tw, h }, log, depth);
        this.revenue = new RevenuePanel(scene, { x: gap * 2 + tw, y: top, w: L.W - gap * 3 - tw, h }, session, depth);
      }
    }
  }

  /** A new line in the terminal. The caller owns the array so it survives a resize. */
  push(): void {
    this.terminal?.render();
  }

  setProject(name: string | null): void {
    this.terminal?.setProject(name);
  }

  update(dtMs: number): void {
    this.since += dtMs;
    if (this.since < 700) return;
    this.since = 0;
    this.revenue?.refresh();
  }

  destroy(): void {
    this.terminal?.destroy();
    this.revenue?.destroy();
    this.terminal = null;
    this.revenue = null;
  }
}

/** Keep the log short so a long game does not grow it forever. */
export function addLine(log: TermLine[], line: TermLine): void {
  log.push(line);
  if (log.length > KEEP) log.shift();
}
