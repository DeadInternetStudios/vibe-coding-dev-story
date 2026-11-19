import Phaser from 'phaser';
import { app } from '../core/app';
import { bake } from '../core/bake';
import { dailyKey } from '../core/daily';
import { loadHall, loadSave } from '../core/save';
import { C, DEPTH, F } from '../core/theme';
import { moon, nightSky, skyline, stars } from '../art/sprites/scenery';
import { button, label, panel, rect, type ButtonKind } from '../ui/kit';
import { fadeTo, layoutOf, responsive } from '../ui/layout';
import { openSettings } from '../ui/modals/settings';
import { openHall } from '../ui/modals/hall';
import { Session } from '../game/session';
import { Rng } from '../sim/rng';

const TITLE_A = 'VIBE CODING';
const TITLE_B = 'DEV STORY';

interface Drifter {
  c: Phaser.GameObjects.Container;
  speed: number;
  h: number;
  /** float position, the container gets the rounded one */
  y: number;
  /** the stretch of screen it may float through, so it never crosses the logo or the buttons */
  y0: number;
  y1: number;
}

/** The front door. A night city, a bouncing logo, and Reddit comments floating up past the skyline. */
export class TitleScene extends Phaser.Scene {
  private letters: { t: Phaser.GameObjects.BitmapText; y: number; i: number }[] = [];
  private drifters: Drifter[] = [];
  private ticker: Phaser.GameObjects.BitmapText | null = null;
  private tickerW = 0;
  private tickerX = 0;
  private clock = 0;

  constructor() {
    super('Title');
  }

  create(): void {
    this.cameras.main.fadeIn(260, 18, 15, 36);
    this.cameras.main.setBackgroundColor(C.ink0);
    responsive(this, () => this.build());
  }

  private build(): void {
    this.letters = [];
    this.drifters = [];
    const L = layoutOf(this);
    const { W, H } = L;
    const portrait = L.portrait;

    // sky and stars
    this.add.image(0, 0, bake(this, `sky:${W}x${H}`, () => nightSky(W, H))).setOrigin(0, 0).setDepth(DEPTH.bg);
    const a = this.add.image(0, 0, bake(this, `starsA:${W}x${H}`, () => stars(W, H, 3, Math.floor(W * H / 420)))).setOrigin(0, 0).setDepth(1);
    const b = this.add.image(0, 0, bake(this, `starsB:${W}x${H}`, () => stars(W, H, 9, Math.floor(W * H / 520)))).setOrigin(0, 0).setDepth(1);
    this.tweens.add({ targets: a, alpha: { from: 1, to: 0.25 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: b, alpha: { from: 0.25, to: 1 }, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.image(W - 44, portrait ? 26 : 22, bake(this, 'moon', moon)).setOrigin(0, 0).setDepth(2);

    // skyline
    const farH = portrait ? 120 : 76;
    const nearH = portrait ? 80 : 50;
    this.add.image(0, H - farH - 8, bake(this, `far:${W}x${farH}`, () => skyline(W, farH, 21, 0))).setOrigin(0, 0).setDepth(3);
    this.add.image(0, H - nearH, bake(this, `near:${W}x${nearH}`, () => skyline(W, nearH, 5, 1))).setOrigin(0, 0).setDepth(5);

    // logo, buttons: measure first so nothing collides
    const save = loadSave();
    const lh = (this.cache.bitmapFont.get(F.title + '-o').data as { lineHeight: number }).lineHeight;
    const buttons = save ? 4 : 3;
    const menuH = buttons * 27 + (save ? 9 : 0);
    const stripH = 13;
    const fits = (sc: number) => 8 + 2 * lh * sc - 8 + 14 + menuH + stripH + 8 <= H;
    const scale = !portrait && fits(3) && W >= 330 ? 3 : 2;
    const logoH = 2 * (lh * scale - (scale === 3 ? 12 : 6));
    const free = H - stripH - logoH - 14 - menuH;
    const logoY = Math.max(4, Math.floor(free * 0.32));
    const logoHalf = this.buildLogo(L.cx, logoY, scale, lh * scale - (scale === 3 ? 12 : 6));
    const subY = logoY + logoH + 2;
    const sub = label(this, L.cx, subY, 'a startup sim where the AI writes the code', { font: F.body, tint: C.cream, outline: true, origin: [0.5, 0], depth: DEPTH.hud });
    this.tweens.add({ targets: sub, alpha: { from: 1, to: 0.55 }, duration: 1300, yoyo: true, repeat: -1 });

    // buttons
    const bw = 128;
    const bh = 22;
    let y = subY + 16;
    const add = (text: string, kind: ButtonKind, fn: () => void, icon?: string) => {
      const btn = button(this, L.cx - bw / 2, y, bw, bh, text, fn, { kind, icon });
      btn.setDepth(DEPTH.hud);
      y += bh + 5;
      return btn;
    };
    add('NEW GAME', 'orange', () => fadeTo(this, 'NewGame'), 'ship');
    if (save) {
      const month = Math.floor(save.day / 28) + 1;
      add('CONTINUE', 'teal', () => this.continueGame(), 'play');
      label(this, L.cx, y - 3, `${save.company.name}  -  month ${month}${save.daily ? '  -  daily' : ''}`, { font: F.body, tint: C.cream, outline: true, origin: [0.5, 0], depth: DEPTH.hud });
      y += 9;
    }
    add('HALL OF FAME', 'cream', () => openHall(this), 'trophy');
    add('SETTINGS', 'plum', () => openSettings(this), 'gear');
    // in the gap under the last button, so nothing above it moves
    label(this, L.cx, y - 3, `daily: ${dailyKey()}`, { font: F.body, tint: C.yellow, outline: true, origin: [0.5, 0], depth: DEPTH.hud });
    this.buildDrifters(L, { half: Math.max(logoHalf, bw / 2), menuBottom: y, stripH });

    // ticker
    rect(this, 0, H - stripH, W, stripH, C.ink0, 0.92).setDepth(DEPTH.hud);
    rect(this, 0, H - stripH, W, 1, C.orange2, 1).setDepth(DEPTH.hud);
    label(this, 4, H - stripH + 3, 'NEWS', { font: F.caps, tint: C.orange2, depth: DEPTH.hud + 1 });
    const heads = app.content.headlines.length ? app.content.headlines : ['AI writes the code. Reddit reads the reviews.'];
    const rng = new Rng(Date.now() & 0xffff);
    const text = rng.shuffle(heads).slice(0, 8).join('      +++      ');
    this.ticker = label(this, W, H - stripH + 3, text, { font: F.body, tint: C.cream, depth: DEPTH.hud + 1 });
    this.tickerW = this.ticker.width;
    this.tickerX = W;
    const mask = this.make.graphics({ x: 0, y: 0 });
    mask.fillStyle(0xffffff).fillRect(34, H - stripH, W - 34, stripH);
    this.ticker.setMask(mask.createGeometryMask());

    // hall of fame teaser: best rank so far
    const hall = loadHall();
    if (hall.length) {
      const best = hall[0]!;
      const chip = panel(this, 4, 4, 92, 17, 'night');
      chip.setDepth(DEPTH.hud);
      label(this, 10, 8, `BEST  ${best.rank}  $${Math.round(best.score / 1000)}K`, { font: F.caps, tint: C.yellow, depth: DEPTH.hud + 1 });
    }

    this.input.keyboard?.on('keydown-ENTER', () => (save ? this.continueGame() : fadeTo(this, 'NewGame')));
  }

  private continueGame(): void {
    const s = loadSave();
    if (!s) return;
    app.session = Session.resume(app.content, s, app.settings.speed);
    fadeTo(this, 'Office');
  }

  /** Returns half the width of the widest logo line, so other things can keep clear of it. */
  private buildLogo(cx: number, y: number, scale: number, lineStep: number): number {
    let half = 0;
    const place = (text: string, yy: number, tints: number[]) => {
      const data = this.cache.bitmapFont.get(F.title + '-o').data as { chars: Record<number, { xAdvance: number }> };
      const adv = (ch: string) => (data.chars[ch.charCodeAt(0)]?.xAdvance ?? 8) * scale;
      const total = [...text].reduce((s, ch) => s + adv(ch), 0);
      half = Math.max(half, total / 2);
      let x = cx - total / 2;
      [...text].forEach((ch, i) => {
        if (ch !== ' ') {
          const t = label(this, x, yy, ch, { font: F.title, outline: true, tint: tints[i % tints.length]!, depth: DEPTH.hud });
          t.setScale(scale);
          this.letters.push({ t, y: yy, i });
        }
        x += adv(ch);
      });
    };
    place(TITLE_A, y, [C.orange2, C.yellow]);
    place(TITLE_B, y + lineStep, [C.cream, C.mint]);
    return half;
  }

  /**
   * Reddit comments floating up past the city. Wide screens give them the lanes on both
   * sides of the logo; narrow ones give them the strip between the buttons and the skyline.
   */
  private buildDrifters(L: ReturnType<typeof layoutOf>, at: { half: number; menuBottom: number; stripH: number }): void {
    const { W, H } = L;
    const rng = new Rng(77);
    const amb = app.content.ambient.length ? app.content.ambient : [];
    const pool = amb.length
      ? amb.map((l) => ({ user: `u/${l.voice}`, text: l.text }))
      : [
          { user: 'u/dave', text: 'did anyone read the diff?' },
          { user: 'u/clod', text: 'You are absolutely right!' },
          { user: 'u/karen', text: 'I want to speak to your AI' },
        ];
    const w = 96;
    const gap = 8;
    const lanes: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const leftMax = L.cx - at.half - gap - w;
    const rightMin = L.cx + at.half + gap;
    const bottom = H - at.stripH - 4;
    if (leftMax >= 4 && W - w - 4 >= rightMin) {
      lanes.push({ x0: 4, x1: leftMax, y0: 26, y1: bottom });
      lanes.push({ x0: rightMin, x1: W - w - 4, y0: 4, y1: bottom });
    } else {
      lanes.push({ x0: 2, x1: Math.max(2, W - w - 2), y0: at.menuBottom + 4, y1: bottom });
    }
    if (lanes[0]!.y1 - lanes[0]!.y0 < 40) return;
    const count = lanes.length === 1 ? Math.min(3, Math.max(1, Math.floor((lanes[0]!.y1 - lanes[0]!.y0) / 60))) : 4;
    const picks = rng.shuffle(pool).slice(0, count);
    picks.forEach((p, i) => {
      const lane = lanes[i % lanes.length]!;
      const c = this.add.container(0, 0).setDepth(6);
      const text = p.text.length > 56 ? `${p.text.slice(0, 54)}..` : p.text;
      const t = label(this, 5, 12, text, { font: F.body, tint: C.cream, maxWidth: w - 10 });
      const h = Math.max(24, 16 + t.height);
      c.add([panel(this, 0, 0, w, h, 'night', false), t, label(this, 5, 3, p.user, { font: F.caps, tint: C.orange2 })]);
      const x = lane.x1 > lane.x0 ? Math.round(rng.range(lane.x0, lane.x1)) : lane.x0;
      const span = lane.y1 - lane.y0 + h;
      const y = lane.y0 + ((i * 0.37 + rng.next() * 0.3) % 1) * span - h;
      c.setPosition(x, Math.round(y));
      this.drifters.push({ c, speed: rng.range(7, 12), h, y, y0: lane.y0, y1: lane.y1 });
    });
  }

  update(_t: number, dt: number): void {
    this.clock += dt / 1000;
    const reduce = app.settings.reducedMotion;
    for (const l of this.letters) l.t.y = Math.round(l.y + (reduce ? 0 : Math.sin(this.clock * 2.6 + l.i * 0.55) * 2));
    for (const d of this.drifters) {
      d.y -= (dt / 1000) * d.speed;
      if (d.y + d.h < d.y0) d.y = d.y1;
      d.c.y = Math.round(d.y);
      const fade = Math.min(1, Math.max(0, (d.y + d.h - d.y0) / 14), Math.max(0, (d.y1 - d.y) / 14));
      d.c.setAlpha(0.9 * fade);
    }
    if (this.ticker) {
      this.tickerX -= (dt / 1000) * 28;
      if (this.tickerX < 36 - this.tickerW) this.tickerX = this.scale.width;
      this.ticker.x = Math.round(this.tickerX);
    }
  }
}

