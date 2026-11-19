/**
 * Bots that play whole games. Used by the tests (the sim must never break, whatever
 * a player does) and by tools/balance.ts (to see how hard the game is).
 */
import { STAT_KEYS } from '../content/types';
import { cardById } from './cards';
import { FUNDING_TARGETS } from './economy';
import { DIFFICULTIES, OFFICE_TIERS, TOKEN_PLANS, type Scope } from './config';
import { Game, unlocked, type NewGameOptions } from './game';
import { SHOP } from './shop';
import type { Content } from './content';
import { Rng } from './rng';
import { yearOf } from './format';

export type Strategy = 'smart' | 'random' | 'idle' | 'yolo';

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

export function playBot(content: Content, seed: number, strategy: Strategy, difficulty: NewGameOptions['difficulty'] = 'normal', hook?: (g: Game) => void): BotResult {
  const game = Game.create(content, botOptions(seed, difficulty));
  const rng = new Rng(seed ^ 0x9e3779b9);
  const s = game.s;
  let steps = 0;
  let minCash = s.company.cash;

  const handlePrompt = (): void => {
    const top = game.pending;
    if (!top) return;
    switch (top.t) {
      case 'card': {
        if (strategy === 'idle' || strategy === 'random') {
          game.pickCard(strategy === 'random' && rng.chance(0.7) ? rng.pick(top.options) : null);
          return;
        }
        const p = s.project!;
        const kind = content.kind(p.kind);
        let best: string | null = null;
        let bestScore = -1;
        for (const id of top.options) {
          const cd = cardById(id)!;
          let sc = (cd.speed ?? 1) * (strategy === 'yolo' ? 1.6 : 1);
          for (const k of STAT_KEYS) sc += ((cd.weight?.[k] ?? 1) - 1) * kind.weights[k] * 3 * (p.stats[k] < 50 ? 1.4 : 0.8);
          sc -= (cd.spaghetti ?? 0) * (strategy === 'yolo' ? 0.1 : 0.7);
          sc += (cd.hype ?? 0) * 0.02;
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
        const chans = content.channels.filter((c) => unlocked(game, c.unlock) && c.cost <= s.company.cash * 0.5);
        const pick = strategy === 'random' ? rng.pick(chans.length ? chans : [content.channels[0]!]) : chans.sort((a, b) => b.hype - a.hype)[0] ?? content.channels[0]!;
        let r = game.launch(pick.id);
        if (r.t === 'friday') {
          game.fridayChoice(strategy === 'yolo' || (strategy === 'random' && rng.chance(0.5)) ? 'yolo' : 'wait');
          if (game.pending?.t === 'ready') r = game.launch(pick.id);
          else return;
        }
        if (r.t === 'event') return;
        if (r.t === 'invalid') {
          game.launch(content.channels[0]!.id);
        }
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
        game.takeFunding(strategy === 'idle' ? 'decline' : (offers[0]?.id ?? 'decline'));
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

  const manage = (): void => {
    if (strategy === 'idle') return;
    // tools and plans
    const ownedBest = s.company.tools.map((id) => content.tool(id)).sort((a, b) => b.speed - a.speed)[0];
    for (const t of content.tools) {
      if (!s.company.tools.includes(t.id) && unlocked(game, t.unlock) && t.price < s.company.cash * 0.25 && t.speed > (ownedBest?.speed ?? 0)) game.buyTool(t.id);
    }
    const best = s.company.tools.map((id) => content.tool(id)).sort((a, b) => b.speed - a.speed)[0];
    if (best && !s.project) game.setTool(best.id);
    const plan = TOKEN_PLANS.slice().reverse().find((pl) => pl.monthly < s.company.cash * 0.04 && pl.tokens >= content.tool(s.company.activeTool).tokens * s.staff.length * 22);
    if (plan && plan.id !== s.company.tokenPlan) game.setTokenPlan(plan.id);
    if (s.company.tokens < 30 && s.company.cash > 4000) game.buyTokens();
    // office
    const next = OFFICE_TIERS[s.company.officeTier + 1];
    if (next && s.company.cash > next.upgrade * 1.8 && s.staff.length >= OFFICE_TIERS[s.company.officeTier]!.desks - 1) game.upgradeOffice();
    // hiring
    if (game.freeDesks() > 0 && s.company.cash > 24000) {
      const pick = s.candidates
        .slice()
        .sort((a, b) => Object.values(b.skills).reduce((n, v) => n + v, 0) / b.salary - Object.values(a.skills).reduce((n, v) => n + v, 0) / a.salary)[0];
      if (pick && s.company.cash > pick.fee + pick.salary * 4) game.hire(pick.id);
    }
    // shopping
    for (const it of SHOP) {
      if (!s.company.items.includes(it.id) && it.tier <= s.company.officeTier && it.price < s.company.cash * 0.08 && (it.mood ?? 0) + (it.speed ?? 0) * 40 >= 3) game.buyItem(it.id);
    }
    // staff moods
    for (const m of s.staff) if (m.mood < 25 && s.company.cash > 3000) game.therapy(m.id);
    if (s.company.spaghetti > 70 && s.project?.status === 'dev') game.refactorSprint();
  };

  const startNext = (): void => {
    if (s.project) return;
    const kinds = content.kinds.filter((k) => unlocked(game, k.unlock));
    const niches = content.niches.filter((n) => unlocked(game, n.unlock));
    if (!kinds.length || !niches.length) return;
    let kind = rng.pick(kinds);
    let niche = rng.pick(niches);
    if (strategy !== 'random') {
      // look for a favored pairing a few times
      for (let i = 0; i < 12; i++) {
        const k = rng.pick(kinds);
        const n = rng.pick(niches);
        if (n.favors.includes(k.id) && !n.curses.includes(k.id)) {
          kind = k;
          niche = n;
          break;
        }
      }
    }
    const scope: Scope = s.company.cash < 14000 ? 'hack' : strategy === 'smart' && s.staff.length >= 5 ? 'full' : 'mvp';
    game.startProject({ kind: kind.id, niche: niche.id, tool: s.company.activeTool, scope });
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
    } else if (s.day % 28 === 3) manage();
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

export { DIFFICULTIES, FUNDING_TARGETS, yearOf };
