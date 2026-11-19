import Phaser from 'phaser';
import { app, current } from '../core/app';
import { audio } from '../core/audio';
import { feature } from '../core/features';
import { bakeIcon, bakePortrait } from '../core/bake';
import { C, DEPTH, F } from '../core/theme';
import type { AwardId, StatKey, ThreadComment } from '../content/types';
import { VOICE_NAMES } from '../content/voiceNames';
import { shortMoney, shortNumber } from '../sim/format';
import type { ShippedApp } from '../sim/types';
import { confettiBurst } from '../ui/fx';
import { BUZZ, buzz } from '../core/haptics';
import { button, iconImg, label, panel, rect, type PanelObj } from '../ui/kit';
import { fadeTo, layoutOf } from '../ui/layout';
import { Speech } from '../ui/speech';
import { beat } from '../ui/story';
import type { StageCtx } from '../ui/ctx';

const AWARD_ICON: Record<AwardId, string> = {
  gold: 'awardGold',
  silver: 'awardSilver',
  wholesome: 'awardWholesome',
  helpful: 'awardHelp',
  facepalm: 'awardFacepalm',
  deceased: 'awardDeceased',
  rocket: 'awardRocket',
  copium: 'awardCopium',
};

const AWARD_NAME: Record<AwardId, string> = {
  gold: 'GOLD',
  silver: 'SILVER',
  wholesome: 'WHOLESOME',
  helpful: 'HELPFUL',
  facepalm: 'FACEPALM',
  deceased: 'DECEASED',
  rocket: 'ROCKET',
  copium: 'COPIUM',
};

const JUDGE_NAME: Record<StatKey | 'overall' | 'hype', string> = {
  vibes: 'VIBES',
  features: 'FEATURES',
  polish: 'POLISH',
  stability: 'STABILITY',
  security: 'SECURITY',
  overall: 'OVERALL',
  hype: 'HYPE',
};

const JUDGE_SHORT: Record<StatKey | 'overall' | 'hype', string> = {
  vibes: 'VIBE',
  features: 'FEAT',
  polish: 'POLI',
  stability: 'STAB',
  security: 'SECU',
  overall: 'ALL',
  hype: 'HYPE',
};

/** The 2nd, 3rd and 4th "overall" rating get their own names, so the tiles never read as one copied tile. */
const OVERALL_AGAIN = ['GUT', 'SELL', 'WOW'];

function judgeShort(judges: StatKey | 'overall' | 'hype', nth: number): string {
  if (nth === 0) return JUDGE_SHORT[judges];
  if (judges === 'overall') return OVERALL_AGAIN[nth - 1] ?? 'ALL';
  return `${JUDGE_SHORT[judges].slice(0, 3)}${nth + 1}`;
}

/** What the address bar says for each place the app can be posted. Every thread is drawn as Reddit, the URL keeps the joke honest. */
const ADDRESS: Record<string, string> = {
  quiet: 'my-garage-blog.dev/launch',
  hn: 'news.ycombinator.com/item',
  ph: 'producthunt.com/posts/new',
  linkedin: 'linkedin.com/feed/update',
  influencer: 'tiktok.example/@shoutout',
  ad: 'billboards.example/campaign',
};

const AVATAR_BG = [C.sky, C.mint, C.yellow, C.pink, C.violet2, C.orange3, C.blue2, C.green2];

interface Item {
  vi: number;
  ci: number;
  c: ThreadComment;
  votes: number;
  awards: AwardId[];
  /** set on the root comment of a vignette */
  rating?: number;
  judges?: StatKey | 'overall' | 'hype';
}

interface Card {
  box: PanelObj;
  x: number;
  y: number;
  w: number;
  /** content height inside, grows as comments land */
  inner: number;
}

const ago = (i: number) => ['1h', '47m', '32m', '21m', '14m', '9m', '5m', '2m', '1m', 'now'][Math.min(9, i)] ?? 'now';

/**
 * The launch day thread. Reddit, but pixel, and everyone is voiced. The sim already decided who
 * says what and how many upvotes it gets. This scene performs it: comments arrive one by one,
 * votes tick up, awards pop, ratings land, then the results card tallies the day.
 */
export class ThreadScene extends Phaser.Scene {
  constructor() {
    super('Thread');
  }

  private rec!: ShippedApp;
  private replay = false;
  private instant = false;
  private fast = false;
  private alive = true;
  private feed!: Phaser.GameObjects.Container;
  private cursor = 0;
  private scroll = 0;
  private scrollTarget = 0;
  private viewTop = 18;
  private viewH = 100;
  private x0 = 0;
  private cw = 0;
  private portrait = false;
  private cur: Speech | null = null;
  private nudge: (() => void) | null = null;
  private slots: { text: Phaser.GameObjects.BitmapText; box: Phaser.GameObjects.Image }[] = [];
  private skipBtn!: Phaser.GameObjects.Container;
  private resultsOpen = false;
  private ratingsSum = 0;
  /** portrait only: the speaker, big, under the feed */
  private stageH = 0;
  private stage: Phaser.GameObjects.Container | null = null;
  private stageFace!: Phaser.GameObjects.Image;
  private stageBg!: Phaser.GameObjects.Image;
  private stageName!: Phaser.GameObjects.BitmapText;
  private stageUser!: Phaser.GameObjects.BitmapText;
  private stageFlair!: Phaser.GameObjects.BitmapText;
  private stageBars: Phaser.GameObjects.Image[] = [];
  /** faded placeholder replies under the feed while the real ones load */
  private ghosts: Phaser.GameObjects.Container | null = null;
  private karmaT!: Phaser.GameObjects.BitmapText;
  private karmaIcon!: Phaser.GameObjects.Image;
  /** the karma the pill shows now */
  private karmaShown = 0;
  /** upvotes that have landed so far, and all that will land */
  private votesIn = 0;
  private votesAll = 1;

  init(data: { appId?: number; replay?: boolean; instant?: boolean }): void {
    const s = current().s;
    const found = s.shipped.find((a) => a.id === data.appId) ?? s.shipped[s.shipped.length - 1];
    if (!found) throw new Error('no app to show a thread for');
    this.rec = found;
    this.replay = !!data.replay;
    this.instant = !!data.instant;
    this.fast = this.instant;
    this.alive = true;
    this.cursor = 0;
    this.scroll = 0;
    this.scrollTarget = 0;
    this.slots = [];
    this.resultsOpen = false;
    this.ratingsSum = 0;
    this.stage = null;
    this.stageBars = [];
    this.ghosts = null;
    this.karmaShown = 0;
    this.votesIn = 0;
    this.votesAll = Math.max(1, this.rec.thread.opVotes + this.items().flat().reduce((n, it) => n + Math.max(0, it.votes), 0));
    this.cur = null;
    this.nudge = null;
  }

  create(): void {
    const L = layoutOf(this);
    this.portrait = L.portrait;
    this.cw = Math.min(L.W - (L.portrait ? 4 : 12), 440);
    this.x0 = Math.floor((L.W - this.cw) / 2);
    this.cameras.main.fadeIn(260, 18, 15, 36);
    this.cameras.main.setBackgroundColor(C.ink0);
    rect(this, 0, 0, L.W, L.H, C.ink0, 1).setDepth(0);
    // faint rows behind the column so wide screens do not look empty
    for (let y = 18; y < L.H; y += 12) rect(this, 0, y, L.W, 1, C.ink1, 0.5).setDepth(1);
    this.viewTop = 18;
    this.stageH = L.portrait ? 66 : 0;
    this.viewH = L.H - this.viewTop - this.stageH;
    this.feed = this.add.container(0, this.viewTop).setDepth(5);
    this.buildChrome(L.W);
    if (this.stageH) this.buildStage(L);
    audio.music('thread', { fadeMs: 500 });
    (window as unknown as { __vcds?: Record<string, unknown> }).__vcds = { ...((window as unknown as { __vcds?: Record<string, unknown> }).__vcds ?? {}), thread: this, scene: this };

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.resultsOpen) return;
      if (p.y > L.H - 16 && p.x > L.W - 52) return;
      this.tapped();
    });
    if (feature('keys')) {
      this.input.keyboard?.on('keydown-SPACE', () => this.tapped());
      this.input.keyboard?.on('keydown-ENTER', () => this.tapped());
      this.input.keyboard?.on('keydown-ESC', () => this.skipAll());
    }
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.alive = false;
      this.scale.off('resize', this.onResize, this);
      this.cur?.stop();
      audio.stopVoice();
    });
    void this.play();
  }

  private onResize(): void {
    if (!this.alive) return;
    this.alive = false;
    this.cur?.stop();
    audio.stopVoice();
    this.time.delayedCall(60, () => this.scene.restart({ appId: this.rec.id, replay: this.replay, instant: true }));
  }

  update(_t: number, dt: number): void {
    const d = this.scrollTarget - this.scroll;
    if (Math.abs(d) > 0.4) this.scroll += d * Math.min(1, dt / 120);
    else this.scroll = this.scrollTarget;
    this.feed.y = this.viewTop - Math.round(this.scroll);
  }

  /* ------------------------------------------------------------- chrome */

  private buildChrome(W: number): void {
    const bar = rect(this, 0, 0, W, 17, C.ink1, 1).setDepth(DEPTH.panel);
    const line = rect(this, 0, 17, W, 1, C.ink0, 1).setDepth(DEPTH.panel);
    void bar;
    void line;
    const dots = [C.pink, C.yellow, C.green2];
    dots.forEach((c, i) => rect(this, 4 + i * 5, 7, 3, 3, c, 1).setDepth(DEPTH.panel + 1));
    const ch = app.content.channels.find((x) => x.id === this.rec.channel);
    const address = ch ? (ADDRESS[ch.id] ?? `reddit.com/${ch.where}`) : 'reddit.com/r/SideProject';
    const urlX = 24;
    const n = Math.max(1, this.rec.thread.vignettes.length);
    const slotW = 12;
    const slotsW = n * (slotW + 1);
    const pillW = 46;
    const urlW = Math.min(this.cw, W - urlX - slotsW - pillW - 11);
    panel(this, urlX, 3, urlW, 11, 'well', false).setDepth(DEPTH.panel + 1);
    label(this, urlX + 4, 5, address, { font: F.body, tint: C.ink4, depth: DEPTH.panel + 2, maxWidth: urlW - 8 });
    // karma pill: rolls up as the comments land and ends on the number the results card shows
    const kx = urlX + urlW + 3;
    panel(this, kx, 3, pillW, 11, 'well', false).setDepth(DEPTH.panel + 1);
    this.karmaIcon = iconImg(this, 'karma', kx + 3, 4).setOrigin(0.5, 0.5).setPosition(kx + 7, 9).setDepth(DEPTH.panel + 2);
    this.karmaT = label(this, kx + 14, 5, '+0', { font: F.caps, tint: C.orange2, depth: DEPTH.panel + 2 });
    // rating slots, they fill in as the root comments land
    this.slots = [];
    for (let i = 0; i < n; i++) {
      const x = W - slotsW - 2 + i * (slotW + 1);
      const box = rect(this, x, 3, slotW, 11, C.ink0, 1).setDepth(DEPTH.panel + 1);
      const text = label(this, x + slotW / 2, 5, '', { font: F.body, tint: C.cream, origin: [0.5, 0], depth: DEPTH.panel + 2 });
      this.slots.push({ box, text });
    }
    // skip
    const L = layoutOf(this);
    this.skipBtn = button(this, L.W - 50, L.H - 14, 48, 12, 'SKIP >>', () => this.skipAll(), { kind: 'plum', font: F.body, silent: true });
    this.skipBtn.setDepth(DEPTH.panel + 4);
    if (this.replay) this.skipBtn.setAlpha(0.9);
  }

  /* ---------------------------------------------------------- pacing */

  private tapped(): void {
    if (this.cur && !this.cur.finished) {
      this.cur.skip();
      audio.stopVoice();
      return;
    }
    this.nudge?.();
  }

  private skipAll(): void {
    if (this.fast) return;
    this.fast = true;
    this.cur?.skip();
    audio.stopVoice();
    this.nudge?.();
  }

  private wait(ms: number): Promise<void> {
    return new Promise((res) => {
      if (this.fast || !this.alive) {
        res();
        return;
      }
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

  private follow(bottom: number): void {
    this.scrollTarget = Math.max(0, bottom + 18 - this.viewH);
    if (this.instant) this.scroll = this.scrollTarget;
  }

  /* ------------------------------------------------------------ the show */

  private items(): Item[][] {
    const c = app.content;
    const out: Item[][] = [];
    this.rec.thread.vignettes.forEach((rec, vi) => {
      const v = c.vignette(rec.id);
      if (!v) return;
      const group: Item[] = v.comments.map((cm, ci) => ({
        vi,
        ci,
        c: cm,
        votes: rec.votes[ci] ?? 0,
        awards: this.rec.thread.awards.filter((a) => a.vignette === rec.id && a.index === ci).map((a) => a.award),
        ...(ci === 0 ? { rating: rec.rating, judges: rec.judges as Item['judges'] } : {}),
      }));
      out.push(group);
    });
    return out;
  }

  private async play(): Promise<void> {
    const sctx: StageCtx = { scene: this, session: current(), hold: () => () => undefined };
    await this.addOp();
    if (!this.instant && !this.replay) {
      await new Promise<void>((res) => {
        if (!beat(sctx, 'thread', res)) res();
      });
    }
    await this.wait(700);
    const groups = this.items();
    for (const group of groups) {
      let card: Card | null = null;
      for (const item of group) {
        if (!this.alive) return;
        card = await this.addComment(item, card);
        await this.wait(this.portrait ? 380 : 320);
      }
      if (card) this.cursor = card.y + card.box.boxH + 5;
      this.moveGhosts(this.cursor);
      await this.wait(260);
    }
    if (!this.alive) return;
    this.dropGhosts();
    await this.wait(500);
    this.showResults();
  }

  /* --------------------------------------------------------------- OP */

  private async addOp(): Promise<void> {
    const rec = this.rec;
    const ch = app.content.channels.find((x) => x.id === rec.channel);
    const founder = current().s.staff.find((m) => m.isFounder);
    const author = `u/${(founder?.name ?? 'founder').replace(/[^A-Za-z0-9]+/g, '')}_${(rec.id * 37) % 90 + 10}`;
    const x = this.x0;
    const w = this.cw;
    const pad = 6;
    const left = pad + 18;
    const tw = w - left - pad;
    const y = 4;
    const head = label(this, x + left, y + 5, '', { font: F.caps, tint: C.cream });
    head.setText(ch?.where ?? 'r/SideProject');
    const meta = label(this, x + left + head.width + 5, y + 5, `Posted by ${author}  2h`, { font: F.body, tint: C.ink4 });
    const title = label(this, x + left, y + 17, rec.thread.title, { font: F.head, tint: C.white, maxWidth: tw });
    const titleH = title.height;
    const body = label(this, x + left, y + 20 + titleH, rec.thread.body, { font: F.read, tint: C.ink5, maxWidth: tw });
    const bodyH = body.height;
    const footY = y + 24 + titleH + bodyH;
    const h = footY + 14 - y;
    const card = panel(this, x, y, w, h, 'plum', false);
    // vote column
    const up = iconImg(this, 'arrowUp', x + 6, y + 8);
    const votes = label(this, x + 10, y + 19, '0', { font: F.body, tint: C.orange2, origin: [0.5, 0] });
    const down = iconImg(this, 'arrowDownOff', x + 6, y + 30);
    const badge = this.add.image(x + left - 2, y + 3, bakeIcon(this, 'subBadge')).setOrigin(1, 0);
    const foot = this.add.container(x + left, footY);
    foot.add(iconImg(this, 'bubble', 0, 0));
    const nComments = this.items().reduce((n, g) => n + g.length, 0);
    foot.add(label(this, 11, 1, `${nComments * 3 + 4} comments`, { font: F.body, tint: C.ink4 }));
    foot.add(label(this, 78, 1, 'Share', { font: F.body, tint: C.ink4 }));
    foot.add(label(this, 108, 1, 'Save', { font: F.body, tint: C.ink4 }));
    this.feed.add([card, badge, head, meta, title, body, up, votes, down, foot]);
    this.feed.sendToBack(card);
    this.cursor = y + h + 5;
    this.follow(this.cursor);
    if (this.instant) {
      votes.setText(shortNumber(rec.thread.opVotes));
      this.bumpKarma(rec.thread.opVotes);
      return;
    }
    audio.sfx('thread_open');
    card.setAlpha(0);
    [badge, head, meta, title, body, up, votes, down, foot].forEach((o) => o.setAlpha(0));
    this.tweens.add({ targets: [card, badge, head, meta, title, body, up, votes, down, foot], alpha: 1, duration: 260 });
    await this.wait(500);
    this.tickNumber(votes, rec.thread.opVotes, 1100, true);
    this.bumpKarma(rec.thread.opVotes);
    this.buildGhosts();
    await this.wait(700);
  }

  /* -------------------------------------------------------------- stage */

  /**
   * Portrait only. The speaker, big, under the feed: a tall phone screen would otherwise be a thin
   * column of text over a dark void. It also puts a face and a name to every voice.
   */
  private buildStage(L: ReturnType<typeof layoutOf>): void {
    const root = this.add.container(0, L.H - this.stageH).setDepth(DEPTH.hud);
    root.add(rect(this, 0, 0, L.W, this.stageH, C.ink1, 1));
    root.add(rect(this, 0, 0, L.W, 1, C.orange2, 1));
    root.add(rect(this, 6, 5, 58, 58, C.ink0, 1));
    this.stageBg = rect(this, 7, 6, 56, 56, C.sky, 1);
    this.stageFace = this.add.image(35, 62, bakePortrait(this, 'narrator')).setOrigin(0.5, 1).setScale(3);
    root.add([this.stageBg, this.stageFace]);
    // until the first reply is spoken the stage says what is going on
    this.stageBg.setTint(C.ink2);
    this.stageName = label(this, 72, 8, 'LOADING REPLIES', { font: F.caps, tint: C.orange2, maxWidth: L.W - 80 });
    this.stageUser = label(this, 72, 20, 'the internet has opinions', { font: F.body, tint: C.blue2, maxWidth: L.W - 80 });
    this.stageFlair = label(this, 72, 30, '', { font: F.body, tint: C.violet2, maxWidth: L.W - 80 });
    root.add([this.stageName, this.stageUser, this.stageFlair]);
    const barsX = 72;
    const barsEnd = L.W - 58;
    const n = Math.max(6, Math.floor((barsEnd - barsX) / 4));
    this.stageBars = Array.from({ length: n }, (_, i) => rect(this, barsX + i * 4, 60, 3, 1, C.orange2, 1).setOrigin(0, 1));
    root.add(this.stageBars);
    this.stage = root;
    this.time.addEvent({ delay: 70, loop: true, callback: () => this.tickStage() });
  }

  /** Put this commenter on the stage. */
  private showSpeaker(c: ThreadComment, instant: boolean): void {
    const stage = this.stage;
    if (!stage) return;
    const voice = c.line.voice;
    this.stageFace.setTexture(bakePortrait(this, voice));
    this.stageBg.setTint(AVATAR_BG[Math.abs(hash(c.user)) % AVATAR_BG.length]!);
    this.stageName.setText((VOICE_NAMES[voice] ?? voice).toUpperCase());
    this.stageUser.setText(c.user);
    this.stageFlair.setText(c.flair ?? '');
    stage.setVisible(true);
    if (instant || app.settings.reducedMotion) return;
    this.stageFace.y = 66;
    this.tweens.add({ targets: this.stageFace, y: 62, duration: 160, ease: 'Back.easeOut' });
    this.stageName.setAlpha(0);
    this.tweens.add({ targets: this.stageName, alpha: 1, duration: 140 });
  }

  /** The stage's meter follows the voice, and the face hops on the loud syllables. */
  private tickStage(): void {
    if (!this.stage?.visible || app.settings.reducedMotion) return;
    const lv = this.cur?.level ?? 0;
    const t = this.time.now;
    this.stageBars.forEach((b, i) => {
      const shape = 0.35 + 0.65 * Math.abs(Math.sin(t / 110 + i * 0.9) * Math.cos(t / 170 + i * 0.4));
      b.setDisplaySize(3, 1 + Math.round(18 * lv * shape));
    });
    if (lv > 0.55) this.stageFace.y = 61;
    else if (this.stageFace.y === 61) this.stageFace.y = 62;
  }

  /** Faded placeholder replies under the last comment, the way a page looks while its replies load. */
  private buildGhosts(): void {
    const g = this.add.container(0, 0);
    this.feed.add(g);
    const w = this.cw;
    for (let i = 0; i < 4; i++) {
      const y = i * 46;
      g.add(panel(this, this.x0, y, w, 40, 'plum', false));
      g.add(rect(this, this.x0 + 5, y + 5, 20, 21, C.ink2, 0.8));
      g.add(rect(this, this.x0 + 30, y + 6, 36 + ((i * 17) % 34), 4, C.ink3, 0.7));
      g.add(rect(this, this.x0 + 30, y + 15, w - 42 - ((i * 23) % 44), 5, C.ink2, 0.9));
      g.add(rect(this, this.x0 + 30, y + 24, w - 74 - ((i * 31) % 52), 5, C.ink2, 0.9));
    }
    this.ghosts = g;
    this.moveGhosts(this.cursor);
    if (!app.settings.reducedMotion) {
      g.setAlpha(0.5);
      this.tweens.add({ targets: g, alpha: 0.95, duration: 760, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private moveGhosts(y: number): void {
    if (this.ghosts) this.ghosts.y = y;
  }

  private dropGhosts(): void {
    const g = this.ghosts;
    this.ghosts = null;
    if (!g) return;
    this.tweens.killTweensOf(g);
    this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
  }

  /**
   * While a line is spoken the portrait bobs with the voice, a three bar meter rides its corner and an
   * orange rule marks who is talking. Returns the function that ends it.
   */
  private speakingFx(sp: Speech, block: Phaser.GameObjects.Container, face: Phaser.GameObjects.Image, ax: number, by: number, av: number, blockH: number): () => void {
    const rule = rect(this, this.x0 + 2, by - 1, 2, blockH, C.orange2, 1);
    const parts: Phaser.GameObjects.Image[] = [rule];
    block.add(rule);
    let tick: Phaser.Time.TimerEvent | null = null;
    const baseY = face.y;
    if (!app.settings.reducedMotion) {
      const backing = rect(this, ax + av - 11, by + av - 8, 10, 8, C.ink0, 0.9);
      const bars = [0, 1, 2].map((i) => rect(this, ax + av - 9 + i * 3, by + av - 1, 2, 1, C.orange2, 1).setOrigin(0, 1));
      parts.push(backing, ...bars);
      block.add([backing, ...bars]);
      tick = this.time.addEvent({
        delay: 70,
        loop: true,
        callback: () => {
          const lv = sp.level;
          bars.forEach((b, i) => b.setDisplaySize(2, 1 + Math.round(6 * Math.min(1, lv * (0.55 + 0.45 * Math.abs(Math.sin(this.time.now / 90 + i * 2.1)))))));
          face.y = baseY - (lv > 0.55 ? 1 : 0);
        },
      });
    }
    return () => {
      tick?.remove();
      face.y = baseY;
      block.remove(parts, true);
    };
  }

  /** The pill moves with the upvotes that have landed, scaled so it ends on the karma the run earned. */
  private bumpKarma(votes: number): void {
    this.votesIn += Math.max(0, votes);
    const to = Math.round(this.rec.karma * Math.min(1, this.votesIn / this.votesAll));
    const from = this.karmaShown;
    this.karmaShown = to;
    if (to === from) return;
    const show = (v: number) => this.karmaT.setText(`+${shortNumber(v)}`);
    if (this.instant || this.fast || app.settings.reducedMotion) {
      show(to);
      return;
    }
    this.tweens.addCounter({ from, to, duration: 650, ease: 'Cubic.easeOut', onUpdate: (tw) => show(Math.round(tw.getValue()!)), onComplete: () => show(to) });
    this.karmaT.setTint(C.white);
    this.time.delayedCall(140, () => this.karmaT.setTint(C.orange2));
    this.karmaIcon.setScale(1.5);
    this.tweens.add({ targets: this.karmaIcon, scale: 1, duration: 240, ease: 'Back.easeOut' });
  }

  private tickNumber(t: Phaser.GameObjects.BitmapText, to: number, ms: number, sound = false): void {
    if (this.instant || app.settings.reducedMotion || this.fast) {
      t.setText(shortNumber(to));
      return;
    }
    const c = { v: 0 };
    let last = 0;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ms,
      ease: 'Cubic.easeOut',
      onUpdate: (tw) => {
        const v = Math.round(to * tw.getValue()!);
        c.v = v;
        t.setText(shortNumber(v));
        if (sound && v - last > Math.max(1, to / 14)) {
          last = v;
          audio.sfx('karma_tick');
        }
      },
      onComplete: () => t.setText(shortNumber(to)),
    });
  }

  /* --------------------------------------------------------- comments */

  private async addComment(item: Item, existing: Card | null): Promise<Card> {
    const { c } = item;
    const portrait = this.portrait;
    const cardX = this.x0;
    const cardW = this.cw;
    const pad = 5;
    const AV = 20;
    const indent = c.depth * (portrait ? 7 : 12);
    const ax = cardX + pad + indent;
    const tx = ax + AV + 4;
    const textW = cardX + cardW - pad - tx;
    const probe = label(this, 0, 0, c.line.text, { font: F.read, maxWidth: textW });
    const bodyH = probe.height;
    probe.destroy();
    const blockH = Math.max(AV + 2, 11 + bodyH + 12);

    let card = existing;
    if (!card) {
      const box = panel(this, cardX, this.cursor, cardW, pad + blockH + pad, 'plum', false);
      this.feed.add(box);
      this.feed.sendToBack(box);
      card = { box, x: cardX, y: this.cursor, w: cardW, inner: 0 };
    }
    const by = card.y + pad + card.inner;
    card.inner += blockH + 3;
    card.box.setBoxSize(cardW, pad + card.inner + pad - 3);
    const bottom = card.y + card.box.boxH;
    this.moveGhosts(bottom + 5);

    const block = this.add.container(0, 0);
    this.feed.add(block);
    const voice = c.line.voice;
    const bg = AVATAR_BG[Math.abs(hash(c.user)) % AVATAR_BG.length]!;
    if (c.depth > 0) block.add(rect(this, ax - 3, by, 1, blockH - 1, C.ink3, 1));
    block.add(rect(this, ax, by, AV, AV + 1, C.ink0, 1));
    block.add(rect(this, ax + 1, by + 1, AV - 2, AV - 1, bg, 1));
    const face = this.add.image(ax + AV / 2, by + AV - 0, bakePortrait(this, voice)).setOrigin(0.5, 1);
    block.add(face);
    const isMod = /mod/i.test(c.flair ?? '') || voice === 'automod';
    const user = label(this, tx, by, c.user, { font: F.body, tint: isMod ? C.green2 : C.blue2 });
    block.add(user);
    let hx = tx + user.width + 4;
    if (c.flair) {
      const f = label(this, hx + 3, by + 1, c.flair, { font: F.body, tint: C.white });
      const fw = f.width + 6;
      const fb = panel(this, hx, by - 1, fw, 10, isMod ? 'btnTeal' : 'violet', false);
      block.add([fb, f]);
      hx += fw + 4;
    }
    block.add(label(this, hx, by, `${ago(item.vi * 3 + item.ci)}`, { font: F.body, tint: C.ink3 }));
    const body = label(this, tx, by + 10, '', { font: F.read, tint: C.ink5, maxWidth: textW });
    block.add(body);
    // footer: votes and awards
    const fy = by + 11 + bodyH;
    const upI = iconImg(this, 'arrowUpOff', tx, fy);
    const votes = label(this, tx + 11, fy + 1, '0', { font: F.caps, tint: C.ink4 });
    const downI = iconImg(this, 'arrowDownOff', tx + 38, fy);
    block.add([upI, votes, downI]);
    const awardsBox = this.add.container(tx + 52, fy);
    block.add(awardsBox);
    const quick = this.instant || this.fast;
    if (!quick) block.setAlpha(0);
    this.follow(bottom);

    if (quick) {
      this.showSpeaker(c, true);
      body.setText(this.wrapped(body, c.line.text));
      this.finishVotes(item, votes, upI, downI, awardsBox, true);
      if (item.rating !== undefined) this.landRating(item, tx + 0, by, block, true);
      return card;
    }

    audio.sfx('comment_in');
    this.showSpeaker(c, false);
    this.tweens.add({ targets: block, alpha: 1, duration: 160 });
    if (!app.settings.reducedMotion && !this.fast) {
      block.x = 6;
      this.tweens.add({ targets: block, x: 0, duration: 180, ease: 'Cubic.easeOut' });
    }
    // the voice, with the text typed to match
    const sp = new Speech(this, body);
    this.cur = sp;
    void sp.say(c.line.text, c.line);
    this.startVotes(item, votes, upI, downI);
    const stopFx = this.speakingFx(sp, block, face, ax, by, AV, blockH);
    await sp.done;
    stopFx();
    if (!this.alive) return card;
    if (this.cur === sp) this.cur = null;
    await this.wait(120);
    this.finishVotes(item, votes, upI, downI, awardsBox, false);
    if (item.rating !== undefined) {
      await this.wait(200);
      this.landRating(item, tx, by, block, false);
      await this.wait(this.fast ? 0 : 520);
    }
    if (item.awards.length) await this.wait(this.fast ? 0 : 280);
    return card;
  }

  /** Let the bitmap font wrap, so instant mode shows the same line breaks as typing does. */
  private wrapped(t: Phaser.GameObjects.BitmapText, text: string): string {
    t.setText(text);
    const w = (t.getTextBounds() as unknown as { wrappedText?: string }).wrappedText;
    return w ?? text;
  }

  private startVotes(item: Item, votes: Phaser.GameObjects.BitmapText, upI: Phaser.GameObjects.Image, downI: Phaser.GameObjects.Image): void {
    void downI;
    // votes roll in while the line is spoken
    const to = item.votes;
    const dur = Math.max(900, Math.min(3200, item.c.line.text.length * 55));
    const neg = to < 0;
    upI.setTexture(bakeIcon(this, neg ? 'arrowUpOff' : 'arrowUp'));
    votes.setTint(neg ? C.violet2 : C.orange2);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: dur,
      ease: 'Cubic.easeOut',
      onUpdate: (tw) => votes.setText(shortNumber(Math.round(to * tw.getValue()!))),
      onComplete: () => votes.setText(shortNumber(to)),
    });
  }

  private finishVotes(item: Item, votes: Phaser.GameObjects.BitmapText, upI: Phaser.GameObjects.Image, downI: Phaser.GameObjects.Image, awardsBox: Phaser.GameObjects.Container, instant: boolean): void {
    const neg = item.votes < 0;
    this.bumpKarma(item.votes);
    votes.setText(shortNumber(item.votes));
    votes.setTint(neg ? C.violet2 : item.votes > 0 ? C.orange2 : C.ink4);
    upI.setTexture(bakeIcon(this, neg ? 'arrowUpOff' : 'arrowUp'));
    downI.setTexture(bakeIcon(this, neg ? 'arrowDown' : 'arrowDownOff'));
    item.awards.forEach((a, i) => {
      const icon = this.add.image(i * 10, 0, bakeIcon(this, AWARD_ICON[a])).setOrigin(0, 0);
      awardsBox.add(icon);
      if (!instant) {
        icon.setScale(0);
        this.tweens.add({ targets: icon, scale: 1, duration: 220, delay: i * 140, ease: 'Back.easeOut' });
        this.time.delayedCall(i * 140, () => audio.sfx('award'));
      }
    });
    if (item.awards.length && item.awards.length <= 2) {
      awardsBox.add(label(this, item.awards.length * 10 + 2, 1, item.awards.map((a) => AWARD_NAME[a]).join(' + '), { font: F.body, tint: C.yellow }));
    }
    if (!instant && neg) audio.sfx('downvote');
    else if (!instant && item.votes > 400) audio.sfx('upvote');
  }

  private landRating(item: Item, x: number, y: number, block: Phaser.GameObjects.Container, instant: boolean): void {
    const rating = item.rating ?? 0;
    const col = rating >= 7 ? C.green2 : rating >= 4 ? C.yellow : C.pink;
    const text = `${JUDGE_NAME[item.judges ?? 'overall']} ${rating}/10`;
    const chip = this.add.container(0, 0);
    const t = label(this, 0, 0, text, { font: F.caps, tint: C.ink0 });
    const w = Math.ceil(t.width) + 8;
    const bgBox = rect(this, 0, 0, w, 11, col, 1);
    const edge = rect(this, -1, -1, w + 2, 13, C.ink0, 1);
    chip.add([edge, bgBox, t]);
    t.setPosition(4, 2);
    const rightEdge = this.x0 + this.cw - 6;
    chip.setPosition(rightEdge - w, y - 1);
    void x;
    block.add(chip);
    this.ratingsSum += rating;
    const slot = this.slots[item.vi];
    const paint = () => {
      if (!slot) return;
      slot.box.setTint(col);
      slot.text.setText(`${rating}`);
      slot.text.setTint(C.ink0);
    };
    if (instant) {
      paint();
      return;
    }
    chip.setScale(1.8);
    chip.setAlpha(0);
    this.tweens.add({ targets: chip, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
    audio.sfx(rating >= 7 ? 'praise' : rating <= 4 ? 'roast' : 'select');
    this.time.delayedCall(app.settings.reducedMotion ? 0 : 300, () => {
      paint();
      if (slot) this.tweens.add({ targets: slot.box, scaleY: { from: 1.5, to: 1 }, duration: 160 });
    });
  }

  /* ------------------------------------------------------------ results */

  private showResults(): void {
    this.resultsOpen = true;
    this.skipBtn.setVisible(false);
    this.karmaT.setText(`+${shortNumber(this.rec.karma)}`);
    this.stage?.setVisible(false);
    this.dropGhosts();
    const L = layoutOf(this);
    const rec = this.rec;
    const s = current().s;
    const root = this.add.container(0, 0).setDepth(DEPTH.modal);
    const dim = rect(this, 0, 0, L.W, L.H, C.ink0, 0.6).setInteractive();
    root.add(dim);
    const wide = !L.portrait && L.W >= 380;
    const w = Math.min(L.W - 6, wide ? 396 : 244);
    const h = Math.min(L.H - 6, wide ? 220 : 330);
    const x = Math.floor((L.W - w) / 2);
    const y = Math.floor((L.H - h) / 2);
    const card = this.add.container(x, y);
    root.add(card);
    card.add(panel(this, 0, 0, w, h, 'paper'));
    card.add(panel(this, 0, 0, w, 15, 'btnOrange', false));
    card.add(label(this, 6, 3, rec.name.toUpperCase(), { font: F.caps, tint: C.white, maxWidth: w - 90 }));
    const ch = app.content.channels.find((c) => c.id === rec.channel);
    card.add(label(this, w - 6, 4, ch?.where ?? '', { font: F.body, tint: C.cream, origin: [1, 0] }));

    // the big number
    const score = rec.score;
    const col = score >= 28 ? C.green1 : score >= 18 ? C.orange1 : C.berry1;
    const verdict = score >= 34 ? 'FRONT PAGE' : score >= 28 ? 'HOT' : score >= 22 ? 'DECENT' : score >= 16 ? 'MID' : score >= 10 ? 'RATIOED' : 'REMOVED BY MODS';
    const lx = 8;
    card.add(label(this, lx, 20, 'REDDIT SCORE', { font: F.caps, tint: C.ink3 }));
    const big = label(this, lx, 29, '0', { font: F.title, tint: col });
    big.setScale(wide ? 3 : 2.5);
    card.add(big);
    card.add(label(this, lx + (wide ? 66 : 60), wide ? 56 : 52, '/40', { font: F.head, tint: C.ink3 }));
    const verdictT = label(this, lx, wide ? 78 : 72, '', { font: F.head, tint: col });
    card.add(verdictT);
    // the ratings
    const rec2 = this.rec.thread.vignettes;
    const seen = new Map<string, number>();
    rec2.forEach((v, i) => {
      const nth = seen.get(v.judges) ?? 0;
      seen.set(v.judges, nth + 1);
      const bx = lx + i * 24;
      const by = wide ? 98 : 90;
      const rc = v.rating >= 7 ? C.green2 : v.rating >= 4 ? C.yellow : C.pink;
      card.add(rect(this, bx, by, 22, 18, C.ink0, 1));
      card.add(rect(this, bx + 1, by + 1, 20, 16, rc, 1));
      card.add(label(this, bx + 11, by + 2, `${v.rating}`, { font: F.head, tint: C.ink0, origin: [0.5, 0] }));
      card.add(label(this, bx + 11, by + 19, judgeShort(v.judges as StatKey | 'overall' | 'hype', nth), { font: F.body, tint: C.ink3, origin: [0.5, 0] }));
    });

    // right side: karma, money, the app store
    const rx = wide ? 150 : 8;
    const ry = wide ? 20 : 130;
    const rw = w - rx - 8;
    const rows: { icon: string; name: string; value: string; tint: number }[] = [
      { icon: 'karma', name: 'KARMA', value: `+${shortNumber(rec.karma)}`, tint: C.orange1 },
      { icon: 'cash', name: 'EXPECTED REVENUE', value: shortMoney(rec.lifetime), tint: C.green1 },
      { icon: 'trophy', name: 'AWARDS GIVEN', value: `${rec.thread.awards.length}`, tint: C.violet1 },
    ];
    rows.forEach((r, i) => {
      const yy = ry + i * 17;
      card.add(panel(this, rx, yy, rw, 15, 'paperDim', false));
      card.add(iconImg(this, r.icon, rx + 3, yy + 3));
      card.add(label(this, rx + 14, yy + 4, r.name, { font: F.body, tint: C.ink2 }));
      card.add(label(this, rx + rw - 4, yy + 3, r.value, { font: F.caps, tint: r.tint, origin: [1, 0] }));
    });
    // review
    const ry2 = ry + rows.length * 17 + 2;
    card.add(panel(this, rx, ry2, rw, wide ? 56 : 62, 'chipLight', false));
    card.add(label(this, rx + 4, ry2 + 3, 'APP STORE REVIEW', { font: F.body, tint: C.ink3 }));
    const stars = rec.review?.stars ?? Math.max(1, Math.round(score / 8));
    for (let i = 0; i < 5; i++) {
      const st = iconImg(this, 'star', rx + rw - 5 - (5 - i) * 9, ry2 + 3);
      if (i >= stars) st.setTint(C.ink4);
      card.add(st);
    }
    card.add(label(this, rx + 4, ry2 + 14, rec.review ? `"${rec.review.text}"` : 'No reviews yet.', { font: F.read, tint: C.ink1, maxWidth: rw - 8 }));
    if (rec.review) card.add(label(this, rx + rw - 4, ry2 + (wide ? 46 : 52), `- ${rec.review.user}`, { font: F.body, tint: C.ink3, origin: [1, 0] }));

    // the best comment of the day
    const best = this.items().flat().sort((a, b) => b.votes - a.votes)[0];
    if (best) {
      const qy = wide ? 133 : ry2 + 66;
      const qh = h - 28 - qy;
      card.add(panel(this, 8, qy, w - 16, qh, 'plum', false));
      card.add(label(this, 14, qy + 4, 'TOP COMMENT', { font: F.body, tint: C.ink4 }));
      card.add(label(this, w - 14, qy + 4, `${best.c.user}   +${shortNumber(best.votes)}`, { font: F.body, tint: C.orange2, origin: [1, 0] }));
      const quote = best.c.line.text.length > 150 ? `${best.c.line.text.slice(0, 147)}...` : best.c.line.text;
      card.add(label(this, 14, qy + 14, `"${quote}"`, { font: F.read, tint: C.ink5, maxWidth: w - 28 }));
    }
    const cont = button(this, Math.floor(w / 2) - 60, h - 24, 120, 18, this.replay ? 'BACK' : 'KEEP SHIPPING', () => this.leave(), { kind: 'orange', icon: 'ship' });
    cont.setAlpha(0);
    card.add(cont);

    // animate in
    card.setAlpha(0);
    card.y = y + 10;
    this.tweens.add({ targets: card, alpha: 1, y, duration: 220, ease: 'Cubic.easeOut' });
    audio.music('launch', { fadeMs: 300 });
    this.tickScore(big, verdictT, score, verdict, cont, { x: x + w / 2, y: y + 24 });
    void s;
  }

  private tickScore(big: Phaser.GameObjects.BitmapText, verdictT: Phaser.GameObjects.BitmapText, score: number, verdict: string, cont: Phaser.GameObjects.Container, burstAt: { x: number; y: number }): void {
    const done = () => {
      big.setText(`${score}`);
      verdictT.setText(verdict);
      this.tweens.add({ targets: cont, alpha: 1, duration: 180 });
      audio.sfx(score >= 28 ? 'fanfare_big' : score >= 18 ? 'fanfare_small' : score >= 10 ? 'deny' : 'game_over');
      if (score >= 28) this.cameras.main.shake(160, 0.004);
      if (score >= 28) buzz(BUZZ.win);
      if (score >= 28) confettiBurst(this, burstAt.x - 40, burstAt.y, { count: score >= 34 ? 44 : 28 });
      if (score >= 28) confettiBurst(this, burstAt.x + 40, burstAt.y, { count: score >= 34 ? 44 : 28 });
    };
    if (app.settings.reducedMotion || this.instant) {
      done();
      return;
    }
    let last = -1;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1100,
      delay: 300,
      ease: 'Cubic.easeOut',
      onUpdate: (tw) => {
        const v = Math.round(score * tw.getValue()!);
        big.setText(`${v}`);
        if (v !== last) {
          last = v;
          if (v % 2 === 0) audio.sfx('karma_tick');
        }
      },
      onComplete: done,
    });
  }

  private leave(): void {
    audio.sfx('confirm');
    audio.stopVoice();
    fadeTo(this, 'Office');
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

