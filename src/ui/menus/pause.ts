import { audio } from '../../core/audio';
import { C, F } from '../../core/theme';
import { dateLabel, money } from '../../sim/format';
import { button, label, type ButtonKind } from '../kit';
import { fadeTo } from '../layout';
import { Modal } from '../modal';
import { openHall } from '../modals/hall';
import { openSettings } from '../modals/settings';
import type { UiCtx } from '../ctx';

/** The pause menu. The clock is already stopped while it is open. */
export function openPause(ctx: UiCtx, onClose: () => void): Modal {
  const scene = ctx.scene;
  const s = ctx.session.s;
  const w = 190;
  const h = 194;
  const m = new Modal(scene, { w, h, title: 'PAUSED', style: 'paper', closable: true, hold: ctx.hold, onClose });
  m.add(label(scene, w / 2, 21, s.company.name.toUpperCase(), { font: F.caps, tint: C.orange1, origin: [0.5, 0], maxWidth: w - 16 }));
  m.add(label(scene, w / 2, 31, `${dateLabel(s.day)}   ${money(s.company.cash)}   ${s.shipped.length} shipped`, { font: F.body, tint: C.ink3, origin: [0.5, 0], maxWidth: w - 12 }));
  const bw = w - 24;
  let y = 46;
  const add = (text: string, kind: ButtonKind, fn: () => void) => {
    m.add(button(scene, 12, y, bw, 24, text, fn, { kind }));
    y += 28;
  };
  add('RESUME', 'orange', () => m.close());
  add('TROPHIES', 'cream', () => {
    openHall(scene, { hold: ctx.hold, tab: 'trophies', run: s.achievements });
  });
  add('SETTINGS', 'plum', () => {
    openSettings(scene, ctx.hold);
  });
  add('SAVE GAME', 'teal', () => {
    ctx.session.save();
    ctx.toast('Saved. Your future self says thanks.', 'good');
    audio.sfx('confirm');
  });
  add('QUIT TO TITLE', 'berry', () => {
    ctx.session.save();
    audio.music(null, { fadeMs: 300 });
    m.close();
    fadeTo(scene, 'Title');
  });
  return m;
}
