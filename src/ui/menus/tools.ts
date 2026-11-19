import type Phaser from 'phaser';
import { C, F } from '../../core/theme';
import { TOKEN_PLANS } from '../../sim/config';
import { money, shortMoney } from '../../sim/format';
import { unlocked } from '../../sim/game';
import { workers } from '../../sim/ctx';
import { bar, button, iconImg, label, panel } from '../kit';
import { layoutOf } from '../layout';
import { Modal } from '../modal';
import { beat } from '../story';
import { tabs } from './common';
import type { UiCtx } from '../ctx';

function lockText(u: { year?: number; karma?: number }): string {
  if (u.karma) return `Needs ${u.karma} karma`;
  if (u.year) return `Opens in year ${u.year}`;
  return 'Locked';
}

/** AI tools to license, and the token plan that decides how long you can use them. */
export function openTools(ctx: UiCtx, onClose: () => void): Modal {
  const scene = ctx.scene;
  const L = layoutOf(scene);
  const game = ctx.session.game;
  const s = ctx.session.s;
  const c = ctx.content;
  const wide = !L.portrait && L.W >= 380;
  const w = Math.min(L.W - 4, wide ? 410 : 246);
  const h = Math.min(L.H - 4, wide ? 232 : 330);
  const m = new Modal(scene, { w, h, title: 'AI TOOLS', style: 'paper', closable: true, hold: ctx.hold, onClose });
  beat(ctx, 'tools');
  const cash = label(scene, w - 8, 6, '', { font: F.caps, tint: C.mint, origin: [1, 0] });
  m.add(cash);
  let tabIndex = 0;

  const t = tabs(m, 6, 21, w - 12, ['TOOLS', 'TOKENS'], (i, content) => {
    tabIndex = i;
    cash.setText(money(s.company.cash));
    if (i === 0) drawTools(content);
    else drawTokens(content);
  });
  const redraw = () => t.select(tabIndex);

  function drawTools(content: Phaser.GameObjects.Container): void {
    const rowH = wide ? 26 : 38;
    c.tools.forEach((tool, i) => {
      const y = 38 + i * (rowH + 2);
      const owned = s.company.tools.includes(tool.id);
      const active = s.company.activeTool === tool.id;
      const open = unlocked(game, tool.unlock);
      content.add(panel(scene, 6, y, w - 12, rowH, active ? 'chipLight' : 'paperDim', false));
      content.add(label(scene, 11, y + 3, (open || owned ? tool.name : '???').toUpperCase(), { font: F.caps, tint: open || owned ? C.ink1 : C.ink3 }));
      content.add(label(scene, 11, y + 13, open || owned ? tool.blurb : lockText(tool.unlock), { font: F.body, tint: open || owned ? C.ink3 : C.berry1, maxWidth: wide ? 180 : w - 30 }));
      const sx = wide ? 202 : 11;
      const sy = wide ? y + 5 : y + 24;
      content.add(iconImg(scene, 'bolt', sx, sy - 1));
      content.add(label(scene, sx + 10, sy, `x${tool.speed}`, { font: F.body, tint: tool.speed >= 1 ? C.green1 : C.ink2 }));
      content.add(iconImg(scene, 'debug', sx + 40, sy - 1));
      content.add(label(scene, sx + 50, sy, `x${tool.bugs}`, { font: F.body, tint: tool.bugs <= 1 ? C.green1 : C.berry1 }));
      content.add(iconImg(scene, 'token', sx + 80, sy - 1));
      content.add(label(scene, sx + 90, sy, `${tool.tokens}K`, { font: F.body, tint: C.violet1 }));
      if (wide) content.add(label(scene, sx, y + 15, tool.monthly ? `${money(tool.monthly)} / month` : 'no monthly fee', { font: F.body, tint: C.ink3 }));
      const bw = wide ? 84 : 70;
      const bx = w - 12 - bw - 4;
      const by = wide ? y + 4 : y + 4;
      let btn;
      if (active) btn = button(scene, bx, by, bw, 18, 'IN USE', () => undefined, { kind: 'teal', disabled: true });
      else if (owned) {
        btn = button(scene, bx, by, bw, 18, 'USE', () => {
          game.setTool(tool.id);
          ctx.refresh();
          redraw();
        }, { kind: 'cream' });
      } else if (open) {
        btn = button(scene, bx, by, bw, 18, `BUY ${shortMoney(tool.price)}`, () => {
          const err = game.buyTool(tool.id);
          if (err) {
            ctx.toast(err, 'bad');
            ctx.sfx('error');
            return;
          }
          game.setTool(tool.id);
          ctx.cashPop(-tool.price);
          ctx.refresh();
          redraw();
        }, { kind: 'orange', disabled: s.company.cash < tool.price });
      } else btn = button(scene, bx, by, bw, 18, 'LOCKED', () => undefined, { kind: 'plum', disabled: true });
      content.add(btn);
    });
  }

  function drawTokens(content: Phaser.GameObjects.Container): void {
    const plan = TOKEN_PLANS.find((p) => p.id === s.company.tokenPlan) ?? TOKEN_PLANS[0]!;
    const tool = c.tool(s.company.activeTool);
    const burn = workers(s).length * tool.tokens;
    content.add(panel(scene, 6, 38, w - 12, 44, 'night', false));
    content.add(iconImg(scene, 'token', 12, 44, 2));
    content.add(label(scene, 34, 42, `${Math.max(0, Math.round(s.company.tokens))}K TOKENS LEFT`, { font: F.head, tint: s.company.tokens < burn * 4 ? C.pink : C.violet2 }));
    content.add(bar(scene, 34, 58, w - 12 - 40, 6, C.violet2, Math.min(1, s.company.tokens / Math.max(1, plan.tokens))));
    content.add(label(scene, 34, 69, `Team burns about ${burn}K a day. ${s.company.tokens < burn * 4 ? 'This is going to hurt.' : 'Plenty. For now.'}`, { font: F.body, tint: C.ink4 }));
    const rowH = 26;
    TOKEN_PLANS.forEach((p, i) => {
      const y = 88 + i * (rowH + 2);
      const cur = p.id === plan.id;
      content.add(panel(scene, 6, y, w - 12, rowH, cur ? 'chipLight' : 'paperDim', false));
      content.add(label(scene, 11, y + 3, p.name.toUpperCase(), { font: F.caps, tint: C.ink1 }));
      content.add(label(scene, 11, y + 13, p.blurb, { font: F.body, tint: C.ink3, maxWidth: w - 120 }));
      content.add(label(scene, w - 100, y + 3, `${p.tokens}K tokens`, { font: F.body, tint: C.violet1, origin: [1, 0] }));
      content.add(label(scene, w - 100, y + 13, p.monthly ? `${money(p.monthly)}/mo` : 'free', { font: F.body, tint: C.ink2, origin: [1, 0] }));
      const b = button(scene, w - 12 - 64 - 4 + 4, y + 4, 64, 18, cur ? 'CURRENT' : 'SWITCH', () => {
        const err = game.setTokenPlan(p.id);
        if (err) ctx.toast(err, 'bad');
        ctx.refresh();
        redraw();
      }, { kind: cur ? 'teal' : 'orange', disabled: cur });
      content.add(b);
    });
    const ty = 88 + TOKEN_PLANS.length * (rowH + 2) + 2;
    const price = game.topUpPrice();
    content.add(button(scene, 6, ty, w - 12, 18, `TOP UP +100K TOKENS  ${money(price)}`, () => {
      const err = game.buyTokens();
      if (err) {
        ctx.toast(err, 'bad');
        ctx.sfx('error');
        return;
      }
      ctx.cashPop(-price);
      ctx.refresh();
      redraw();
    }, { kind: 'violet', icon: 'token', disabled: s.company.cash < price }));
  }

  return m;
}
