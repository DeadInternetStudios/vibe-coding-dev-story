import Phaser from 'phaser';
import { app } from '../core/app';
import { audio } from '../core/audio';
import { feature } from '../core/features';
import { writeSave } from '../core/save';
import { C, DEPTH, F } from '../core/theme';
import { recordTrophies } from '../core/trophies';
import { Room } from '../game/room';
import type { Session } from '../game/session';
import { monthName } from '../sim/format';
import { PHASES, TOKEN_PLANS } from '../sim/config';
import { unlocked, type Game } from '../sim/game';
import type { Content } from '../sim/content';
import { Rng } from '../sim/rng';
import { shopItem } from '../sim/shop';
import type { Notice, Tone } from '../sim/types';
import type { SfxId } from '../audio';
import type { VoiceLine } from '../content/vo';
import type { DialogueStep } from '../content/types';
import { Hud, type MenuId } from '../ui/hud';
import { label, panel, pop, rect } from '../ui/kit';
import { layoutOf, responsive } from '../ui/layout';
import { wipeIn } from '../ui/wipe';
import type { Modal } from '../ui/modal';
import { Chatter } from '../ui/chatter';
import { Dash, addLine, hash7, type TermKind, type TermLine } from '../ui/dash';
import { coinShower, confettiBurst } from '../ui/fx';
import { BUZZ, buzz } from '../core/haptics';
import { Ticker } from '../ui/ticker';
import { Toasts } from '../ui/toasts';
import type { UiCtx } from '../ui/ctx';
import { openMenu } from '../ui/menus';
import { openPrompt } from '../ui/prompts';
import { beat, showIntro } from '../ui/story';
import { fadeTo } from '../ui/layout';
import { shortMoney } from '../sim/format';

/** Height kept free under the room on a tall screen for the office chatter box. */
const CHATTER_LANE = 36;

/** The main screen: the office, the bars, and everything that pops up over them. */
export class OfficeScene extends Phaser.Scene {
  session!: Session;
  room!: Room;
  hud!: Hud;
  toasts!: Toasts;
  private ctx!: UiCtx;
  private menuModal: Modal | null = null;
  private promptOpen = false;
  private view = { x: 0, y: 0, w: 0, h: 0 };
  private dragging = false;
  private dragX = 0;
  /** moves the track and arrows that show a room wider than the screen can be dragged */
  private panTick: (() => void) | null = null;
  private bannerObj: Phaser.GameObjects.Container | null = null;
  private introDone = false;
  private introOpen = false;
  /** a brand new company waits, clock stopped, until the first project starts */
  private firstProjectWait = false;
  private launching = false;
  private chatter!: Chatter;
  private ticker?: Ticker;
  private dash?: Dash;
  /** the repo log shown in the terminal, kept here so a resize does not wipe it */
  private termLog: TermLine[] = [];
  private repoId = -2;
  private repoStep = 0;
  private repoReady = -1;
  private commitBag: string[] = [];
  /** seconds of play until the office says something */
  private ambientIn = 14;
  /** quiet time after any remark, so nothing talks over the last one */
  private hush = 0;
  private ambientBag: VoiceLine[] = [];
  private narrationBag: DialogueStep[] = [];
  /** one-time teaching moments waiting for a calm second */
  private beats: string[] = [];
  private beatOpen = false;
  private karmaSeen = 0;
  private directorIn = 1;

  constructor() {
    super('Office');
  }

  create(data?: { intro?: boolean }): void {
    const session = app.session;
    if (!session) {
      this.scene.start('Title');
      return;
    }
    this.session = session;
    session.clearHolds();
    this.cameras.main.setBackgroundColor(C.ink0);
    wipeIn(this);
    this.introDone = !data?.intro;
    this.firstProjectWait = !!data?.intro;
    if (data?.intro) session.paused = true;
    this.launching = false;
    this.menuModal = null;
    this.promptOpen = false;
    this.beats = [];
    this.beatOpen = false;
    this.karmaSeen = karmaUnlocks(session.game, app.content);
    this.ctx = this.makeCtx();
    this.introOpen = false;
    responsive(this, () => this.build(), () => this.teardown());
    this.installKeys();
    audio.music(session.s.company.crunch ? 'crunch' : 'office');
    window.__vcds = { ...(window.__vcds ?? {}), scene: this, session };
    this.events.once('shutdown', () => {
      this.hud?.destroy();
      session.save();
    });
    this.startIntroSoon();
  }

  /** The opening scene plays once the office is on screen. A window resize destroys the story box mid-sentence, so the scene starts over in the new layout. */
  private startIntroSoon(): void {
    if (this.introDone) return;
    this.time.delayedCall(450, () => {
      if (this.introDone || this.introOpen) return;
      this.introOpen = true;
      showIntro(this.ctx, () => {
        this.introOpen = false;
        this.introDone = true;
      });
    });
  }

  private teardown(): void {
    this.session.clearHolds();
    this.chatter?.stop();
    this.ticker?.destroy();
    this.dash?.destroy();
    this.hud?.destroy();
    this.room?.destroy();
    this.menuModal = null;
    this.promptOpen = false;
    // story boxes die with the rebuild; whatever waited on them starts over (prompts reopen from the game's pending, tips come back from the director)
    this.beats = [];
    this.beatOpen = false;
    if (this.introOpen) {
      this.introOpen = false;
      this.startIntroSoon();
    }
  }

  private makeCtx(): UiCtx {
    const self = this;
    return {
      scene: this,
      session: this.session,
      content: app.content,
      get room() {
        return self.room;
      },
      hold: (tag?: string) => this.session.hold(tag),
      toast: (text: string, tone: Tone = 'info', icon?: string) => this.toasts?.push(text, tone, icon),
      refresh: () => {
        this.room?.sync();
        this.hud?.update(0, false);
      },
      sfx: (id: SfxId) => audio.sfx(id),
      cashPop: (amount: number) => this.cashPop(amount),
      track: (m: Modal) => m,
      open: (id: string) => this.openMenuById(id as MenuId),
      banner: (text: string, sub?: string, tone: Tone = 'info') => this.banner(text, sub, tone),
      log: (kind: TermKind, head: string, text: string) => this.logLine(kind, head, text),
      shake: (power = 0.004) => {
        if (app.settings.shake && !app.settings.reducedMotion) this.cameras.main.shake(180, power);
        buzz(power > 0.008 ? BUZZ.bad : BUZZ.bump);
      },
    };
  }

  private build(): void {
    const L = layoutOf(this);
    // backdrop outside the room
    rect(this, 0, 0, L.W, L.H, C.ink0, 1).setDepth(DEPTH.bg);
    this.hud = new Hud(this, this.session);
    this.hud.onMenu = (id) => this.openMenuById(id);
    this.hud.onSpeed = (i) => this.setSpeed(i);
    this.hud.onCrunch = () => {
      this.session.game.setCrunch(!this.session.s.company.crunch);
      audio.sfx(this.session.s.company.crunch ? 'alert' : 'toggle');
      audio.music(this.session.s.company.crunch ? 'crunch' : 'office');
      this.hud.update(0, false);
    };
    this.hud.build(L);
    this.toasts = new Toasts(this, L, this.hud.topH + 1);
    this.ticker = new Ticker(this, L, this.hud.topH + 2, app.content.headlines);
    this.chatter = new Chatter(this, L, L.H - this.hud.bottomH - 2);
    this.room = new Room(this, this.session);
    this.room.root.setDepth(DEPTH.room);
    this.room.onStaff = (id) => this.openStaff(id);
    this.room.onItem = (id) => this.itemQuip(id);
    this.room.onBulb = () => this.tapIdea();
    this.bootLog();
    this.panTick = null;
    this.placeRoom();
    this.setupPan();
    const s = this.session.s;
    this.room.showIdea(s.project?.idea?.staffId ?? null);
  }

  private placeRoom(): void {
    const L = layoutOf(this);
    const top = this.hud.topH + 2;
    const bottom = L.H - this.hud.bottomH - 2;
    this.view = { x: 0, y: top, w: L.W, h: bottom - top };
    const rw = this.room.w;
    const rh = this.room.h;
    const x = rw <= L.W ? Math.floor((L.W - rw) / 2) : Math.min(0, Math.max(L.W - rw, Math.floor((L.W - rw) / 2)));
    // portrait: the room rides low so the repo log and the revenue list get the tall space above it,
    // with one chatter line of height left underneath
    const y = L.portrait ? Math.max(top, bottom - CHATTER_LANE - rh) : top + Math.max(0, Math.floor((bottom - top - rh) / 2));
    this.room.root.setPosition(x, y);
    // a plum floor plate under the room so the edge reads
    if (rw <= L.W) rect(this, x - 3, y - 3, rw + 6, rh + 6, C.ink1, 1).setDepth(DEPTH.room - 1);
    this.dash = new Dash(this, this.session, L, { x, y, w: rw, h: rh }, this.view, this.termLog);
    this.dash.setProject(this.session.s.project?.name ?? null);
  }

  /** Desktop shortcuts. They stay quiet while a story box or a popup owns the screen. */
  private installKeys(): void {
    const kb = this.input.keyboard;
    if (!kb || !feature('keys')) return;
    const free = () => this.introDone && !this.launching && !this.promptOpen && !this.beatOpen && !this.children.getByName('dialogue');
    const on = (key: string, fn: () => void, whileMenu = false) =>
      kb.on(`keydown-${key}`, () => {
        if (!free() || (!whileMenu && this.menuModal?.open)) return;
        fn();
      });
    on('SPACE', () => this.setSpeed(-1));
    ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((key, i) => on(key, () => this.setSpeed(i)));
    const menus: Record<string, string> = { H: 'hire', T: 'team', S: 'shop', O: 'tools', R: 'room', P: 'project' };
    for (const [key, id] of Object.entries(menus)) on(key, () => this.openMenuById(id), true);
    // escape opens the pause menu; the menu closes itself on escape, so only open it when nothing is up
    on('ESC', () => this.openMenuById('menu'));
    on('C', () => this.hud.onCrunch());
    on('I', () => this.session.s.project?.idea && this.tapIdea());
    this.events.once('shutdown', () => kb.removeAllListeners());
  }

  private setupPan(): void {
    const L = layoutOf(this);
    const rw = this.room.w;
    if (rw <= L.W) return;
    // the room is wider than the screen: say so once, then it can be dragged
    const seen = this.session.s.tutorial;
    const minX = L.W - rw;
    if (!seen.includes('pan')) {
      seen.push('pan');
      this.time.delayedCall(2200, () => this.toasts?.push('The office is bigger than your screen. Drag it to look around.', 'info', 'star'));
      // once, the room slides to one end and back by itself, so nobody mistakes the cut off desks for a broken layout
      const startX = this.room.root.x;
      const go = (x: number, ms: number, next?: () => void) =>
        this.tweens.add({ targets: this.room.root, x, duration: ms, ease: 'Sine.easeInOut', onComplete: () => next?.() });
      if (!app.settings.reducedMotion) this.time.delayedCall(900, () => go(minX, 1300, () => go(0, 2400, () => go(startX, 1300))));
    }
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > this.view.y && p.y < this.view.y + this.view.h && !this.menuModal && !this.promptOpen) {
        this.tweens.killTweensOf(this.room.root);
        this.dragging = true;
        this.dragX = p.x - this.room.root.x;
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragging) this.room.root.x = Math.round(Phaser.Math.Clamp(p.x - this.dragX, minX, 0));
    });
    this.input.on('pointerup', () => (this.dragging = false));
    this.panHint(L, minX);
  }

  /** A room wider than the screen gets a small track under it and arrows at its edges, so it reads as something to drag. */
  private panHint(L: ReturnType<typeof layoutOf>, minX: number): void {
    const root = this.room.root;
    const ty = Math.min(this.view.y + this.view.h - 5, root.y + this.room.h + 4);
    const trackW = 52;
    const tx = Math.floor((L.W - trackW) / 2);
    rect(this, tx - 1, ty - 1, trackW + 2, 5, C.ink0, 1).setDepth(DEPTH.fx);
    rect(this, tx, ty, trackW, 3, C.ink2, 1).setDepth(DEPTH.fx);
    const thumbW = Math.max(10, Math.round(trackW * (L.W / this.room.w)));
    const thumb = rect(this, tx, ty, thumbW, 3, C.orange2, 1).setDepth(DEPTH.fx + 1);
    const chevron = (x: number, dir: 1 | -1) => {
      const c = this.add.container(x, root.y + Math.floor(this.room.h / 2) - 3).setDepth(DEPTH.fx + 1);
      c.add(rect(this, 0, -1, 5, 9, C.ink0, 0.6));
      [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]].forEach(([dx, dy]) => c.add(rect(this, 1 + (dir === 1 ? dx! : 2 - dx!), 1 + dy!, 1, 1, C.cream, 1)));
      return c;
    };
    const left = chevron(2, -1);
    const right = chevron(L.W - 7, 1);
    this.panTick = () => {
      const span = this.room.w - L.W;
      const at = Phaser.Math.Clamp(-root.x / span, 0, 1);
      thumb.x = tx + Math.round((trackW - thumbW) * at);
      const pulse = app.settings.reducedMotion ? 0.9 : 0.55 + 0.4 * Math.sin(this.time.now / 260);
      left.setAlpha(root.x < -1 ? pulse : 0);
      right.setAlpha(root.x > minX + 1 ? pulse : 0);
    };
  }


  /* ------------------------------------------------------------ actions */

  private setSpeed(i: number): void {
    if (i < 0) this.session.paused = !this.session.paused;
    else {
      this.session.paused = false;
      this.session.setSpeed(i);
      app.settings.speed = i;
      audio.tempo(1 + i * 0.08);
    }
    this.hud.update(0, false);
  }

  private tapIdea(): void {
    this.session.game.tapIdea();
    audio.sfx('hot_idea');
    this.room.showIdea(null);
    this.hud.update(0, false);
  }

  private itemQuip(id: string): void {
    this.toasts.push(shopItem(id).quip, 'info', 'star');
    audio.sfx('bubble');
  }

  private openStaff(id: string): void {
    this.openMenuById('team', id);
  }

  private openMenuById(id: MenuId | string, arg?: string): void {
    if (this.promptOpen) return;
    if (this.menuModal?.open) this.menuModal.close(true);
    const m: Modal | null = openMenu(this.ctx, id, arg, () => {
      // a modal that fades out can finish after the next one has opened; only forget this one
      if (this.menuModal === m) this.menuModal = null;
      this.hud?.update(0, false);
    });
    this.menuModal = m;
  }

  /* ----------------------------------------------------------- effects */

  private cashPop(amount: number): void {
    if (Math.abs(amount) < 1) return;
    const { x, y } = this.hud.cashPos;
    pop(this, x + 16, y + 26, `${amount > 0 ? '+' : '-'}${shortMoney(Math.abs(amount))}`, amount > 0 ? C.green2 : C.pink);
  }

  private banner(text: string, sub?: string, tone: Tone = 'info'): void {
    const L = layoutOf(this);
    this.bannerObj?.destroy();
    const w = Math.min(L.W - 12, 260);
    const h = sub ? 34 : 24;
    const y = this.hud.topH + 14;
    const c = this.add.container(Math.round((L.W - w) / 2), y).setDepth(DEPTH.toast + 5);
    const bg = panel(this, 0, 0, w, h, tone === 'bad' ? 'btnBerry' : tone === 'good' ? 'btnTeal' : tone === 'wow' ? 'btnOrange' : 'plum');
    const t = label(this, w / 2, 4, text, { font: F.head, tint: C.white, origin: [0.5, 0], outline: true });
    c.add([bg, t]);
    if (sub) c.add(label(this, w / 2, 21, sub, { font: F.body, tint: C.cream, origin: [0.5, 0] }));
    this.bannerObj = c;
    if (app.settings.reducedMotion) {
      this.time.delayedCall(1800, () => c.destroy());
      return;
    }
    c.setAlpha(0).setScale(0.9, 0.9);
    c.x += Math.round(w * 0.05);
    this.tweens.add({ targets: c, alpha: 1, scaleX: 1, scaleY: 1, x: Math.round((L.W - w) / 2), duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, y: y - 8, delay: 1700, duration: 300, onComplete: () => c.destroy() });
  }

  /* ----------------------------------------------------------- notices */

  private handle(n: Notice): void {
    switch (n.t) {
      case 'toast':
        this.toasts.push(n.text, n.tone);
        if (n.tone === 'bad') audio.sfx('alert');
        if (n.staffId) this.room.sprite(n.staffId)?.emote(n.tone === 'bad' ? 'slump' : 'cheer', n.tone === 'bad' ? 'sad' : 'happy', 1200);
        break;
      case 'cash':
        this.cashPop(n.amount);
        if (n.amount >= 5000) {
          const at = this.room.toScreen(this.room.w / 2, this.room.h * 0.6);
          coinShower(this, at.x, at.y, Math.min(14, 4 + Math.round(n.amount / 4000)));
        }
        audio.sfx(n.amount > 0 ? (n.amount > 5000 ? 'coins' : 'coin') : 'bill');
        break;
      case 'idea':
        this.room.showIdea(n.staffId);
        audio.sfx('hot_idea');
        this.queueBeat('hotidea');
        break;
      case 'ideaGone':
        this.room.showIdea(null);
        break;
      case 'phase': {
        // phase 4 is the finish line: the launch popup that follows says it better than a banner
        const name = PHASES[n.phase]?.label.toUpperCase();
        if (name) this.banner(`PHASE ${n.phase + 1}: ${name}`, n.project, 'info');
        if (name) this.logLine('ok', 'ok', `${name.toLowerCase()} phase done`);
        audio.sfx('phase_done');
        this.room.cheerAll();
        break;
      }
      case 'levelUp': {
        const sp = this.room.sprite(n.staffId);
        sp?.emote('cheer', 'happy', 1600);
        if (sp) pop(this, this.room.root.x + sp.x, this.room.root.y + sp.y - 26, `LEVEL ${n.level}!`, C.yellow);
        audio.sfx('level_up');
        break;
      }
      case 'quit':
        this.toasts.push(`${n.name} quit. "${n.why}"`, 'bad', 'warn');
        this.logLine('warn', 'exit', `${n.name} left the repo`);
        audio.sfx('fire');
        this.ctx.shake(0.003);
        break;
      case 'achievement': {
        if (feature('trophies')) recordTrophies([n.id]);
        const a = app.content.achievements.find((x) => x.id === n.id);
        if (a) {
          this.banner('ACHIEVEMENT!', a.name, 'wow');
          audio.sfx('achievement');
          confettiBurst(this, layoutOf(this).W / 2, this.hud.topH + 24, { count: 22 });
          this.logLine('ok', 'ok', `unlocked: ${a.name}`);
        }
        break;
      }
      case 'newMonth':
        this.toasts.push(`${monthName(n.month)} begins. Rent is a state of mind.`, 'info', 'calendar');
        this.narrate();
        break;
      case 'newYear':
        this.banner(`YEAR ${n.year}`, 'The market got smarter. So did your landlord.', 'wow');
        audio.sfx('fanfare_small');
        break;
      case 'rateLimited':
        if (n.on) {
          this.toasts.push('Rate limited. The AI needs a nap.', 'bad', 'token');
          audio.sfx('rate_limit');
          this.logLine('warn', '429', 'too many requests. the AI needs a nap');
        } else {
          this.logLine('ok', 'ok', 'rate limit lifted');
        }
        break;
      case 'sound':
        audio.sfx(n.id as SfxId);
        break;
      case 'launched':
        this.logLine('cmd', '$', 'git push --force origin main');
        break;
      case 'prompt':
        break;
    }
  }

  /* ----------------------------------------------------- voices and lessons */

  /** Nothing else wants the screen or the clock. */
  private calm(): boolean {
    return !this.promptOpen && !this.launching && this.introDone && !this.menuModal?.open && !this.session.held && !this.session.game.pending;
  }

  /** The narrator opens a month now and then, and more often when the game runs slowly enough to listen. */
  private narrate(): void {
    const pool = app.content.story.monthNarration;
    if (!pool.length || this.chatter.busy || this.hush > 0 || !this.calm()) return;
    if (Math.random() > (this.session.speedIdx >= 2 ? 0.25 : 0.6)) return;
    if (this.narrationBag.length === 0) this.narrationBag = new Rng(Math.floor(Math.random() * 1e9)).shuffle(pool.slice());
    const step = this.narrationBag.pop();
    if (!step) return;
    this.chatter.say(step.speaker as VoiceLine['voice'], step.line.text, step.line);
    this.hush = 18;
  }

  /** Per frame: ambient office talk, the lessons, and clearing the screen for anything that matters. */
  private talk(sec: number): void {
    if (this.promptOpen || this.menuModal?.open || this.session.held) {
      if (this.chatter.busy) this.chatter.stop();
    } else if (this.session.ticking) {
      this.hush = Math.max(0, this.hush - sec);
      this.ambientIn -= sec;
      const pool = app.content.ambient;
      if (this.ambientIn <= 0 && pool.length && !this.chatter.busy && this.hush <= 0 && this.calm()) {
        if (this.ambientBag.length === 0) this.ambientBag = new Rng(Math.floor(Math.random() * 1e9)).shuffle(pool.slice());
        const line = this.ambientBag.pop();
        if (line) this.chatter.say(line.voice, line.text, line);
        this.ambientIn = 26 + Math.random() * 24;
        this.hush = 10;
      }
    }
    this.director(sec);
  }

  private queueBeat(key: string): void {
    if (!this.session.s.tutorial.includes(key) && !this.beats.includes(key)) this.beats.push(key);
  }

  /** Watches for the moments the tutorial waits on, and plays the next one when the screen is calm. */
  private director(sec: number): void {
    this.directorIn -= sec;
    if (this.directorIn > 0) return;
    this.directorIn = 0.6;
    const co = this.session.s.company;
    const cap = Math.max(300, TOKEN_PLANS.find((t) => t.id === co.tokenPlan)?.tokens ?? 300);
    if (co.tokens < cap * 0.12) this.queueBeat('tokens');
    if (co.spaghetti > 40) this.queueBeat('spaghetti');
    if (co.cash < 10000) this.queueBeat('cash');
    const k = karmaUnlocks(this.session.game, app.content);
    if (k > this.karmaSeen) this.queueBeat('karma');
    this.karmaSeen = k;
    if (this.beatOpen || this.beats.length === 0 || !this.calm()) return;
    const key = this.beats.shift()!;
    this.chatter.stop();
    this.beatOpen = true;
    if (!beat(this.ctx, key, () => (this.beatOpen = false))) this.beatOpen = false;
  }

  /* ------------------------------------------------------------ the repo */

  /** The terminal never starts empty: a new company boots, a loaded one resumes. */
  private bootLog(): void {
    if (this.termLog.length > 0) return;
    const s = this.session.s;
    const fresh = s.day <= 1 && s.shipped.length === 0;
    const lines: TermLine[] = fresh
      ? [
          { kind: 'cmd', head: '$', text: 'cd ~/garage' },
          { kind: 'cmd', head: '$', text: 'git init' },
          { kind: 'ok', head: 'ok', text: 'initialized empty repository' },
          { kind: 'cmd', head: '$', text: 'cat plan.txt' },
          { kind: 'warn', head: 'err', text: 'plan.txt: no such file' },
          { kind: 'cmd', head: '$', text: 'echo "ship it" > plan.txt' },
          { kind: 'ok', head: 'ok', text: 'plan written (1 line)' },
          { kind: 'cmd', head: '$', text: 'vibe init' },
          { kind: 'warn', head: 'warn', text: 'runway is finite. optimism is not' },
        ]
      : [
          // a company that has been around has a past: the log fills a tall terminal instead of leaving it empty at the top
          { kind: 'cmd', head: '$', text: 'git log --oneline' },
          ...Array.from({ length: 9 }, (): TermLine => ({ kind: 'commit', head: hash7(), text: this.nextCommit() })),
          { kind: 'cmd', head: '$', text: 'cd ~/garage' },
          { kind: 'cmd', head: '$', text: 'git pull' },
          { kind: 'warn', head: 'warn', text: 'merge conflict. nobody knows why' },
          { kind: 'cmd', head: '$', text: 'vibe resume' },
          { kind: 'ok', head: 'ok', text: `welcome back. day ${s.day}` },
          { kind: 'warn', head: 'warn', text: '3 unread messages, all from Mom' },
        ];
    for (const l of lines) addLine(this.termLog, l);
  }

  private logLine(kind: TermKind, head: string, text: string): void {
    addLine(this.termLog, { kind, head, text });
    this.dash?.push();
  }

  private nextCommit(): string {
    if (this.commitBag.length === 0) {
      const pool = app.content.commitMessages;
      this.commitBag = new Rng(Math.floor(Math.random() * 1e9)).shuffle(pool.length ? pool.slice() : ['fix']);
    }
    return this.commitBag.pop()!;
  }

  /** The terminal follows the project: a scaffold line, a commit every few percent, a green build at the end. */
  private repo(): void {
    const p = this.session.s.project;
    const id = p?.id ?? -1;
    if (id !== this.repoId) {
      this.repoId = id;
      this.repoStep = 0;
      this.dash?.setProject(p?.name ?? null);
      if (p) {
        const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        this.logLine('cmd', '$', `npx create-vibe-app ${slug}`);
      }
    }
    if (p?.status === 'dev') {
      const step = Math.floor(p.progress / 8);
      while (this.repoStep < step) {
        this.repoStep++;
        this.logLine('commit', hash7(), this.nextCommit());
      }
    }
    if (p?.status === 'ready' && this.repoReady !== id) {
      this.repoReady = id;
      this.logLine('ok', 'ok', 'build passing. tests: 0 (deleted)');
    }
  }

  /* ------------------------------------------------------------- frame */

  update(_time: number, dt: number): void {
    if (!this.session) return;
    if (this.firstProjectWait && this.session.s.project) {
      this.firstProjectWait = false;
      this.session.paused = false;
      this.toasts.push('Clock started. The runway is not a metaphor.', 'info', 'star');
    }
    const days = this.session.update(dt);
    for (const n of this.session.takeNotices()) this.handle(n);
    if (days > 0) {
      this.room.sync();
    }
    this.room.update(dt);
    this.hud.update(dt);
    this.toasts.update(dt);
    this.ticker?.update(dt);
    this.dash?.update(dt);
    this.panTick?.();
    this.repo();
    this.talk(dt / 1000);

    // anything the game waits on gets a popup
    if (!this.promptOpen && !this.launching && this.introDone && this.session.game.pending) {
      const p = this.session.game.pending;
      this.promptOpen = true;
      if (this.menuModal?.open) this.menuModal.close(true);
      let finished = false;
      openPrompt(this.ctx, p, (next) => {
        if (finished) return;
        finished = true;
        this.promptOpen = false;
        this.room.sync();
        this.hud.update(0, true);
        if (next?.t === 'thread') {
          this.launching = true;
          this.session.save();
          fadeTo(this, 'Thread', { appId: next.appId });
        } else if (next?.t === 'ending') {
          this.launching = true;
          fadeTo(this, 'Ending');
        }
      });
    }
    if (this.session.s.ending && !this.launching && !this.promptOpen) {
      this.launching = true;
      fadeTo(this, 'Ending');
    }
  }
}

/** How many things that need karma are open to the player right now. */
function karmaUnlocks(game: Game, c: Content): number {
  let n = 0;
  for (const list of [c.kinds, c.niches, c.tools, c.channels]) for (const it of list) if (it.unlock?.karma && unlocked(game, it.unlock)) n += 1;
  return n;
}

declare global {
  interface Window {
    __vcds?: Record<string, unknown>;
  }
}

export { writeSave };
