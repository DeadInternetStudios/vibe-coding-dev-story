import { hasIcon } from '../../art/sprites/icons';
import { bakeIcon, bakePerson } from '../../core/bake';
import { C, F } from '../../core/theme';
import { STAT_KEYS, type StatKey } from '../../content/types';
import { SCOPES, type Scope } from '../../sim/config';
import { unlocked } from '../../sim/game';
import { nicheFit, noveltyOf } from '../../sim/launch';
import { productName } from '../../sim/names';
import { Rng } from '../../sim/rng';
import { qualityOf } from '../../sim/views';
import { bar, button, hoverFrame, iconImg, label, panel, rect } from '../kit';
import { layoutOf, popupH } from '../layout';
import { Modal } from '../modal';
import { beat } from '../story';
import type { UiCtx } from '../ctx';

const COLORS: Record<StatKey, number> = { vibes: C.pink, features: C.sky, polish: C.yellow, stability: C.mint, security: C.violet2 };

function lockText(u: { year?: number; karma?: number }): string {
  if (u.karma) return `needs ${u.karma} karma`;
  if (u.year) return `unlocks in year ${u.year}`;
  return 'locked';
}

/** Start a project: pick a kind, a niche, a tool, a scope and a team, see the forecast, press go. */
export function openProject(ctx: UiCtx, onClose: () => void): Modal {
  const scene = ctx.scene;
  const L = layoutOf(scene);
  const game = ctx.session.game;
  const c = ctx.content;
  const s = ctx.session.s;
  const wide = !L.portrait && L.W >= 380;
  const w = Math.min(L.W - 4, wide ? 410 : 246);
  const h = popupH(L, wide ? 246 : 372);
  const m = new Modal(scene, { w, h, title: 'NEW PROJECT', style: 'paper', closable: true, hold: ctx.hold, onClose });
  beat(ctx, 'idea');

  const ownedTools = c.tools.filter((t) => s.company.tools.includes(t.id));
  const st = {
    kind: Math.max(0, c.kinds.findIndex((k) => unlocked(game, k.unlock))),
    niche: 0,
    tool: Math.max(0, ownedTools.findIndex((t) => t.id === s.company.activeTool)),
    scope: 'mvp' as Scope,
    team: new Set(s.staff.map((x) => x.id)),
    name: '',
    nameSeed: Math.floor(Math.random() * 1e9),
  };
  const rngName = () => productName(new Rng(st.nameSeed), c.kinds[st.kind]!, c.niches[st.niche]!, s.shipped.map((a) => a.name));

  const lw = wide ? 196 : w - 12;
  const rx = wide ? lw + 14 : 6;
  const rw = wide ? w - rx - 6 : w - 12;

  // ------------------------------------------------------------ cyclers
  const cycler = (y: number, title: string, text: () => string, sub: () => string, subTint: () => number, step: (d: number) => void, icon: () => string) => {
    m.add(label(scene, 6, y, title, { font: F.caps, tint: C.ink3 }));
    m.add(button(scene, 6, y + 9, 13, 15, '<', () => step(-1), { kind: 'plum' }));
    m.add(button(scene, lw - 7, y + 9, 13, 15, '>', () => step(1), { kind: 'plum' }));
    const face = panel(scene, 21, y + 9, lw - 30, 15, 'paperDim', false);
    m.add(face);
    // a 12 x 12 picture sits at the left edge of the face, the words center in what is left
    const pic = scene.add.image(24, y + 10, bakeIcon(scene, 'lock')).setOrigin(0, 0);
    m.add(pic);
    const t = label(scene, 21 + 14 + (lw - 30 - 14) / 2, y + 12, '', { font: F.caps, tint: C.ink1, origin: [0.5, 0] });
    m.add(t);
    const sb = label(scene, 21, y + 26, '', { font: F.body, tint: C.ink3, maxWidth: lw - 16 });
    m.add(sb);
    return {
      paint: () => {
        t.setText(text());
        sb.setText(sub());
        sb.setTint(subTint());
        const name = icon();
        const big = hasIcon(name) && name.includes('_');
        pic.setTexture(bakeIcon(scene, hasIcon(name) ? name : 'lock'));
        pic.setPosition(big ? 24 : 26, y + (big ? 10 : 12));
      },
    };
  };

  const wrap = (i: number, n: number) => ((i % n) + n) % n;

  const kindRow = cycler(
    20,
    'WHAT',
    () => {
      const k = c.kinds[st.kind]!;
      return unlocked(game, k.unlock) ? k.name.toUpperCase() : '??? LOCKED';
    },
    () => {
      const k = c.kinds[st.kind]!;
      return unlocked(game, k.unlock) ? `${k.blurb}  Pays ${'$'.repeat(Math.max(1, Math.round(k.money / 2)))}` : lockText(k.unlock);
    },
    () => (unlocked(game, c.kinds[st.kind]!.unlock) ? C.ink3 : C.berry1),
    (d) => {
      st.kind = wrap(st.kind + d, c.kinds.length);
      st.nameSeed = Math.floor(Math.random() * 1e9);
      repaint();
    },
    () => (unlocked(game, c.kinds[st.kind]!.unlock) ? `kind_${c.kinds[st.kind]!.id}` : 'lock'),
  );
  const nicheRow = cycler(
    63,
    'FOR WHOM',
    () => {
      const n = c.niches[st.niche]!;
      return unlocked(game, n.unlock) ? n.plural.toUpperCase() : '??? LOCKED';
    },
    () => {
      const n = c.niches[st.niche]!;
      if (!unlocked(game, n.unlock)) return lockText(n.unlock);
      const k = c.kinds[st.kind]!;
      const fit = nicheFit(game.ctx, k.id, n.id);
      const nov = noveltyOf(s, k.id, n.id);
      const bits = [fit > 1 ? 'They LOVE this.' : fit < 1 ? 'They will HATE this.' : 'Mild interest.'];
      if (nov < 0.8) bits.push('Reddit is tired of it.');
      return bits.join(' ');
    },
    () => {
      const n = c.niches[st.niche]!;
      if (!unlocked(game, n.unlock)) return C.berry1;
      const fit = nicheFit(game.ctx, c.kinds[st.kind]!.id, n.id);
      return fit > 1 ? C.green1 : fit < 1 ? C.berry1 : C.ink3;
    },
    (d) => {
      st.niche = wrap(st.niche + d, c.niches.length);
      st.nameSeed = Math.floor(Math.random() * 1e9);
      repaint();
    },
    () => (unlocked(game, c.niches[st.niche]!.unlock) ? `niche_${c.niches[st.niche]!.id}` : 'lock'),
  );
  const toolRow = cycler(
    106,
    'WITH WHAT',
    () => ownedTools[st.tool]?.name.toUpperCase() ?? 'NO TOOL',
    () => {
      const t = ownedTools[st.tool];
      if (!t) return '';
      return `speed x${t.speed}  bugs x${t.bugs}  ${t.tokens}K tokens/day each`;
    },
    () => C.ink3,
    (d) => {
      st.tool = wrap(st.tool + d, Math.max(1, ownedTools.length));
      repaint();
    },
    () => `tool_${ownedTools[st.tool]?.id ?? ''}`,
  );

  // ------------------------------------------------------------ scope
  m.add(label(scene, 6, 150, 'HOW BIG', { font: F.caps, tint: C.ink3 }));
  const scopes = Object.keys(SCOPES) as Scope[];
  const sw = Math.floor((lw - 4) / 3);
  const scopeBtns = scopes.map((sc, i) => {
    const ok = unlocked(game, SCOPES[sc].unlock);
    const b = button(scene, 6 + i * (sw + 2), 159, sw, 15, ok ? SCOPES[sc].label.replace('Weekend ', '').replace('The Full Thing', 'FULL').toUpperCase() : 'LOCKED', () => {
      if (!ok) {
        ctx.toast(`Full scope needs ${SCOPES[sc].unlock.karma} karma.`, 'bad');
        return;
      }
      st.scope = sc;
      repaint();
    }, { kind: 'plum', font: F.body });
    m.add(b);
    return { sc, b, ok };
  });
  const scopeHint = label(scene, 6, 176, '', { font: F.body, tint: C.ink3, maxWidth: lw });
  m.add(scopeHint);

  // ------------------------------------------------------------ team
  m.add(label(scene, 6, 190, 'WHO BUILDS (tap to toggle)', { font: F.caps, tint: C.ink3 }));
  const faces: { id: string; img: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Image }[] = [];
  const per = Math.min(s.staff.length, Math.floor((lw - 4) / 19));
  s.staff.forEach((mem, i) => {
    const col = i % Math.max(1, per);
    const row = Math.floor(i / Math.max(1, per));
    const fx = 6 + col * 19;
    const fy = 200 + row * 24;
    const ring = rect(scene, fx, fy, 18, 22, C.ink0, 1);
    const bg = rect(scene, fx + 1, fy + 1, 16, 20, C.sky, 1);
    const img = scene.add.image(fx + 9, fy + 21, bakePerson(scene, mem.look, 'stand', 'normal')).setOrigin(0.5, 1).setScale(1);
    m.add(ring);
    m.add(bg);
    m.add(img);
    const z = scene.add.zone(fx, fy, 18, 22).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => {
      if (st.team.has(mem.id)) st.team.delete(mem.id);
      else st.team.add(mem.id);
      ctx.sfx('toggle');
      repaint();
    });
    m.add(z);
    m.add(hoverFrame(scene, z, fx, fy, 18, 22));
    faces.push({ id: mem.id, img, ring: ring as unknown as Phaser.GameObjects.Image });
    void bg;
  });

  // ------------------------------------------------------------ forecast
  const fx = rx;
  const fy = wide ? 21 : 246;
  m.add(label(scene, fx, fy, 'FORECAST', { font: F.caps, tint: C.ink3 }));
  const qLabel = label(scene, fx + rw - 2, fy - 2, '', { font: F.title, tint: C.teal1, origin: [1, 0] });
  m.add(qLabel);
  const statBars = new Map<StatKey, ReturnType<typeof bar>>();
  STAT_KEYS.forEach((k, i) => {
    const y = fy + 14 + i * 11;
    m.add(iconImg(scene, k, fx, y - 1));
    m.add(label(scene, fx + 11, y, k.toUpperCase().slice(0, 4), { font: F.body, tint: C.ink3 }));
    const b = bar(scene, fx + 38, y, rw - 60, 6, COLORS[k], 0);
    m.add(b);
    statBars.set(k, b);
  });
  const timeLabel = label(scene, fx, fy + 74, '', { font: F.caps, tint: C.ink1 });
  m.add(timeLabel);
  const noteLabel = label(scene, fx, fy + 86, '', { font: F.body, tint: C.ink3, maxWidth: rw });
  m.add(noteLabel);
  const nameLabel = label(scene, fx, fy + 112, '', { font: F.caps, tint: C.orange1, maxWidth: rw - 22 });
  m.add(nameLabel);
  m.add(button(scene, fx + rw - 19, fy + 108, 19, 14, '', () => {
    st.nameSeed = Math.floor(Math.random() * 1e9);
    ctx.sfx('select');
    repaint();
  }, { kind: 'violet', icon: 'dice' }));
  const startBtn = button(scene, fx, h - 26, rw, 20, 'START BUILDING', () => go(), { kind: 'orange', icon: 'ship' });
  m.add(startBtn);

  const plan = () => ({ kind: c.kinds[st.kind]!.id, niche: c.niches[st.niche]!.id, tool: ownedTools[st.tool]?.id ?? s.company.activeTool, scope: st.scope, team: [...st.team], name: st.name });

  function repaint(): void {
    kindRow.paint();
    nicheRow.paint();
    toolRow.paint();
    for (const sb of scopeBtns) sb.b.setKind(sb.sc === st.scope ? 'teal' : 'plum');
    scopeHint.setText(`${SCOPES[st.scope].blurb}  (${SCOPES[st.scope].weeks}x time, ${SCOPES[st.scope].money}x money)`);
    faces.forEach((f) => {
      const on = st.team.has(f.id);
      f.img.setAlpha(on ? 1 : 0.4);
      (f.ring as unknown as Phaser.GameObjects.Image).setTint(on ? C.orange2 : C.ink0);
    });
    st.name = rngName();
    nameLabel.setText(st.name);
    const k = c.kinds[st.kind]!;
    const n = c.niches[st.niche]!;
    const lockedKind = !unlocked(game, k.unlock);
    const lockedNiche = !unlocked(game, n.unlock);
    const p = plan();
    const fc = game.forecast({ kind: p.kind, scope: p.scope, tool: p.tool, team: p.team });
    for (const key of STAT_KEYS) statBars.get(key)?.set(Math.min(1, fc.stats[key] / 100), true);
    const q = Math.round(qualityOf(c, k.id, fc.stats));
    qLabel.setText(`Q${q}`);
    const weeks = fc.days / 7;
    timeLabel.setText(`About ${weeks < 1.2 ? `${fc.days} days` : `${weeks.toFixed(1)} weeks`} of work`);
    const err = lockedKind ? 'That kind of app is still locked.' : lockedNiche ? 'That audience is still locked.' : game.canStart(p);
    const team = s.staff.filter((x) => st.team.has(x.id)).length;
    noteLabel.setText(err ?? (team === 0 ? 'Nobody is building. Pick someone.' : `${team} building, ${s.staff.length - team} supporting.`));
    noteLabel.setTint(err ? C.berry1 : C.ink3);
    startBtn.setEnabled(!err && team > 0);
  }

  function go(): void {
    const p = plan();
    const err = game.canStart(p);
    if (err) {
      ctx.toast(err, 'bad');
      ctx.sfx('error');
      return;
    }
    game.startProject(p);
    ctx.sfx('confirm');
    m.close();
    ctx.refresh();
    ctx.banner('NEW PROJECT', p.name, 'info');
  }

  repaint();
  return m;
}
