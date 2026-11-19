/**
 * Development: starting a project and the daily work step.
 */
import { STAT_KEYS, type SkillKey, type StatKey } from '../content/types';
import { CARDS, cardById, type Card } from './cards';
import { COORDINATION, PHASES, PHASE_WEIGHTS, SCOPES, SKILL_FLOOR, STAT_GAIN_K, STAT_SKILLS, STAT_SOFT_CAP, WEEKS_SCALE, WORKDAYS_PER_WEEK, moodBugs, moodSpeed, phaseAt, type Scope } from './config';
import { addSpaghetti, bump, sound, toast, workers, type Ctx } from './ctx';
import { clamp } from './format';
import { productName } from './names';
import { gainXp, skillOf, traitMult } from './staff';
import { itemBonus, itemStat } from './shop';
import type { Project, Staff } from './types';

export interface ProjectPlan {
  kind: string;
  niche: string;
  tool: string;
  scope: Scope;
  name?: string;
  /** staff ids that build; everyone else supports. Default: everyone builds. */
  team?: string[];
}

export function karmaHype(karma: number): number {
  return Math.min(16, karma / 140);
}

export function startProject(ctx: Ctx, plan: ProjectPlan): Project {
  const { s, c, rng } = ctx;
  const kind = c.kind(plan.kind);
  const niche = c.niche(plan.niche);
  const takenNames = s.shipped.map((a) => a.name);
  const name = plan.name ?? productName(rng, kind, niche, takenNames);
  const stats = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) stats[k] = 0;
  const bank = s.counters.hype_bank ?? 0;
  s.counters.hype_bank = 0;
  const p: Project = {
    id: s.nextId++,
    name,
    kind: kind.id,
    niche: niche.id,
    tool: plan.tool,
    scope: plan.scope,
    startDay: s.day,
    status: 'dev',
    readyOn: 0,
    progress: 0,
    workTotal: workdaysFor(kind.weeks, plan.scope),
    stats,
    hype: bank + SCOPES[plan.scope].hype + karmaHype(s.company.karma),
    hotIdeas: 0,
    idea: null,
    card: null,
    cardPhase: -1,
    offered: [],
    flags: [],
    delayed: 0,
    stalledUntil: 0,
    rateLimitedDays: 0,
    fridayDeploy: false,
    tagline: rng.pick(kind.taglines),
  };
  s.project = p;
  s.company.activeTool = plan.tool;
  if (plan.team) for (const m of s.staff) m.assign = plan.team.includes(m.id) ? 'build' : 'support';
  else for (const m of s.staff) m.assign = 'build';
  offerCards(ctx, 0);
  return p;
}

/** Puts three cards on the table for a phase and waits for the player. */
export function offerCards(ctx: Ctx, phase: number): void {
  const p = ctx.s.project;
  if (!p) return;
  const pool = CARDS.filter((cd) => cd.phases.includes(phase as 0 | 1 | 2 | 3));
  const picks: string[] = [];
  const rares = pool.filter((cd) => cd.rarity === 'rare');
  const commons = pool.filter((cd) => cd.rarity !== 'rare');
  if (rares.length && ctx.rng.chance(0.3)) picks.push(ctx.rng.pick(rares).id);
  for (const cd of ctx.rng.shuffle(commons)) {
    if (picks.length >= 3) break;
    picks.push(cd.id);
  }
  p.offered = picks.slice(0, 3);
  p.cardPhase = phase;
  p.card = null;
  ctx.s.pending.push({ t: 'card', phase, options: p.offered.slice() });
}

export function currentCard(p: Project): Card | undefined {
  return p.card ? cardById(p.card) : undefined;
}

/** Resolves the gamble on the card of the phase that just ended. */
function resolveGamble(ctx: Ctx, p: Project): void {
  const card = currentCard(p);
  if (!card?.gamble) return;
  const g = card.gamble;
  if (!ctx.rng.chance(g.p)) return;
  if (g.stat && g.n) p.stats[g.stat] = clamp(p.stats[g.stat] + g.n, 0, 100);
  if (g.spaghetti) addSpaghetti(ctx, g.spaghetti);
  if (g.progress) p.progress = clamp(p.progress + g.progress, 0, 99.5);
  toast(ctx, g.text, (g.n ?? 0) >= 0 && !g.spaghetti ? 'good' : 'bad');
}

/** Working days an MVP-sized job takes at normal pace. */
export function workdaysFor(kindWeeks: number, scope: Scope): number {
  return kindWeeks * WEEKS_SCALE * SCOPES[scope].weeks * WORKDAYS_PER_WEEK;
}

/** Too many cooks: the share of output each builder keeps once the team is bigger than a few. */
export function coordination(team: readonly Staff[]): number {
  const pms = team.filter((m) => m.archetype === 'pm').length;
  const perHead = Math.max(COORDINATION.floor, COORDINATION.perHead - pms * COORDINATION.pmRelief);
  return 1 / (1 + perHead * Math.max(0, team.length - COORDINATION.freeHeads));
}

/** How briskly one builder moves today. About 1 for a happy person with an ordinary tool. */
function paceOf(ctx: Ctx, m: Staff, toolSpeed: number, card: Card | undefined, rateLimited: boolean): number {
  const { c, s } = ctx;
  const prompt = 0.85 + skillOf(c, m, 'prompt') / 150;
  const spaghettiDrag = 1 - s.company.spaghetti / 380;
  const crunch = s.company.crunch ? 1.35 : 1;
  return (
    prompt *
    moodSpeed(m.mood) *
    toolSpeed *
    traitMult(c, m, 'speed') *
    (rateLimited ? 0.15 : 1) *
    (card?.speed ?? 1) *
    crunch *
    spaghettiDrag *
    itemBonus(s, 'speed')
  );
}

/** What one builder knows about a stat: the skills behind it plus what the AI covers. */
function skillFor(ctx: Ctx, m: Staff, stat: StatKey): number {
  let v = SKILL_FLOOR;
  for (const [sk, share] of STAT_SKILLS[stat]) v += skillOf(ctx.c, m, sk as SkillKey) * share;
  return v;
}

const PHASE_SHARE = PHASES.map((ph) => (ph.to - ph.from) / 100);
/** How much of a whole project each stat gets from the phase weights alone. */
const STAT_SHARE = Object.fromEntries(STAT_KEYS.map((k) => [k, PHASE_SHARE.reduce((n, sh, i) => n + sh * PHASE_WEIGHTS[i as 0 | 1 | 2 | 3][k], 0)])) as Record<StatKey, number>;

export interface Forecast {
  stats: Record<StatKey, number>;
  /** calendar days from kickoff to ready, at today's mood and no cards */
  days: number;
  workdays: number;
}

/** What a plan is likely to turn into with the team as it is today. Shown in the project wizard. */
export function forecast(ctx: Ctx, plan: { kind: string; scope: Scope; tool: string; team?: string[] }): Forecast {
  const { s, c } = ctx;
  const kind = c.kind(plan.kind);
  const tool = c.tool(plan.tool);
  const team = s.staff.filter((m) => (plan.team ? plan.team.includes(m.id) : true));
  const work = workdaysFor(kind.weeks, plan.scope);
  const stats = {} as Record<StatKey, number>;
  const paces = team.map((m) => paceOf(ctx, m, tool.speed, undefined, false));
  const avgPace = paces.length ? paces.reduce((a, b) => a + b, 0) / paces.length : 1;
  const coord = coordination(team);
  for (const k of STAT_KEYS) {
    let sum = 0;
    team.forEach((m, i) => {
      sum += (paces[i]! / avgPace) * skillFor(ctx, m, k);
    });
    const x = (work * STAT_GAIN_K * STAT_SHARE[k] * coord * sum * itemStat(s, k)) / STAT_SOFT_CAP;
    stats[k] = STAT_SOFT_CAP * (1 - Math.exp(-x));
  }
  const workdays = work / Math.max(0.2, avgPace);
  return { stats, days: Math.ceil((workdays * 7) / WORKDAYS_PER_WEEK), workdays };
}

/** One working day on the current project. */
export function devStep(ctx: Ctx): void {
  const { s, c, rng } = ctx;
  const p = s.project;
  if (!p) return;
  if (s.day < p.stalledUntil) return;

  const team = workers(s);
  const supporters = s.staff.filter((m) => m.assign === 'support' && s.day >= m.awayUntil);
  if (team.length === 0) {
    if (s.day % 7 === 0) toast(ctx, 'Nobody is building anything. The deadline is vibes.', 'bad');
    return;
  }

  const tool = c.tool(p.tool);
  const card = currentCard(p);
  const phase = phaseAt(p.progress);

  // tokens
  const burn = team.length * tool.tokens * (card?.tokens ?? 1);
  const wasLimited = s.company.tokens <= 0;
  s.company.tokens = Math.max(0, s.company.tokens - burn);
  const rateLimited = s.company.tokens <= 0;
  if (rateLimited !== wasLimited) ctx.out.push({ t: 'rateLimited', on: rateLimited });
  if (rateLimited) p.rateLimitedDays += 1;

  // pace and stats: everyone adds to the pile, the clock moves at the average pace
  let totalPace = 0;
  let bugMult = 0;
  const coord = coordination(team);
  for (const m of team) {
    const pace = paceOf(ctx, m, tool.speed, card, rateLimited);
    totalPace += pace;
    bugMult += moodBugs(m.mood) * traitMult(c, m, 'bugs');
    for (const k of STAT_KEYS) {
      const gain =
        pace *
        coord *
        PHASE_WEIGHTS[phase][k] *
        (card?.weight?.[k] ?? 1) *
        skillFor(ctx, m, k) *
        STAT_GAIN_K *
        itemStat(s, k) *
        Math.max(0, 1 - p.stats[k] / STAT_SOFT_CAP);
      p.stats[k] += gain;
    }
    if (gainXp(m, 1 * traitMult(c, m, 'xp'), rng)) ctx.out.push({ t: 'levelUp', staffId: m.id, level: m.level });
  }
  bugMult /= team.length;

  // bugs, the vibe coding tax
  const bugP = clamp(0.16 * tool.bugs * bugMult * (1 + s.company.spaghetti / 70) * itemBonus(s, 'bugs'), 0.02, 0.6);
  if (rng.chance(bugP)) {
    p.stats.stability = Math.max(0, p.stats.stability - rng.range(0.6, 1.8) * (1 + s.company.spaghetti / 100));
    if (rng.chance(0.25)) p.stats.security = Math.max(0, p.stats.security - rng.range(0.3, 1.2));
    if (rng.chance(0.12)) toast(ctx, rng.pick(['A bug crawled out of the autocomplete.', 'Tests are red. Tests are always red.', 'The AI fixed one bug and made two.', 'Something broke. Nobody touched it.']), 'bad');
  }

  // spaghetti
  addSpaghetti(ctx, 0.1 * tool.bugs * Math.sqrt(totalPace) * itemBonus(s, 'spaghetti') + (card?.spaghetti ?? 0));
  for (const m of supporters) addSpaghetti(ctx, -0.25 * (skillOf(c, m, 'debug') / 20) * moodSpeed(m.mood));

  // supporters build hype with the time they have
  for (const m of supporters) {
    p.hype = clamp(p.hype + 0.05 * (skillOf(c, m, 'hustle') / 20), 0, 100);
    gainXp(m, 0.6, rng);
  }

  // mood from the card
  if (card?.mood) for (const m of team) m.mood = clamp(m.mood + card.mood, 0, 100);

  // progress
  p.progress += ((totalPace / team.length) / p.workTotal) * 100;

  // hot ideas
  if (p.idea && s.day > p.idea.until) {
    p.idea = null;
    ctx.out.push({ t: 'ideaGone' });
  }
  if (!p.idea && phase <= 2 && rng.chance(0.08) && p.progress < 95) {
    const who = rng.pick(team);
    const stat = rng.weighted(STAT_KEYS, (k) => PHASE_WEIGHTS[phase][k]) ?? 'vibes';
    p.idea = { id: s.nextId++, staffId: who.id, until: s.day + 10, stat };
    ctx.out.push({ t: 'idea', staffId: who.id, stat });
    sound(ctx, 'hot_idea');
  }

  // phase change or done
  if (p.progress >= 100) {
    p.progress = 100;
    resolveGamble(ctx, p);
    for (const m of team) gainXp(m, 12, rng);
    p.status = 'ready';
    s.pending.push({ t: 'ready' });
    ctx.out.push({ t: 'phase', phase: 4, project: p.name });
    sound(ctx, 'phase_done');
    return;
  }
  const next = phaseAt(p.progress);
  if (next !== phase) {
    resolveGamble(ctx, p);
    ctx.out.push({ t: 'phase', phase: next, project: p.name });
    sound(ctx, 'phase_done');
    offerCards(ctx, next);
  }
}

/** The player taps a spark above somebody's head. */
export function tapIdea(ctx: Ctx): { stat: StatKey; n: number } | null {
  const p = ctx.s.project;
  if (!p?.idea) return null;
  const idea = p.idea;
  p.idea = null;
  const who = ctx.s.staff.find((m) => m.id === idea.staffId);
  const n = ctx.rng.int(6, 11) + Math.round((who ? skillOf(ctx.c, who, 'taste') : 0) / 10);
  p.stats[idea.stat] = clamp(p.stats[idea.stat] + n, 0, 100);
  p.hype = clamp(p.hype + 2, 0, 100);
  p.hotIdeas += 1;
  bump(ctx, 'hot_ideas');
  if (who) gainXp(who, 4, ctx.rng);
  sound(ctx, 'level_up');
  return { stat: idea.stat, n };
}

export function pickCard(ctx: Ctx, id: string | null): void {
  const p = ctx.s.project;
  const top = ctx.s.pending[0];
  if (!p || top?.t !== 'card') return;
  ctx.s.pending.shift();
  p.offered = [];
  if (!id) {
    p.card = null;
    return;
  }
  const card = cardById(id);
  if (!card) return;
  p.card = id;
  if (card.hype) p.hype = clamp(p.hype + card.hype, 0, 100);
  bump(ctx, 'cards_played');
  toast(ctx, card.quip, 'info');
  sound(ctx, 'select');
}

export { PHASES };
