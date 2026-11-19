import type Phaser from 'phaser';
import { bakeDecor, bakeIcon } from '../../core/bake';
import { C, F } from '../../core/theme';
import { OFFICE_TIERS } from '../../sim/config';
import { money, shortMoney } from '../../sim/format';
import { SHOP, type ShopItem } from '../../sim/shop';
import { unlocked } from '../../sim/game';
import { button, hoverFrame, iconImg, label, panel, rect } from '../kit';
import { layoutOf, popupH } from '../layout';
import { Modal } from '../modal';
import type { UiCtx } from '../ctx';

const shortPrice = (n: number) => shortMoney(n);

function effectsOf(it: ShopItem): { icon: string; text: string; good: boolean }[] {
  const out: { icon: string; text: string; good: boolean }[] = [];
  if (it.speed) out.push({ icon: 'bolt', text: `+${Math.round(it.speed * 100)}% speed`, good: true });
  if (it.bugs) out.push({ icon: 'debug', text: `-${Math.round(it.bugs * 100)}% bugs`, good: true });
  if (it.spaghetti) out.push({ icon: 'spaghetti', text: `-${Math.round(it.spaghetti * 100)}% spaghetti`, good: true });
  if (it.mood) out.push({ icon: 'moodHappy', text: `+${it.mood} mood`, good: true });
  if (it.karma) out.push({ icon: 'karma', text: `+${Math.round(it.karma * 100)}% karma`, good: true });
  for (const [k, v] of Object.entries(it.stat ?? {})) out.push({ icon: k, text: `+${Math.round((v ?? 0) * 100)}% ${k}`, good: true });
  return out;
}

/** Things for the office. Every one is a bad idea with a small real bonus. */
export function openShop(ctx: UiCtx, onClose: () => void): Modal {
  const scene = ctx.scene;
  const L = layoutOf(scene);
  const game = ctx.session.game;
  const s = ctx.session.s;
  const wide = !L.portrait && L.W >= 380;
  const w = Math.min(L.W - 4, wide ? 410 : 246);
  const h = popupH(L, wide ? 246 : 350);
  const m = new Modal(scene, { w, h, title: 'OFFICE SHOP', style: 'paper', closable: true, hold: ctx.hold, onClose });

  const cols = wide ? 5 : 6;
  const tile = wide ? 36 : 36;
  const gx = 6;
  const gy = 21;
  const gridH = Math.ceil(SHOP.length / cols) * (tile + 2);
  let sel = 0;
  const cash = label(scene, w - 8, 6, '', { font: F.caps, tint: C.mint, origin: [1, 0] });
  m.add(cash);

  const tileObjs: { ring: Phaser.GameObjects.Image; badge: Phaser.GameObjects.Container; price: Phaser.GameObjects.BitmapText }[] = [];
  const state = (it: ShopItem): 'owned' | 'locked' | 'tier' | 'ok' => {
    if (s.company.items.includes(it.id)) return 'owned';
    if (!unlocked(game, it.unlock ?? {})) return 'locked';
    if (s.company.officeTier < it.tier) return 'tier';
    return 'ok';
  };

  SHOP.forEach((it, i) => {
    const x = gx + (i % cols) * (tile + 2);
    const y = gy + Math.floor(i / cols) * (tile + 2);
    const ring = rect(scene, x, y, tile, tile, C.ink0, 1);
    m.add(ring);
    m.add(rect(scene, x + 1, y + 1, tile - 2, tile - 2, C.cream, 1));
    const key = bakeDecor(scene, it.art) ?? bakeIcon(scene, 'shop');
    const img = scene.add.image(x + tile / 2, y + tile / 2 - 2, key).setOrigin(0.5, 0.5);
    const sc = Math.max(1, Math.floor(Math.min((tile - 8) / img.width, (tile - 14) / img.height)));
    img.setScale(sc);
    const st = state(it);
    if (st === 'locked' || st === 'tier') img.setTint(0x555566);
    m.add(img);
    const price = label(scene, x + tile / 2, y + tile - 9, st === 'owned' ? 'OWNED' : shortPrice(it.price), { font: F.body, tint: st === 'owned' ? C.green1 : st === 'ok' ? C.ink1 : C.ink3, origin: [0.5, 0] });
    m.add(price);
    const badge = scene.add.container(x + tile - 7, y + 1);
    if (st === 'owned') badge.add(iconImg(scene, 'check', 0, 0));
    if (st === 'locked' || st === 'tier') badge.add(iconImg(scene, 'lock', 0, 0));
    m.add(badge);
    const z = scene.add.zone(x, y, tile, tile).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => {
      sel = i;
      ctx.sfx('select');
      paint();
    });
    m.add(z);
    m.add(hoverFrame(scene, z, x, y, tile, tile));
    tileObjs.push({ ring, badge, price });
  });

  const dx = wide ? gx + cols * (tile + 2) + 4 : 6;
  const dy = wide ? 21 : gy + gridH + 4;
  const dw = wide ? w - dx - 6 : w - 12;
  const dh = h - dy - 6;
  const detail = scene.add.container(0, 0);
  m.add(detail);

  function paint(): void {
    cash.setText(money(s.company.cash));
    detail.removeAll(true);
    tileObjs.forEach((t, i) => t.ring.setTint(i === sel ? C.orange2 : C.ink0));
    const it = SHOP[sel]!;
    const st = state(it);
    detail.add(panel(scene, dx, dy, dw, dh, 'paperDim', false));
    const px = dx + 5;
    const key = bakeDecor(scene, it.art) ?? bakeIcon(scene, 'shop');
    detail.add(rect(scene, px, dy + 5, 30, 30, C.ink0, 1));
    detail.add(rect(scene, px + 1, dy + 6, 28, 28, C.cream, 1));
    const img = scene.add.image(px + 15, dy + 20, key).setOrigin(0.5, 0.5);
    img.setScale(Math.max(1, Math.floor(Math.min(26 / img.width, 26 / img.height))));
    detail.add(img);
    detail.add(label(scene, px + 36, dy + 5, it.name.toUpperCase(), { font: F.caps, tint: C.ink1, maxWidth: dw - 44 }));
    detail.add(label(scene, px + 36, dy + 15, it.blurb, { font: F.body, tint: C.ink3, maxWidth: dw - 44 }));
    let y = dy + 40;
    for (const e of effectsOf(it)) {
      detail.add(iconImg(scene, e.icon, px, y - 1));
      detail.add(label(scene, px + 11, y, e.text, { font: F.body, tint: C.green1 }));
      y += 10;
    }
    if (!effectsOf(it).length) {
      detail.add(label(scene, px, y, 'Pure decoration. Priceless.', { font: F.body, tint: C.ink3 }));
      y += 10;
    }
    y += 2;
    detail.add(label(scene, px, y, `"${it.quip}"`, { font: F.read, tint: C.ink2, maxWidth: dw - 10 }));
    const label2 = st === 'owned' ? 'OWNED' : st === 'locked' ? 'LOCKED' : st === 'tier' ? `NEEDS ${OFFICE_TIERS[it.tier]!.name.toUpperCase()}` : `BUY ${money(it.price)}`;
    const buy = button(scene, px, dy + dh - 24, dw - 10, 18, label2, () => {
      const err = game.buyItem(it.id);
      if (err) {
        ctx.toast(err, 'bad');
        ctx.sfx('error');
        return;
      }
      ctx.cashPop(-it.price);
      ctx.refresh();
      tileRefresh();
      paint();
    }, { kind: st === 'ok' ? 'orange' : 'plum', disabled: st !== 'ok' || s.company.cash < it.price, icon: st === 'ok' ? 'cash' : undefined });
    detail.add(buy);
    if (st === 'locked' && it.unlock) {
      detail.add(label(scene, px, dy + dh - 34, it.unlock.karma ? `Needs ${it.unlock.karma} karma` : `Opens in year ${it.unlock.year}`, { font: F.body, tint: C.berry1 }));
    }
  }

  function tileRefresh(): void {
    tileObjs.forEach((t, i) => {
      t.badge.removeAll(true);
      const st = state(SHOP[i]!);
      t.price.setText(st === 'owned' ? 'OWNED' : shortPrice(SHOP[i]!.price));
      t.price.setTint(st === 'owned' ? C.green1 : st === 'ok' ? C.ink1 : C.ink3);
      if (st === 'owned') t.badge.add(iconImg(scene, 'check', 0, 0));
      if (st === 'locked' || st === 'tier') t.badge.add(iconImg(scene, 'lock', 0, 0));
    });
  }

  paint();
  return m;
}
