/**
 * Launch day: the Reddit thread, the Reddit Score, karma and the money curve.
 */
import { STAT_KEYS, type AwardId, type ThreadCtx, type Vignette } from '../content/types';
import { FRIDAY, MARKET_BAR, NOVELTY, REMOVED_BELOW, REVENUE, SCOPES, SOLID_FROM, VIRAL_FROM } from './config';
import { addCash, addKarma, addSpaghetti, bump, setFlag, sound, toast, cashScale, type Ctx } from './ctx';
import { clamp, lerp, yearOf } from './format';
import { fill } from './names';
import { gainXp } from './staff';
import { itemBonus } from './shop';
import type { ShippedApp, ThreadRecord } from './types';
import { companyView, projectView, qualityOf } from './views';

/** 1 for something fresh, lower when the crowd has seen it lately. */
export function noveltyOf(s: Ctx['s'], kindId: string, nicheId: string): number {
  let n = 1;
  for (const a of s.shipped.slice(-8)) {
    const fade = Math.exp(-(s.day - a.launchDay) / NOVELTY.memoryDays);
    if (a.kind === kindId) n *= 1 - (1 - NOVELTY.sameKind) * fade;
    if (a.niche === nicheId) n *= 1 - (1 - NOVELTY.sameNiche) * fade;
  }
  return Math.max(NOVELTY.floor, n);
}

export function nicheFit(ctx: Ctx, kindId: string, nicheId: string): number {
  const n = ctx.c.niche(nicheId);
  if (n.favors.includes(kindId)) return 1.35;
  if (n.curses.includes(kindId)) return 0.65;
  return 1;
}

function safeWhen(v: Vignette, tctx: ThreadCtx): boolean {
  try {
    return v.when(tctx);
  } catch {
    return false;
  }
}

function toneFit(tone: Vignette['tone'], roast: number): number {
  switch (tone) {
    case 'roast':
      return 0.55 + roast * 1.2;
    case 'praise':
      return 1.45 - roast * 0.9;
    default:
      return 1;
  }
}

/** Picks the vignettes for a thread: varied topics, a mix of tones, never the same set twice in a row. */
export function pickVignettes(ctx: Ctx, tctx: ThreadCtx, roast: number, want = 4): Vignette[] {
  const { s, c, rng } = ctx;
  const pool = c.vignettes.filter((v) => safeWhen(v, tctx));
  const recent = (v: Vignette) => (s.seenVignettes[v.id] !== undefined && s.day - s.seenVignettes[v.id]! < 140 ? 0.2 : 1);
  const weight = (v: Vignette) => Math.max(0.01, v.weight) * toneFit(v.tone, roast) * recent(v);
  const picked: Vignette[] = [];
  const topics = new Set<string>();
  const take = (v: Vignette | undefined) => {
    if (!v || picked.includes(v)) return;
    picked.push(v);
    topics.add(v.topic);
  };
  const fresh = () => pool.filter((v) => !picked.includes(v) && !topics.has(v.topic));
  // always at least one friendly voice and one roast if the pool has them
  take(rng.weighted(fresh().filter((v) => v.tone === 'praise' || v.tone === 'neutral'), weight));
  take(rng.weighted(fresh().filter((v) => v.tone === 'roast' || v.tone === 'chaos'), weight));
  while (picked.length < want) {
    const next = rng.weighted(fresh(), weight);
    if (!next) break;
    take(next);
  }
  while (picked.length < want) {
    const next = rng.weighted(pool.filter((v) => !picked.includes(v)), weight);
    if (!next) break;
    take(next);
  }
  return rng.shuffle(picked);
}

/** A product of quality 50 reads as a 5.8 on a friendly channel. */
const RATING_OFFSET = 0.8;
const TONE_ADJ: Record<Vignette['tone'], number> = { praise: 0.7, roast: -0.7, neutral: 0, chaos: 0 };

export interface LaunchResult {
  app: ShippedApp;
  incident: boolean;
}

export function launchProject(ctx: Ctx, channelId: string): LaunchResult {
  const { s, c, rng } = ctx;
  const p = s.project;
  if (!p) throw new Error('no project to launch');
  const ch = c.channel(channelId);
  const kind = c.kind(p.kind);

  const cost = Math.round(ch.cost * cashScale(s));
  if (cost > 0) addCash(ctx, -cost, `Launch: ${ch.name}`);
  p.hype = clamp(p.hype + ch.hype, 0, 100);

  // a Friday deploy rides the weekend crowd, or takes production down
  let incident = false;
  if (p.fridayDeploy) {
    bump(ctx, 'friday_deploys');
    const chance = 0.3 + s.company.spaghetti / 250 + (100 - p.stats.stability) / 400;
    if (rng.chance(chance)) {
      incident = true;
      p.stats.stability = Math.max(0, p.stats.stability - rng.range(14, 24));
      p.stats.security = Math.max(0, p.stats.security - rng.range(3, 9));
      p.hype = clamp(p.hype - FRIDAY.incidentHype, 0, 100);
      addSpaghetti(ctx, 6);
      addCash(ctx, -Math.round(FRIDAY.incidentCost * cashScale(s)), 'Incident: weekend overtime and refunds');
      for (const m of s.staff) m.mood = clamp(m.mood - FRIDAY.incidentMood, 0, 100);
      bump(ctx, 'friday_incidents');
    } else {
      p.hype = clamp(p.hype + FRIDAY.hype, 0, 100);
    }
  }

  const bar = MARKET_BAR[Math.min(2, yearOf(s.day) - 1)]!;
  const pv = projectView(c, p, channelId);
  const tctx: ThreadCtx = { company: companyView(s), project: pv, rand: () => rng.next() };
  const vignettes = pickVignettes(ctx, tctx, ch.roast);

  const reach = 0.6 + p.hype / 100;
  const ratings: number[] = [];
  const records: ThreadRecord['vignettes'] = [];
  const awards: ThreadRecord['awards'] = [];
  let rootVotes = 0;
  for (const v of vignettes) {
    const judged = (v.judges === 'overall' ? pv.quality : v.judges === 'hype' ? pv.hype : pv.stats[v.judges]) - (v.judges === 'hype' ? 0 : bar);
    const raw = judged / 10 + RATING_OFFSET + rng.bell() * 1.3 + TONE_ADJ[v.tone] - ch.roast * 0.8;
    const rating = clamp(Math.round(raw), 1, 10);
    ratings.push(rating);
    const t = clamp(0.25 + pv.quality / 200 + pv.hype / 400 + rng.bell() * 0.25, 0, 1);
    const votes = v.comments.map((cm) => Math.round(lerp(cm.votes[0], cm.votes[1], t) * reach * ch.karmaMult));
    rootVotes += Math.max(0, votes[0] ?? 0);
    records.push({ id: v.id, rating, judges: v.judges, votes });
    v.comments.forEach((cm, index) => {
      for (const award of cm.awards ?? []) if (rng.chance(0.65)) awards.push({ vignette: v.id, index, award: award as AwardId });
    });
    s.seenVignettes[v.id] = s.day;
  }
  const score = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 4) : 0;

  const opVotes = Math.round((300 + pv.quality * 25 + pv.hype * 15) * (0.7 + rng.next() * 0.6) * ch.karmaMult);
  const title = fill(rng.pick(ch.titles), { name: p.name, tagline: p.tagline });
  // the body never says the tagline a second time when the title already did
  const said = title.includes(p.tagline);
  const body = c.opBodies.length ? fill(rng.pick(c.opBodies), { name: p.name, tagline: said ? '' : p.tagline, kind: kind.name }).replace(/\s{2,}/g, ' ').trim() : said ? '' : p.tagline;

  const karma = Math.round((rootVotes * 0.025 + opVotes * 0.01) * itemBonus(s, 'karma'));
  addKarma(ctx, karma);

  // money
  const fit = nicheFit(ctx, p.kind, p.niche);
  const quality = qualityOf(c, p.kind, p.stats);
  const scoreBonus = 0.7 + (score / 40) * 0.6;
  const stabilityPenalty = p.stats.stability < 30 ? 0.8 : 1;
  const lifetime = Math.round(
    REVENUE.base *
      Math.pow(kind.money / 5, REVENUE.moneyExp) *
      fit *
      Math.pow(Math.max(quality - bar, 5) / 50, REVENUE.qualityExp) *
      (0.75 + p.hype / 120) *
      SCOPES[p.scope].money *
      scoreBonus *
      stabilityPenalty *
      (incident ? FRIDAY.incidentRevenue : 1) *
      noveltyOf(s, p.kind, p.niche) *
      REVENUE.yearMult[Math.min(2, yearOf(s.day) - 1)]! *
      (1 + s.company.karma / 4000) *
      ctx.revenue,
  );
  const spikeAmp = (lifetime * REVENUE.spikeShare) / REVENUE.spikeTau;
  const tailAmp = (lifetime * (1 - REVENUE.spikeShare)) / REVENUE.tailTau;

  // the app store crowd
  const stars = clamp(Math.round(score / 8), 1, 5);
  const matching = c.appReviews.filter((r) => r.stars === stars);
  const review = matching.length ? rng.pick(matching) : c.appReviews.length ? rng.pick(c.appReviews) : undefined;

  // the thread ends with the mods (on a flop) and then the founder's Edit
  const edits = c.opEdits[score >= VIRAL_FROM ? 'viral' : score >= SOLID_FROM ? 'solid' : 'flop'];
  const closing: Pick<ThreadRecord, 'mod' | 'edit'> = {};
  if (score < REMOVED_BELOW && c.modNotices.length) closing.mod = rng.pick(c.modNotices);
  if (edits.length) closing.edit = rng.pick(edits);

  const app: ShippedApp = {
    id: p.id,
    name: p.name,
    kind: p.kind,
    niche: p.niche,
    tool: p.tool,
    scope: p.scope,
    launchDay: s.day,
    channel: channelId,
    quality: Math.round(quality),
    hype: Math.round(p.hype),
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, Math.round(p.stats[k])])) as ShippedApp['stats'],
    score,
    ratings,
    karma,
    lifetime,
    earned: 0,
    spikeAmp,
    tailAmp,
    fridayDeploy: p.fridayDeploy,
    incident,
    thread: { channel: channelId, title, body, opVotes, vignettes: records, awards, ...closing },
    review: review ? { stars: review.stars, text: review.text, user: review.user } : undefined,
  };
  s.shipped.push(app);
  s.project = null;
  s.tally.appsLaunched += 1;

  // counters
  bump(ctx, 'apps_shipped');
  s.counters.best_rating = Math.max(s.counters.best_rating ?? 0, score);
  bump(ctx, 'perfect_scores', ratings.filter((r) => r === 10).length);
  if (score >= 36) setFlag(ctx, 'legendary_launch');

  // the team feels it
  const mood = Math.round((score - 18) / 2);
  for (const m of s.staff) {
    m.mood = clamp(m.mood + mood, 0, 100);
    m.assign = 'build';
    gainXp(m, 6, rng);
  }
  toast(ctx, `${p.name} is live: ${score}/40 on Reddit.`, score >= 24 ? 'wow' : score >= 16 ? 'good' : 'bad');
  ctx.out.push({ t: 'launched', appId: app.id });
  // the thread scene plays the fanfare that matches the score once it has told everyone; launch day itself only gets the stinger
  sound(ctx, 'ship_it');
  return { app, incident };
}

/** Money coming in today from every app already live. */
export function dailyIncome(ctx: Ctx): number {
  let total = 0;
  for (const a of ctx.s.shipped) {
    const d = ctx.s.day - a.launchDay;
    if (d < 0) continue;
    const amt = a.spikeAmp * Math.exp(-d / REVENUE.spikeTau) + a.tailAmp * Math.exp(-d / REVENUE.tailTau);
    a.earned += amt;
    total += amt;
  }
  return total;
}
