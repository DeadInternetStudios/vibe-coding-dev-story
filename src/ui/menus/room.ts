import type Phaser from 'phaser';
import { bakePerson } from '../../core/bake';
import { C, F } from '../../core/theme';
import { OFFICE_TIERS } from '../../sim/config';
import { dateLabel, money, shortMoney } from '../../sim/format';
import { bar, button, iconImg, label, panel } from '../kit';
import { fadeTo, layoutOf, popupH } from '../layout';
import { Modal } from '../modal';
import { tabs } from './common';
import { buildingRows } from './roomLayout';
import type { UiCtx } from '../ctx';

/** The office itself: the building, the code, and the things you have shipped. */
export function openRoom(ctx: UiCtx, onClose: () => void, startTab = 0): Modal {
  const scene = ctx.scene;
  const L = layoutOf(scene);
  const game = ctx.session.game;
  const s = ctx.session.s;
  const c = ctx.content;
  const wide = !L.portrait && L.W >= 380;
  const w = Math.min(L.W - 4, wide ? 410 : 246);
  const h = popupH(L, wide ? 246 : 330);
  const m = new Modal(scene, { w, h, title: 'THE OFFICE', style: 'paper', closable: true, hold: ctx.hold, onClose });
  const cash = label(scene, w - 20, 6, '', { font: F.caps, tint: C.mint, origin: [1, 0] });
  m.add(cash);
  let tabIndex = startTab;

  const t = tabs(m, 6, 21, w - 12, ['BUILDING', 'APPS'], (i, content) => {
    tabIndex = i;
    cash.setText(money(s.company.cash));
    if (i === 0) drawBuilding(content);
    else drawApps(content);
  }, startTab);
  const redraw = () => t.select(tabIndex);

  function drawBuilding(content: Phaser.GameObjects.Container): void {
    const cur = OFFICE_TIERS[s.company.officeTier]!;
    const next = OFFICE_TIERS[s.company.officeTier + 1];
    const iw = w - 12;
    const R = buildingRows(h);
    // inside a panel: text rows sit a little closer on a short card
    const dy = (roomy: number, tight: number) => (R.tight ? tight : roomy);
    content.add(panel(scene, 6, R.curY, iw, R.panelH, 'paperDim', false));
    content.add(iconImg(scene, 'office', 11, R.curY + dy(5, 4), 2));
    content.add(label(scene, 32, R.curY + dy(4, 3), cur.name.toUpperCase(), { font: F.caps, tint: C.ink1 }));
    content.add(label(scene, 32, R.curY + dy(14, 12), cur.blurb, { font: F.body, tint: C.ink3, maxWidth: iw - 34 }));
    content.add(label(scene, 32, R.curY + dy(30, 21), `${s.staff.length} of ${cur.desks} desks   Rent ${money(cur.rent)}/mo`, { font: F.body, tint: C.ink2 }));

    if (next) {
      const y = R.nextY;
      content.add(panel(scene, 6, y, iw, R.panelH, 'chipLight', false));
      content.add(label(scene, 11, y + dy(4, 3), `NEXT: ${next.name.toUpperCase()}`, { font: F.caps, tint: C.orange1 }));
      content.add(label(scene, 11, y + dy(14, 12), next.blurb, { font: F.body, tint: C.ink3, maxWidth: iw - 90 }));
      content.add(label(scene, 11, y + dy(30, 21), `${next.desks} desks   Rent ${money(next.rent)}/mo`, { font: F.body, tint: C.ink2 }));
      content.add(button(scene, 6 + iw - 76, y + dy(20, 7), 72, 18, `MOVE ${shortMoney(next.upgrade)}`, () => {
        const err = game.upgradeOffice();
        if (err) {
          ctx.toast(err, 'bad');
          ctx.sfx('error');
          return;
        }
        ctx.cashPop(-next.upgrade);
        ctx.shake(1);
        ctx.refresh();
        ctx.room.rebuild();
        ctx.banner('NEW OFFICE', OFFICE_TIERS[s.company.officeTier]!.name, 'wow');
        m.close();
      }, { kind: 'orange', disabled: s.company.cash < next.upgrade }));
    } else {
      content.add(label(scene, 6 + iw / 2, R.nextY + 12, 'This is the top floor. There is nowhere left to go but down.', { font: F.body, tint: C.ink3, origin: [0.5, 0], maxWidth: iw - 10, align: 'center' }));
    }

    // health
    const hy = R.healthY;
    content.add(label(scene, 6, hy, 'SPAGHETTI', { font: F.caps, tint: C.ink3 }));
    content.add(bar(scene, 64, hy + 1, iw - 62, 6, C.orange2, s.company.spaghetti / 100));
    const mood = s.staff.length ? s.staff.reduce((n, x) => n + x.mood, 0) / s.staff.length : 0;
    content.add(label(scene, 6, hy + dy(12, 11), 'TEAM MOOD', { font: F.caps, tint: C.ink3 }));
    content.add(bar(scene, 64, hy + dy(13, 12), iw - 62, 6, mood > 60 ? C.green2 : mood > 30 ? C.yellow : C.pink, mood / 100));

    // actions
    const ay = R.actionsY;
    const hw = Math.floor((iw - 3) / 2);
    content.add(button(scene, 6, ay, hw, R.actionH, s.company.crunch ? 'CRUNCH: ON' : 'CRUNCH: OFF', () => {
      game.setCrunch(!s.company.crunch);
      ctx.refresh();
      redraw();
    }, { kind: s.company.crunch ? 'berry' : 'plum' }));
    content.add(button(scene, 6 + hw + 3, ay, hw, R.actionH, 'REFACTOR WEEK', () => {
      game.refactorSprint();
      ctx.sfx('fix');
      ctx.refresh();
      redraw();
    }, { kind: 'teal' }));
    content.add(label(scene, 6, R.hintY, 'Crunch: faster, grumpier. Refactor: cleaner code, five lost days.', { font: F.body, tint: C.ink3, maxWidth: iw }));

    // the floor plan: one cell for each desk, a person where somebody sits
    const fy = R.floorY;
    const free = Math.max(0, cur.desks - s.staff.length);
    content.add(label(scene, 6, fy, 'THE FLOOR', { font: F.caps, tint: C.ink3 }));
    content.add(label(scene, 6 + iw, fy, free ? `${free} free ${free === 1 ? 'desk' : 'desks'}` : 'every desk taken', { font: F.body, tint: free ? C.green1 : C.ink3, origin: [1, 0] }));
    const cell = 22;
    const cols = Math.max(1, Math.floor(iw / cell));
    for (let i = 0; i < cur.desks; i++) {
      const cx = 6 + (i % cols) * cell;
      const cy = R.cellsY + Math.floor(i / cols) * R.cellStep;
      const who = s.staff[i];
      content.add(panel(scene, cx, cy, cell - 2, R.cellH, who ? 'chipLight' : 'paperDim', false));
      if (who) content.add(scene.add.image(cx + (cell - 2) / 2, cy + R.cellH - 1, bakePerson(scene, who.look, 'stand', who.mood > 60 ? 'happy' : who.mood > 30 ? 'normal' : 'sad')).setOrigin(0.5, 1));
      else content.add(iconImg(scene, 'plus', cx + 6, cy + 9).setAlpha(0.35));
    }
  }

  function drawApps(content: Phaser.GameObjects.Container): void {
    const iw = w - 12;
    const apps = [...s.shipped].reverse();
    if (!apps.length) {
      content.add(label(scene, w / 2, 70, 'Nothing shipped yet.', { font: F.caps, tint: C.ink2, origin: [0.5, 0] }));
      content.add(label(scene, w / 2, 84, 'Build something. Post it. Read the comments. Regret.', { font: F.body, tint: C.ink3, origin: [0.5, 0], maxWidth: iw - 10, align: 'center' }));
      return;
    }
    const rowH = 24;
    const max = Math.floor((h - 38 - 6) / (rowH + 2));
    apps.slice(0, max).forEach((a, i) => {
      const y = 38 + i * (rowH + 2);
      content.add(panel(scene, 6, y, iw, rowH, 'paperDim', false));
      content.add(label(scene, 11, y + 3, a.name.toUpperCase(), { font: F.caps, tint: C.ink1, maxWidth: iw - 110 }));
      const kind = c.kinds.find((k) => k.id === a.kind)?.name ?? a.kind;
      const niche = c.niches.find((n) => n.id === a.niche)?.plural ?? a.niche;
      content.add(label(scene, 11, y + 13, `${kind} for ${niche}. ${dateLabel(a.launchDay)}`, { font: F.body, tint: C.ink3, maxWidth: iw - 110 }));
      content.add(label(scene, 6 + iw - 76, y + 3, `${a.score}/40`, { font: F.caps, tint: a.score >= 24 ? C.green1 : a.score >= 14 ? C.orange1 : C.berry1, origin: [1, 0] }));
      content.add(label(scene, 6 + iw - 76, y + 13, shortMoney(a.earned), { font: F.body, tint: C.green1, origin: [1, 0] }));
      content.add(button(scene, 6 + iw - 70, y + 3, 64, 18, 'THREAD', () => {
        m.close();
        fadeTo(scene, 'Thread', { appId: a.id, replay: true });
      }, { kind: 'violet', font: F.body }));
    });
  }

  return m;
}
