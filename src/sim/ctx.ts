import type { Content } from './content';
import { OFFICE_TIERS, YEAR_MULT } from './config';
import { yearOf } from './format';
import type { Rng } from './rng';
import type { GameState, Notice, Staff, Tone } from './types';

/** Everything a sim function needs. Built once per game and reused. */
export interface Ctx {
  s: GameState;
  c: Content;
  rng: Rng;
  /** Notices raised since the UI last drained them. */
  out: Notice[];
  /** Multiplier on bad things, from the difficulty. */
  bad: number;
  /** Multiplier on revenue, from the difficulty. */
  revenue: number;
}

export const yearMult = (s: GameState) => YEAR_MULT[Math.min(2, yearOf(s.day) - 1)]!;

/**
 * How big a dollar amount in content should feel. Follows the year, and the size of the
 * company, so a big event still stings when the bank account has grown.
 */
export function cashScale(s: GameState): number {
  const payroll = s.staff.reduce((n, m) => n + (m.isFounder ? 0 : m.salary), 0);
  const burn = payroll + OFFICE_TIERS[s.company.officeTier]!.rent;
  return Math.max(yearMult(s), burn / 9000);
}

export const deskCount = (s: GameState) => OFFICE_TIERS[s.company.officeTier]!.desks;

export function toast(ctx: Ctx, text: string, tone: Tone = 'info', staffId?: string): void {
  ctx.out.push({ t: 'toast', text, tone, staffId });
}

export function sound(ctx: Ctx, id: string): void {
  ctx.out.push({ t: 'sound', id });
}

/** Moves money and leaves a line for the next payday report. */
export function addCash(ctx: Ctx, amount: number, why: string): void {
  const n = Math.round(amount);
  if (n === 0) return;
  ctx.s.company.cash += n;
  ctx.s.ledger.push({ label: why, amount: n });
  ctx.out.push({ t: 'cash', amount: n, why });
}

export function addKarma(ctx: Ctx, n: number): void {
  ctx.s.company.karma = Math.max(0, Math.round(ctx.s.company.karma + n));
}

export function addSpaghetti(ctx: Ctx, n: number): void {
  ctx.s.company.spaghetti = Math.max(0, Math.min(100, ctx.s.company.spaghetti + n));
}

export function bump(ctx: Ctx, counter: string, n = 1): void {
  ctx.s.counters[counter] = (ctx.s.counters[counter] ?? 0) + n;
}

export function setFlag(ctx: Ctx, id: string, value = true): void {
  const has = ctx.s.flags.includes(id);
  if (value && !has) ctx.s.flags.push(id);
  if (!value && has) ctx.s.flags.splice(ctx.s.flags.indexOf(id), 1);
}

export function staffById(s: GameState, id: string): Staff | undefined {
  return s.staff.find((m) => m.id === id);
}

export function workers(s: GameState): Staff[] {
  return s.staff.filter((m) => m.assign === 'build' && s.day >= m.awayUntil);
}
