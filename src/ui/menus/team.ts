import Phaser from 'phaser';
import { audio } from '../../core/audio';
import { bakePerson } from '../../core/bake';
import { C, F } from '../../core/theme';
import { SKILL_KEYS, type SkillKey } from '../../content/types';
import { money, shortMoney } from '../../sim/format';
import type { Staff } from '../../sim/types';
import { bar, button, hoverFrame, iconImg, label, panel, rect, type ButtonKind } from '../kit';
import { layoutOf, popupH } from '../layout';
import { Modal } from '../modal';
import { beat } from '../story';
import { SKILL_WORD } from '../text';
import type { UiCtx } from '../ctx';

const SKILL_COLORS: Record<SkillKey, number> = { prompt: C.sky, taste: C.pink, debug: C.mint, paranoia: C.violet2, hustle: C.yellow };

function moodIcon(mood: number): string {
  return mood >= 70 ? 'moodHappy' : mood >= 45 ? 'moodOk' : mood >= 22 ? 'moodSad' : 'moodPanic';
}

/** Everyone on the payroll. Pick a face to see what they are good at and what they need. */
export function openTeam(ctx: UiCtx, focus: string | undefined, onClose: () => void): Modal {
  const scene = ctx.scene;
  const L = layoutOf(scene);
  const s = ctx.session.s;
  const game = ctx.session.game;
  const wide = !L.portrait && L.W >= 380;
  const w = Math.min(L.W - 4, wide ? 410 : 246);
  const h = popupH(L, wide ? 246 : 350);
  const m = new Modal(scene, { w, h, title: 'THE TEAM', style: 'paper', closable: true, hold: ctx.hold, onClose });
  beat(ctx, 'team');
  let sel = Math.max(0, s.staff.findIndex((x) => x.id === focus));

  // ------------------------------------------------------------ the grid
  const cols = wide ? 4 : 8;
  const tile = wide ? 30 : 28;
  const gridW = cols * (tile + 2);
  const gx = 6;
  const gy = 21;
  const tiles: { bg: Phaser.GameObjects.Image }[] = [];
  s.staff.forEach((mem, i) => {
    const x = gx + (i % cols) * (tile + 2);
    const y = gy + Math.floor(i / cols) * (tile + 4);
    const bg = rect(scene, x, y, tile, tile + 2, C.ink0, 1);
    const inner = rect(scene, x + 1, y + 1, tile - 2, tile, C.sky, 1);
    const img = scene.add.image(x + tile / 2, y + tile + 1, bakePerson(scene, mem.look, 'stand', mem.mood > 60 ? 'happy' : mem.mood > 30 ? 'normal' : 'sad')).setOrigin(0.5, 1);
    m.add(bg);
    m.add(inner);
    m.add(img);
    const dot = rect(scene, x + tile - 5, y + 2, 3, 3, mem.mood > 60 ? C.green2 : mem.mood > 30 ? C.yellow : C.berry1, 1);
    m.add(dot);
    if (mem.awayUntil > s.day) m.add(iconImg(scene, 'clock', x + 1, y + 1));
    const z = scene.add.zone(x, y, tile, tile + 2).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => {
      sel = i;
      ctx.sfx('select');
      paint();
    });
    m.add(z);
    m.add(hoverFrame(scene, z, x, y, tile, tile + 2));
    tiles.push({ bg: bg as unknown as Phaser.GameObjects.Image });
  });
  const free = game.freeDesks();
  const gridBottom = gy + Math.ceil(s.staff.length / cols) * (tile + 4);
  m.add(label(scene, gx, gridBottom + 2, `${s.staff.length} people, ${free} free desk${free === 1 ? '' : 's'}`, { font: F.body, tint: C.ink3 }));
  m.add(label(scene, gx, gridBottom + 12, `Payroll ${shortMoney(s.staff.reduce((n, x) => n + x.salary, 0))} / month`, { font: F.body, tint: C.ink3 }));

  // ------------------------------------------------------------ detail
  const dx = wide ? gx + gridW + 6 : 6;
  const dy = wide ? 21 : gridBottom + 26;
  const dw = wide ? w - dx - 6 : w - 12;
  const detail = scene.add.container(0, 0);
  m.add(detail);

  function paint(): void {
    detail.removeAll(true);
    tiles.forEach((t, i) => t.bg.setTint(i === sel ? C.orange2 : C.ink0));
    const mem = s.staff[sel];
    if (!mem) return;
    drawDetail(mem);
  }

  function drawDetail(mem: Staff): void {
    const arch = ctx.content.archetype(mem.archetype);
    const box = panel(scene, dx, dy, dw, h - dy - 6, 'paperDim', false);
    detail.add(box);
    const px = dx + 4;
    // portrait
    detail.add(rect(scene, px, dy + 4, 40, 54, C.ink0, 1));
    detail.add(rect(scene, px + 1, dy + 5, 38, 52, C.sky, 1));
    detail.add(scene.add.image(px + 20, dy + 56, bakePerson(scene, mem.look, 'stand', mem.mood > 60 ? 'happy' : mem.mood > 30 ? 'normal' : 'sad')).setOrigin(0.5, 1).setScale(2));
    // name block
    const nx = px + 46;
    detail.add(label(scene, nx, dy + 4, mem.name.toUpperCase(), { font: F.caps, tint: C.ink1, maxWidth: dw - 54 }));
    detail.add(label(scene, nx, dy + 14, arch.role + (mem.isFounder ? ' (you)' : ''), { font: F.body, tint: C.orange1 }));
    detail.add(label(scene, nx, dy + 24, `LV ${mem.level}`, { font: F.caps, tint: C.ink2 }));
    const need = 40 + 28 * mem.level;
    detail.add(bar(scene, nx + 22, dy + 25, dw - 80, 5, C.yellow, Math.min(1, mem.xp / need)));
    // mood
    detail.add(iconImg(scene, moodIcon(mem.mood), nx, dy + 36));
    detail.add(bar(scene, nx + 11, dy + 38, dw - 70, 5, mem.mood > 60 ? C.green2 : mem.mood > 30 ? C.yellow : C.pink, mem.mood / 100));
    detail.add(label(scene, nx, dy + 48, mem.awayUntil > s.day ? `Away: ${mem.awayWhy ?? 'out'} (${mem.awayUntil - s.day}d)` : mem.assign === 'build' ? 'Building' : 'Supporting', { font: F.body, tint: C.ink3 }));
    // skills
    let y = dy + 62;
    for (const k of SKILL_KEYS) {
      detail.add(iconImg(scene, k, px, y - 1));
      detail.add(label(scene, px + 10, y, SKILL_WORD[k], { font: F.body, tint: C.ink2 }));
      detail.add(rect(scene, px + 54, y + 1, dw - 124, 5, C.ink1, 1));
      detail.add(rect(scene, px + 55, y + 2, Math.max(1, Math.round((Math.min(40, mem.skills[k]) / 40) * (dw - 126))), 3, SKILL_COLORS[k], 1));
      detail.add(label(scene, px + dw - 58, y, `${mem.skills[k]}`, { font: F.body, tint: C.ink1, origin: [1, 0] }));
      const cost = game.trainCost(mem, k);
      const tb = button(scene, px + dw - 52, y - 2, 44, 10, `+ ${shortMoney(cost)}`, () => {
        const err = game.train(mem.id, k);
        if (err) {
          ctx.toast(err, 'bad');
          ctx.sfx('error');
        } else ctx.sfx('level_up');
        ctx.refresh();
        paint();
      }, { kind: 'teal', font: F.body, disabled: s.company.cash < cost || mem.awayUntil > s.day });
      detail.add(tb);
      y += 11;
    }
    // traits
    y += 2;
    let tx = px;
    for (const id of mem.traits) {
      const tr = ctx.content.trait(id);
      const t = label(scene, tx + 3, y + 2, tr.name, { font: F.body, tint: C.cream });
      const cw = Math.ceil(t.width) + 8;
      if (tx + cw > dx + dw - 4) break;
      detail.add(panel(scene, tx, y, cw, 12, 'plum', false));
      detail.add(t);
      tx += cw + 3;
    }
    const first = mem.traits[0] ? ctx.content.trait(mem.traits[0]) : null;
    if (first) detail.add(label(scene, px, y + 15, first.blurb, { font: F.body, tint: C.ink3, maxWidth: dw - 8 }));
    // salary and actions
    const by = h - 26;
    detail.add(label(scene, px, by - 11, mem.isFounder ? 'The boss. Works for exposure.' : `${money(mem.salary)} / month`, { font: F.body, tint: C.ink2 }));
    const bw = Math.floor((dw - 8 - 6) / 4);
    let bx = px;
    const add = (text: string, kind: ButtonKind, fn: () => void, disabled = false) => {
      const b = button(scene, bx, by, bw, 18, text, fn, { kind, font: F.body, disabled });
      detail.add(b);
      bx += bw + 2;
    };
    add(mem.assign === 'build' ? 'SUPPORT' : 'BUILD', 'cream', () => {
      game.setAssign(mem.id, mem.assign === 'build' ? 'support' : 'build');
      ctx.refresh();
      paint();
    });
    add('RAISE', 'teal', () => {
      const err = game.raise(mem.id);
      if (err) ctx.toast(err, 'bad');
      else ctx.sfx('coin');
      ctx.refresh();
      paint();
    }, !!mem.isFounder);
    add(`CHILL ${shortMoney(game.therapyCost())}`, 'violet', () => {
      const err = game.therapy(mem.id);
      if (err) {
        ctx.toast(err, 'bad');
        ctx.sfx('error');
      }
      ctx.refresh();
      paint();
    }, mem.awayUntil > s.day);
    add('FIRE', 'berry', () => confirmFire(mem), !!mem.isFounder);
    // voice
    if (arch.intro.length) {
      const v = button(scene, dx + dw - 14, dy + 3, 11, 11, '', () => {
        const line = arch.intro[Math.floor(Math.random() * arch.intro.length)]!;
        void audio.voice(line);
        ctx.toast(line.text, 'info', mem.id);
      }, { kind: 'violet', icon: 'speaker' });
      detail.add(v);
    }
  }

  function confirmFire(mem: Staff): void {
    const cm = new Modal(scene, { w: 200, h: 70, title: `FIRE ${mem.name.toUpperCase().slice(0, 14)}?`, style: 'paper', depth: 340 });
    cm.add(label(scene, 100, 22, `Severance ${shortMoney(Math.round(mem.salary * 0.5))}. Everyone else gets sad.`, { font: F.body, tint: C.ink2, origin: [0.5, 0], maxWidth: 184, align: 'center' }));
    cm.add(button(scene, 12, 46, 80, 18, 'KEEP', () => cm.close(), { kind: 'teal' }));
    cm.add(button(scene, 108, 46, 80, 18, 'FIRE', () => {
      game.fire(mem.id);
      cm.close();
      ctx.refresh();
      sel = 0;
      m.close();
    }, { kind: 'berry' }));
  }

  paint();
  return m;
}
