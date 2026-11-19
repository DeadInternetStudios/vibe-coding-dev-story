import Phaser from 'phaser';
import { app, current } from '../core/app';
import { audio } from '../core/audio';
import { dailyTag, recordDaily, type DailyResult } from '../core/daily';
import { C, DEPTH, F } from '../core/theme';
import { clearSave, pushHall, type HallEntry } from '../core/save';
import { copyText, shareText } from '../core/share';
import { feature } from '../core/features';
import { openShare } from '../features/share/modal';
import { recordTrophies } from '../core/trophies';
import { dateLabel, shortMoney, shortNumber } from '../sim/format';
import { button, label, panel, rect, type ButtonObj } from '../ui/kit';
import { fadeTo, layoutOf, responsive } from '../ui/layout';
import { openHall } from '../ui/modals/hall';
import { RANK_COLOR, RANK_NAME } from '../ui/ranks';
import { Speech } from '../ui/speech';

const SKY: Record<string, [number, number, number]> = {
  S: [0x2a1650, 0x7a4ad1, 0xff8a30],
  A: [0x23356e, 0x3f6bd1, 0x72aaf5],
  B: [0x2e2247, 0x7b1f45, 0xe8501c],
  C: [0x2e2247, 0x4d3d6b, 0x7a6a96],
  D: [0x124f5e, 0x1f5b3c, 0x3d9a4a],
  F: [0x17102a, 0x23356e, 0x3a3f5c],
};

/**
 * The end of the run. The announcer reads the ending, the numbers tally up, a rank letter lands,
 * and the run goes into the hall of fame. Tap to hurry it along.
 */
export class EndingScene extends Phaser.Scene {
  constructor() {
    super('Ending');
  }

  private fast = false;
  private nudge: (() => void) | null = null;
  private alive = true;
  private run = 0;
  private recorded: { pos: number; entry: HallEntry } | null = null;
  private dailyResult: DailyResult | null = null;

  create(data?: { replay?: boolean }): void {
    void data;
    this.fast = false;
    this.alive = true;
    this.cameras.main.fadeIn(500, 18, 15, 36);
    this.input.on('pointerup', () => this.skip());
    this.input.keyboard?.on('keydown-SPACE', () => this.skip());
    this.events.once('shutdown', () => {
      this.alive = false;
      audio.stopVoice();
    });
    this.record();
    responsive(this, () => {
      this.run += 1;
      void this.build(this.run, this.run > 1);
    });
  }

  private skip(): void {
    this.fast = true;
    this.nudge?.();
  }

  private wait(ms: number): Promise<void> {
    return new Promise((res) => {
      if (this.fast || !this.alive) return res();
      const ev = this.time.delayedCall(ms, () => {
        this.nudge = null;
        res();
      });
      this.nudge = () => {
        ev.remove();
        this.nudge = null;
        res();
      };
    });
  }

  /** Save the run once and clear the save, a finished game cannot be continued. */
  private record(): void {
    const s = current().s;
    if (feature('trophies')) recordTrophies(s.achievements);
    this.dailyResult = null;
    const end = s.ending;
    if (!end) return;
    const founder = s.staff.find((m) => m.isFounder)?.name ?? 'Founder';
    const entry: HallEntry = {
      company: s.company.name,
      founder,
      rank: end.rank,
      score: end.score,
      valuation: end.valuation,
      apps: s.shipped.length,
      days: end.day,
      endingId: end.endingId,
      difficulty: s.difficulty,
      bankrupt: end.bankrupt,
      when: Date.now(),
      ...(s.daily ? { daily: s.daily } : {}),
    };
    if (s.daily) this.dailyResult = recordDaily(s.daily, { score: end.score, rank: end.rank });
    const list = pushHall(entry);
    this.recorded = { pos: list.findIndex((e) => e.when === entry.when) + 1, entry };
    clearSave();
  }

  private async build(run: number, instant: boolean): Promise<void> {
    const L = layoutOf(this);
    const s = current().s;
    const end = s.ending;
    if (!end) {
      fadeTo(this, 'Title');
      return;
    }
    const ending = app.content.endings.find((e) => e.id === end.endingId);
    const rank = end.rank;
    const col = RANK_COLOR[rank] ?? C.cream;
    this.fast = instant;
    const alive = () => this.alive && this.run === run;

    // the sky
    const [top, mid, low] = SKY[rank] ?? SKY.B!;
    const bands = 18;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const c = t < 0.55 ? Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.IntegerToColor(top), Phaser.Display.Color.IntegerToColor(mid), 100, (t / 0.55) * 100) : Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.IntegerToColor(mid), Phaser.Display.Color.IntegerToColor(low), 100, ((t - 0.55) / 0.45) * 100);
      const rgb = (c.r << 16) | (c.g << 8) | c.b;
      rect(this, 0, Math.floor((i * L.H) / bands), L.W, Math.ceil(L.H / bands) + 1, rgb, 1).setDepth(0);
    }
    this.particles(rank, L.W, L.H);
    audio.music(rank === 'S' || rank === 'A' ? 'win' : 'lose', { fadeMs: 400 });

    const wide = !L.portrait && L.W >= 380;
    const w = Math.min(L.W - 6, wide ? 410 : 246);
    // a daily run has one more line under the score, so the wide card grows to fit it
    const h = Math.min(L.H - 6, wide ? (s.daily ? 234 : 222) : 340);
    const x = Math.floor((L.W - w) / 2);
    const y = Math.floor((L.H - h) / 2);
    const card = this.add.container(x, y).setDepth(DEPTH.panel);
    card.add(panel(this, 0, 0, w, h, 'paper'));
    card.add(panel(this, 0, 0, w, 15, rank === 'F' || rank === 'D' ? 'btnBerry' : 'btnOrange', false));
    card.add(label(this, w / 2, 3, s.daily ? `THE END - ${dailyTag(s.daily)}` : 'THE END', { font: F.caps, tint: C.white, origin: [0.5, 0] }));
    if (!instant) {
      card.setAlpha(0);
      card.y = y + 14;
      this.tweens.add({ targets: card, alpha: 1, y, duration: 420, ease: 'Cubic.easeOut' });
      await this.wait(500);
    }
    if (!alive()) return;

    // title and the announcer
    const title = ending?.title ?? (end.bankrupt ? 'OUT OF MONEY' : 'THE RUN ENDS');
    const titleT = label(this, w / 2, 20, title.toUpperCase(), { font: F.head, tint: col === C.yellow ? C.orange1 : C.ink1, origin: [0.5, 0], maxWidth: w - 24, align: 'center' });
    card.add(titleT);
    const th = titleT.height;
    const tagT = label(this, w / 2, 22 + th, ending?.tag ?? '', { font: F.body, tint: C.ink3, origin: [0.5, 0], maxWidth: w - 24, align: 'center' });
    card.add(tagT);
    audio.sfx(rank === 'S' ? 'fanfare_big' : rank === 'F' || rank === 'D' ? 'deny' : 'fanfare_small');
    const bodyY = 34 + th;
    const bodyW = wide ? w - 112 : w - 20;
    const bodyT = label(this, wide ? 8 : 10, bodyY, '', { font: F.read, tint: C.ink1, maxWidth: bodyW });
    card.add(bodyT);
    const text = ending?.body ?? 'The company is over. The Reddit thread is not.';
    if (instant) {
      bodyT.setText(text);
    } else {
      const sp = new Speech(this, bodyT);
      void sp.say(text, ending?.line);
      const skipper = () => {
        if (!sp.finished) sp.skip();
      };
      this.input.once('pointerup', skipper);
      await Promise.race([sp.done, new Promise<void>((r) => this.time.delayedCall(9000, r))]);
      if (!alive()) return;
      await this.wait(250);
    }
    // measure the finished text on a probe, so the stamp and the numbers sit below the last line however it wrapped
    const probe = label(this, -999, -999, text, { font: F.read, maxWidth: bodyW });
    const bodyH = probe.height || 40;
    probe.destroy();

    // the rank stamp
    const sx = wide ? w - 54 : w / 2;
    const sy = wide ? 52 : bodyY + bodyH + 38;
    const stamp = this.add.container(sx, sy);
    stamp.add(rect(this, -27, -30, 54, 60, C.ink0, 1));
    stamp.add(rect(this, -26, -29, 52, 58, col, 1));
    stamp.add(rect(this, -23, -26, 46, 52, C.ink0, 0.14));
    const letter = label(this, 0, -26, rank, { font: F.title, tint: C.ink0, origin: [0.5, 0] });
    letter.setScale(2);
    stamp.add(letter);
    stamp.add(label(this, 0, 17, RANK_NAME[rank] ?? '', { font: F.body, tint: C.ink0, origin: [0.5, 0] }));
    card.add(stamp);
    if (!instant) {
      stamp.setScale(3).setAlpha(0);
      this.tweens.add({ targets: stamp, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeIn' });
      this.time.delayedCall(250, () => {
        audio.sfx(rank === 'S' || rank === 'A' ? 'award_win' : 'bill');
        this.cameras.main.shake(140, 0.006);
      });
      await this.wait(700);
    }
    if (!alive()) return;

    // the numbers
    const rows: [string, string, number][] = [
      ['APPS SHIPPED', `${s.shipped.length}`, C.ink1],
      ['REVENUE', shortMoney(s.company.totalRevenue), C.green1],
      ['KARMA', shortNumber(s.company.karma), C.orange1],
      ['TEAM', `${s.staff.length}`, C.ink1],
      ['TIME', dateLabel(end.day), C.ink1],
      ['VALUATION', shortMoney(end.valuation), C.violet1],
    ];
    const gy = wide ? Math.max(bodyY + bodyH + 8, 98) : sy + 36;
    const colW = Math.floor((w - 20) / 2);
    const rowH = 14;
    for (let i = 0; i < rows.length; i++) {
      const [name, val, tint] = rows[i]!;
      const rx = 10 + (i % 2) * (colW + 4);
      const ry = gy + Math.floor(i / 2) * (rowH + 2);
      card.add(panel(this, rx, ry, colW, rowH, 'paperDim', false));
      card.add(label(this, rx + 4, ry + 4, name, { font: F.body, tint: C.ink2 }));
      const v = label(this, rx + colW - 4, ry + 3, val, { font: F.caps, tint, origin: [1, 0] });
      card.add(v);
      if (!instant) {
        v.setAlpha(0);
        this.tweens.add({ targets: v, alpha: 1, duration: 140 });
        audio.sfx('coin');
        await this.wait(190);
        if (!alive()) return;
      }
    }

    const sy2 = gy + Math.ceil(rows.length / 2) * (rowH + 2) + 3;
    const scoreT = label(this, w / 2, sy2, '', { font: F.head, tint: C.ink1, origin: [0.5, 0] });
    card.add(scoreT);
    const hallT = label(this, w / 2, sy2 + 15, '', { font: F.body, tint: C.ink3, origin: [0.5, 0] });
    card.add(hallT);
    const dailyT = label(this, w / 2, sy2 + 26, '', { font: F.body, tint: C.violet1, origin: [0.5, 0], maxWidth: w - 20, align: 'center' });
    card.add(dailyT);
    const finalScore = end.score;
    const showScore = (v: number) => scoreT.setText(`SCORE ${v.toLocaleString('en-US')}`);
    if (instant || app.settings.reducedMotion) showScore(finalScore);
    else {
      let last = -1;
      await new Promise<void>((res) => {
        this.tweens.addCounter({
          from: 0,
          to: 1,
          duration: this.fast ? 10 : 1200,
          ease: 'Cubic.easeOut',
          onUpdate: (tw) => {
            const v = Math.round(finalScore * tw.getValue()!);
            showScore(v);
            if (v !== last && Math.random() < 0.4) audio.sfx('karma_tick');
            last = v;
          },
          onComplete: () => res(),
        });
      });
    }
    if (this.recorded) hallT.setText(this.recorded.pos === 1 ? 'NEW HIGH SCORE! #1 IN THE HALL OF FAME' : `#${this.recorded.pos} in the hall of fame`);
    if (this.recorded?.pos === 1 && !instant) {
      audio.sfx('achievement');
      hallT.setTint(C.orange1);
    }
    if (this.dailyResult) {
      const { best, improved } = this.dailyResult;
      dailyT.setText(improved ? 'NEW DAILY BEST!' : `Daily best: ${best.score.toLocaleString('en-US')} (${best.rank})`);
      if (improved) dailyT.setTint(C.orange1);
    }
    if (!alive()) return;

    // buttons
    const by = h - 24;
    const count = 4;
    const bw = Math.floor((w - 12 - (count - 1) * 4) / count);
    const roomy = bw >= 66;
    const at = (i: number) => 6 + i * (bw + 4);
    const again = button(this, at(0), by, bw, 18, 'NEW RUN', () => {
      audio.music(null, { fadeMs: 300 });
      fadeTo(this, 'NewGame');
    }, { kind: 'orange', icon: roomy ? 'plus' : undefined });
    const hall = button(this, at(1), by, bw, 18, 'HALL', () => {
      openHall(this, { run: s.achievements });
    }, { kind: 'violet', icon: roomy ? 'trophy' : undefined });
    const share: ButtonObj = button(this, at(2), by, bw, 18, 'SHARE', () => {
      if (feature('share')) {
        openShare(this, s, ending?.title);
        return;
      }
      void copyText(shareText(s, ending?.title, `${location.origin}${location.pathname}`)).then((ok) => share.setText(ok ? 'COPIED' : 'SHARE'));
    }, { kind: 'teal', icon: roomy ? 'ship' : undefined });
    const home = button(this, at(3), by, bw, 18, 'TITLE', () => {
      audio.music(null, { fadeMs: 300 });
      fadeTo(this, 'Title');
    }, { kind: 'plum' });
    card.add([again, hall, share, home]);
    if (!instant) {
      [again, hall, share, home].forEach((b, i) => {
        b.setAlpha(0);
        this.tweens.add({ targets: b, alpha: 1, duration: 200, delay: i * 90 });
      });
    }
  }

  private particles(rank: string, W: number, H: number): void {
    const confetti = rank === 'S' || rank === 'A';
    const rain = rank === 'F';
    if (app.settings.reducedMotion) return;
    const colors = [C.yellow, C.pink, C.sky, C.mint, C.orange2, C.violet2];
    const n = confetti ? 44 : rain ? 60 : 24;
    for (let i = 0; i < n; i++) {
      const c = confetti ? colors[i % colors.length]! : rain ? C.blue2 : C.ink4;
      const pw = confetti ? 2 : 1;
      const ph = confetti ? 3 : rain ? 4 : 1;
      const p = rect(this, Math.random() * W, Math.random() * H, pw, ph, c, rain ? 0.6 : 1).setDepth(DEPTH.panel - 1);
      const dur = confetti ? 2600 + Math.random() * 2400 : rain ? 600 + Math.random() * 500 : 4000 + Math.random() * 3000;
      const fall = (): void => {
        p.setPosition(Math.random() * W, -6);
        this.tweens.add({
          targets: p,
          y: H + 6,
          x: p.x + (confetti ? (Math.random() - 0.5) * 40 : rain ? -10 : (Math.random() - 0.5) * 30),
          duration: dur,
          onComplete: fall,
        });
      };
      this.tweens.add({ targets: p, y: H + 6, duration: dur * Math.random() + 300, onComplete: fall });
    }
  }
}
