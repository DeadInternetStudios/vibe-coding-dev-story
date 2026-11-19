import Phaser from 'phaser';
import { loadHall } from '../../core/save';
import { C, F } from '../../core/theme';
import { shortMoney } from '../../sim/format';
import { label } from '../kit';
import { Modal } from '../modal';
import { layoutOf } from '../layout';

/** Past runs, best first. */
export function openHall(scene: Phaser.Scene, hold?: () => () => void): Modal {
  const L = layoutOf(scene);
  const w = Math.min(L.W - 8, 286);
  const h = Math.min(L.H - 8, 196);
  const m = new Modal(scene, { w, h, title: 'HALL OF FAME', closable: true, hold });
  const hall = loadHall();
  if (hall.length === 0) {
    m.add(label(scene, w / 2, 70, 'Nobody has finished a run yet.', { font: F.body, tint: C.ink3, origin: [0.5, 0] }));
    m.add(label(scene, w / 2, 84, 'Your name could be here.', { font: F.body, tint: C.ink3, origin: [0.5, 0] }));
    return m;
  }
  const rows = Math.min(hall.length, Math.floor((h - 34) / 14));
  hall.slice(0, rows).forEach((e, i) => {
    const y = 24 + i * 14;
    const rank = label(scene, 10, y, e.rank, { font: F.head, tint: e.rank === 'S' ? C.orange1 : e.bankrupt ? C.berry1 : C.ink1 });
    m.add(rank);
    m.add(label(scene, 26, y + 1, `${e.company}`.slice(0, 22), { font: F.caps, tint: C.ink1 }));
    m.add(label(scene, w - 10, y + 1, shortMoney(e.score), { font: F.caps, tint: C.green1, origin: [1, 0] }));
    m.add(label(scene, 26, y + 8, `${e.founder} - ${e.apps} apps - ${e.difficulty}`.slice(0, 40), { font: F.body, tint: C.ink3 }));
  });
  return m;
}
