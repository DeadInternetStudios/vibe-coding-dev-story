import Phaser from 'phaser';
import { app } from '../core/app';
import { bakePerson } from '../core/bake';
import { dailyKey, dailyRun, dailyTag, loadDailyBest } from '../core/daily';
import { C, DEPTH, F } from '../core/theme';
import { ACCESSORIES, HAIR } from '../art/sprites/people';
import { CLOTH_RAMPS, HAIR_RAMPS, SKIN_RAMPS } from '../art/palette';
import { DIFFICULTIES, FOUNDER_ORIGINS, type FounderOriginId } from '../sim/config';
import { Rng } from '../sim/rng';
import type { Look } from '../sim/types';
import { Session } from '../game/session';
import { button, label, panel, rect, type ButtonObj } from '../ui/kit';
import { editText } from '../ui/domInput';
import { fadeTo, layoutOf, responsive } from '../ui/layout';
import { nightSky } from '../art/sprites/scenery';
import { bake } from '../core/bake';

const LOOK_ROWS: { key: keyof Look; name: string; count: () => number }[] = [
  { key: 'skin', name: 'SKIN', count: () => SKIN_RAMPS.length },
  { key: 'hair', name: 'HAIR', count: () => HAIR.length },
  { key: 'hairColor', name: 'COLOR', count: () => HAIR_RAMPS.length },
  { key: 'outfit', name: 'OUTFIT', count: () => CLOTH_RAMPS.length },
  { key: 'accessory', name: 'EXTRA', count: () => ACCESSORIES.length },
];

/** height of the two lines that explain the daily challenge, above its button */
const DAILY_NOTE = 23;

const ORIGIN_SKILL_NAMES: Record<string, string> = { prompt: 'PROMPT', taste: 'TASTE', debug: 'DEBUG', paranoia: 'PARANOIA', hustle: 'HUSTLE' };

interface Form {
  company: string;
  founder: string;
  look: Look;
  origin: number;
  difficulty: number;
}

/** Name the company, make the founder, pick a past and a difficulty. Then start. */
export class NewGameScene extends Phaser.Scene {
  private form!: Form;
  private seed = 1;

  constructor() {
    super('NewGame');
  }

  create(): void {
    this.cameras.main.fadeIn(220, 18, 15, 36);
    const rng = new Rng(Math.floor(Math.random() * 1e9));
    this.seed = rng.state;
    const c = app.content;
    const first = rng.pick(c.firstNames);
    this.form = {
      company: rng.pick(c.companyNames),
      founder: first,
      look: { skin: rng.int(0, SKIN_RAMPS.length - 1), hair: rng.int(0, HAIR.length - 1), hairColor: rng.int(0, HAIR_RAMPS.length - 1), outfit: rng.int(0, CLOTH_RAMPS.length - 1), accessory: rng.int(0, 1) },
      origin: 1,
      difficulty: 1,
    };
    responsive(this, () => this.build());
  }

  private build(): void {
    const L = layoutOf(this);
    const f = this.form;
    this.add.image(0, 0, bake(this, `sky:${L.W}x${L.H}`, () => nightSky(L.W, L.H))).setOrigin(0, 0).setDepth(DEPTH.bg);
    rect(this, 0, 0, L.W, L.H, C.ink0, 0.45);

    const padX = L.portrait ? 6 : 10;
    const cw = L.cw - padX * 2;
    const x0 = L.x0 + padX;
    label(this, L.cx, 5, 'START YOUR STARTUP', { font: F.head, tint: C.yellow, outline: true, origin: [0.5, 0] });

    // columns
    const wide = !L.portrait;
    const leftW = wide ? Math.min(168, Math.floor(cw * 0.42)) : cw;
    const rightX = wide ? x0 + leftW + 8 : x0;
    const rightW = wide ? cw - leftW - 8 : cw;

    // ---------------------------------------------------------- left: names
    let y = 22;
    const field = (title: string, value: string, onEdit: () => void, onDice: () => void, yy: number) => {
      label(this, x0, yy, title, { font: F.caps, tint: C.cream });
      const box = panel(this, x0, yy + 9, leftW - 22, 14, 'paper');
      const t = label(this, x0 + 4, yy + 13, value, { font: F.caps, tint: C.ink1, maxWidth: leftW - 30 });
      const z = this.add.zone(x0, yy + 9, leftW - 22, 14).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerup', onEdit);
      const dice = button(this, x0 + leftW - 20, yy + 9, 20, 14, '', onDice, { kind: 'violet', icon: 'dice' });
      return { box, t, z, dice };
    };
    const companyField = field(
      'COMPANY',
      f.company,
      () => editText(this, { x: x0, y: y + 9, w: leftW - 22, h: 14 }, f.company, 22, (v) => {
        f.company = v;
        companyField.t.setText(v);
      }),
      () => {
        f.company = new Rng(Math.floor(Math.random() * 1e9)).pick(app.content.companyNames);
        companyField.t.setText(f.company);
      },
      y,
    );
    y += 26;
    const founderField = field(
      'FOUNDER',
      f.founder,
      () => editText(this, { x: x0, y: y + 9, w: leftW - 22, h: 14 }, f.founder, 14, (v) => {
        f.founder = v;
        founderField.t.setText(v);
      }),
      () => {
        f.founder = new Rng(Math.floor(Math.random() * 1e9)).pick(app.content.firstNames);
        founderField.t.setText(f.founder);
      },
      y,
    );
    y += 28;

    // ------------------------------------------------------- left: avatar
    const prev = panel(this, x0, y, 52, 72, 'night');
    void prev;
    const sprite = this.add.image(x0 + 26, y + 70, bakePerson(this, f.look, 'stand', 'happy')).setOrigin(0.5, 1).setScale(3);
    this.tweens.add({ targets: sprite, y: sprite.y - 2, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const repaint = () => sprite.setTexture(bakePerson(this, f.look, 'stand', 'happy'));
    let ay = y;
    for (const row of LOOK_ROWS) {
      const rx = x0 + 58;
      label(this, rx, ay + 3, row.name, { font: F.caps, tint: C.cream });
      const cur = label(this, rx + 70, ay + 3, '', { font: F.body, tint: C.cream, origin: [0.5, 0] });
      const bump = (d: number) => {
        const n = row.count();
        f.look = { ...f.look, [row.key]: (((f.look[row.key] ?? 0) + d) % n + n) % n };
        cur.setText(`${(f.look[row.key] ?? 0) + 1}`);
        repaint();
      };
      cur.setText(`${(f.look[row.key] ?? 0) + 1}`);
      button(this, rx + 44, ay, 12, 12, '<', () => bump(-1), { kind: 'plum' });
      button(this, rx + 86, ay, 12, 12, '>', () => bump(1), { kind: 'plum' });
      ay += 15;
    }
    if (!wide) y = ay + 8;

    // ------------------------------------------------------ right: origins
    let ry = wide ? 22 : y;
    label(this, rightX, ry, 'WHERE DID YOU COME FROM?', { font: F.caps, tint: C.cream });
    ry += 10;
    const cards: { box: ReturnType<typeof panel>; id: number }[] = [];
    const cardH = 31;
    FOUNDER_ORIGINS.forEach((o, i) => {
      const on = i === f.origin;
      const box = panel(this, rightX, ry, rightW, cardH, on ? 'btnTeal' : 'paperDim');
      const top = Object.entries(o.skills).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => `+${ORIGIN_SKILL_NAMES[k] ?? k}`);
      label(this, rightX + 5, ry + 4, o.name.toUpperCase(), { font: F.caps, tint: on ? C.white : C.ink1 });
      label(this, rightX + rightW - 5, ry + 4, top.join(' '), { font: F.body, tint: on ? C.yellow : C.teal1, origin: [1, 0] });
      label(this, rightX + 5, ry + 14, o.blurb, { font: F.body, tint: on ? C.cream : C.ink2, maxWidth: rightW - 10 });
      const z = this.add.zone(rightX, ry, rightW, cardH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => {
        f.origin = i;
        this.refresh();
      });
      cards.push({ box, id: i });
      ry += cardH + 3;
    });

    // ------------------------------------------------------ difficulty
    ry += 3;
    label(this, rightX, ry, 'DIFFICULTY', { font: F.caps, tint: C.cream });
    ry += 10;
    const gap = 3;
    const dw = Math.floor((rightW - gap * 2) / 3);
    const dbtns: ButtonObj[] = [];
    DIFFICULTIES.forEach((d, i) => {
      const b = button(this, rightX + i * (dw + gap), ry, dw, 15, d.id.toUpperCase(), () => {
        f.difficulty = i;
        dbtns.forEach((bb, j) => bb.setKind(j === i ? 'teal' : 'plum'));
        blurb.setText(DIFFICULTIES[i]!.blurb);
      }, { kind: i === f.difficulty ? 'teal' : 'plum' });
      dbtns.push(b);
    });
    ry += 18;
    const blurb = label(this, rightX, ry, DIFFICULTIES[f.difficulty]!.blurb, { font: F.body, tint: C.cream, maxWidth: rightW });
    ry += 12;

    // ------------------------------------------------------ start, and the daily challenge beside it
    // wide screens keep the daily in the empty corner under the avatar, narrow ones stack it above the start
    const startY = wide ? L.H - 30 : Math.max(ry + 6 + DAILY_NOTE + 24 + 4, L.H - 34);
    const startW = wide ? rightW : cw;
    const start = button(this, rightX, startY, startW, 24, "LET'S VIBE", () => this.start(), { kind: 'orange', icon: 'bolt' });
    this.tweens.add({ targets: start, y: start.y - 1, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const dailyY = wide ? startY : startY - 24 - 4;
    const dailyW = wide ? leftW : cw;
    const today = dailyKey();
    const best = loadDailyBest(today);
    label(this, x0, dailyY - DAILY_NOTE, dailyTag(today), { font: F.caps, tint: C.yellow });
    label(this, x0, dailyY - 12, best ? `Normal difficulty. Best: ${best.score.toLocaleString('en-US')} (${best.rank})` : 'Normal difficulty. Same chaos for all.', { font: F.body, tint: best ? C.mint : C.cream, maxWidth: dailyW });
    button(this, x0, dailyY, dailyW, 24, 'DAILY CHALLENGE', () => this.start(true), { kind: 'violet', icon: 'calendar' });
    const back = button(this, 4, 4, 30, 14, 'BACK', () => fadeTo(this, 'Title'), { kind: 'plum' });
    void back;
    void cards;
  }

  private refresh(): void {
    this.children.removeAll(true);
    this.tweens.killAll();
    this.build();
  }

  /** A normal start follows the form. The daily challenge keeps the names and the past, but takes its seed and difficulty from the date. */
  private start(daily = false): void {
    const f = this.form;
    const origin = FOUNDER_ORIGINS[f.origin]!;
    const run = daily ? dailyRun(dailyKey()) : { seed: this.seed, difficulty: DIFFICULTIES[f.difficulty]!.id };
    app.session = Session.fresh(
      app.content,
      {
        ...run,
        company: f.company,
        founderName: f.founder,
        origin: origin.id as FounderOriginId,
        look: f.look,
      },
      app.settings.speed,
    );
    fadeTo(this, 'Office', { intro: true });
  }
}
