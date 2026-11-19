import Phaser from 'phaser';
import { hasIcon } from '../art/sprites/icons';
import { app } from '../core/app';
import type { SfxId } from '../audio';
import { audio } from '../core/audio';
import { bakeBox as bakeBoxKey, bakePortrait } from '../core/bake';
import { C, F } from '../core/theme';
import { STAT_KEYS, type StatKey } from '../content/types';
import { STAT_WORD, STAT_WORD_7 } from './text';
import { VOICE_NAMES } from '../content/voiceNames';
import { PHASES, SCOPES } from '../sim/config';
import { cardById, type Card } from '../sim/cards';
import { cashScale } from '../sim/ctx';
import { unlocked } from '../sim/game';
import { money, shortMoney, signedMoney } from '../sim/format';
import { projectView } from '../sim/views';
import { Rng } from '../sim/rng';
import type { EventOutcome, Prompt } from '../sim/types';
import { bar, button, chip, choiceButton, iconImg, label, rect, type ButtonObj } from './kit';
import { channelRows, channelTextY } from './channelRows';
import { layoutOf, popupH } from './layout';
import { hash7 } from './dash';
import { Modal, NUMBER_KEYS } from './modal';
import { Speech } from './speech';
import { beat, scene as playScene } from './story';
import { dialogue } from './dialogue';
import { threadLines } from './threadLines';
import type { UiCtx } from './ctx';

export type Follow = { t: 'thread'; appId: number } | { t: 'ending' } | undefined;
type Done = (next?: Follow) => void;

/** Open the popup for whatever the game is waiting on. `done` fires when the player has dealt with it. */
export function openPrompt(ctx: UiCtx, p: Prompt, done: Done): void {
  switch (p.t) {
    case 'event':
      if (beat(ctx, 'event', () => eventPrompt(ctx, p, done))) return;
      eventPrompt(ctx, p, done);
      return;
    case 'card':
      cardPrompt(ctx, p, done);
      return;
    case 'ready':
      if (beat(ctx, 'channel', () => readyPrompt(ctx, done))) return;
      readyPrompt(ctx, done);
      return;
    case 'friday':
      fridayPrompt(ctx, done);
      return;
    case 'payday':
      if (beat(ctx, 'payday', () => paydayPrompt(ctx, p, done))) return;
      paydayPrompt(ctx, p, done);
      return;
    case 'funding':
      fundingPrompt(ctx, p, done);
      return;
    case 'awards':
      awardsPrompt(ctx, p, done);
      return;
    case 'ending':
      done({ t: 'ending' });
      return;
  }
}

/** Measure wrapped text height without leaving anything on screen. */
function textHeight(ctx: UiCtx, text: string, font: string, maxWidth: number): number {
  const t = label(ctx.scene, -2000, -2000, text, { font: font as typeof F.body, maxWidth });
  const h = t.height;
  t.destroy();
  return h;
}

/* -------------------------------------------------------------------- event */

/** The first sound of an event popup. Most are the plain alert; a few have a noise of their own. */
const EVENT_SOUND: Partial<Record<string, SfxId>> = {
  'mystery-pizza': 'pizza',
  'last-good-snack': 'pizza',
  'coffee-died': 'coffee',
  'mom-focus-group': 'phone',
  'the-bank-called': 'phone',
  'recruiter-spam': 'phone',
  'duck-listens': 'quack',
  'duck-applies': 'quack',
  'cat-typed': 'meow',
  'cat-moves-in': 'meow',
  'prod-gone': 'explosion',
  'intern-force-push': 'explosion',
  'citywide-blackout': 'explosion',
  'qa-gremlin-wakes': 'bug',
  'bug-bounty-hunter': 'bug',
  'fake-package': 'bug',
  'hooded-pull-request': 'bug',
  'hooded-visitor': 'bug',
  'all-nighter': 'keyboard_burst',
  'one-more-feature': 'keyboard_burst',
};

function eventPrompt(ctx: UiCtx, p: Extract<Prompt, { t: 'event' }>, done: Done): void {
  const scene = ctx.scene;
  const L = layoutOf(scene);
  const w = Math.min(L.W - 8, 336);
  const textW = w - 62;
  const bodyH = textHeight(ctx, p.body, F.read, textW);
  // a choice with a hint line is taller than one without, so stack them by their real heights
  const choiceHs = p.choices.map((c) => (c.hint ? 14 + (textHeight(ctx, c.hint, F.body, w - 24) || 8) + 4 : 17));
  const h = Math.min(L.H - 6, 30 + Math.max(40, bodyH + 14) + choiceHs.reduce((n, ch) => n + ch + 4, 0) + 10);
  const m = new Modal(scene, { w, h, title: p.title.toUpperCase(), style: 'paper' });
  ctx.sfx(EVENT_SOUND[p.eventId] ?? 'alert');
  // portrait
  const frame = rect(scene, 6, 24, 38, 40, C.ink0, 1);
  const bg = rect(scene, 7, 25, 36, 38, p.speaker === 'system' ? C.violet2 : C.sky, 1);
  const face = scene.add.image(9, 28, bakePortrait(scene, p.speaker)).setOrigin(0, 0).setScale(2);
  m.add(frame);
  m.add(bg);
  m.add(face);
  const who = p.speaker === 'system' ? 'SYSTEM' : (VOICE_NAMES[p.speaker] ?? p.speaker).toUpperCase();
  m.add(label(scene, 50, 21, who, { font: F.caps, tint: C.orange1 }));
  const body = label(scene, 50, 31, '', { font: F.read, tint: C.ink1, maxWidth: textW });
  m.add(body);
  const speech = new Speech(scene, body);
  void speech.say(p.body, p.speaker === 'system' ? undefined : p.line);
  const mouth = scene.time.addEvent({
    delay: 70,
    loop: true,
    callback: () => {
      face.y = 28 + (!speech.finished && speech.level > 0.55 ? -1 : 0);
    },
  });
  const choiceY = 30 + Math.max(40, bodyH + 14);
  const buttons: Phaser.GameObjects.Container[] = [];
  let chosen = false;
  const showChoices = () => {
    if (buttons.length || chosen) return;
    let y = choiceY;
    p.choices.forEach((c, i) => {
      const b = choiceButton(scene, 6, y, w - 12, c.label, c.hint, c.enabled, () => pick(i), 'cream');
      y += choiceHs[i]! + 4;
      m.add(b);
      buttons.push(b);
      if (!app.settings.reducedMotion) {
        b.setAlpha(0);
        scene.tweens.add({ targets: b, alpha: 1, duration: 140, delay: i * 70 });
      }
    });
  };
  const hit = scene.add.zone(0, 0, w, choiceY).setOrigin(0, 0).setInteractive();
  m.add(hit);
  hit.on('pointerup', () => {
    if (!speech.finished) speech.skip();
  });
  void speech.done.then(showChoices);
  scene.time.delayedCall(60, () => {
    if (speech.finished) showChoices();
  });
  const watch = scene.time.addEvent({
    delay: 100,
    loop: true,
    callback: () => {
      if (speech.finished) {
        showChoices();
        watch.remove();
      }
    },
  });

  const pick = (i: number) => {
    if (chosen) return;
    chosen = true;
    speech.stop();
    mouth.remove();
    watch.remove();
    const out = ctx.session.game.resolveEvent(i);
    ctx.sfx('confirm');
    for (const b of buttons) b.destroy();
    showOutcome(ctx, m, out, w, choiceY, p.speaker, () => {
      m.close();
      ctx.refresh();
      done();
    });
  };
  // desktop: number keys pick, space or enter skips the typing
  p.choices.forEach((c, i) => m.key(NUMBER_KEYS[i]!, () => buttons.length > 0 && c.enabled && pick(i)));
  const hurry = () => !speech.finished && speech.skip();
  m.key('SPACE', hurry);
  m.key('ENTER', hurry);
}

function showOutcome(ctx: UiCtx, m: Modal, out: EventOutcome | null, w: number, y: number, speaker: string, onContinue: () => void): void {
  const scene = ctx.scene;
  const res = label(scene, 8, y, '', { font: F.read, tint: C.ink1, maxWidth: w - 16 });
  m.add(res);
  const sp = new Speech(scene, res);
  const text = out?.result ?? 'Nothing happened. Somehow that is worse.';
  void sp.say(text, speaker === 'system' ? undefined : out?.line);
  const rh = textHeight(ctx, text, F.read, w - 16);
  let cy = y + rh + 6;
  const chips = out?.chips ?? [];
  let cx = 8;
  let good = 0;
  let bad = 0;
  chips.forEach((c, i) => {
    const ch = chip(scene, 0, 0, c.kind, c.text, c.good);
    if (cx + ch.w > w - 8) {
      cx = 8;
      cy += 15;
    }
    ch.c.setPosition(cx, cy);
    cx += ch.w + 4;
    m.add(ch.c);
    if (c.good) good++;
    else bad++;
    if (!app.settings.reducedMotion) {
      ch.c.setAlpha(0);
      scene.tweens.add({ targets: ch.c, alpha: 1, y: { from: cy + 4, to: cy }, duration: 160, delay: 200 + i * 110 });
    }
  });
  ctx.sfx(bad > good ? 'deny' : 'praise');
  if (bad > good) {
    ctx.room.slumpAll();
    ctx.shake(0.003);
  } else if (good > 0) ctx.room.cheerAll();
  const proceed = () => {
    sp.stop();
    onContinue();
  };
  const btn = button(scene, w - 78, Math.min(m.h - 24, cy + 20), 70, 18, 'CONTINUE', proceed, { kind: 'orange' });
  m.add(btn);
  const onKey = () => (sp.finished ? proceed() : sp.skip());
  m.key('SPACE', onKey);
  m.key('ENTER', onKey);
  const zone = scene.add.zone(0, 0, w, 40).setOrigin(0, 0);
  void zone;
}

/* --------------------------------------------------------------------- card */

function cardEffects(card: Card): { text: string; good: boolean }[] {
  const out: { text: string; good: boolean }[] = [];
  if (card.speed) out.push({ text: `SPEED ${card.speed >= 1 ? '+' : ''}${Math.round((card.speed - 1) * 100)}%`, good: card.speed >= 1 });
  for (const [k, v] of Object.entries(card.weight ?? {})) out.push({ text: `${STAT_WORD_7[k as StatKey]} x${v!.toFixed(1)}`, good: (v ?? 1) >= 1 });
  if (card.spaghetti) out.push({ text: card.spaghetti > 0 ? 'MORE SPAGHETTI' : 'LESS SPAGHETTI', good: card.spaghetti < 0 });
  if (card.tokens && card.tokens !== 1) out.push({ text: `TOKENS x${card.tokens}`, good: card.tokens < 1 });
  if (card.mood) out.push({ text: card.mood > 0 ? 'MORALE UP' : 'MORALE DOWN', good: card.mood > 0 });
  if (card.hype) out.push({ text: `HYPE +${card.hype}`, good: true });
  if (card.gamble) out.push({ text: 'RISKY', good: false });
  return out.slice(0, 4);
}

function cardPrompt(ctx: UiCtx, p: Extract<Prompt, { t: 'card' }>, done: Done): void {
  const scene = ctx.scene;
  const L = layoutOf(scene);
  const proj = ctx.session.s.project;
  const cards = p.options.map((id) => cardById(id)).filter((c): c is Card => !!c);
  const n = Math.max(1, cards.length);
  const w = Math.min(L.W - 6, n * 94 + 24);
  const cardW = Math.floor((w - 12 - (n - 1) * 4) / n);
  // a card is as tall as its longest content: name, blurb and effect lines never run into each other
  const textH = (text: string, font: typeof F.caps | typeof F.body, maxWidth: number): number => {
    const probe = label(scene, 0, 0, text, { font, maxWidth });
    const height = probe.height;
    probe.destroy();
    return height;
  };
  const cardNeed = cards.reduce(
    (most, card) => Math.max(most, 33 + textH(card.name.toUpperCase(), F.caps, cardW - 6) + 3 + textH(card.blurb, F.body, cardW - 8) + 4 + cardEffects(card).length * 9 + 4),
    0,
  );
  const h = Math.min(L.H - 6, Math.max(150, Math.ceil(cardNeed) + 36));
  const phaseName = PHASES[p.phase]?.label ?? '';
  const m = new Modal(scene, { w, h, title: `${phaseName.toUpperCase()}: PICK A MOVE`, style: 'paper' });
  ctx.sfx('open');
  if (proj) m.add(label(scene, w / 2, 20, proj.name, { font: F.body, tint: C.ink3, origin: [0.5, 0] }));
  const play = (t: Card | null) => {
    ctx.session.game.pickCard(t ? t.id : null);
    if (t) {
      ctx.toast(t.quip, 'info', t.icon);
      ctx.sfx('select');
      ctx.log('commit', hash7(), t.name);
    }
    m.close();
    ctx.refresh();
    done();
  };
  cards.forEach((card, i) => {
    const x = 6 + i * (cardW + 4);
    const c = scene.add.container(x, 30);
    const rare = card.rarity === 'rare';
    const face = scene.add.nineslice(0, 0, bakeBoxKey(scene, rare ? 'btnOrange' : 'btnCream'), undefined, cardW, h - 36, 4, 4, 4, 4).setOrigin(0, 0);
    const ink = rare ? C.white : C.ink1;
    const big = hasIcon(`card_${card.icon}`);
    const icon = big ? iconImg(scene, `card_${card.icon}`, Math.floor(cardW / 2) - 12, 5, 2) : iconImg(scene, card.icon, Math.floor(cardW / 2) - 12, 5, 3);
    const name = label(scene, cardW / 2, 33, card.name.toUpperCase(), { font: F.caps, tint: ink, maxWidth: cardW - 6, origin: [0.5, 0], align: 'center' });
    const blurb = label(scene, 4, 33 + name.height + 3, card.blurb, { font: F.body, tint: rare ? C.cream : C.ink3, maxWidth: cardW - 8 });
    c.add([face, icon, name, blurb]);
    let ey = h - 36 - 4;
    const effects = cardEffects(card);
    for (let k = effects.length - 1; k >= 0; k--) {
      const e = effects[k]!;
      ey -= 9;
      c.add(label(scene, cardW / 2, ey, e.text, { font: F.body, tint: e.good ? (rare ? C.mint : C.green1) : rare ? C.yellow : C.berry1, origin: [0.5, 0] }));
    }
    const zone = scene.add.zone(0, 0, cardW, h - 36).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => c.setY(28));
    zone.on('pointerout', () => c.setY(30));
    zone.on('pointerup', () => play(card));
    c.add(zone);
    m.add(c);
    if (!app.settings.reducedMotion) {
      c.setAlpha(0);
      c.y += 10;
      scene.tweens.add({ targets: c, alpha: 1, y: 30, duration: 200, delay: 80 + i * 90, ease: 'Back.easeOut' });
    }
  });
  const skip = button(scene, w - 52, 3, 46, 12, 'SKIP', () => play(null), { kind: 'plum', font: F.body });
  m.add(skip);
  cards.forEach((card, i) => m.key(NUMBER_KEYS[i]!, () => play(card)));
  ctx.room.say(ctx.session.s.staff[1]?.id ?? '', 'What should we focus on?');
}


/* -------------------------------------------------------------------- ready */

function readyPrompt(ctx: UiCtx, done: Done): void {
  const scene = ctx.scene;
  const L = layoutOf(scene);
  const game = ctx.session.game;
  const c = ctx.content;
  const p = ctx.session.s.project;
  if (!p) {
    done();
    return;
  }
  const wide = !L.portrait && L.W >= 360;
  const w = Math.min(L.W - 4, wide ? 392 : 246);
  // wide: room for eight rows of two lines where the screen has it; a phone on its side gets one line per row
  const h = popupH(L, wide ? 258 : 408);
  const m = new Modal(scene, { w, h, title: 'READY TO LAUNCH', style: 'paper' });
  ctx.sfx('fanfare_small');
  const view = projectView(c, p);
  const kind = c.kind(p.kind);
  const niche = c.niche(p.niche);
  const lw = wide ? 140 : w - 12;
  // product card
  const badges = [`kind_${p.kind}`, `niche_${p.niche}`].filter(hasIcon);
  badges.forEach((name, i) => m.add(iconImg(scene, name, lw - 13 * (badges.length - i), 19)));
  const nameW = lw - (badges.length ? 13 * badges.length + 4 : 0);
  m.add(label(scene, 6, 21, p.name, { font: F.caps, tint: C.orange1, maxWidth: nameW }));
  m.add(label(scene, 6, 31, `${kind.name} for ${niche.plural}`, { font: F.body, tint: C.ink3, maxWidth: lw }));
  m.add(label(scene, 6, 40, `"${p.tagline}"`, { font: F.body, tint: C.ink2, maxWidth: lw }));
  let sy = wide ? 66 : 62;
  const colors: Record<StatKey, number> = { vibes: C.pink, features: C.sky, polish: C.yellow, stability: C.mint, security: C.violet2 };
  for (const k of STAT_KEYS) {
    m.add(iconImg(scene, k, 6, sy - 1));
    m.add(label(scene, 17, sy, (wide ? STAT_WORD_7 : STAT_WORD)[k], { font: F.body, tint: C.ink3 }));
    m.add(bar(scene, wide ? 56 : 66, sy, lw - (wide ? 56 : 66) - 26, 5, colors[k], view.stats[k] / 100));
    m.add(label(scene, lw - 6, sy - 1, `${view.stats[k]}`, { font: F.body, tint: C.ink1, origin: [1, 0] }));
    sy += 9;
  }
  m.add(label(scene, 6, sy + 2, 'QUALITY', { font: F.caps, tint: C.ink1 }));
  m.add(label(scene, lw - 6, sy, `${view.quality}`, { font: F.head, tint: C.teal1, origin: [1, 0] }));
  sy += 14;
  m.add(label(scene, 6, sy, 'HYPE', { font: F.caps, tint: C.ink1 }));
  m.add(bar(scene, wide ? 56 : 66, sy + 1, lw - (wide ? 56 : 66) - 26, 5, C.pink, Math.min(1, p.hype / 100)));
  m.add(label(scene, lw - 6, sy, `${Math.round(p.hype)}`, { font: F.body, tint: C.ink1, origin: [1, 0] }));
  sy += 12;
  m.add(label(scene, 6, sy, `Scope: ${SCOPES[p.scope].label}`, { font: F.body, tint: C.ink3 }));
  if (p.fridayDeploy) m.add(label(scene, 6, sy + 9, 'FRIDAY DEPLOY. Bold.', { font: F.body, tint: C.berry1 }));

  // channels
  const cx = wide ? 152 : 6;
  const cw = wide ? w - cx - 6 : w - 12;
  let cy = wide ? 21 : sy + 22;
  m.add(label(scene, cx, cy, 'WHERE DO YOU POST IT?', { font: F.caps, tint: C.ink1 }));
  cy += 11;
  let selected = c.channels.find((ch) => unlocked(game, ch.unlock))?.id ?? c.channels[0]!.id;
  const rows: { id: string; btn: ButtonObj; ok: boolean }[] = [];
  const launchBtnRef: { b?: ButtonObj } = {};
  const costOf = (id: string) => Math.round(c.channel(id).cost * cashScale(game.ctx.s));
  const refreshLaunch = () => {
    const ch = c.channel(selected);
    launchBtnRef.b?.setText(`LAUNCH ON ${ch.where.toUpperCase()}`.slice(0, 26));
  };
  const { rowH, inline } = channelRows(h, cy, c.channels.length);
  for (const ch of c.channels) {
    const ok = unlocked(game, ch.unlock);
    const cost = costOf(ch.id);
    const choose = () => {
      if (!ok) return;
      selected = ch.id;
      rows.forEach((r) => r.btn.setKind(r.id === selected ? 'teal' : r.ok ? 'cream' : 'plum'));
      refreshLaunch();
      ctx.sfx('select');
    };
    m.key(NUMBER_KEYS[rows.length]!, choose);
    const b = button(scene, cx, cy, cw, rowH - 1, '', choose, { kind: ok ? (ch.id === selected ? 'teal' : 'cream') : 'plum' });
    b.setEnabled(true);
    m.add(b);
    rows.push({ id: ch.id, btn: b, ok });
    const dark = ok && ch.id !== selected;
    const art = hasIcon(`chan_${ch.id}`) && rowH >= 15;
    if (art) m.add(iconImg(scene, `chan_${ch.id}`, cx + 3, cy + Math.floor((rowH - 1 - 12) / 2)).setAlpha(ok ? 1 : 0.4));
    const tx = cx + (art ? 18 : 4);
    // the name and what it does sit in the middle of the row: stacked when the row is tall enough, side by side when it is not
    const ty = cy + channelTextY(rowH, inline);
    const t1 = label(scene, tx, ty, ch.where, { font: F.caps, tint: ok ? (dark ? C.ink1 : C.white) : C.ink4 });
    const sub = ok ? `hype +${ch.hype}${ch.roast > 0.5 ? '  spicy' : ''}` : ch.unlock.karma ? `needs ${ch.unlock.karma} karma` : `year ${ch.unlock.year ?? 2}`;
    const t2 = label(scene, inline ? tx + t1.width + 6 : tx, inline ? ty : ty + 9, sub, { font: F.body, tint: ok ? (dark ? C.ink3 : C.cream) : C.ink3 });
    m.add(t1);
    m.add(t2);
    // a locked channel shows a padlock, not a price: nobody can pay it yet
    if (ok) m.add(label(scene, cx + cw - 4, ty, cost > 0 ? shortMoney(cost) : 'FREE', { font: F.caps, tint: dark ? C.green1 : C.mint, origin: [1, 0] }));
    else m.add(iconImg(scene, 'lock', cx + cw - 15, cy + Math.floor((rowH - 1 - 10) / 2)));
    cy += rowH;
  }
  rows.forEach((r) => r.btn.setKind(r.id === selected ? 'teal' : r.ok ? 'cream' : 'plum'));
  const launch = button(scene, cx, h - 25, cw, 19, 'LAUNCH', () => doLaunch(), { kind: 'orange', icon: 'ship' });
  launchBtnRef.b = launch;
  m.add(launch);
  m.key('ENTER', () => doLaunch());
  refreshLaunch();

  const doLaunch = () => {
    const r = game.launch(selected);
    if (r.t === 'invalid') {
      ctx.toast(r.why, 'bad');
      ctx.sfx('error');
      return;
    }
    ctx.refresh();
    if (r.t === 'launched') {
      m.close();
      ctx.sfx('deploy_go');
      const toThread = () => done({ t: 'thread', appId: r.app.id });
      deployBeats(ctx, () => (r.incident ? incidentBeat(ctx, toThread) : toThread()));
      // the thread is made the moment the app ships: its voices load while the deploy jokes play
      void audio.preload(threadLines(ctx.content, r.app.thread));
      return;
    }
    m.close();
    done();
  };
}

/** A Friday deploy took production down. Short, loud, and Dave was right. */
function incidentBeat(ctx: UiCtx, onDone: () => void): void {
  ctx.sfx('alert');
  ctx.shake(0.012);
  ctx.banner('PROD IS DOWN', 'It was a Friday.', 'bad');
  ctx.log('warn', 'ERROR', 'prod is down. it was a friday.');
  playScene(ctx, ctx.content.story.friday.incident, () => {
    ctx.refresh();
    onDone();
  });
}

/** Two random deploy gags, then the countdown. */
function deployBeats(ctx: UiCtx, onDone: () => void): void {
  const steps = ctx.content.story.deploy;
  if (steps.length < 3) {
    onDone();
    return;
  }
  const rng = new Rng(Math.floor(Math.random() * 1e9));
  const pool = steps.slice(0, -1);
  const two = rng.shuffle(pool).slice(0, 2);
  dialogue(ctx, [...two, steps[steps.length - 1]!], onDone, { skippable: true, countdown: true });
}

/* ------------------------------------------------------------------- friday */

function fridayPrompt(ctx: UiCtx, done: Done): void {
  const scene = ctx.scene;
  const L = layoutOf(scene);
  const game = ctx.session.game;
  const story = ctx.content.story.friday;
  playScene(ctx, story.ask, () => {
    const w = Math.min(L.W - 8, 260);
    const h = 128;
    const m = new Modal(scene, { w, h, title: 'IT IS FRIDAY', style: 'paper' });
    ctx.sfx('alert');
    m.add(label(scene, w / 2, 24, 'The app is ready. The weekend is near.', { font: F.body, tint: C.ink2, origin: [0.5, 0] }));
    const pick = (c: 'yolo' | 'wait') => {
      game.fridayChoice(c);
      m.close();
      playScene(ctx, story[c], () => {
        ctx.refresh();
        done();
      });
    };
    m.key('ONE', () => pick('yolo'));
    m.key('TWO', () => pick('wait'));
    m.add(choiceButton(scene, 8, 38, w - 16, 'YOLO DEPLOY NOW', 'Faster. Riskier. Dave will not answer his phone.', true, () => pick('yolo'), 'berry'));
    m.add(choiceButton(scene, 8, 78, w - 16, 'WAIT FOR MONDAY', 'Safe. The team rests. The launch slips three days.', true, () => pick('wait'), 'teal'));
  });
}

/* ------------------------------------------------------------------- payday */

function paydayPrompt(ctx: UiCtx, p: Extract<Prompt, { t: 'payday' }>, done: Done): void {
  const scene = ctx.scene;
  const L = layoutOf(scene);
  const r = p.report;
  const lines = [...r.lines];
  const w = Math.min(L.W - 6, 300);
  const rowH = 10;
  const warnH = r.warnings.length * 10;
  const h = popupH(L, 56 + (lines.length + 3) * rowH + warnH + 26);
  const m = new Modal(scene, { w, h, title: 'PAYDAY', style: 'paper', dim: 0.8 });
  ctx.sfx('payday');
  m.add(label(scene, w / 2, 20, r.headline, { font: F.body, tint: C.ink3, origin: [0.5, 0], maxWidth: w - 16, align: 'center' }));
  let y = 36 + (textHeight(ctx, r.headline, F.body, w - 16) > 9 ? 8 : 0);
  const row = (name: string, amount: number, delay: number, bold = false) => {
    const t = label(scene, 10, y, name, { font: bold ? F.caps : F.body, tint: C.ink1 });
    const a = label(scene, w - 10, y, signedMoney(amount), { font: bold ? F.caps : F.body, tint: amount >= 0 ? C.green1 : C.berry1, origin: [1, 0] });
    m.add(t);
    m.add(a);
    if (!app.settings.reducedMotion) {
      t.setAlpha(0);
      a.setAlpha(0);
      scene.tweens.add({ targets: [t, a], alpha: 1, delay, duration: 120 });
      scene.time.delayedCall(delay, () => ctx.sfx(amount >= 0 ? 'coin' : 'type'));
    }
    y += rowH;
  };
  let d = 120;
  row('Income this month', r.income, d);
  d += 110;
  for (const l of lines) {
    row(l.label, l.amount, d);
    d += 110;
  }
  y += 3;
  rect(scene, 8, y, w - 16, 1, C.ink3, 1);
  m.add(rect(scene, 8, y, w - 16, 1, C.ink3, 1));
  y += 5;
  row('TOTAL', r.total, d + 80, true);
  const cash = label(scene, w - 10, y + 2, `Cash: ${money(r.cashAfter)}`, { font: F.caps, tint: r.cashAfter < 5000 ? C.berry1 : C.ink1, origin: [1, 0] });
  m.add(cash);
  y += 16;
  for (const wn of r.warnings) {
    m.add(label(scene, 10, y, `! ${wn}`, { font: F.body, tint: C.berry1, maxWidth: w - 20 }));
    y += 10;
  }
  const onward = () => {
    ctx.session.game.ackPayday();
    m.close();
    ctx.session.save();
    ctx.refresh();
    done();
  };
  m.add(button(scene, w / 2 - 40, h - 24, 80, 18, 'ONWARD', onward, { kind: 'orange' }));
  m.key('ENTER', onward);
  m.key('SPACE', onward);
}

/* ------------------------------------------------------------------ funding */

function fundingPrompt(ctx: UiCtx, p: Extract<Prompt, { t: 'funding' }>, done: Done): void {
  const scene = ctx.scene;
  const L = layoutOf(scene);
  const game = ctx.session.game;
  const story = ctx.content.story.funding;
  playScene(ctx, p.passed ? story.pass : story.fail, () => {
    const w = Math.min(L.W - 8, 300);
    if (!p.passed) {
      const m = new Modal(scene, { w, h: 96, title: `YEAR ${p.year} FUNDING`, style: 'paper' });
      m.add(label(scene, w / 2, 24, `Valuation ${shortMoney(p.valuation)}. They wanted ${shortMoney(p.target)}.`, { font: F.body, tint: C.berry1, origin: [0.5, 0], maxWidth: w - 16, align: 'center' }));
      m.add(label(scene, w / 2, 44, game.takeFunding(null), { font: F.body, tint: C.ink2, origin: [0.5, 0], maxWidth: w - 20, align: 'center' }));
      const okFine = () => {
        m.close();
        ctx.refresh();
        done();
      };
      m.add(button(scene, w / 2 - 40, 72, 80, 18, 'OK FINE', okFine, { kind: 'plum' }));
      m.key('ENTER', okFine);
      m.key('SPACE', okFine);
      return;
    }
    const offers = game.fundingChoices();
    const h = 40 + offers.length * 40 + 8;
    const m = new Modal(scene, { w, h, title: `YEAR ${p.year} FUNDING`, style: 'paper' });
    m.add(label(scene, w / 2, 21, `Valuation ${shortMoney(p.valuation)}. The money is interested.`, { font: F.body, tint: C.teal1, origin: [0.5, 0] }));
    offers.forEach((o, i) => {
      const kind = o.id === 'vc' ? 'orange' : o.id === 'angel' ? 'teal' : 'cream';
      const take = () => {
        const msg = game.takeFunding(o.id);
        ctx.cashPop(o.cash);
        ctx.sfx(o.cash > 0 ? 'cash_register' : 'praise');
        m.close();
        ctx.refresh();
        ctx.toast(msg, o.cash > 0 ? 'good' : 'info');
        done();
      };
      m.key(NUMBER_KEYS[i]!, take);
      m.add(choiceButton(scene, 8, 34 + i * 40, w - 16, `${o.label.toUpperCase()}  ${o.cash > 0 ? `+${shortMoney(o.cash)}` : ''}`, o.blurb, true, take, kind));
    });
  });
}

/* ------------------------------------------------------------------- awards */

function awardsPrompt(ctx: UiCtx, p: Extract<Prompt, { t: 'awards' }>, done: Done): void {
  const scene = ctx.scene;
  const L = layoutOf(scene);
  const game = ctx.session.game;
  audio.music('awards');
  const steps = ctx.content.story.yearEnd[String(p.year)] ?? [];
  playScene(ctx, steps, () => {
    const won = game.awardsFor(p.year);
    const w = Math.min(L.W - 8, 300);
    const rows = won.filter((x) => x.app);
    const h = popupH(L, 54 + Math.max(1, rows.length) * 26 + 24);
    const m = new Modal(scene, { w, h, title: `THE VIBEY AWARDS, YEAR ${p.year}`, style: 'plum' });
    ctx.sfx('award_win');
    if (rows.length === 0) {
      m.add(label(scene, w / 2, 30, 'No apps this year. The trophy goes to the founder\nfor Best Hair. A small, quiet victory.', { font: F.body, tint: C.cream, origin: [0.5, 0], align: 'center', maxWidth: w - 20 }));
    }
    rows.forEach((r, i) => {
      const y = 24 + i * 26;
      m.add(iconImg(scene, r.id === 'worst' ? 'awardHelp' : r.id === 'cash' ? 'awardGold' : r.id === 'crowd' ? 'awardWholesome' : 'awardSilver', 8, y + 4, 2));
      m.add(label(scene, 32, y + 2, r.title.toUpperCase(), { font: F.caps, tint: C.yellow }));
      m.add(label(scene, 32, y + 12, r.app!.name, { font: F.body, tint: C.cream, maxWidth: w - 110 }));
      m.add(label(scene, w - 8, y + 6, r.prize, { font: F.caps, tint: C.mint, origin: [1, 0] }));
    });
    const thanks = () => {
      game.ackAwards();
      m.close();
      audio.music('office');
      ctx.refresh();
      done();
    };
    m.add(button(scene, w / 2 - 44, h - 24, 88, 18, 'GREAT, THANKS', thanks, { kind: 'orange' }));
    m.key('ENTER', thanks);
    m.key('SPACE', thanks);
  });
}
