import { STAT_KEYS, type CompanyView, type ProjectView, type StatKey } from '../content/types';
import type { Content } from './content';
import { OFFICE_TIERS } from './config';
import { monthOf, yearOf } from './format';
import type { GameState, Project } from './types';

export function companyView(s: GameState): CompanyView {
  const flags = new Set(s.flags);
  return {
    year: yearOf(s.day),
    month: monthOf(s.day),
    day: s.day,
    cash: s.company.cash,
    tokens: s.company.tokens,
    karma: s.company.karma,
    spaghetti: s.company.spaghetti,
    staffCount: s.staff.length,
    deskCount: OFFICE_TIERS[s.company.officeTier]!.desks,
    officeTier: s.company.officeTier,
    appsShipped: s.shipped.length,
    flags,
    counters: s.counters,
    hasArchetype: (id) => s.staff.some((m) => m.archetype === id),
    hasTrait: (id) => s.staff.some((m) => m.traits.includes(id)),
  };
}

/** Kind weighted blend of the five stats, 0 to 100. */
export function qualityOf(content: Content, kindId: string, stats: Readonly<Record<StatKey, number>>): number {
  const w = content.kind(kindId).weights;
  let q = 0;
  for (const k of STAT_KEYS) q += w[k] * stats[k];
  return Math.max(0, Math.min(100, q));
}

export function projectView(content: Content, p: Project, channel = ''): ProjectView {
  const stats = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) stats[k] = Math.round(Math.max(0, Math.min(100, p.stats[k])));
  return {
    name: p.name,
    kind: p.kind,
    niche: p.niche,
    tool: p.tool,
    scope: p.scope,
    stats,
    quality: Math.round(qualityOf(content, p.kind, p.stats)),
    hype: Math.round(p.hype),
    channel,
    weeksTaken: 0,
    fridayDeploy: p.fridayDeploy,
    hotIdeas: p.hotIdeas,
    flags: new Set(p.flags),
  };
}
