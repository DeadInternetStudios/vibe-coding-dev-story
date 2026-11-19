import Phaser from 'phaser';
import { app } from '../core/app';
import { bake, bakeDecor, bakeIcon } from '../core/bake';
import { C, F } from '../core/theme';
import { desk as deskPx, laptop } from '../art/sprites/office';
import { roomBackdrop } from '../art/sprites/rooms';
import { Px } from '../art/pixel';
import { SHOP, shopItem } from '../sim/shop';
import { Rng } from '../sim/rng';
import type { Session } from './session';
import { roomSpec, type RoomSpec, type Spot } from './roomSpecs';
import { StaffSprite } from './staffSprite';
import { label } from '../ui/kit';

const STICKERS = ['orange1', 'teal2', 'violet1', 'blue1', 'green1', 'berry1', 'orange1'] as const;
/** a rough box for items that have no drawing yet */
function crate(w: number, h: number): Px {
  const p = new Px(w, h);
  p.rect(0, 0, w, h, 'violet1').frame(0, 0, w, h, 'ink0').hline(1, 1, w - 2, 'violet2');
  return p;
}

/**
 * The office as a player sees it: backdrop, desks, bought items and the people.
 * It reads the session and keeps its sprites in step, it never changes the game.
 */
export class Room {
  readonly scene: Phaser.Scene;
  readonly root: Phaser.GameObjects.Container;
  private session: Session;
  private spec: RoomSpec;
  private tier = -1;
  private sprites = new Map<string, StaffSprite>();
  private itemsKey = '';
  private furniture: Phaser.GameObjects.GameObject[] = [];
  private desksObjs: Phaser.GameObjects.Image[] = [];
  private emptyDeskTags: Phaser.GameObjects.Container[] = [];
  private chatter = 4;
  private rng = new Rng(Math.floor(Math.random() * 1e9));
  onStaff: (id: string) => void = () => {};
  onItem: (id: string) => void = () => {};
  onBulb: () => void = () => {};
  private sortClock = 0;
  private lastStaffKey = '';

  constructor(scene: Phaser.Scene, session: Session) {
    this.scene = scene;
    this.session = session;
    this.root = scene.add.container(0, 0);
    this.spec = roomSpec(session.s.company.officeTier);
    this.rebuild();
  }

  get w(): number {
    return this.spec.w;
  }
  get h(): number {
    return this.spec.h;
  }

  /** Throw everything away and make the room again, used on tier change and layout change. */
  rebuild(): void {
    for (const sp of this.sprites.values()) sp.destroy();
    this.sprites.clear();
    for (const f of this.furniture) f.destroy();
    this.furniture = [];
    for (const t of this.emptyDeskTags) t.destroy();
    this.emptyDeskTags = [];
    this.desksObjs = [];
    this.root.removeAll(true);
    this.tier = this.session.s.company.officeTier;
    this.spec = roomSpec(this.tier);
    const spec = this.spec;
    const bg = this.scene.add.image(0, 0, bake(this.scene, `room:${this.tier}`, () => roomBackdrop(spec.look))).setOrigin(0, 0);
    bg.setDepth(-1000);
    this.root.add(bg);
    // desks and laptops
    const tools = this.session.game.c.tools;
    const toolIdx = Math.max(0, tools.findIndex((t) => t.id === this.session.s.company.activeTool));
    spec.desks.forEach((d, i) => {
      const dimg = this.scene.add.image(d.x, d.y + 22, bake(this.scene, 'desk', deskPx)).setOrigin(0, 1);
      dimg.setDepth(d.y + 22);
      this.root.add(dimg);
      this.desksObjs.push(dimg);
      const lap = this.scene.add.image(d.x + 9, d.y + 18, bake(this.scene, `laptop:${STICKERS[toolIdx % STICKERS.length]}`, () => laptop(STICKERS[toolIdx % STICKERS.length]!))).setOrigin(0, 1);
      lap.setDepth(d.y + 22.2);
      this.root.add(lap);
      void i;
    });
    this.itemsKey = '';
    this.lastStaffKey = '';
    this.syncItems();
    this.syncStaff(true);
  }

  /** Keep sprites in step with the game. Cheap, call it often. */
  sync(): void {
    if (this.session.s.company.officeTier !== this.tier) {
      this.rebuild();
      return;
    }
    this.syncItems();
    this.syncStaff(false);
  }

  /* ----------------------------------------------------------------- items */

  private syncItems(): void {
    const items = this.session.s.company.items;
    const key = items.join(',') + '|' + this.session.s.company.activeTool;
    if (key === this.itemsKey) return;
    this.itemsKey = key;
    for (const f of this.furniture) f.destroy();
    this.furniture = [];
    const spec = this.spec;
    let floorI = 0;
    let wallI = 0;
    const deskItems: string[] = [];
    for (const id of items) {
      const it = shopItem(id);
      if (it.spot === 'desk') {
        deskItems.push(id);
        continue;
      }
      if (it.spot === 'wall') {
        const spot = spec.wallSpots[wallI++];
        if (spot) this.placeItem(id, spot, 'wall');
      } else {
        const spot = spec.floorSpots[floorI++];
        if (spot) this.placeItem(id, spot, 'floor');
      }
    }
    // desk items go on every desk, side by side along the front edge
    deskItems.forEach((id, k) => {
      for (const d of spec.desks) this.placeItem(id, { x: d.x + 5 + k * 6, y: d.y + 9 }, 'desk');
    });
    this.furniture.forEach((f) => this.root.add(f));
    this.root.sort('depth');
  }

  private placeItem(id: string, spot: Spot, kind: 'wall' | 'floor' | 'desk'): void {
    let key = bakeDecor(this.scene, id);
    if (!key) key = bake(this.scene, `crate:${id}`, () => (kind === 'desk' ? crate(6, 6) : crate(kind === 'wall' ? 24 : 18, kind === 'wall' ? 14 : 22)));
    const img = this.scene.add.image(spot.x, spot.y, key).setOrigin(0.5, kind === 'wall' ? 0 : 1);
    img.setDepth(kind === 'wall' ? -500 : kind === 'desk' ? spot.y + 22.4 : spot.y);
    img.setInteractive({ useHandCursor: true });
    img.on('pointerup', () => this.onItem(id));
    this.furniture.push(img);
  }

  /** Where the item was placed, for effects. */
  itemSpot(id: string): { x: number; y: number } | null {
    const img = this.furniture.find((f) => (f as Phaser.GameObjects.Image).texture?.key === `decor:${id}` || (f as Phaser.GameObjects.Image).texture?.key === `crate:${id}`) as Phaser.GameObjects.Image | undefined;
    return img ? { x: img.x, y: img.y } : null;
  }

  /* ----------------------------------------------------------------- staff */

  private syncStaff(force: boolean): void {
    const s = this.session.s;
    const key = s.staff.map((m) => `${m.id}:${m.assign}:${m.awayUntil > s.day ? 1 : 0}`).join(',');
    if (!force && key === this.lastStaffKey) return;
    this.lastStaffKey = key;
    const seen = new Set<string>();
    const builders = s.staff.filter((m) => m.assign === 'build');
    const supporters = s.staff.filter((m) => m.assign === 'support');
    const seatOf = new Map<string, number>();
    // keep seats stable: staff order is hire order
    [...builders, ...supporters].forEach((m, i) => seatOf.set(m.id, i));
    for (const m of s.staff) {
      seen.add(m.id);
      let sp = this.sprites.get(m.id);
      const fresh = !sp;
      if (!sp) {
        sp = new StaffSprite(this.scene, m, this.root);
        sp.onTap = () => this.onStaff(m.id);
        this.sprites.set(m.id, sp);
      }
      sp.staff = m;
      const seatIdx = seatOf.get(m.id)!;
      const desk = this.spec.desks[seatIdx % this.spec.desks.length]!;
      sp.setSeat(desk.x + 16, desk.y);
      sp.roam = this.spec.roam;
      const away = m.awayUntil > s.day;
      if (away) {
        if (sp.mode !== 'away') sp.goAway(m.awayWhy ?? 'away');
      } else if (m.assign === 'support') {
        if (sp.mode !== 'roam') {
          if (fresh) sp.place(desk.x + 16, desk.y + 26);
          sp.startRoaming(this.spec.roam);
        }
      } else if (fresh && !force) {
        sp.arriveFrom(this.spec.door);
        sp.onArrived = () => sp!.emote('cheer', 'happy', 900);
      } else if (sp.mode === 'away') sp.comeBack();
      else if (sp.mode === 'roam') {
        sp.mode = 'arrive';
        sp.arriveFrom({ x: sp.x, y: sp.y });
      } else if (fresh) sp.sitDown();
    }
    // goodbyes
    for (const [id, sp] of this.sprites) {
      if (seen.has(id)) continue;
      this.sprites.delete(id);
      sp.leaveTo(this.spec.door);
      sp.onLeft = () => sp.destroy();
    }
    this.layoutEmptyDesks();
  }

  private layoutEmptyDesks(): void {
    for (const t of this.emptyDeskTags) t.destroy();
    this.emptyDeskTags = [];
    const s = this.session.s;
    const taken = new Set<number>();
    const builders = s.staff.filter((m) => m.assign === 'build');
    const supporters = s.staff.filter((m) => m.assign === 'support');
    [...builders, ...supporters].forEach((_, i) => taken.add(i));
    this.spec.desks.forEach((d, i) => {
      if (taken.has(i)) return;
      const c = this.scene.add.container(d.x + 16, d.y - 4);
      const t = this.scene.add.image(0, 0, bakeIcon(this.scene, 'plus')).setOrigin(0.5, 1).setAlpha(0.55);
      c.add(t);
      c.setDepth(d.y + 30);
      this.root.add(c);
      this.emptyDeskTags.push(c);
    });
  }

  spriteOf(id: string): StaffSprite | undefined {
    return this.sprites.get(id);
  }

  sprite(id: string): StaffSprite | undefined {
    return this.sprites.get(id);
  }

  /** Room coordinates to screen coordinates. */
  toScreen(x: number, y: number): { x: number; y: number } {
    return { x: this.root.x + x, y: this.root.y + y };
  }

  /** Everyone cheers, for a launch or a payday that went well. */
  cheerAll(): void {
    for (const sp of this.sprites.values()) if (sp.mode === 'desk') sp.emote('cheer', 'happy', 1800);
  }

  slumpAll(): void {
    for (const sp of this.sprites.values()) if (sp.mode === 'desk') sp.emote('slump', 'sad', 2200);
  }

  /** Per frame. */
  update(dt: number): void {
    const s = this.session.s;
    const proj = s.project;
    const working = !!proj && proj.status === 'dev';
    const running = this.session.ticking;
    const tired = this.session.rateLimited && working;
    let moving = false;
    for (const sp of this.sprites.values()) {
      sp.working = working && sp.staff.assign === 'build';
      sp.tired = tired && sp.staff.assign === 'build';
      sp.update(dt, running);
      if (sp.mode !== 'desk') {
        sp.setDepth(sp.y);
        moving = true;
      } else sp.setDepth(sp.seat.y + 21.5);
    }
    this.sortClock += dt;
    if (moving && this.sortClock > 90) {
      this.sortClock = 0;
      this.root.sort('depth');
    }
    // chatter
    if (running) {
      this.chatter -= (dt / 1000) * Math.min(3, this.session.speed);
      if (this.chatter <= 0) {
        this.chatter = 5 + this.rng.range(0, 7);
        this.randomQuip();
      }
    }
  }

  private randomQuip(): void {
    const list = [...this.sprites.values()].filter((sp) => sp.mode === 'desk' || sp.mode === 'roam');
    if (list.length === 0) return;
    if (list.filter((s) => s.talking).length >= 2) return;
    const sp = this.rng.pick(list);
    if (sp.talking) return;
    const arch = this.session.game.c.archetype(sp.staff.archetype);
    const tool = this.session.game.c.tool(this.session.s.company.activeTool);
    const working = this.session.s.project?.status === 'dev';
    const pool = working && this.rng.chance(0.45) && tool.chatter.length ? tool.chatter : arch.quotes;
    if (!pool.length) return;
    sp.say(this.rng.pick(pool), 3600);
  }

  /** Show a message over a staff member. */
  say(id: string, text: string): void {
    this.sprites.get(id)?.say(text);
  }

  /** The bulb of whoever has an idea. */
  showIdea(staffId: string | null): void {
    for (const [id, sp] of this.sprites) {
      sp.showBulb(id === staffId);
      const b = sp.bulbObj;
      if (b && id === staffId) {
        b.removeAllListeners('pointerup');
        b.on('pointerup', () => this.onBulb());
      }
    }
  }

  destroy(): void {
    for (const sp of this.sprites.values()) sp.destroy();
    this.sprites.clear();
    this.root.destroy();
  }
}

export { C, F, app, label, SHOP };
