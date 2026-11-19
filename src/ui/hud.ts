import Phaser from 'phaser';
import { C, DEPTH, F } from '../core/theme';
import { STAT_KEYS, type StatKey } from '../content/types';
import { PHASES, SPEEDS, TOKEN_PLANS, phaseAt } from '../sim/config';
import { dateLabel, money, shortMoney } from '../sim/format';
import { projectView } from '../sim/views';
import type { Session } from '../game/session';
import { hasIcon } from '../art/sprites/icons';
import { bar, button, fit, iconImg, label, panel, rect, type BarObj, type ButtonObj } from './kit';
import type { Layout } from './layout';

export type MenuId = 'hire' | 'team' | 'shop' | 'tools' | 'room' | 'menu' | 'apps' | 'project' | 'launch';

const STAT_COLORS: Record<StatKey, number> = {
  vibes: C.pink,
  features: C.sky,
  polish: C.yellow,
  stability: C.mint,
  security: C.violet2,
};

interface Meter {
  icon: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.BitmapText;
  bar?: BarObj;
}

/**
 * The top bar and the bottom panel. Built from a layout, refreshed every frame
 * but only touches an object when its number changed.
 */
export class Hud {
  readonly scene: Phaser.Scene;
  private session: Session;
  private objs: Phaser.GameObjects.GameObject[] = [];
  topH = 17;
  bottomH = 60;
  onMenu: (id: MenuId) => void = () => {};
  onSpeed: (i: number) => void = () => {};
  onCrunch: () => void = () => {};
  private cash!: Meter;
  private karma!: Meter;
  private tokens!: Meter;
  private spag!: Meter;
  private date!: Phaser.GameObjects.BitmapText;
  private speedBtns: ButtonObj[] = [];
  private shownCash = 0;
  private cashTarget = 0;
  private last: Record<string, string | number> = {};
  private project!: Phaser.GameObjects.Container;
  private projectKey = '';
  private statBars = new Map<StatKey, BarObj>();
  private statVals = new Map<StatKey, Phaser.GameObjects.BitmapText>();
  private progressBar: BarObj | null = null;
  private hypeBar: BarObj | null = null;
  private hypeVal: Phaser.GameObjects.BitmapText | null = null;
  private phasePips: Phaser.GameObjects.Image[] = [];
  private phaseLabel: Phaser.GameObjects.BitmapText | null = null;
  private qualityText: Phaser.GameObjects.BitmapText | null = null;
  private crunchBtn: ButtonObj | null = null;
  private hireBtn: ButtonObj | null = null;
  private L!: Layout;
  cashPos = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, session: Session) {
    this.scene = scene;
    this.session = session;
  }

  destroy(): void {
    for (const o of this.objs) o.destroy();
    this.objs = [];
    this.project?.destroy();
  }

  private add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objs.push(o);
    return o;
  }

  build(L: Layout): void {
    this.destroy();
    this.L = L;
    this.last = {};
    this.projectKey = '';
    const s = this.scene;
    const portrait = L.portrait;
    this.topH = portrait ? 30 : 17;
    this.bottomH = portrait ? 118 : 62;

    // ------------------------------------------------------------ top bar
    const top = rect(s, 0, 0, L.W, this.topH, C.ink0, 1).setDepth(DEPTH.hud);
    const topEdge = rect(s, 0, this.topH, L.W, 1, C.ink2, 1).setDepth(DEPTH.hud);
    this.add(top);
    this.add(topEdge);
    const meter = (x: number, y: number, icon: string, withBar = false, barW = 28): Meter => {
      const ic = iconImg(s, icon, x, y).setDepth(DEPTH.hud + 1);
      this.add(ic);
      const text = label(s, x + 10, y + 1, '', { font: F.caps, tint: C.cream, depth: DEPTH.hud + 1 });
      this.add(text);
      const m: Meter = { icon: ic, text };
      if (withBar) {
        m.bar = bar(s, x + 10, y + 1, barW, 6, C.orange2, 0);
        m.bar.setDepth(DEPTH.hud + 1);
        this.add(m.bar);
        m.text.setX(x + 10 + barW + 3);
      }
      return m;
    };
    const x0 = L.x0 + 4;
    const row2 = portrait ? 16 : 4;
    this.cash = meter(x0, 4, 'cash');
    this.cashPos = { x: x0 + 12, y: 4 };
    this.karma = meter(portrait ? x0 + 78 : x0 + 70, 4, 'karma');
    this.tokens = meter(portrait ? x0 : x0 + 130, row2, 'token', true, 26);
    this.spag = meter(portrait ? x0 + 78 : x0 + 214, row2, 'spaghetti', true, 26);
    this.date = label(s, L.x0 + L.cw - 4, portrait ? 4 : 5, '', { font: F.caps, tint: C.yellow, origin: [1, 0], depth: DEPTH.hud + 1 });
    this.add(this.date);

    // speed buttons
    this.speedBtns = [];
    const names = ['1x', '2x', '4x', '8x'];
    const bw = 15;
    const sx = L.x0 + L.cw - 4 - (SPEEDS.length + 1) * (bw + 1) + 1;
    const sy = portrait ? 15 : 2;
    const pause = button(s, sx, sy, bw, 13, '', () => this.onSpeed(-1), { kind: 'plum', icon: 'pause', silent: false });
    pause.setDepth(DEPTH.hud + 2);
    this.add(pause);
    this.speedBtns.push(pause);
    SPEEDS.forEach((_, i) => {
      const b = button(s, sx + (i + 1) * (bw + 1), sy, bw, 13, names[i]!, () => this.onSpeed(i), { kind: 'plum', font: F.body });
      b.setDepth(DEPTH.hud + 2);
      this.add(b);
      this.speedBtns.push(b);
    });

    // --------------------------------------------------------- bottom panel
    const by = L.H - this.bottomH;
    const bg = rect(s, 0, by, L.W, this.bottomH, C.ink0, 1).setDepth(DEPTH.hud);
    const edge = rect(s, 0, by, L.W, 1, C.ink2, 1).setDepth(DEPTH.hud);
    this.add(bg);
    this.add(edge);
    this.buildMenu(L, by);
    this.project = s.add.container(0, 0).setDepth(DEPTH.hud + 1);
    this.buildProject();
    this.update(0, true);
  }

  private buildMenu(L: Layout, by: number): void {
    const s = this.scene;
    const items: [MenuId, string, string][] = [
      ['hire', 'HIRE', 'hire'],
      ['team', 'TEAM', 'team'],
      ['shop', 'SHOP', 'shop'],
      ['tools', 'TOOLS', 'tools'],
      ['room', 'ROOM', 'office'],
      ['menu', 'MENU', 'gear'],
    ];
    const portrait = L.portrait;
    const cols = 3;
    const gap = 2;
    const areaW = portrait ? L.cw - 8 : 152;
    const ax = portrait ? L.x0 + 4 : L.x0 + L.cw - areaW - 4;
    const ay = portrait ? by + this.bottomH - 42 : by + 4;
    const bw = Math.floor((areaW - gap * (cols - 1)) / cols);
    const bh = portrait ? 19 : 26;
    items.forEach(([id, text, icon], i) => {
      const cx = ax + (i % cols) * (bw + gap);
      const cy = ay + Math.floor(i / cols) * (bh + gap);
      const b = button(s, cx, cy, bw, bh, text, () => this.onMenu(id), { kind: id === 'hire' ? 'orange' : id === 'menu' ? 'plum' : 'teal', icon });
      b.setDepth(DEPTH.hud + 2);
      this.add(b);
      if (id === 'hire') this.hireBtn = b;
    });
  }

  /** The card on the left of the bottom panel. Rebuilt when the project changes. */
  private buildProject(): void {
    const L = this.L;
    const s = this.scene;
    this.project.removeAll(true);
    this.statBars.clear();
    this.statVals.clear();
    this.phasePips = [];
    this.progressBar = null;
    this.hypeBar = null;
    this.hypeVal = null;
    this.crunchBtn = null;
    this.phaseLabel = null;
    this.qualityText = null;
    const portrait = L.portrait;
    const by = L.H - this.bottomH;
    const x = L.x0 + 4;
    const w = portrait ? L.cw - 8 : L.cw - 152 - 12;
    const y = by + 4;
    const h = portrait ? this.bottomH - 4 - 46 : this.bottomH - 8;
    const card = panel(s, x, y, w, h, 'night');
    this.project.add(card);
    const p = this.session.s.project;
    const c = this.session.game.c;
    if (!p) {
      this.projectKey = 'none';
      const burn = this.session.game.monthlyBurn();
      const months = burn > 0 ? Math.max(0, this.session.s.company.cash / burn) : 99;
      const msg = this.session.s.shipped.length === 0 ? 'No project yet. Time to vibe.' : 'Nothing in the oven.';
      this.project.add(label(s, x + 6, y + 6, msg, { font: F.caps, tint: C.cream }));
      this.project.add(label(s, x + 6, y + 17, `Runway: ${months >= 24 ? '24+' : months.toFixed(1)} months at $${shortMoney(burn).slice(1)}/mo`, { font: F.body, tint: months < 2 ? C.pink : C.ink4 }));
      const b = button(s, x + 6, y + h - 22, Math.min(150, w - 12), 18, 'START A PROJECT', () => this.onMenu('project'), { kind: 'orange', icon: 'plan' });
      this.project.add(b);
      this.scene.tweens.add({ targets: b, y: b.y - 1, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return;
    }
    this.projectKey = `p${p.id}:${p.status}`;
    const kind = c.kind(p.kind);
    const niche = c.niche(p.niche);
    const art = hasIcon(`kind_${p.kind}`);
    if (art) this.project.add(iconImg(s, `kind_${p.kind}`, x + 5, y + 3));
    const nx = x + (art ? 20 : 6);
    this.project.add(label(s, nx, y + 3, fit(p.name, 22), { font: F.caps, tint: C.yellow }));
    const sub = `${kind.name} / ${niche.plural}`;
    this.project.add(label(s, nx, y + 12, fit(sub, 38), { font: F.body, tint: C.ink4 }));
    if (p.status !== 'dev') {
      const b = button(s, x + 6, y + h - 22, Math.min(150, w - 12), 18, p.status === 'ready' ? 'LAUNCH IT' : 'WAITING FOR MONDAY', () => this.onMenu('launch'), { kind: p.status === 'ready' ? 'orange' : 'plum', icon: 'ship', disabled: p.status !== 'ready' });
      this.project.add(b);
      return;
    }
    // phase pips
    const pipX = x + 6;
    const pipY = y + 22;
    PHASES.forEach((_, i) => {
      const pip = rect(s, pipX + i * 22, pipY, 20, 4, C.ink2, 1);
      this.project.add(pip);
      this.phasePips.push(pip as unknown as Phaser.GameObjects.Image);
    });
    this.phaseLabel = label(s, pipX + PHASES.length * 22 + 2, pipY - 2, '', { font: F.caps, tint: C.orange2 });
    this.project.add(this.phaseLabel);
    this.progressBar = bar(s, x + 6, pipY + 7, Math.min(w - 12, 140), 5, C.orange2, p.progress / 100);
    this.project.add(this.progressBar);
    // quality and the crunch switch sit on the right, clear of the stat grid
    const rx = x + w - 6;
    this.qualityText = label(s, rx, y + 3, 'Q 0', { font: F.read, tint: C.mint, origin: [1, 0] });
    this.project.add(this.qualityText);
    this.crunchBtn = button(s, rx - 44, pipY - 1, 44, 13, 'CRUNCH', () => this.onCrunch(), { kind: this.session.s.company.crunch ? 'berry' : 'plum', font: F.body });
    this.project.add(this.crunchBtn);
    // five stats and hype in a grid of three columns, the same in every layout
    const cols = 3;
    const colW = Math.floor((w - 12) / cols);
    const sy0 = pipY + 13;
    const cell = (i: number) => ({ cx: x + 6 + (i % cols) * colW, cy: sy0 + Math.floor(i / cols) * 9 });
    STAT_KEYS.forEach((k, i) => {
      const { cx, cy } = cell(i);
      this.project.add(iconImg(s, k, cx, cy - 1));
      const bb = bar(s, cx + 10, cy, colW - 36, 5, STAT_COLORS[k], 0);
      this.project.add(bb);
      this.statBars.set(k, bb);
      const v = label(s, cx + colW - 24, cy - 1, '0', { font: F.body, tint: C.cream });
      this.project.add(v);
      this.statVals.set(k, v);
    });
    const hype = cell(STAT_KEYS.length);
    this.project.add(label(s, hype.cx, hype.cy - 1, 'HYPE', { font: F.body, tint: C.pink }));
    this.hypeBar = bar(s, hype.cx + 22, hype.cy, colW - 48, 5, C.pink, 0);
    this.project.add(this.hypeBar);
    this.hypeVal = label(s, hype.cx + colW - 24, hype.cy - 1, '0', { font: F.body, tint: C.cream });
    this.project.add(this.hypeVal);
  }

  private setText(key: string, obj: Phaser.GameObjects.BitmapText, text: string): void {
    if (this.last[key] === text) return;
    this.last[key] = text;
    obj.setText(text);
  }

  update(dtMs: number, force = false): void {
    const s = this.session.s;
    const co = s.company;
    // cash counts toward its real value
    this.cashTarget = co.cash;
    if (force) this.shownCash = co.cash;
    const diff = this.cashTarget - this.shownCash;
    if (Math.abs(diff) > 0.5) {
      const step = Math.sign(diff) * Math.max(1, Math.abs(diff) * Math.min(1, dtMs / 140));
      this.shownCash = Math.abs(step) >= Math.abs(diff) ? this.cashTarget : this.shownCash + step;
    }
    const cashStr = money(this.shownCash);
    this.setText('cash', this.cash.text, cashStr);
    this.cash.text.setTint(this.shownCash < 0 ? C.pink : Math.abs(diff) > 0.5 ? (diff > 0 ? C.green2 : C.pink) : C.cream);
    this.setText('karma', this.karma.text, `${Math.round(co.karma)}`);
    const tokCap = this.tokenCap();
    this.tokens.bar?.set(Math.min(1, co.tokens / tokCap), true);
    this.setText('tokens', this.tokens.text, co.tokens >= 1000 ? `${(co.tokens / 1000).toFixed(1)}M` : `${Math.round(co.tokens)}K`);
    this.tokens.text.setTint(co.tokens < tokCap * 0.12 ? C.pink : C.cream);
    this.spag.bar?.set(co.spaghetti / 100, true);
    this.setText('spag', this.spag.text, `${Math.round(co.spaghetti)}%`);
    this.spag.text.setTint(co.spaghetti > 70 ? C.pink : co.spaghetti > 40 ? C.yellow : C.cream);
    this.setText('date', this.date, dateLabel(s.day));
    this.speedBtns.forEach((b, i) => {
      const on = i === 0 ? this.session.paused : !this.session.paused && this.session.speedIdx === i - 1;
      b.setKind(on ? 'orange' : 'plum');
    });
    if (this.hireBtn) {
      const free = this.session.game.freeDesks();
      const txt = free > 0 ? 'HIRE' : 'FULL';
      if (this.last.hire !== txt) {
        this.last.hire = txt;
        this.hireBtn.setText(txt);
        this.hireBtn.setKind(free > 0 ? 'orange' : 'plum');
      }
    }

    // project card
    const p = s.project;
    const key = p ? `p${p.id}:${p.status}` : 'none';
    if (key !== this.projectKey) this.buildProject();
    if (p && p.status === 'dev') this.updateProject(p);
  }

  private tokenCap(): number {
    const plan = this.session.s.company.tokenPlan;
    const cfg = TOKEN_PLANS.find((t) => t.id === plan);
    return Math.max(300, cfg?.tokens ?? 300);
  }

  private updateProject(p: NonNullable<Session['s']['project']>): void {
    const c = this.session.game.c;
    const view = projectView(c, p);
    const ph = phaseAt(p.progress);
    this.phasePips.forEach((pip, i) => {
      const img = pip as unknown as Phaser.GameObjects.Image;
      img.setTint(i < ph ? C.teal2 : i === ph ? C.orange2 : C.ink2);
    });
    if (this.phaseLabel) this.setText('phase', this.phaseLabel, PHASES[ph]!.label.toUpperCase());
    this.progressBar?.set(p.progress / 100, true);
    for (const k of STAT_KEYS) {
      this.statBars.get(k)?.set(view.stats[k] / 100, true);
      const t = this.statVals.get(k);
      if (t) this.setText(`st${k}`, t, `${view.stats[k]}`);
    }
    if (this.qualityText) this.setText('q', this.qualityText, `Q ${view.quality}`);
    this.hypeBar?.set(Math.min(1, p.hype / 100), true);
    if (this.hypeVal) this.setText('hype', this.hypeVal, `${Math.round(p.hype)}`);
    const crunch = this.session.s.company.crunch;
    if (this.crunchBtn && this.last.crunch !== (crunch ? 1 : 0)) {
      this.last.crunch = crunch ? 1 : 0;
      this.crunchBtn.setKind(crunch ? 'berry' : 'plum');
    }
  }

  /** Flash a stat label, used when a card or idea pays off. */
  pulseStat(k: StatKey): void {
    const t = this.statVals.get(k);
    if (!t) return;
    this.scene.tweens.add({ targets: t, scale: { from: 1.8, to: 1 }, duration: 260, ease: 'Back.easeOut' });
  }
}

