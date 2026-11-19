import { SKILL_KEYS, type Effect } from '../content/types';
import { PHASES, phaseAt } from './config';
import { addCash, addKarma, addSpaghetti, bump, deskCount, setFlag, sound, toast, yearMult, type Ctx } from './ctx';
import { clamp, money } from './format';
import { gainXp, makeCandidate, staffFromCandidate } from './staff';
import type { Chip, Staff } from './types';

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export function removeStaff(ctx: Ctx, s: Staff, why: string): void {
  const i = ctx.s.staff.indexOf(s);
  if (i < 0 || s.isFounder) return;
  ctx.s.staff.splice(i, 1);
  bump(ctx, why === 'fired' ? 'fires' : 'quits');
  ctx.out.push({ t: 'quit', staffId: s.id, name: s.name, why });
}

/** Adds a new person to the team if there is a desk. */
export function hireArchetype(ctx: Ctx, archetypeId: string, free = false): Staff | null {
  if (ctx.s.staff.length >= deskCount(ctx.s)) {
    toast(ctx, 'No free desk. Somebody almost joined.', 'bad');
    return null;
  }
  const year = 1 + Math.floor(ctx.s.day / 336);
  const cand = makeCandidate(ctx.rng, ctx.c, ctx.s, archetypeId, year, ctx.s.company.officeTier);
  const staff = staffFromCandidate(cand, ctx.s.day);
  if (free) staff.mood = 85;
  ctx.s.staff.push(staff);
  bump(ctx, 'hires');
  ctx.out.push({ t: 'toast', text: `${staff.name} joined as ${ctx.c.archetype(archetypeId).role}.`, tone: 'good', staffId: staff.id });
  sound(ctx, 'hire');
  return staff;
}

function pickTargets(ctx: Ctx, who: 'all' | 'random' | undefined): Staff[] {
  if (ctx.s.staff.length === 0) return [];
  if (who === 'random') return [ctx.rng.pick(ctx.s.staff)];
  return ctx.s.staff;
}

/**
 * Runs effects and describes them as chips for the result card. Money is in
 * year 1 dollars and grows each year. Bad things hurt more on hard modes.
 */
export function applyEffects(ctx: Ctx, effects: readonly Effect[], why: string): Chip[] {
  const chips: Chip[] = [];
  for (const e of effects) applyOne(ctx, e, why, chips);
  return chips;
}

function applyOne(ctx: Ctx, e: Effect, why: string, chips: Chip[]): void {
  const s = ctx.s;
  const p = s.project;
  switch (e.t) {
    case 'cash': {
      const n = Math.round(e.n * yearMult(s) * (e.n < 0 ? ctx.bad : 1));
      addCash(ctx, n, why);
      chips.push({ kind: 'cash', text: `${n >= 0 ? '+' : '-'}${money(Math.abs(n))}`, good: n >= 0 });
      break;
    }
    case 'tokens': {
      s.company.tokens = Math.max(0, s.company.tokens + e.n);
      chips.push({ kind: 'tokens', text: `${sign(e.n)}k tokens`, good: e.n >= 0 });
      break;
    }
    case 'karma': {
      addKarma(ctx, e.n);
      chips.push({ kind: 'karma', text: `${sign(e.n)} karma`, good: e.n >= 0 });
      break;
    }
    case 'spaghetti': {
      const n = Math.round(e.n * (e.n > 0 ? ctx.bad : 1));
      addSpaghetti(ctx, n);
      chips.push({ kind: 'spaghetti', text: `${sign(n)} spaghetti`, good: n <= 0 });
      break;
    }
    case 'mood': {
      const n = Math.round(e.n * (e.n < 0 ? ctx.bad : 1));
      for (const m of pickTargets(ctx, e.who)) m.mood = clamp(m.mood + n, 0, 100);
      chips.push({ kind: 'mood', text: `${sign(n)} mood${e.who === 'random' ? ' (one person)' : ''}`, good: n >= 0 });
      break;
    }
    case 'stat': {
      if (p) p.stats[e.stat] = clamp(p.stats[e.stat] + e.n, 0, 100);
      chips.push({ kind: 'stat', text: `${sign(e.n)} ${e.stat}`, good: e.n >= 0 });
      break;
    }
    case 'progress': {
      if (p) {
        const phase = PHASES[phaseAt(p.progress)];
        const span = phase.to - phase.from;
        p.progress = clamp(p.progress + (e.n / 100) * span, 0, 99.5);
      }
      chips.push({ kind: 'progress', text: `${sign(e.n)}% progress`, good: e.n >= 0 });
      break;
    }
    case 'hype': {
      if (p) p.hype = clamp(p.hype + e.n, 0, 100);
      else s.counters.hype_bank = clamp((s.counters.hype_bank ?? 0) + e.n, 0, 40);
      chips.push({ kind: 'hype', text: `${sign(e.n)} hype`, good: e.n >= 0 });
      break;
    }
    case 'delay': {
      if (p) {
        if (e.days > 0) {
          p.stalledUntil = Math.max(p.stalledUntil, s.day) + e.days;
          p.delayed += e.days;
        } else {
          const perDay = (p.workTotal > 0 ? 100 / (p.workTotal / Math.max(1, ctx.s.staff.length)) : 1) * 0.8;
          p.progress = clamp(p.progress + perDay * -e.days, 0, 99.5);
        }
      }
      chips.push({ kind: 'delay', text: e.days > 0 ? `${e.days} days lost` : `${-e.days} days saved`, good: e.days < 0 });
      break;
    }
    case 'fire': {
      const pool = s.staff.filter((m) => !m.isFounder);
      if (pool.length === 0) break;
      let who: Staff;
      if (e.who === 'worst') who = pool.slice().sort((a, b) => sum(a) - sum(b))[0]!;
      else if (e.who === 'best') who = pool.slice().sort((a, b) => sum(b) - sum(a))[0]!;
      else who = ctx.rng.pick(pool);
      removeStaff(ctx, who, 'quit');
      chips.push({ kind: 'fire', text: `${who.name} leaves`, good: false });
      break;
    }
    case 'hire': {
      const h = hireArchetype(ctx, e.archetype, true);
      if (h) chips.push({ kind: 'hire', text: `${h.name} joins`, good: true });
      else chips.push({ kind: 'hire', text: 'no free desk', good: false });
      break;
    }
    case 'skill': {
      const n = Math.min(5, e.n);
      for (const m of pickTargets(ctx, e.who)) m.skills[e.skill] = clamp(m.skills[e.skill] + n, 1, 99);
      chips.push({ kind: 'skill', text: `${sign(n)} ${e.skill}${e.who === 'random' ? ' (one person)' : ''}`, good: n >= 0 });
      break;
    }
    case 'xp': {
      for (const m of pickTargets(ctx, e.who)) {
        if (gainXp(m, e.n, ctx.rng)) ctx.out.push({ t: 'levelUp', staffId: m.id, level: m.level });
      }
      chips.push({ kind: 'xp', text: `${sign(e.n)} xp`, good: e.n >= 0 });
      break;
    }
    case 'flag': {
      setFlag(ctx, e.id, e.value ?? true);
      break;
    }
    case 'counter': {
      bump(ctx, e.id, e.n);
      break;
    }
    case 'chance': {
      const win = ctx.rng.chance(e.p);
      for (const sub of win ? e.yes : (e.no ?? [])) applyOne(ctx, sub, why, chips);
      break;
    }
  }
}

const sum = (m: Staff) => SKILL_KEYS.reduce((n, k) => n + m.skills[k], 0);
