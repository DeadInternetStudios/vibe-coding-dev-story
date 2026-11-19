import Phaser from 'phaser';
import { app } from '../core/app';
import { Session } from './session';

/**
 * A test driver for the browser, reached through `window.__drive`. It clicks the same things a
 * player clicks, so a monkey run through the real screens finds exceptions and dead ends that unit
 * tests cannot. Installed only with `?debug` in the address or in dev builds.
 */
interface Clickable {
  obj: Phaser.GameObjects.GameObject;
  label: string;
  depth: number;
  x: number;
  y: number;
  w: number;
  h: number;
  dim: boolean;
}

type AnyScene = Phaser.Scene & Record<string, unknown>;

function rootOf(obj: Phaser.GameObjects.GameObject): Phaser.GameObjects.GameObject {
  let o: Phaser.GameObjects.GameObject = obj;
  while (o.parentContainer) o = o.parentContainer;
  return o;
}

function shown(obj: Phaser.GameObjects.GameObject): boolean {
  let o: Phaser.GameObjects.GameObject | null = obj;
  while (o) {
    const v = o as unknown as { visible?: boolean; alpha?: number };
    if (v.visible === false || (v.alpha !== undefined && v.alpha < 0.15)) return false;
    o = o.parentContainer;
  }
  return true;
}

/** What a control says: the words directly inside its small container. A big container (a whole modal body) says nothing about any one zone in it. */
function texts(c: Phaser.GameObjects.Container): string {
  if (c.list.length > 8) return '';
  const out: string[] = [];
  for (const ch of c.list) if (ch.type === 'BitmapText') out.push((ch as Phaser.GameObjects.BitmapText).text);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

function collect(scene: Phaser.Scene): Clickable[] {
  const out: Clickable[] = [];
  const visit = (o: Phaser.GameObjects.GameObject, parent: Phaser.GameObjects.Container | null) => {
    if (!o.active) return;
    if (o.type === 'Container') for (const ch of (o as Phaser.GameObjects.Container).list) visit(ch, o as Phaser.GameObjects.Container);
    if (!o.input?.enabled || !shown(o)) return;
    const root = rootOf(o);
    const b = (o as unknown as { getBounds(): Phaser.Geom.Rectangle }).getBounds();
    const isDim = o.type === 'Image' && b.width >= scene.scale.width - 2;
    const label = parent ? texts(parent) : '';
    out.push({ obj: o, label: isDim ? 'dim' : label, depth: (root as unknown as { depth: number }).depth ?? 0, x: b.centerX, y: b.centerY, w: b.width, h: b.height, dim: isDim });
  };
  for (const o of scene.children.list) visit(o, null);
  return out.sort((a, b) => b.depth - a.depth);
}

function press(c: Clickable, scene: Phaser.Scene): void {
  const ptr = { x: c.x, y: c.y, worldX: c.x, worldY: c.y, isDown: true, getDistance: () => 0, event: {} } as unknown as Phaser.Input.Pointer;
  c.obj.emit('pointerover', ptr);
  c.obj.emit('pointerdown', ptr, 0, 0, { stopPropagation() {} });
  c.obj.emit('pointerup', ptr, 0, 0, { stopPropagation() {} });
  scene.input.emit('pointerup', ptr);
}

export function installDriver(game: Phaser.Game): void {
  const errors: string[] = [];
  window.addEventListener('error', (e) => errors.push(`${e.message} @ ${e.filename}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => errors.push(`rejection: ${String((e as PromiseRejectionEvent).reason)}`));
  const active = (): AnyScene | null => (game.scene.getScenes(true)[0] as AnyScene | undefined) ?? null;

  const list = () => {
    const sc = active();
    return sc ? collect(sc) : [];
  };

  const click = (match: string | RegExp): boolean => {
    const sc = active();
    if (!sc) return false;
    const re = typeof match === 'string' ? new RegExp(match, 'i') : match;
    const hit = collect(sc).find((c) => !c.dim && re.test(c.label));
    if (!hit) return false;
    press(hit, sc);
    return true;
  };

  /** Tap through the dialogue that is on screen, one step. */
  const next = (): boolean => {
    const sc = active();
    const talking = sc?.children.getByName('dialogue') as Phaser.GameObjects.Container | null | undefined;
    if (!sc || !talking?.active) return false;
    const dim = collect(sc).find((c) => c.dim && rootOf(c.obj) === talking);
    if (!dim) return false;
    press(dim, sc);
    return true;
  };

  const rnd = <T,>(a: T[]): T | undefined => a[Math.floor(Math.random() * a.length)];
  const stats = { clicks: 0, ticks: 0, talks: 0, menus: 0, prompts: 0, starts: 0, apps: 0, day: 0, scene: '', stuck: 0 };
  let stuckAt: string[] = [];
  let stuckFlight: string[] = [];
  const trace: string[] = [];
  const freezes: string[] = [];
  const pulse: string[] = [];
  const flight: string[] = [];
  let lastFlight = '';
  let lastScene = '';
  let lastPulse = 0;
  const born = performance.now();
  let lastFrame = born;
  const watch = (): void => {
    const now = performance.now();
    if (now - lastFrame > 400 && freezes.length < 12) freezes.push(`${Math.round((now - born) / 1000)}s +${Math.round(now - lastFrame)}ms in ${lastScene}`);
    lastFrame = now;
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
  let timer = 0;
  let lastSig = '';

  const tick = (): void => {
    const sc = active();
    if (!sc) return;
    stats.ticks += 1;
    stats.scene = sc.scene.key;
    if (stats.scene !== lastScene) {
      lastScene = stats.scene;
      if (trace.length < 60) trace.push(`${Math.round((performance.now() - born) / 1000)}s ${stats.scene}`);
    }
    const items = collect(sc);
    const sig = `${sc.scene.key}|${items.map((i) => i.label).join('|')}`;
    stats.stuck = sig === lastSig ? stats.stuck + 1 : 0;
    if (stats.stuck === 150) stuckFlight = flight.slice();
    if (stats.stuck === 150) stuckAt = [`${Math.round((performance.now() - born) / 1000)}s`, ...items.map((i) => `${i.depth}:${i.dim ? 'dim' : i.label.slice(0, 40)}`)].slice(0, 15);
    lastSig = sig;
    const top = items.filter((i) => !i.dim);
    const talking = sc.children.getByName('dialogue') as Phaser.GameObjects.Container | null;
    if (talking?.active) {
      const dim = items.find((i) => i.dim && rootOf(i.obj) === talking);
      if (dim) {
        stats.talks += 1;
        press(dim, sc);
        return;
      }
    }
    const go = (c: Clickable | undefined): void => {
      if (!c) return;
      stats.clicks += 1;
      press(c, sc);
    };
    switch (sc.scene.key) {
      case 'Title':
        if (!click(/NEW GAME/)) go(rnd(top));
        return;
      case 'NewGame':
        if (!click(/VIBE/)) go(rnd(top));
        return;
      case 'Thread':
        if (!click(/KEEP SHIPPING|BACK/)) click(/SKIP/);
        return;
      case 'Ending':
        return;
      case 'Office': {
        const office = sc as unknown as {
          session: { game: { s: { project: unknown; shipped: unknown[]; day: number } }; paused: boolean; holders: string[]; ticking: boolean };
          promptOpen: boolean;
          menuModal: { open: boolean; close(): void } | null;
          openMenuById(id: string): void;
          setSpeed(i: number): void;
        };
        const g = office.session.game;
        const sigF = `H[${office.session.holders.join(',')}] T=${office.session.ticking} P[${((g.s as unknown as { pending: { t: string }[] }).pending ?? []).map((q) => q.t).join(',')}] open=${office.promptOpen} menu=${!!office.menuModal?.open} M[${top.filter((i) => i.depth >= 300).map((i) => i.label.slice(0, 8)).filter((x) => x).slice(0, 5).join('|')}]`;
        if (sigF !== lastFlight) {
          lastFlight = sigF;
          flight.push(`${Math.round((performance.now() - born) / 1000)}s ${sigF}`);
          if (flight.length > 14) flight.shift();
        }
        stats.day = g.s.day;
        stats.apps = g.s.shipped.length;
        if (performance.now() - lastPulse > 10000 && pulse.length < 30) {
          lastPulse = performance.now();
          pulse.push(`${Math.round((lastPulse - born) / 1000)}s d${g.s.day} $${Math.round((g.s as unknown as { company: { cash: number } }).company.cash)} a${g.s.shipped.length}`);
        }
        const modal = top.filter((i) => i.depth >= 300 && !/QUIT|NEW GAME|RESET|DELETE|^FIRE/i.test(i.label));
        if (office.promptOpen) {
          stats.prompts += 1;
          const pref = modal.find((i) => /CONTINUE|ONWARD|KEEP|LAUNCH ON|NEXT|OK\b/i.test(i.label));
          go(pref ?? rnd(modal));
          return;
        }
        if (office.menuModal?.open) {
          const build = modal.find((i) => /START BUILDING/i.test(i.label));
          if (build && Math.random() < 0.4) {
            stats.starts += 1;
            go(build);
            return;
          }
          if (Math.random() < 0.15) {
            office.menuModal.close();
            return;
          }
          const good = modal.filter((i) => /^(HIRE|BUY|UPGRADE|TRAIN|TOP UP|USE|RAISE|THERAPY|EQUIP|PICK)/i.test(i.label));
          go(Math.random() < 0.5 && good.length ? rnd(good) : rnd(modal));
          return;
        }
        office.session.paused = false;
        if (g.s.project === null && Math.random() < 0.5) {
          office.openMenuById('project');
          return;
        }
        if (Math.random() < 0.015) {
          stats.menus += 1;
          office.openMenuById(rnd(['hire', 'team', 'shop', 'tools', 'room'])!);
          return;
        }
        office.setSpeed(3);
        return;
      }
      default:
        go(rnd(top));
    }
  };

  /** The shots tool shows the first ~240 characters of a console line, so a long report goes out in slices. */
  const report = (text: string): void => {
    const n = Math.ceil(text.length / 200);
    for (let i = 0; i < n; i += 1) console.error(`DRIVER ${i + 1}/${n} ${text.slice(i * 200, (i + 1) * 200)}`);
  };

  const api = {
    list: () => list().map((c) => ({ label: c.label, depth: c.depth, x: Math.round(c.x), y: Math.round(c.y), dim: c.dim })),
    click,
    next,
    scene: () => active()?.scene.key ?? null,
    /** the running game's state, for probes that need real data */
    state: () => app.session?.s ?? null,
    errors,
    stats,
    autoplay(ms = 60000, every = 120): void {
      window.clearInterval(timer);
      const t0 = performance.now();
      timer = window.setInterval(() => {
        try {
          tick();
        } catch (e) {
          errors.push(`driver: ${String(e)}`);
        }
        const over = performance.now() - t0 > ms || stats.scene === 'Ending';
        if (over) {
          window.clearInterval(timer);
          report(JSON.stringify({ ...stats, errors: errors.slice(0, 6), stuckAt, stuckFlight, flight, trace, freezes, pulse, elapsed: Math.round(performance.now() - t0) }));
        }
      }, every);
    },
    stop: () => window.clearInterval(timer),
    turbo: (n: number) => {
      Session.turbo = n;
    },
  };
  (window as unknown as { __drive: typeof api }).__drive = api;
}
