/**
 * Bots that play whole games. Used by the tests (the sim must never break, whatever
 * a player does) and by tools/balance.ts (to see how hard the game is).
 *
 *  smart  plays like a careful player: reads what it can afford, hires for gaps, avoids Friday.
 *  casual is smart, but a third of its choices are made without thinking.
 *  yolo   plays fast and loose: speed cards, Friday deploys, hires early, never refactors.
 *  random pushes buttons.
 *  idle   ships the minimum and never spends.
 */
import { SKILL_KEYS, STAT_KEYS, type SkillKey } from '../content/types';
import { cardById } from './cards';
import { OFFICE_TIERS, PHASE_WEIGHTS, REVENUE, SCOPES, TOKEN_PLANS, type Scope } from './config';
import type { Content } from './content';
import { Game, unlocked, type NewGameOptions } from './game';
import { nicheFit, noveltyOf } from './launch';
import { Rng } from './rng';
import { SHOP } from './shop';
import { skillOf } from './staff';
import { qualityOf } from './views';
import type { Staff } from './types';

export type Strategy = 'smart' | 'casual' | 'random' | 'idle' | 'yolo';

export interface BotResult {
  strategy: Strategy;
  seed: number;
  game: Game;
  steps: number;
  apps: number;
  avgScore: number;
  minCash: number;
  endDay: number;
  rank: string;
  bankrupt: boolean;
  score: number;
}

export function botOptions(seed: number, difficulty: NewGameOptions['difficulty'] = 'normal'): NewGameOptions {
  return { seed, company: 'Bot Labs', founderName: 'Botty McBotface', origin: 'bootcamp', difficulty };
}

function builders(g: Game): Staff[] {
  return g.s.staff.filter((m) => m.assign === 'build' && g.s.day >= m.awayUntil);
}

interface Plan {
  kind: string;
  niche: string;
  scope: Scope;
  value: number;
}

/** Money per day for a candidate project, the way a careful founder would guess it. */
function bestPlan(g: Game, strategy: Strategy, rng: Rng): Plan | null {
  const { s, c } = g;
  const kinds = c.kinds.filter((k) => unlocked(g, k.unlock));
  const niches = c.niches.filter((n) => unlocked(g, n.unlock));
  let best: Plan | null = null;
  const scopes = (strategy === 'yolo' ? (['hack', 'mvp'] as Scope[]) : (['hack', 'mvp', 'full'] as Scope[])).filter((sc) => unlocked(g, SCOPES[sc].unlock));
  for (const kind of kinds) {
    for (const niche of niches) {
      const fit = nicheFit({ s, c, rng, out: [], bad: 1, revenue: 1 }, kind.id, niche.id);
      for (const scope of scopes) {
        const fc = g.forecast({ kind: kind.id, scope, tool: s.company.activeTool });
        const q = qualityOf(c, kind.id, fc.stats);
        const days = fc.days + 6;
        const life = REVENUE.base * Math.pow(kind.money / 5, REVENUE.moneyExp) * fit * noveltyOf(s, kind.id, niche.id) * Math.pow(Math.max(q, 5) / 50, REVENUE.qualityExp) * (0.75 + 20 / 120) * SCOPES[scope].money;
        // tiny projects feed karma faster, but a runway under three months wants the quick ones
        const runway = s.company.cash / Math.max(1, g.monthlyBurn());
        const value = (life / days) * (runway < 3 && scope === 'full' ? 0.4 : 1) * (0.9 + rng.next() * 0.2);
        if (!best || value > best.value) best = { kind: kind.id, niche: niche.id, scope, value };
      }
    }
  }
  return best;
}

/** What a candidate adds to the team, in rough dollars a month. */
function candidateValue(g: Game, cand: { skills: Record<SkillKey, number>; salary: number }): number {
  const mine = builders(g);
  const avg = {} as Record<SkillKey, number>;
  for (const k of SKILL_KEYS) avg[k] = mine.reduce((n, m) => n + skillOf(g.c, m, k), 0) / Math.max(1, mine.length);
  const importance: Record<SkillKey, number> = { prompt: 1, taste: 0.9, debug: 0.8, paranoia: 0.35, hustle: 0.5 };
  let v = 0;
  for (const k of SKILL_KEYS) {
    const lift = Math.max(0, cand.skills[k] - avg[k] * 0.6);
    v += importance[k] * lift;
  }
  return v * 420 - cand.salary;
}

export function playBot(content: Content, seed: number, strategy: Strategy, difficulty: NewGameOptions['difficulty'] = 'normal', hook?: (g: Game) => void): BotResult {
  const game = Game.create(content, botOptions(seed, difficulty));
  const rng = new Rng(seed ^ 0x9e3779b9);
  const s = game.s;
  let steps = 0;
  let minCash = s.company.cash;
  const careful = strategy === 'smart' || strategy === 'casual';
  const slip = strategy === 'casual' ? 0.35 : 0;

  const handlePrompt = (): void => {
    const top = game.pending;
    if (!top) return;
    switch (top.t) {
      case 'card': {
        if (strategy === 'idle' || strategy === 'random' || rng.chance(slip)) {
          game.pickCard(strategy !== 'idle' && rng.chance(0.7) ? rng.pick(top.options) : null);
          return;
        }
        const p = s.project!;
        const kind = content.kind(p.kind);
        let best: string | null = null;
        let bestScore = -Infinity;
        for (const id of top.options) {
          const cd = cardById(id)!;
          let sc = ((cd.speed ?? 1) - 1) * (strategy === 'yolo' ? 4 : 1.2);
          for (const k of STAT_KEYS) sc += ((cd.weight?.[k] ?? 1) - 1) * kind.weights[k] * 6 * (p.stats[k] < 50 ? 1.3 : 0.8) * PHASE_WEIGHTS[top.phase as 0 | 1 | 2 | 3][k];
          sc -= (cd.spaghetti ?? 0) * (strategy === 'yolo' ? 0.05 : 0.5);
          sc -= ((cd.tokens ?? 1) - 1) * 0.5;
          sc += (cd.mood ?? 0) * 0.8 + (cd.hype ?? 0) * 0.04;
          if (cd.gamble) sc += careful ? -0.2 : 0.3;
          if (sc > bestScore) {
            bestScore = sc;
            best = id;
          }
        }
        game.pickCard(best);
        return;
      }
      case 'event': {
        const enabled = top.choices.map((c, i) => (c.enabled ? i : -1)).filter((i) => i >= 0);
        game.resolveEvent(enabled.length ? rng.pick(enabled) : 0);
        return;
      }
      case 'ready': {
        const p = s.project!;
        const quality = qualityOf(content, p.kind, p.stats);
        const affordable = content.channels.filter((c) => unlocked(game, c.unlock) && c.cost <= Math.max(0, s.company.cash) * 0.3);
        const pool = affordable.length ? affordable : content.channels.filter((c) => c.cost === 0);
        let pick = pool[0]!;
        if (strategy === 'random' || rng.chance(slip)) pick = rng.pick(pool);
        else if (strategy === 'idle') pick = content.channels[0]!;
        else {
          const value = (ch: (typeof pool)[number]) => ch.hype + 22 * ch.karmaMult - ch.roast * Math.max(0, 85 - quality) * 0.55 - ch.cost / 500;
          pick = pool.slice().sort((a, b) => value(b) - value(a))[0]!;
        }
        let r = game.launch(pick.id);
        if (r.t === 'friday') {
          game.fridayChoice(strategy === 'yolo' || ((strategy === 'random' || strategy === 'casual') && rng.chance(0.5)) ? 'yolo' : 'wait');
          if (game.pending?.t === 'ready') r = game.launch(pick.id);
          else return;
        }
        if (r.t === 'invalid') game.launch(content.channels[0]!.id);
        return;
      }
      case 'payday':
        game.ackPayday();
        return;
      case 'awards':
        game.ackAwards();
        return;
      case 'funding': {
        const offers = game.fundingChoices();
        const vc = offers.find((o) => o.id === 'vc');
        const angel = offers.find((o) => o.id === 'angel');
        game.takeFunding(strategy === 'idle' ? 'decline' : strategy === 'yolo' ? (vc?.id ?? 'decline') : (angel?.id ?? 'decline'));
        return;
      }
      case 'friday':
        game.fridayChoice('wait');
        return;
      case 'ending':
        game.ackEnding();
        return;
    }
  };

  const monthlyNeed = (): number => game.monthlyBurn();

  const manage = (): void => {
    if (strategy === 'idle') return;
    const cash = s.company.cash;
    const burn = monthlyNeed();
    const runway = cash / Math.max(1, burn);

    // tools: the best one we can pay for without scaring the accountant
    const current = content.tool(s.company.activeTool);
    for (const t of content.tools.slice().sort((a, b) => b.speed - a.speed)) {
      if (s.company.tools.includes(t.id) || !unlocked(game, t.unlock)) continue;
      if (t.speed > current.speed * 1.15 && t.price <= cash * (careful ? 0.22 : 0.4) && runway > 2.5) {
        game.buyTool(t.id);
        break;
      }
    }
    if (!s.project) {
      const best = s.company.tools.map((id) => content.tool(id)).sort((a, b) => b.speed * (b.tokens > 0 ? 1 : 0.6) - a.speed * (a.tokens > 0 ? 1 : 0.6))[0];
      if (best) game.setTool(best.id);
    }

    // token plan: the cheapest one that covers a month of work
    const tool = content.tool(s.company.activeTool);
    const need = Math.max(1, s.staff.length) * tool.tokens * 21 * 1.1;
    const plan = TOKEN_PLANS.find((pl) => pl.tokens >= need) ?? TOKEN_PLANS[TOKEN_PLANS.length - 1]!;
    if (plan.id !== s.company.tokenPlan && plan.monthly <= cash * 0.15) game.setTokenPlan(plan.id);
    if (s.company.tokens < tool.tokens * Math.max(1, s.staff.length) * 3 && cash > burn * 2) game.buyTokens();

    // office
    const next = OFFICE_TIERS[s.company.officeTier + 1];
    const rentUp = next ? next.rent - OFFICE_TIERS[s.company.officeTier]!.rent : 0;
    if (next && s.staff.length >= OFFICE_TIERS[s.company.officeTier]!.desks - 1 && (cash - next.upgrade) / (burn + rentUp) > (careful ? 4 : 2.5)) game.upgradeOffice();

    // hiring: when there is a desk, runway and somebody who fills a gap
    const wantRunway = careful ? 4.5 : 3;
    if (game.freeDesks() > 0 && runway > wantRunway && s.staff.length < 18) {
      const pick = rng.chance(slip) ? rng.pick(s.candidates) : s.candidates.slice().sort((a, b) => candidateValue(game, b) - candidateValue(game, a))[0];
      if (pick && (candidateValue(game, pick) > 0 || slip > 0) && cash > pick.fee + pick.salary * 4) game.hire(pick.id);
    }
    // let the dead weight go when money is scary
    if (runway < 1.2 && s.staff.length > 3) {
      const worst = s.staff.filter((m) => !m.isFounder).sort((a, b) => b.salary / (1 + b.skills.prompt) - a.salary / (1 + a.skills.prompt))[0];
      if (worst) game.fire(worst.id);
    }

    // training for the weak spot
    if (careful && runway > 6) {
      const m = s.staff.filter((x) => game.s.day >= x.awayUntil).sort((a, b) => a.level - b.level)[0];
      if (m && s.day % 56 === 3) {
        const key = SKILL_KEYS.slice().sort((a, b) => m.skills[a] - m.skills[b])[1]!;
        if (game.trainCost(m, key) < cash * 0.04) game.train(m.id, key);
      }
    }

    // shopping
    if (runway > 5) {
      for (const it of SHOP) {
        if (s.company.items.includes(it.id) || it.tier > s.company.officeTier || it.price > cash * (careful ? 0.07 : 0.12)) continue;
        if ((it.mood ?? 0) + (it.speed ?? 0) * 40 + (it.stat ? 4 : 0) >= 3) game.buyItem(it.id);
      }
    }
    // staff moods
    if (careful) for (const m of s.staff) if (m.mood < 28 && cash > burn * 2) game.therapy(m.id);
    if (careful && s.company.spaghetti > 60 && s.project?.status === 'dev') game.refactorSprint();
  };

  const startNext = (): void => {
    if (s.project) return;
    const kinds = content.kinds.filter((k) => unlocked(game, k.unlock));
    const niches = content.niches.filter((n) => unlocked(game, n.unlock));
    if (!kinds.length || !niches.length) return;
    let plan: Plan | null = null;
    if ((strategy === 'smart' || strategy === 'yolo' || strategy === 'casual') && !rng.chance(slip)) plan = bestPlan(game, strategy === 'casual' ? 'smart' : strategy, rng);
    if (!plan) {
      plan = { kind: rng.pick(kinds).id, niche: rng.pick(niches).id, scope: strategy === 'idle' ? 'hack' : rng.pick<Scope>(['hack', 'mvp']), value: 0 };
    }
    game.startProject({ kind: plan.kind, niche: plan.niche, tool: s.company.activeTool, scope: plan.scope });
  };

  const guard = 200000;
  while (!s.ending || s.pending.length) {
    if (steps++ > guard) throw new Error(`bot stuck at day ${s.day}, pending ${JSON.stringify(s.pending[0])}`);
    if (game.pending) {
      handlePrompt();
      hook?.(game);
      continue;
    }
    if (!s.project) {
      manage();
      startNext();
    } else if (s.day % 14 === 3) manage();
    if (s.project?.idea && strategy !== 'idle' && (strategy !== 'random' || rng.chance(0.4))) game.tapIdea();
    game.tick();
    game.drain();
    minCash = Math.min(minCash, s.company.cash);
    hook?.(game);
    if (s.ending && !s.pending.length) break;
  }

  const apps = s.shipped.length;
  const avgScore = apps ? s.shipped.reduce((n, a) => n + a.score, 0) / apps : 0;
  return {
    strategy,
    seed,
    game,
    steps,
    apps,
    avgScore,
    minCash,
    endDay: s.day,
    rank: s.ending?.rank ?? '?',
    bankrupt: s.ending?.bankrupt ?? false,
    score: s.ending?.score ?? 0,
  };
}
