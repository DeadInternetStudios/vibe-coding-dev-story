import Phaser from 'phaser';
import { app } from '../core/app';
import { audio } from '../core/audio';
import { writeSave } from '../core/save';
import { C, DEPTH, F } from '../core/theme';
import { Room } from '../game/room';
import type { Session } from '../game/session';
import { monthName } from '../sim/format';
import type { Notice, Tone } from '../sim/types';
import type { SfxId } from '../audio';
import { Hud, type MenuId } from '../ui/hud';
import { label, panel, pop, rect } from '../ui/kit';
import { layoutOf, responsive } from '../ui/layout';
import type { Modal } from '../ui/modal';
import { Toasts } from '../ui/toasts';
import type { UiCtx } from '../ui/ctx';
import { openMenu } from '../ui/menus';
import { openPrompt } from '../ui/prompts';
import { showIntro } from '../ui/story';
import { fadeTo } from '../ui/layout';
import { shortMoney } from '../sim/format';

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
  private bannerObj: Phaser.GameObjects.Container | null = null;
  private introDone = false;
  private launching = false;

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
    this.cameras.main.setBackgroundColor(C.ink0);
    this.cameras.main.fadeIn(260, 18, 15, 36);
    this.introDone = !data?.intro;
    this.launching = false;
    this.menuModal = null;
    this.promptOpen = false;
    this.ctx = this.makeCtx();
    responsive(this, () => this.build(), () => this.teardown());
    audio.music(session.s.company.crunch ? 'crunch' : 'office');
    window.__vcds = { ...(window.__vcds ?? {}), scene: this, session };
    this.events.once('shutdown', () => {
      this.hud?.destroy();
      session.save();
    });
    if (data?.intro) this.time.delayedCall(450, () => showIntro(this.ctx, () => (this.introDone = true)));
  }

  private teardown(): void {
    this.hud?.destroy();
    this.room?.destroy();
    this.menuModal = null;
    this.promptOpen = false;
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
      hold: () => this.session.hold(),
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
      shake: (power = 0.004) => {
        if (app.settings.shake && !app.settings.reducedMotion) this.cameras.main.shake(180, power);
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
    this.room = new Room(this, this.session);
    this.room.root.setDepth(DEPTH.room);
    this.room.onStaff = (id) => this.openStaff(id);
    this.room.onItem = (id) => this.itemQuip(id);
    this.room.onBulb = () => this.tapIdea();
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
    const y = top + Math.max(0, Math.floor((bottom - top - rh) / 2));
    this.room.root.setPosition(x, y);
    // a plum floor plate under the room so the edge reads
    if (rw <= L.W) rect(this, x - 3, y - 3, rw + 6, rh + 6, C.ink1, 1).setDepth(DEPTH.room - 1);
  }

  private setupPan(): void {
    const L = layoutOf(this);
    const rw = this.room.w;
    if (rw <= L.W) return;
    const minX = L.W - rw;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > this.view.y && p.y < this.view.y + this.view.h && !this.menuModal && !this.promptOpen) {
        this.dragging = true;
        this.dragX = p.x - this.room.root.x;
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragging) this.room.root.x = Math.round(Phaser.Math.Clamp(p.x - this.dragX, minX, 0));
    });
    this.input.on('pointerup', () => (this.dragging = false));
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
    import('../sim/shop').then(({ shopItem }) => {
      const it = shopItem(id);
      this.toasts.push(it.quip, 'info', 'star');
      audio.sfx('bubble');
    });
  }

  private openStaff(id: string): void {
    this.openMenuById('team', id);
  }

  private openMenuById(id: MenuId | string, arg?: string): void {
    if (this.promptOpen) return;
    if (this.menuModal?.open) this.menuModal.close();
    const m = openMenu(this.ctx, id, arg, () => {
      this.menuModal = null;
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
        audio.sfx(n.amount > 0 ? (n.amount > 5000 ? 'coins' : 'coin') : 'bill');
        break;
      case 'idea':
        this.room.showIdea(n.staffId);
        audio.sfx('hot_idea');
        break;
      case 'ideaGone':
        this.room.showIdea(null);
        break;
      case 'phase': {
        const names = ['PLAN', 'PROMPT', 'FIX', 'SHIP'];
        this.banner(`PHASE ${n.phase + 1}: ${names[n.phase] ?? ''}`, n.project, 'info');
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
        audio.sfx('fire');
        this.ctx.shake(0.003);
        break;
      case 'achievement': {
        const a = app.content.achievements.find((x) => x.id === n.id);
        if (a) {
          this.banner('ACHIEVEMENT!', a.name, 'wow');
          audio.sfx('achievement');
        }
        break;
      }
      case 'newMonth':
        this.toasts.push(`${monthName(n.month)} begins. Rent is a state of mind.`, 'info', 'calendar');
        break;
      case 'newYear':
        this.banner(`YEAR ${n.year}`, 'The market got smarter. So did your landlord.', 'wow');
        audio.sfx('fanfare_small');
        break;
      case 'rateLimited':
        if (n.on) {
          this.toasts.push('Rate limited. The AI needs a nap.', 'bad', 'token');
          audio.sfx('rate_limit');
        }
        break;
      case 'sound':
        audio.sfx(n.id as SfxId);
        break;
      case 'launched':
      case 'prompt':
        break;
    }
  }

  /* ------------------------------------------------------------- frame */

  update(_time: number, dt: number): void {
    if (!this.session) return;
    const days = this.session.update(dt);
    for (const n of this.session.takeNotices()) this.handle(n);
    if (days > 0) {
      this.room.sync();
    }
    this.room.update(dt);
    this.hud.update(dt);
    this.toasts.update(dt);

    // anything the game waits on gets a popup
    if (!this.promptOpen && !this.launching && this.introDone && this.session.game.pending) {
      const p = this.session.game.pending;
      this.promptOpen = true;
      if (this.menuModal?.open) this.menuModal.close();
      openPrompt(this.ctx, p, (next) => {
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

declare global {
  interface Window {
    __vcds?: Record<string, unknown>;
  }
}

export { writeSave };
