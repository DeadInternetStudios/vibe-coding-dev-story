/**
 * The game. One object owns the state and every rule. The scenes read it,
 * call its actions, and drain the notices it raises. No Phaser in here.
 */
import type { SkillKey, Unlock } from '../content/types';
import { DAYS_PER_MONTH, DIFFICULTIES, FOUNDER_ORIGINS, OFFICE_TIERS, SCOPES, START, TOKEN_PLANS, TOPUP_PRICE, TOTAL_DAYS, type DifficultyId, type FounderOriginId } from './config';
import type { Content } from './content';
import { addCash, addSpaghetti, bump, cashScale, sound, toast, type Ctx } from './ctx';
import { devStep, forecast as forecastImpl, pickCard as pickCardImpl, startProject, tapIdea, type Forecast, type ProjectPlan } from './dev';
import { resolveEvent as resolveEventImpl, rollDaily } from './events';
import { finalScore, fundingOffers, isBankrupt, monthlyBurn, pickEnding, runPayday, takeFunding as takeFundingImpl, valuation, FUNDING_TARGETS } from './economy';
import { removeStaff } from './effects';
import { clamp, dowOf, isFriday, isMonthStart, isPayday, isWorkday, isYearEnd, yearOf } from './format';
import { dailyIncome, launchProject } from './launch';
import { Rng, hashSeed } from './rng';
import { itemMood, shopItem } from './shop';
import { gainXp, makeCandidate, randomLook, staffFromCandidate, traitMood } from './staff';
import type { EventOutcome, GameState, Look, Notice, Prompt, ShippedApp, Staff } from './types';
import { companyView } from './views';

export interface NewGameOptions {
  seed?: number;
  company: string;
  founderName: string;
  origin: FounderOriginId;
  difficulty: DifficultyId;
  /** how the founder looks, random when left out */
  look?: Look;
}

export const SAVE_VERSION = 1;

const AWARD_PRIZE = { best: 60, crowd: 30, cash: 1500 };

export function unlocked(game: Game, u: Unlock): boolean {
  const s = game.s;
  if (u.year !== undefined && yearOf(s.day) < u.year) return false;
  if (u.karma !== undefined && s.company.karma < u.karma) return false;
  return true;
}

export class Game {
  readonly ctx: Ctx;

  constructor(content: Content, state: GameState) {
    const diff = DIFFICULTIES.find((d) => d.id === state.difficulty) ?? DIFFICULTIES[1];
    this.ctx = { s: state, c: content, rng: new Rng(state.rng), out: [], bad: diff.bad, revenue: diff.revenue };
  }

  get s(): GameState {
    return this.ctx.s;
  }

  get c(): Content {
    return this.ctx.c;
  }

  /** Serializable snapshot. */
  snapshot(): GameState {
    this.s.rng = this.ctx.rng.state;
    return this.s;
  }

  /** Hands over what happened since the last call. */
  drain(): Notice[] {
    const out = this.ctx.out;
    this.ctx.out = [];
    return out;
  }

  get pending(): Prompt | undefined {
    return this.s.pending[0];
  }

  /* ------------------------------------------------------------- creation */

  static create(content: Content, opts: NewGameOptions): Game {
    const seed = opts.seed ?? hashSeed(`${opts.company}|${opts.founderName}|${Date.now()}`);
    const rng = new Rng(seed);
    const diff = DIFFICULTIES.find((d) => d.id === opts.difficulty) ?? DIFFICULTIES[1];
    const origin = FOUNDER_ORIGINS.find((o) => o.id === opts.origin) ?? FOUNDER_ORIGINS[0];
    const state: GameState = {
      v: SAVE_VERSION,
      seed,
      rng: rng.state,
      difficulty: diff.id,
      day: 0,
      nextId: 1,
      company: {
        name: opts.company,
        founderOrigin: origin.id,
        cash: diff.cash,
        tokens: START.tokens,
        tokenPlan: 'hobby',
        karma: 0,
        spaghetti: START.spaghetti,
        officeTier: 0,
        items: [],
        tools: [content.tools[0]?.id ?? 'tab'],
        activeTool: content.tools[0]?.id ?? 'tab',
        bankruptStrikes: 0,
        crunch: false,
        fundingTaken: [],
        totalRevenue: 0,
        monthlyRevenue: [],
      },
      staff: [],
      candidates: [],
      project: null,
      shipped: [],
      flags: [],
      counters: {},
      achievements: [],
      seenEvents: {},
      seenVignettes: {},
      pending: [],
      tally: { revenue: 0, appsLaunched: 0 },
      ledger: [],
      ending: null,
      tutorial: [],
    };
    const game = new Game(content, state);
    game.seedTeam(opts.founderName, origin.skills, origin.trait, opts.look);
    game.refreshCandidates();
    return game;
  }

  private seedTeam(founderName: string, originSkills: Record<SkillKey, number>, originTrait: string, look?: Look): void {
    const { s, c, rng } = this.ctx;
    const founderA = c.archetypes.find((a) => a.id === 'founder') ?? c.archetypes[0]!;
    const founder: Staff = {
      id: 's0',
      name: founderName,
      archetype: founderA.id,
      look: look ? { ...look } : { ...randomLook(rng, founderA), accessory: 0 },
      skills: { ...originSkills },
      level: 1,
      xp: 0,
      mood: 80,
      salary: 0,
      traits: c.traits.some((t) => t.id === originTrait) ? [originTrait] : [],
      hiredOn: 0,
      assign: 'build',
      awayUntil: 0,
      isFounder: true,
      grumpyDays: 0,
    };
    s.staff.push(founder);
    for (const id of ['vibecoder', 'intern']) {
      if (!c.archetypes.some((a) => a.id === id)) continue;
      const cand = makeCandidate(rng, c, s, id, 1, 0);
      s.staff.push({ ...staffFromCandidate(cand, 0), mood: 78 });
    }
  }

  /* ----------------------------------------------------------- the loop */

  /** Can the clock run? False while the game waits on the player. */
  get running(): boolean {
    return this.s.pending.length === 0 && !this.s.ending;
  }

  /** Advances one day. Does nothing while a prompt is open. */
  tick(): void {
    if (!this.running) return;
    const { s } = this.ctx;
    const day = s.day;

    if (isMonthStart(day) && day > 0) {
      this.ctx.out.push({ t: 'newMonth', month: 1 + Math.floor((day % 336) / DAYS_PER_MONTH), year: yearOf(day) });
      this.refreshCandidates();
      rollDaily(this.ctx, 'month');
    }

    this.staffDay();

    const income = dailyIncome(this.ctx);
    if (income > 0) {
      s.company.cash += income;
      s.tally.revenue += income;
      s.company.totalRevenue += income;
    }

    const p = s.project;
    if (p) {
      if (p.status === 'waiting' && day >= p.readyOn) {
        p.status = 'ready';
        s.pending.push({ t: 'ready' });
      } else if (p.status === 'dev' && (isWorkday(day) || s.company.crunch)) {
        devStep(this.ctx);
        if (s.pending.length === 0) rollDaily(this.ctx, 'dev');
      }
    }
    if (s.pending.length === 0 && isWorkday(day)) rollDaily(this.ctx, 'rare');

    if (isPayday(day)) {
      const report = runPayday(this.ctx);
      s.pending.push({ t: 'payday', report });
      sound(this.ctx, 'payday');
      if (isBankrupt(this.ctx)) {
        this.finish(true);
        s.day += 1;
        return;
      }
    }

    if (isYearEnd(day)) {
      const year = yearOf(day);
      s.pending.push({ t: 'awards', year });
      if (year < 3) {
        const target = FUNDING_TARGETS[year - 1]!;
        const v = valuation(this.ctx);
        s.pending.push({ t: 'funding', year, valuation: v, target, passed: v >= target });
      }
      this.ctx.out.push({ t: 'newYear', year: year + 1 });
    }

    if (day >= TOTAL_DAYS - 1) {
      this.finish(false);
    }

    this.checkAchievements();
    s.day += 1;
  }

  private finish(bankrupt: boolean): void {
    const { s } = this.ctx;
    s.ending = pickEnding(this.ctx, bankrupt);
    s.pending.push({ t: 'ending' });
  }

  private staffDay(): void {
    const { s, c, rng } = this.ctx;
    const p = s.project;
    const overdue = p && p.status === 'dev' ? Math.max(0, s.day - p.startDay - p.workTotal * (7 / 5) * 1.6) : 0;
    const rateLimited = s.company.tokens <= 0;
    for (const m of s.staff.slice()) {
      let target = 62 + traitMood(c, m) + itemMood(s);
      if (s.company.crunch) target -= 22;
      if (overdue > 0) target -= 6;
      if (rateLimited && p?.status === 'dev') target -= 8;
      if (s.day < m.awayUntil) target += 4;
      m.mood = clamp(m.mood + (target - m.mood) * 0.04 + (rng.next() - 0.5) * 0.6, 0, 100);
      if (m.mood < 15) m.grumpyDays += 1;
      else m.grumpyDays = 0;
      if (m.grumpyDays >= 14 && !m.isFounder) {
        toast(this.ctx, `${m.name} quit. Their resignation email was one word: "vibes".`, 'bad');
        removeStaff(this.ctx, m, 'quit');
      }
    }
  }

  private checkAchievements(): void {
    const { s, c } = this.ctx;
    const view = companyView(s);
    for (const a of c.achievements) {
      if (s.achievements.includes(a.id)) continue;
      let hit = false;
      try {
        hit = a.when({ counters: s.counters, company: view });
      } catch {
        hit = false;
      }
      if (!hit) continue;
      s.achievements.push(a.id);
      this.ctx.out.push({ t: 'achievement', id: a.id });
      sound(this.ctx, 'achievement');
    }
  }

  /* -------------------------------------------------------------- prompts */

  /** Pick a card for the open card prompt, or null to skip. */
  pickCard(id: string | null): void {
    pickCardImpl(this.ctx, id);
  }

  resolveEvent(choice: number): EventOutcome | null {
    const out = resolveEventImpl(this.ctx, choice);
    this.checkAchievements();
    return out;
  }

  ackPayday(): void {
    if (this.s.pending[0]?.t === 'payday') this.s.pending.shift();
  }

  /** Who wins the Vibey Awards this year. Pure, the prizes are paid when the show ends. */
  awardsFor(year: number): { id: string; title: string; app: ShippedApp | null; prize: string }[] {
    const apps = this.s.shipped.filter((a) => yearOf(a.launchDay) === year);
    const best = (f: (a: ShippedApp) => number) => apps.reduce<ShippedApp | null>((b, a) => (!b || f(a) > f(b) ? a : b), null);
    const worst = apps.length >= 3 ? apps.reduce<ShippedApp | null>((b, a) => (!b || a.score < b.score ? a : b), null) : null;
    const k = AWARD_PRIZE;
    return [
      { id: 'best', title: 'Best Vibes', app: best((a) => a.score), prize: `+${k.best} karma` },
      { id: 'crowd', title: 'Most Upvoted', app: best((a) => a.karma), prize: `+${k.crowd} karma` },
      { id: 'cash', title: 'Cash Cow', app: best((a) => a.earned), prize: `+$${Math.round(k.cash * cashScale(this.s)).toLocaleString('en-US')}` },
      { id: 'worst', title: 'Participation Trophy', app: worst, prize: 'a hug' },
    ];
  }

  ackAwards(): void {
    if (this.s.pending[0]?.t !== 'awards') return;
    const top = this.s.pending[0];
    const won = this.awardsFor(top.year);
    for (const w of won) {
      if (!w.app) continue;
      if (w.id === 'best') this.s.company.karma += AWARD_PRIZE.best;
      if (w.id === 'crowd') this.s.company.karma += AWARD_PRIZE.crowd;
      if (w.id === 'cash') addCash(this.ctx, Math.round(AWARD_PRIZE.cash * cashScale(this.s)), 'Vibey Award: Cash Cow');
      if (w.id === 'worst') for (const m of this.s.staff) m.mood = clamp(m.mood + 3, 0, 100);
    }
    this.s.pending.shift();
  }

  fundingChoices() {
    return fundingOffers(this.ctx);
  }

  /** Answers the funding prompt. Returns the line to show. */
  takeFunding(offerId: string | null): string {
    const top = this.s.pending[0];
    if (top?.t !== 'funding') return '';
    this.s.pending.shift();
    if (!top.passed) {
      for (const m of this.s.staff) m.mood = clamp(m.mood - 4, 0, 100);
      return 'Nobody called back. The investors are "busy". The team is "fine".';
    }
    return offerId ? takeFundingImpl(this.ctx, offerId) : '';
  }

  ackEnding(): void {
    if (this.s.pending[0]?.t === 'ending') this.s.pending.shift();
  }

  /* ------------------------------------------------------------ projects */

  canStart(plan: ProjectPlan): string | null {
    const { s, c } = this.ctx;
    if (s.project) return 'You are already building something.';
    if (!s.company.tools.includes(plan.tool)) return 'You do not own that tool.';
    if (!unlocked(this, SCOPES[plan.scope].unlock)) return `${SCOPES[plan.scope].label} unlocks with more karma. Ship a few things first.`;
    if (!unlocked(this, c.kind(plan.kind).unlock)) return 'That kind of app is still locked.';
    if (!unlocked(this, c.niche(plan.niche).unlock)) return 'That audience is still locked.';
    if (s.staff.length === 0) return 'Nobody works here. That is a vibe, but no.';
    return null;
  }

  /** What the wizard shows before the player commits: likely stats and how long it takes. */
  forecast(plan: Pick<ProjectPlan, 'kind' | 'scope' | 'tool' | 'team'>): Forecast {
    return forecastImpl(this.ctx, plan);
  }

  startProject(plan: ProjectPlan) {
    const err = this.canStart(plan);
    if (err) throw new Error(err);
    sound(this.ctx, 'select');
    return startProject(this.ctx, plan);
  }

  tapIdea() {
    return tapIdea(this.ctx);
  }

  /**
   * The player presses Launch. May answer with a prompt to resolve first
   * ('friday' or 'event'); call it again after that. Returns the app when it ships.
   */
  launch(channelId: string): { t: 'friday' } | { t: 'event' } | { t: 'launched'; app: ShippedApp; incident: boolean } | { t: 'invalid'; why: string } {
    const { s, c } = this.ctx;
    const p = s.project;
    if (!p || p.status !== 'ready' || s.pending[0]?.t !== 'ready') return { t: 'invalid', why: 'Nothing is ready to launch.' };
    const ch = c.channel(channelId);
    if (!unlocked(this, ch.unlock)) return { t: 'invalid', why: 'That channel is still locked.' };
    const cost = Math.round(ch.cost * cashScale(s));
    if (cost > s.company.cash + 20000) return { t: 'invalid', why: 'Even on credit you cannot afford that.' };

    if (isFriday(s.day) && !p.flags.includes('friday_decided')) {
      s.pending.unshift({ t: 'friday' });
      return { t: 'friday' };
    }
    if (!p.flags.includes('launch_event_done')) {
      p.flags.push('launch_event_done');
      if (rollDaily(this.ctx, 'launch')) {
        // the event goes on top of the ready prompt
        const ev = s.pending.pop()!;
        s.pending.unshift(ev);
        return { t: 'event' };
      }
    }
    s.pending.shift();
    const result = launchProject(this.ctx, channelId);
    this.checkAchievements();
    return { t: 'launched', app: result.app, incident: result.incident };
  }

  /** The Friday decision. 'yolo' deploys now; 'wait' holds the launch until Monday. */
  fridayChoice(choice: 'yolo' | 'wait'): void {
    const { s } = this.ctx;
    const p = s.project;
    if (!p || s.pending[0]?.t !== 'friday') return;
    s.pending.shift();
    p.flags.push('friday_decided');
    if (choice === 'yolo') {
      p.fridayDeploy = true;
      return;
    }
    s.pending.shift();
    p.status = 'waiting';
    p.readyOn = s.day + 3 - dowOf(s.day) + 4;
    for (const m of s.staff) m.mood = clamp(m.mood + 6, 0, 100);
    toast(this.ctx, 'You waited. The weekend was lovely. Monday will not be.', 'good');
  }

  /* --------------------------------------------------------------- staff */

  /** What the run would score if it ended today. */
  scoreNow(): number {
    return finalScore(this.ctx);
  }

  monthlyBurn(): number {
    return monthlyBurn(this.ctx);
  }

  freeDesks(): number {
    return OFFICE_TIERS[this.s.company.officeTier]!.desks - this.s.staff.length;
  }

  refreshCandidates(): void {
    const { s, c, rng } = this.ctx;
    const year = yearOf(s.day);
    const pool = c.archetypes.filter((a) => !a.special && a.id !== 'founder' && unlocked(this, a.unlock));
    const board: typeof s.candidates = [];
    const kinds = rng.shuffle(pool);
    for (let i = 0; i < Math.min(6, Math.max(kinds.length, 1)); i++) {
      const a = kinds[i % kinds.length];
      if (!a) break;
      board.push(makeCandidate(rng, c, s, a.id, year, s.company.officeTier));
    }
    s.candidates = board;
  }

  hire(candidateId: string): string | null {
    const { s, c } = this.ctx;
    const cand = s.candidates.find((x) => x.id === candidateId);
    if (!cand) return 'That candidate took another offer.';
    if (this.freeDesks() <= 0) return 'No free desk. Upgrade the office or let someone go.';
    if (s.company.cash < cand.fee) return 'Not enough cash for the signing fee.';
    addCash(this.ctx, -cand.fee, `Signing fee: ${cand.name}`);
    s.candidates = s.candidates.filter((x) => x.id !== candidateId);
    const staff = staffFromCandidate(cand, s.day);
    s.staff.push(staff);
    bump(this.ctx, 'hires');
    toast(this.ctx, `${staff.name} joined as ${c.archetype(staff.archetype).role}.`, 'good', staff.id);
    sound(this.ctx, 'hire');
    return null;
  }

  fire(staffId: string): void {
    const m = this.s.staff.find((x) => x.id === staffId);
    if (!m || m.isFounder) return;
    addCash(this.ctx, -Math.round(m.salary * 0.5), `Severance: ${m.name}`);
    for (const o of this.s.staff) if (o !== m) o.mood = clamp(o.mood - 5, 0, 100);
    removeStaff(this.ctx, m, 'fired');
    sound(this.ctx, 'fire');
  }

  setAssign(staffId: string, assign: 'build' | 'support'): void {
    const m = this.s.staff.find((x) => x.id === staffId);
    if (m) m.assign = assign;
  }

  trainCost(m: Staff, skill: SkillKey): number {
    return Math.round((400 + m.skills[skill] * 18) * cashScale(this.s));
  }

  train(staffId: string, skill: SkillKey): string | null {
    const { s, rng } = this.ctx;
    const m = s.staff.find((x) => x.id === staffId);
    if (!m) return 'Nobody there.';
    if (s.day < m.awayUntil) return 'Already away.';
    const cost = this.trainCost(m, skill);
    if (s.company.cash < cost) return 'Not enough cash for the course.';
    addCash(this.ctx, -cost, `Training: ${m.name}`);
    m.awayUntil = s.day + 4;
    m.awayWhy = `${skill} bootcamp`;
    const gain = rng.chance(0.3) ? 3 : 2;
    m.skills[skill] = clamp(m.skills[skill] + gain, 1, 99);
    if (gainXp(m, 12, rng)) this.ctx.out.push({ t: 'levelUp', staffId: m.id, level: m.level });
    toast(this.ctx, `${m.name} came back with +${gain} ${skill} and a lanyard.`, 'good', m.id);
    sound(this.ctx, 'level_up');
    return null;
  }

  therapyCost(): number {
    return Math.round(450 * cashScale(this.s));
  }

  therapy(staffId: string): string | null {
    const { s } = this.ctx;
    const m = s.staff.find((x) => x.id === staffId);
    if (!m) return 'Nobody there.';
    if (s.day < m.awayUntil) return 'Already away.';
    const cost = this.therapyCost();
    if (s.company.cash < cost) return 'Not enough cash.';
    addCash(this.ctx, -cost, `Wellness day: ${m.name}`);
    m.awayUntil = s.day + 3;
    m.awayWhy = 'wellness day';
    m.mood = clamp(m.mood + 40, 0, 100);
    m.grumpyDays = 0;
    toast(this.ctx, `${m.name} touched grass. It was surprisingly effective.`, 'good', m.id);
    return null;
  }

  raise(staffId: string): string | null {
    const m = this.s.staff.find((x) => x.id === staffId);
    if (!m || m.isFounder) return 'No.';
    m.salary = Math.round((m.salary * 1.12) / 50) * 50;
    m.mood = clamp(m.mood + 18, 0, 100);
    toast(this.ctx, `${m.name} got a raise and a very long hug.`, 'good', m.id);
    return null;
  }

  setCrunch(on: boolean): void {
    this.s.company.crunch = on;
    if (on) {
      toast(this.ctx, 'Crunch mode on. Weekends are a state of mind.', 'bad');
      sound(this.ctx, 'alert');
    }
  }

  refactorSprint(): string | null {
    const { s } = this.ctx;
    const p = s.project;
    if (p && p.status === 'dev') {
      p.stalledUntil = Math.max(p.stalledUntil, s.day) + 5;
      p.delayed += 5;
    }
    addSpaghetti(this.ctx, -20);
    for (const m of s.staff) m.mood = clamp(m.mood - 3, 0, 100);
    toast(this.ctx, 'Refactor sprint. The code is a little less haunted.', 'good');
    return null;
  }

  /* ---------------------------------------------------------------- shop */

  buyItem(id: string): string | null {
    const { s } = this.ctx;
    const it = shopItem(id);
    if (s.company.items.includes(id)) return 'Already own that.';
    if (s.company.officeTier < it.tier) return 'You need a bigger office first.';
    if (s.company.cash < it.price) return 'Not enough cash.';
    addCash(this.ctx, -it.price, it.name);
    s.company.items.push(id);
    toast(this.ctx, it.quip, 'good');
    sound(this.ctx, 'cash_register');
    return null;
  }

  buyTool(id: string): string | null {
    const { s, c } = this.ctx;
    const tool = c.tool(id);
    if (s.company.tools.includes(id)) return 'Already licensed.';
    if (!unlocked(this, tool.unlock)) return 'Locked for now.';
    if (s.company.cash < tool.price) return 'Not enough cash.';
    addCash(this.ctx, -tool.price, `License: ${tool.name}`);
    s.company.tools.push(id);
    toast(this.ctx, `${tool.name} installed. Everyone says it is worth it.`, 'good');
    sound(this.ctx, 'cash_register');
    return null;
  }

  setTool(id: string): void {
    if (this.s.company.tools.includes(id)) this.s.company.activeTool = id;
  }

  setTokenPlan(id: string): string | null {
    const plan = TOKEN_PLANS.find((p) => p.id === id);
    if (!plan) return 'No such plan.';
    this.s.company.tokenPlan = id;
    this.s.company.tokens = Math.max(this.s.company.tokens, plan.tokens);
    toast(this.ctx, `Plan switched to ${plan.name}. Billing starts at the next payday.`, 'info');
    return null;
  }

  topUpPrice(): number {
    return Math.round(TOPUP_PRICE * cashScale(this.s));
  }

  buyTokens(): string | null {
    const { s } = this.ctx;
    const price = this.topUpPrice();
    if (s.company.cash < price) return 'Not enough cash.';
    addCash(this.ctx, -price, 'Token top-up');
    s.company.tokens += 100;
    sound(this.ctx, 'coin');
    return null;
  }

  upgradeOffice(): string | null {
    const { s } = this.ctx;
    const next = OFFICE_TIERS[s.company.officeTier + 1];
    if (!next) return 'This is the top floor.';
    if (s.company.cash < next.upgrade) return 'Not enough cash.';
    addCash(this.ctx, -next.upgrade, `Moved to ${next.name}`);
    s.company.officeTier += 1;
    for (const m of s.staff) m.mood = clamp(m.mood + 12, 0, 100);
    toast(this.ctx, `Welcome to ${next.name}.`, 'wow');
    sound(this.ctx, 'fanfare_big');
    this.refreshCandidates();
    return null;
  }
}
