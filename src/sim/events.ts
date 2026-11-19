import type { EventCtx, GameEvent } from '../content/types';
import { EVENT_CHANCE, EVENT_COOLDOWN_DAYS } from './config';
import { bump, type Ctx } from './ctx';
import { applyEffects } from './effects';
import type { EventOutcome } from './types';
import { companyView, projectView } from './views';

export function eventCtx(ctx: Ctx): EventCtx {
  return {
    company: companyView(ctx.s),
    project: ctx.s.project ? projectView(ctx.c, ctx.s.project) : null,
    rand: () => ctx.rng.next(),
  };
}

function ok(fn: (c: EventCtx) => boolean, ec: EventCtx): boolean {
  try {
    return fn(ec);
  } catch {
    return false;
  }
}

export function eligibleEvents(ctx: Ctx, stage: GameEvent['stage']): GameEvent[] {
  const ec = eventCtx(ctx);
  const day = ctx.s.day;
  const pool = ctx.c.events.filter((e) => e.stage === stage && ok(e.when, ec));
  const fresh = pool.filter((e) => ctx.s.seenEvents[e.id] === undefined || day - ctx.s.seenEvents[e.id]! >= EVENT_COOLDOWN_DAYS);
  return fresh.length ? fresh : pool.filter((e) => ctx.s.seenEvents[e.id] === undefined || day - ctx.s.seenEvents[e.id]! >= 30);
}

/** Puts an event on the prompt queue. Returns false when none was eligible. */
export function fireEvent(ctx: Ctx, stage: GameEvent['stage']): boolean {
  const pool = eligibleEvents(ctx, stage);
  const ev = ctx.rng.weighted(pool, (e) => e.weight);
  if (!ev) return false;
  const ec = eventCtx(ctx);
  ctx.s.seenEvents[ev.id] = ctx.s.day;
  bump(ctx, 'events_seen');
  ctx.s.pending.push({
    t: 'event',
    eventId: ev.id,
    title: ev.title,
    body: ev.body,
    speaker: ev.speaker,
    line: ev.line,
    choices: ev.choices.map((ch) => ({ label: ch.label, hint: ch.hint, enabled: ch.requires ? ok(ch.requires, ec) : true })),
  });
  return true;
}

/** Chance roll for the day. */
export function rollDaily(ctx: Ctx, stage: GameEvent['stage'], mult = 1): boolean {
  if (!ctx.rng.chance(EVENT_CHANCE[stage] * mult)) return false;
  return fireEvent(ctx, stage);
}

/** The player picked a choice. Applies it and pops the prompt. */
export function resolveEvent(ctx: Ctx, choiceIndex: number): EventOutcome | null {
  const top = ctx.s.pending[0];
  if (top?.t !== 'event') return null;
  const ev = ctx.c.event(top.eventId);
  if (!ev) {
    ctx.s.pending.shift();
    return null;
  }
  const choice = ev.choices[choiceIndex];
  if (!choice) return null;
  ctx.s.pending.shift();
  const chips = applyEffects(ctx, choice.effects, ev.title);
  return { result: choice.result, line: choice.line, chips };
}
