import Phaser from 'phaser';
import { app } from '../core/app';
import { audio } from '../core/audio';
import { bake, bakePortrait } from '../core/bake';
import { dailyKey } from '../core/daily';
import { feature } from '../core/features';
import { loadHall, loadSave, saveSettings } from '../core/save';
import { C, DEPTH, F } from '../core/theme';
import { nightCity } from '../art/sprites/scenery';
import { LOGO_H, LOGO_W, logoPx } from '../art/sprites/logo';
import { fxPx } from '../art/sprites/fx';
import { button, label, panel, rect, uiEvents, type ButtonKind } from '../ui/kit';
import { fadeTo, layoutOf, responsive } from '../ui/layout';
import { wipeIn } from '../ui/wipe';
import { openSettings } from '../ui/modals/settings';
import { openHall } from '../ui/modals/hall';
import { Session } from '../game/session';
import { Speech } from '../ui/speech';
import { bandEnds, ScrollText } from '../ui/scrollText';
import { VOICE_NAMES } from '../content/voiceNames';
import { Rng } from '../sim/rng';

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
  private logo: { img: Phaser.GameObjects.Image; y: number } | null = null;
  private twinkles: Phaser.GameObjects.Image[] = [];
  private drifters: Drifter[] = [];
  private ticker: ScrollText | null = null;
  private tickerX = 0;
  /** 1 when the floating comments may show, 0 while a greeting has the stage: one voice at a time */
  private chatter = 1;
  private chatterTo = 1;
  private clock = 0;
  private woke = false;
  private greeted = false;
  /** while a greeting is spoken, how loud it is: the logo bounces with it */
  private greeting: Speech | null = null;

  constructor() {
    super('Title');
  }

  create(): void {
    wipeIn(this);
    audio.music('title', { fadeMs: 400 });
    this.cameras.main.setBackgroundColor(C.ink0);
    responsive(this, () => this.build());
  }

  private build(): void {
    this.logo = null;
    this.twinkles = [];
    this.drifters = [];
    const L = layoutOf(this);
    const { W, H } = L;

    // the whole night: sky, moon, skyline, billboard, taxi and street in one picture
    this.add.image(0, 0, bake(this, `city:${W}x${H}`, () => nightCity(W, H))).setOrigin(0, 0).setDepth(DEPTH.bg);
    this.twinkle(W, H);
    this.shootingStars(W, H);

    // logo, buttons: measure first so nothing collides
    const save = loadSave();
    const buttons = save ? 4 : 3;
    const menuH = buttons * 27 + (save ? 9 : 0);
    const stripH = 13;
    // the top band belongs to the sound switch, its hint and the best-rank chip: the logo starts under it
    const band = 22;
    const fits = (sc: number) => band + LOGO_H * sc + 14 + 14 + menuH + stripH + 6 <= H;
    let scale = Math.max(1, Math.min(3, Math.floor((W - 16) / LOGO_W)));
    while (scale > 1 && !fits(scale)) scale--;
    const logoH = LOGO_H * scale;
    const free = H - stripH - logoH - 14 - menuH - band;
    const logoY = band + Math.max(0, Math.floor(free * 0.32));
    this.buildLogo(L.cx, logoY, scale);
    const subY = logoY + logoH + 4;
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
    // one main button: a returning player's is CONTINUE, a new player's is NEW GAME
    if (save) {
      const month = Math.floor(save.day / 28) + 1;
      add('CONTINUE', 'orange', () => this.continueGame(), 'play');
      label(this, L.cx, y - 3, `${save.company.name}  -  month ${month}${save.daily ? '  -  daily' : ''}`, { font: F.body, tint: C.cream, outline: true, origin: [0.5, 0], depth: DEPTH.hud });
      y += 9;
      add('NEW GAME', 'teal', () => fadeTo(this, 'NewGame'), 'ship');
    } else {
      add('NEW GAME', 'orange', () => fadeTo(this, 'NewGame'), 'ship');
    }
    add('HALL OF FAME', 'cream', () => openHall(this), 'trophy');
    add('SETTINGS', 'plum', () => openSettings(this), 'gear');
    // in the gap under the last button, so nothing above it moves
    if (feature('daily')) label(this, L.cx, y - 3, `daily: ${dailyKey()}`, { font: F.body, tint: C.yellow, outline: true, origin: [0.5, 0], depth: DEPTH.hud });
    const menuBottom = y;
    const menuTop = subY + 16;
    this.buildDrifters(L, { half: bw / 2, top: subY + 14, menuBottom, stripH });

    // ticker: letters come out of the dark on the right and sink into the NEWS badge, whole
    const NEWS_W = 34;
    rect(this, 0, H - stripH, W, stripH, C.ink0, 0.92).setDepth(DEPTH.hud);
    rect(this, 0, H - stripH, W, 1, C.orange2, 1).setDepth(DEPTH.hud);
    const heads = app.content.headlines.length ? app.content.headlines : ['AI writes the code. Reddit reads the reviews.'];
    const rng = new Rng(Date.now() & 0xffff);
    const text = rng.shuffle(heads).slice(0, 8).join('      +++      ');
    this.ticker = new ScrollText(this, H - stripH + 3, NEWS_W, W, { font: F.body, tint: C.cream, depth: DEPTH.hud + 1 });
    this.ticker.setRun(text);
    this.tickerX = W;
    this.ticker.place(this.tickerX);
    bandEnds(this, NEWS_W, W, H - stripH + 1, stripH - 1, C.ink0, DEPTH.hud + 2);
    rect(this, 0, H - stripH + 1, NEWS_W, stripH - 1, C.ink0, 1).setDepth(DEPTH.hud + 3);
    label(this, 4, H - stripH + 3, 'NEWS', { font: F.caps, tint: C.orange2, depth: DEPTH.hud + 4 });

    // hall of fame teaser: best rank so far
    const hall = loadHall();
    if (hall.length) {
      const best = hall[0]!;
      const chip = panel(this, 4, 4, 92, 17, 'night');
      chip.setDepth(DEPTH.hud);
      label(this, 10, 8, `BEST  ${best.rank}  $${Math.round(best.score / 1000)}K`, { font: F.caps, tint: C.yellow, depth: DEPTH.hud + 1 });
    }

    // the sound switch: the first tap anywhere wakes the sound up, this one turns it off and on again
    const soundText = () => (app.settings.muted ? 'SOUND OFF' : 'SOUND ON');
    const soundKind = (): ButtonKind => (app.settings.muted ? 'berry' : 'teal');
    const sound = button(this, W - 62, 4, 58, 14, soundText(), () => {
      app.settings.muted = !app.settings.muted;
      saveSettings(app.settings);
      uiEvents.emit('settings');
      sound.setText(soundText());
      sound.setKind(soundKind());
    }, { kind: soundKind(), icon: 'speaker', font: F.body });
    sound.setDepth(DEPTH.hud);
    // browsers keep a page silent until someone touches it: say so, and let the first touch wake the title song
    if (!this.woke && !app.settings.muted && !audio.status().unlocked) {
      // no arrow: the switch next to it turns sound OFF, and the tap that wakes it can be anywhere
      const room = W - 66 - (hall.length ? 100 : 6);
      const hint = label(this, W - 66, 7, room >= 96 ? 'tap anywhere for sound' : 'tap for sound', { font: F.body, tint: C.yellow, outline: true, origin: [1, 0], depth: DEPTH.hud });
      this.tweens.add({ targets: hint, alpha: { from: 1, to: 0.35 }, duration: 520, yoyo: true, repeat: -1 });
      const wake = (over: Phaser.GameObjects.GameObject[]) => {
        this.woke = true;
        hint.destroy();
        // a tap on empty sky: the first voice of the game says hello. A tap on a button just gets on with it.
        if (over.length === 0) this.greet(L, stripH, menuTop, menuBottom);
      };
      this.input.once('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => wake(over));
      this.input.keyboard?.once('keydown', () => wake([]));
    }

    this.input.keyboard?.on('keydown-ENTER', () => (save ? this.continueGame() : fadeTo(this, 'NewGame')));
  }

  private continueGame(): void {
    const s = loadSave();
    if (!s) return;
    app.session = Session.resume(app.content, s, app.settings.speed);
    fadeTo(this, 'Office');
  }

  /** The wordmark, whole, at a whole-number scale. Returns half its width so other things can keep clear of it. */
  private buildLogo(cx: number, y: number, scale: number): number {
    const img = this.add.image(cx, y, bake(this, 'logo', logoPx)).setOrigin(0.5, 0).setScale(scale).setDepth(DEPTH.hud);
    this.logo = { img, y };
    if (!app.settings.reducedMotion) {
      img.setAlpha(0).setScale(scale * 0.9);
      this.tweens.add({ targets: img, alpha: 1, scale, duration: 420, ease: 'Back.easeOut' });
    }
    return (LOGO_W * scale) / 2;
  }

  /** Every few seconds a star falls across the sky: the title should never be a still picture. */
  private shootingStars(W: number, H: number): void {
    if (app.settings.reducedMotion) return;
    const rng = new Rng((Date.now() & 0xffff) + 9);
    const fire = () => {
      const x = Math.round(rng.range(W * 0.12, W * 0.78));
      const y = Math.round(rng.range(5, H * 0.3));
      const star = this.add.container(x, y).setDepth(DEPTH.bg + 2);
      for (let i = 0; i < 8; i++) star.add(rect(this, -i * 3, -Math.round(i * 1.5), i === 0 ? 2 : i < 4 ? 2 : 1, i === 0 ? 2 : 1, i < 2 ? C.white : C.yellow, 1 - i * 0.11));
      this.tweens.add({ targets: star, x: x + 86, y: y + 43, alpha: 0, duration: 620, ease: 'Sine.easeIn', onComplete: () => star.destroy() });
      this.time.delayedCall(rng.int(4200, 8800), fire);
    };
    this.time.delayedCall(1600, fire);
  }

  /**
   * The first tap on empty sky wakes the sound and one of the voices of the game says hello. The box stands in the
   * free lane beside the buttons when the screen is wide, under the buttons when it is narrow, and never over them.
   */
  private greet(L: ReturnType<typeof layoutOf>, stripH: number, menuTop: number, menuBottom: number): void {
    const lines = app.content.titleQuips;
    if (this.greeted || lines.length === 0) return;
    this.greeted = true;
    const { W, H } = L;
    const line = lines[Math.floor(Math.random() * lines.length)]!;
    const faceW = 40;
    const boxH = 54;
    // beside the buttons (a button column is 128 wide, 8 clear on each side)
    const laneL = { x: 4, w: L.cx - 64 - 8 - 4 };
    const laneR = { x: L.cx + 64 + 8, w: W - 4 - (L.cx + 64 + 8) };
    const lane = laneR.w >= 124 ? laneR : laneL.w >= 124 ? laneL : null;
    let w: number;
    let x: number;
    let y: number;
    if (lane) {
      w = Math.min(176, lane.w);
      x = lane.x;
      y = menuTop + 6;
    } else {
      w = Math.min(W - 12, 224);
      x = Math.floor((W - w) / 2);
      y = menuBottom + 10;
      if (y + boxH > H - stripH - 4) y = H - stripH - 4 - boxH;
    }
    const text = label(this, faceW + 12, 15, '', { font: F.body, tint: C.cream, maxWidth: w - faceW - 20 });
    const root = this.add.container(0, 0).setDepth(DEPTH.hud + 6);
    const name = label(this, faceW + 12, 4, `${VOICE_NAMES[line.voice] ?? line.voice}`.toUpperCase(), { font: F.caps, tint: C.orange2 });
    root.add([panel(this, 0, 0, w, boxH, 'night'), rect(this, 5, 5, faceW - 4, faceW - 4, C.ink2, 1), this.add.image(5 + (faceW - 4) / 2, 5 + faceW - 5, bakePortrait(this, line.voice)).setOrigin(0.5, 1).setScale(2), name, text]);
    root.setPosition(x, y);
    if (!app.settings.reducedMotion) {
      root.setAlpha(0);
      root.y += 8;
      this.tweens.add({ targets: root, alpha: 1, y, duration: 180, ease: 'Back.easeOut' });
    }
    // one voice at a time: the floating comments step aside while this one talks
    this.chatterTo = 0;
    const speech = new Speech(this, text);
    this.greeting = speech;
    void speech.say(line.text, line).then(() => speech.done).then(() => {
      this.greeting = null;
      this.time.delayedCall(1300, () => {
        this.chatterTo = 1;
        this.tweens.add({ targets: root, alpha: 0, duration: 300, onComplete: () => root.destroy() });
      });
    });
    this.events.once('shutdown', () => speech.stop());
  }

  /** A few stars that blink, over the still ones in the picture. */
  private twinkle(W: number, H: number): void {
    const rng = new Rng(2027);
    const key = bake(this, 'fx:sparkleSmall', () => fxPx('sparkleSmall')!);
    const count = Math.max(6, Math.floor((W * H) / 9000));
    for (let i = 0; i < count; i++) {
      const img = this.add.image(Math.round(rng.range(6, W - 6)), Math.round(rng.range(4, H * 0.5)), key).setDepth(DEPTH.bg + 1).setAlpha(0);
      this.twinkles.push(img);
      if (app.settings.reducedMotion) {
        img.setAlpha(0.7);
        continue;
      }
      this.tweens.add({ targets: img, alpha: { from: 0, to: 1 }, duration: 600 + rng.int(0, 700), yoyo: true, repeat: -1, delay: rng.int(0, 2600), hold: rng.int(200, 900), repeatDelay: rng.int(1200, 3600) });
    }
  }

  /**
   * Reddit comments floating up past the city. Wide screens give them the lanes on both
   * sides of the logo; narrow ones give them the strip between the buttons and the skyline.
   */
  private buildDrifters(L: ReturnType<typeof layoutOf>, at: { half: number; top: number; menuBottom: number; stripH: number }): void {
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
    const w = 104;
    const gap = 8;
    const lanes: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const leftMax = L.cx - at.half - gap - w;
    const rightMin = L.cx + at.half + gap;
    const bottom = H - at.stripH - 4;
    if (leftMax >= 4 && W - w - 4 >= rightMin) {
      // beside the buttons, under the wordmark: the logo spans the screen, the buttons do not
      lanes.push({ x0: 4, x1: leftMax, y0: at.top, y1: bottom });
      lanes.push({ x0: rightMin, x1: W - w - 4, y0: at.top, y1: bottom });
    } else {
      lanes.push({ x0: 2, x1: Math.max(2, W - w - 2), y0: at.menuBottom + 4, y1: bottom });
    }
    if (lanes[0]!.y1 - lanes[0]!.y0 < 40) return;
    const count = lanes.length === 1 ? Math.min(3, Math.max(1, Math.floor((lanes[0]!.y1 - lanes[0]!.y0) / 60))) : 4;
    // each commenter once, and only lines that fit a bubble whole: a cut line reads as a bug on the first screen
    const picks: typeof pool = [];
    const seen = new Set<string>();
    for (const p of rng.shuffle(pool)) {
      if (picks.length >= count) break;
      if (seen.has(p.user) || p.text.length > 80) continue;
      seen.add(p.user);
      picks.push(p);
    }
    picks.forEach((p, i) => {
      const lane = lanes[i % lanes.length]!;
      const c = this.add.container(0, 0).setDepth(6);
      const t = label(this, 5, 12, p.text, { font: F.body, tint: C.cream, maxWidth: w - 10 });
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
    if (this.logo) this.logo.img.y = this.logo.y + (reduce ? 0 : Math.round(Math.sin(this.clock * 2.2) * 2 - (this.greeting?.level ?? 0) * 3));
    this.chatter += Math.sign(this.chatterTo - this.chatter) * Math.min(Math.abs(this.chatterTo - this.chatter), dt / 400);
    for (const d of this.drifters) {
      d.y -= (dt / 1000) * d.speed;
      if (d.y + d.h < d.y0) d.y = d.y1;
      d.c.y = Math.round(d.y);
      // a bubble is only seen whole: it fades in once all of it is above the news strip and is gone before its top reaches the buttons
      const fade = Math.min(1, Math.max(0, Math.min(d.y - d.y0, d.y1 - (d.y + d.h)) / 12));
      d.c.setAlpha(0.9 * fade * this.chatter);
    }
    if (this.ticker) {
      this.tickerX -= (dt / 1000) * 28;
      if (this.tickerX + this.ticker.width < 34) this.tickerX = this.scale.width;
      this.ticker.place(this.tickerX);
    }
  }
}
