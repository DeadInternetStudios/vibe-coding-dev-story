import type Phaser from 'phaser';
import { audio } from '../../core/audio';
import { bakePerson } from '../../core/bake';
import { C, F } from '../../core/theme';
import { SKILL_KEYS } from '../../content/types';
import { money, shortMoney } from '../../sim/format';
import { button, hoverFrame, iconImg, label, panel, rect } from '../kit';
import { layoutOf, popupH } from '../layout';
import { Modal } from '../modal';
import { beat } from '../story';
import type { UiCtx } from '../ctx';
import { HIRE_TOP, HIRE_WIDE_FOOT, hireLayout } from './hireLayout';

/** The job board. Six hopefuls, each with a voice and a salary that sounds fine until the first payday. */
export function openHire(ctx: UiCtx, onClose: () => void): Modal {
  const scene = ctx.scene;
  const L = layoutOf(scene);
  const game = ctx.session.game;
  const s = ctx.session.s;
  const wide = !L.portrait && L.W >= 380;
  const w = Math.min(L.W - 4, wide ? 410 : 246);
  const rows = Math.max(1, s.candidates.length);
  const { rowH, h } = hireLayout(popupH(L, 1e4), rows, wide);
  const m = new Modal(scene, { w, h, title: 'JOB BOARD', style: 'paper', closable: true, hold: ctx.hold, onClose });
  beat(ctx, 'hire');

  const deskLabel = label(scene, w - 24, 6, '', { font: F.caps, tint: C.cream, origin: [1, 0] });
  m.add(deskLabel);
  // the cash is always in view and always current: beside the title on a wide card, under the rows on a narrow one
  const cashLabel = wide ? label(scene, 8, 6, '', { font: F.caps, tint: C.mint }) : label(scene, 8, h - 11, '', { font: F.body, tint: C.ink3 });
  m.add(cashLabel);
  const paintDesks = () => {
    const f = game.freeDesks();
    // a phone's job board has no room beside the title for the long form
    deskLabel.setText(wide ? (f > 0 ? `${f} FREE DESK${f === 1 ? '' : 'S'}` : 'NO FREE DESK') : f > 0 ? `${f} DESK${f === 1 ? '' : 'S'}` : 'NO DESKS');
    deskLabel.setTint(f > 0 ? C.mint : C.pink);
    cashLabel.setText(wide ? `CASH ${money(s.company.cash)}` : `Cash ${money(s.company.cash)}. New applicants every month.`);
  };
  paintDesks();

  // a wide card has one line under the rows, so it carries the "how it works" too
  const hint = wide ? 'Tap a face to hear them out. New applicants every month.' : 'Tap a face to hear them out.';
  const subtitle = label(scene, 8, wide ? h - HIRE_WIDE_FOOT + 2 : h - 28, hint, { font: F.read, tint: C.ink2, maxWidth: w - 16 });
  m.add(subtitle);

  let speaking: string | null = null;
  const rowsUi: Phaser.GameObjects.Container[] = [];

  const draw = () => {
    rowsUi.forEach((r) => r.destroy());
    rowsUi.length = 0;
    paintDesks();
    if (!s.candidates.length) {
      const c = scene.add.container(0, 0);
      c.add(label(scene, w / 2, 70, 'Nobody is applying right now.', { font: F.caps, tint: C.ink2, origin: [0.5, 0] }));
      c.add(label(scene, w / 2, 84, 'Come back next month. Maybe post on Reddit.', { font: F.body, tint: C.ink3, origin: [0.5, 0] }));
      m.add(c);
      rowsUi.push(c);
      return;
    }
    s.candidates.forEach((cand, i) => {
      const arch = ctx.content.archetype(cand.archetype);
      const y = HIRE_TOP + i * (rowH + 2);
      const r = scene.add.container(6, y);
      r.add(panel(scene, 0, 0, w - 12, rowH, speaking === cand.id ? 'chipLight' : 'paperDim', false));
      r.add(rect(scene, 3, 3, 18, rowH - 6, C.sky, 1));
      r.add(scene.add.image(12, rowH - 2, bakePerson(scene, cand.look, 'stand', 'normal')).setOrigin(0.5, 1));
      const hit = scene.add.zone(0, 0, 140, rowH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        const line = arch.intro[Math.floor(Math.random() * arch.intro.length)];
        speaking = cand.id;
        ctx.sfx('select');
        if (line) {
          subtitle.setText(`${cand.name}: "${line.text}"`);
          void audio.voice(line);
        }
        draw();
      });
      r.add(hit);
      r.add(hoverFrame(scene, hit, 0, 0, 140, rowH));
      r.add(label(scene, 25, 3, cand.name.toUpperCase(), { font: F.caps, tint: C.ink1, maxWidth: 110 }));
      r.add(label(scene, 25, 13, arch.role, { font: F.body, tint: C.orange1 }));
      // skills
      const sx = wide ? 140 : 25;
      const sy = wide ? 5 : 25;
      SKILL_KEYS.forEach((k, j) => {
        const x = sx + j * (wide ? 26 : 31);
        r.add(iconImg(scene, k, x, sy - 1));
        r.add(label(scene, x + 10, sy, `${cand.skills[k]}`, { font: F.body, tint: cand.skills[k] >= 14 ? C.green1 : C.ink2 }));
      });
      // traits
      const tx = wide ? 140 : 25;
      const ty = wide ? 16 : 34;
      r.add(label(scene, tx, ty, cand.traits.map((id) => ctx.content.trait(id).name).join(', '), { font: F.body, tint: C.ink3, maxWidth: wide ? 150 : w - 90 }));
      // price and button; on a wide row the salary sits right under a short button, clear of the row's bottom edge
      const bw = wide ? 78 : 62;
      const btnH = wide ? 14 : 16;
      const btnY = wide ? (rowH >= 29 ? 4 : rowH >= 28 ? 3 : 2) : 7;
      const hb = button(scene, w - 12 - bw - 4, btnY, bw, btnH, `HIRE ${shortMoney(cand.fee)}`, () => {
        const err = game.hire(cand.id);
        if (err) {
          ctx.toast(err, 'bad');
          ctx.sfx('error');
          return;
        }
        ctx.refresh();
        draw();
      }, { kind: 'orange', font: F.body, disabled: game.freeDesks() <= 0 });
      r.add(hb);
      r.add(label(scene, w - 12 - bw / 2 - 4, wide ? btnY + btnH + 1 : 26, `${shortMoney(cand.salary)}/mo`, { font: F.body, tint: C.ink2, origin: [0.5, 0] }));
      m.add(r);
      rowsUi.push(r);
    });
  };
  draw();
  return m;
}
