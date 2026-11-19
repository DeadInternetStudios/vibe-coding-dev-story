/**
 * The picture a player posts: the run on one card, drawn with the game's own art and fonts.
 * It is laid out once in card pixels (240 x 126) and drawn at any whole-number scale, so the
 * small copy fits on a phone screen and the big copy (1200 x 630) is the size link previews use.
 */
import Phaser from 'phaser';
import { bake } from '../../core/bake';
import { C, F } from '../../core/theme';
import { logoPx } from '../../art/sprites/logo';
import { nightCity } from '../../art/sprites/scenery';
import { shortMoney, shortNumber } from '../../sim/format';
import type { GameState } from '../../sim/types';
import { RANK_COLOR, RANK_NAME } from '../../ui/ranks';
import { fit, iconImg, label, panel, rect } from '../../ui/kit';

export const CARD_W = 240;
export const CARD_H = 126;

export interface CardFacts {
  company: string;
  founder: string;
  rank: string;
  endingTitle: string;
  score: number;
  valuation: number;
  apps: number;
  karma: number;
  best: { name: string; score: number } | null;
  where: string;
}

/** What the card says, taken from a finished run. Null while the run has no ending yet. */
export function cardFacts(s: GameState, endingTitle: string | undefined, where: string): CardFacts | null {
  const end = s.ending;
  if (!end) return null;
  const best = s.shipped.slice().sort((a, b) => b.score - a.score)[0];
  return {
    company: s.company.name,
    founder: s.staff.find((m) => m.isFounder)?.name ?? 'Founder',
    rank: end.rank,
    endingTitle: endingTitle ?? (end.bankrupt ? 'Ran out of runway' : 'Still standing'),
    score: end.score,
    valuation: end.valuation,
    apps: s.shipped.length,
    karma: s.company.karma,
    best: best ? { name: best.name, score: best.score } : null,
    where,
  };
}

/** Lay the card out in a container at the scene's origin, in card pixels. The caller scales and destroys it. */
function layout(scene: Phaser.Scene, f: CardFacts): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const col = RANK_COLOR[f.rank] ?? C.cream;
  c.add(scene.add.image(0, 0, bake(scene, `city:${CARD_W}x${CARD_H}`, () => nightCity(CARD_W, CARD_H))).setOrigin(0, 0));
  c.add(scene.add.image(CARD_W / 2, 3, bake(scene, 'logo', logoPx)).setOrigin(0.5, 0));

  // the panel with the verdict
  const py = 55;
  c.add(panel(scene, 6, py, CARD_W - 12, 62, 'plum'));
  c.add(rect(scene, 12, py + 7, 46, 46, C.ink0, 1));
  c.add(rect(scene, 13, py + 8, 44, 44, col, 1));
  const letter = label(scene, 35, py + 12, f.rank, { font: F.title, tint: C.ink0, origin: [0.5, 0] });
  letter.setScale(2);
  c.add(letter);

  const tx = 64;
  const tw = CARD_W - tx - 12;
  c.add(label(scene, tx, py + 5, fit(f.company.toUpperCase(), 24), { font: F.head, tint: C.cream, maxWidth: tw }));
  c.add(label(scene, tx, py + 17, `RANK ${f.rank}  ${RANK_NAME[f.rank] ?? ''}`, { font: F.capsBold, tint: col }));
  c.add(label(scene, tx, py + 28, fit(f.endingTitle, 46), { font: F.body, tint: C.ink5, maxWidth: tw }));
  // three numbers
  const stats: [string, string][] = [
    ['ship', `${f.apps} APP${f.apps === 1 ? '' : 'S'}`],
    ['cash', shortMoney(f.valuation)],
    ['karma', shortNumber(f.karma)],
  ];
  stats.forEach(([icon, text], i) => {
    const x = tx + i * 56;
    c.add(iconImg(scene, icon, x, py + 38));
    c.add(label(scene, x + 10, py + 39, text, { font: F.caps, tint: C.yellow }));
  });
  c.add(label(scene, tx, py + 50, f.best ? fit(`BEST: ${f.best.name}  ${f.best.score}/40`, 44) : 'NO APPS SHIPPED. BOLD.', { font: F.body, tint: C.ink4, maxWidth: tw }));

  // footer
  c.add(rect(scene, 0, CARD_H - 8, CARD_W, 8, C.ink0, 0.85));
  c.add(label(scene, 4, CARD_H - 7, `u/${f.founder.replace(/[^A-Za-z0-9]+/g, '')}`, { font: F.body, tint: C.orange2 }));
  c.add(label(scene, CARD_W - 4, CARD_H - 7, f.where, { font: F.body, tint: C.cream, origin: [1, 0] }));
  return c;
}

/**
 * Draw the card into a new render texture `scale` times as big as the card pixels. The texture is a game
 * object: put it in a modal, or snapshot it to a picture. Destroy it when done.
 * `smooth` is for a copy that will be shown smaller than it is drawn: it is shrunk with blending, not by dropping pixels.
 */
export function drawCard(scene: Phaser.Scene, f: CardFacts, scale: number, smooth = false): Phaser.GameObjects.RenderTexture {
  const rt = scene.add.renderTexture(-9000, -9000, CARD_W * scale, CARD_H * scale);
  // the filter is set before anything is drawn: changing it afterwards wipes the texture
  if (smooth) rt.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  const card = layout(scene, f);
  card.setScale(scale);
  rt.draw(card);
  rt.render();
  card.destroy();
  return rt;
}

/** The card as a PNG file. */
export function cardPng(scene: Phaser.Scene, f: CardFacts): Promise<Blob> {
  const rt = drawCard(scene, f, 5);
  return new Promise<Blob>((resolve, reject) => {
    rt.snapshot((img) => {
      rt.destroy();
      if (!(img instanceof HTMLImageElement)) {
        reject(new Error('no picture'));
        return;
      }
      void fetch(img.src).then((r) => r.blob()).then(resolve, reject);
    }, 'image/png');
  });
}
