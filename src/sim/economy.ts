/**
 * Payday, valuation, funding rounds and the ending.
 */
import { BANKRUPT_CASH, OFFICE_TIERS, REVENUE, TOKEN_PLANS } from './config';
import { addCash, bump, type Ctx } from './ctx';
import { clamp, monthOf, yearOf } from './format';
import { totalPayroll } from './staff';
import type { EndingResult, LedgerLine, PaydayReport } from './types';

export const FUNDING_TARGETS = [600_000, 4_500_000] as const;

export function valuation(ctx: Ctx): number {
  const { s } = ctx;
  const last = s.company.monthlyRevenue.slice(-3);
  const avg = last.length ? last.reduce((a, b) => a + b, 0) / last.length : 0;
  const arr = avg * 12;
  return Math.round(arr * 3 + Math.max(0, s.company.cash) * 0.5 + s.company.karma * 60 + s.shipped.length * 2500 + s.staff.length * 1500);
}

export function monthlyBurn(ctx: Ctx): number {
  const { s, c } = ctx;
  const plan = TOKEN_PLANS.find((p) => p.id === s.company.tokenPlan) ?? TOKEN_PLANS[0]!;
  const tool = c.tool(s.company.activeTool);
  return totalPayroll(s.staff) + OFFICE_TIERS[s.company.officeTier]!.rent + plan.monthly + tool.monthly + 200;
}

/** The world is kind to a founder who is going under, twice. */
function lifeline(ctx: Ctx): LedgerLine | null {
  const { s } = ctx;
  if (s.company.cash >= 0 || s.day > 380) return null;
  if (!s.flags.includes('lifeline_mom')) {
    s.flags.push('lifeline_mom');
    return { label: 'Mom', amount: 12000, note: 'Mom wired $12,000. Memo: "for groceries (and your dreams)". She still thinks you work at Google.' };
  }
  if (!s.flags.includes('lifeline_reddit') && s.company.karma >= 40) {
    s.flags.push('lifeline_reddit');
    return { label: 'Strangers on Reddit', amount: 8000, note: 'A thread called "this founder is cooked" got 4k upvotes and $8,000 in coffee donations.' };
  }
  return null;
}

export function runPayday(ctx: Ctx): PaydayReport {
  const { s, c, rng } = ctx;
  const year = yearOf(s.day);
  const month = monthOf(s.day);
  const income = Math.round(s.tally.revenue);
  const lines: LedgerLine[] = [];

  const salaries = totalPayroll(s.staff);
  if (salaries > 0) lines.push({ label: 'Salaries', amount: -salaries, note: `${s.staff.length - 1} humans and counting` });
  lines.push({ label: 'Rent', amount: -OFFICE_TIERS[s.company.officeTier]!.rent, note: OFFICE_TIERS[s.company.officeTier]!.name });
  const plan = TOKEN_PLANS.find((p) => p.id === s.company.tokenPlan) ?? TOKEN_PLANS[0]!;
  if (plan.monthly > 0) lines.push({ label: `Tokens: ${plan.name}`, amount: -plan.monthly, note: `${plan.tokens}k a month` });
  const tool = c.tool(s.company.activeTool);
  if (tool.monthly > 0) lines.push({ label: tool.name, amount: -tool.monthly, note: 'subscription' });
  const live = s.shipped.filter((a) => a.spikeAmp * Math.exp(-(s.day - a.launchDay) / REVENUE.spikeTau) + a.tailAmp * Math.exp(-(s.day - a.launchDay) / REVENUE.tailTau) > 40).length;
  const cloud = Math.round(40 + income * 0.1 + live * 120 + s.company.spaghetti * 6);
  lines.push({ label: 'Cloud bill', amount: -cloud, note: s.company.spaghetti > 40 ? 'includes the spaghetti tax' : `${live} apps still on the servers` });

  const items = c.paydayItems.length ? rng.shuffle(c.paydayItems).slice(0, 3) : [];
  for (const it of items) {
    const base = rng.int(it.cost[0], it.cost[1]);
    lines.push({ label: it.label, amount: -Math.round(base * (0.7 + s.staff.length * 0.12) * (1 + 0.25 * (year - 1))), note: it.note });
  }

  let total = lines.reduce((n, l) => n + l.amount, 0);
  s.company.cash += total;
  s.company.monthlyRevenue.push(income);
  if (s.company.monthlyRevenue.length > 36) s.company.monthlyRevenue.shift();

  const warnings: string[] = [];
  const rescue = lifeline(ctx);
  if (rescue) {
    lines.push(rescue);
    s.company.cash += rescue.amount;
    total += rescue.amount;
    warnings.push(rescue.note ?? '');
  }
  if (s.company.cash < 0) {
    s.company.bankruptStrikes += 1;
    bump(ctx, 'bankrupt_scares');
    warnings.push(s.company.bankruptStrikes >= 2 ? 'Cash is negative again. The bank has stopped calling. They write letters now.' : 'Cash is negative. One more month like this ends the company.');
    for (const m of s.staff) m.mood = clamp(m.mood - 8, 0, 100);
  } else {
    s.company.bankruptStrikes = 0;
    const burn = monthlyBurn(ctx);
    const weeks = burn > 0 ? Math.floor((s.company.cash / burn) * 4) : 99;
    if (weeks < 6) warnings.push(`Runway is about ${Math.max(0, weeks)} weeks. Ship something. Anything.`);
  }

  // refill the token plan
  s.company.tokens = Math.max(s.company.tokens, plan.tokens);
  bump(ctx, 'months_survived');

  const recap = s.ledger.slice();
  s.ledger = [];
  s.tally = { revenue: 0, appsLaunched: 0 };

  const report: PaydayReport = {
    month,
    year,
    income,
    lines,
    recap,
    total,
    cashAfter: Math.round(s.company.cash),
    headline: c.headlines.length ? rng.pick(c.headlines) : 'Another month survived.',
    warnings,
  };
  return report;
}

export function isBankrupt(ctx: Ctx): boolean {
  return ctx.s.company.bankruptStrikes >= 2 || ctx.s.company.cash < BANKRUPT_CASH * 12;
}

/** Offers at a funding round. */
export function fundingOffers(ctx: Ctx): { id: string; label: string; cash: number; blurb: string }[] {
  const v = valuation(ctx);
  return [
    { id: 'vc', label: 'Take the VC money', cash: Math.round(v * 0.3), blurb: 'Big check. Bigger expectations. They say "10x" when they greet you.' },
    { id: 'angel', label: 'Take the angel check', cash: Math.round(v * 0.1), blurb: 'A friendly dentist. He asks for a logo with his name on it.' },
    { id: 'decline', label: 'Stay scrappy', cash: 0, blurb: 'Keep every share. Keep the ramen.' },
  ];
}

export function takeFunding(ctx: Ctx, offerId: string): string {
  const { s } = ctx;
  const year = yearOf(s.day);
  const offer = fundingOffers(ctx).find((o) => o.id === offerId);
  if (!offer) return '';
  s.company.fundingTaken.push(`${offerId}${year}`);
  if (offer.cash > 0) addCash(ctx, offer.cash, `Funding: ${offer.label}`);
  if (offerId === 'vc') {
    s.flags.push(`vc${year}`);
    for (const m of s.staff) m.mood = clamp(m.mood - 3, 0, 100);
    return `Wire received: $${offer.cash.toLocaleString('en-US')}. The board meeting is on Monday.`;
  }
  if (offerId === 'angel') {
    return `Wire received: $${offer.cash.toLocaleString('en-US')}. The dentist wants a ping pong table.`;
  }
  for (const m of s.staff) m.mood = clamp(m.mood + 8, 0, 100);
  s.company.karma += 120;
  return 'You declined. The team loves it. The accountant does not.';
}

export function finalScore(ctx: Ctx): number {
  const { s } = ctx;
  const vcPenalty = s.flags.filter((f) => f.startsWith('vc')).length * 0.07;
  const raw = valuation(ctx) + s.company.karma * 30 + s.achievements.length * 2500 + s.company.totalRevenue * 0.15;
  return Math.round(raw * (1 - vcPenalty));
}

export function rankFor(score: number): EndingResult['rank'] {
  if (score >= 20_000_000) return 'S';
  if (score >= 11_000_000) return 'A';
  if (score >= 5_000_000) return 'B';
  if (score >= 1_500_000) return 'C';
  if (score >= 400_000) return 'D';
  return 'F';
}

/** Which of the endings for a rank. Two ranks have two: a famous A needs karma, an F with a founder still in the building becomes a podcast. */
export function pickEnding(ctx: Ctx, bankrupt: boolean): EndingResult {
  const { s, c, rng } = ctx;
  const score = finalScore(ctx);
  const rank = bankrupt ? 'F' : rankFor(score);
  const pool = c.endings.filter((e) => e.rank === rank);
  const founderHere = s.staff.some((m) => m.archetype === 'founder');
  const wanted = rank === 'A' ? (s.company.karma >= 9000 ? 'famous' : 'acquired') : rank === 'F' ? (founderHere && rng.chance(0.6) ? 'podcast' : 'runway') : '';
  const chosen = pool.find((e) => e.id === wanted) ?? (pool.length ? rng.pick(pool) : c.endings[0]);
  return {
    endingId: chosen?.id ?? 'none',
    rank,
    score,
    valuation: valuation(ctx),
    bankrupt,
    day: s.day,
  };
}

