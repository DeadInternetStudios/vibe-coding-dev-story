/**
 * The one gate every saved run goes through, whether it comes out of this browser's storage or from a pasted save code.
 * A save is plain JSON that anyone can edit or invent, so it is read field by field against what the game reads
 * (types, ranges, ids the content knows) and then played forward on a copy. What fails is turned away like a save from
 * another version: the title says so and offers NEW GAME. The game never starts from a save this file has not passed.
 *
 * A new field in GameState or in a record below fails to compile here until it has a check. When a later version renames or
 * removes content ids, migrate old saves in `loadSave` first, or this gate turns those players' runs away.
 */
import { SKILL_KEYS, STAT_KEYS } from '../content/types';
import { VOICES } from '../content/vo';
import { CARDS } from '../sim/cards';
import { DIFFICULTIES, FOUNDER_ORIGINS, OFFICE_TIERS, SCOPES, TOKEN_PLANS, TOTAL_DAYS } from '../sim/config';
import type { Content } from '../sim/content';
import { Game, SAVE_VERSION } from '../sim/game';
import { SHOP } from '../sim/shop';
import type { Candidate, EndingResult, GameState, LedgerLine, Look, PaydayReport, Project, Prompt, ShippedApp, Staff, ThreadRecord } from '../sim/types';

/** null when the value is fine, else a short note on what was expected, led by the path to it */
type Check = (v: unknown) => string | null;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const num =
  (lo = -1e13, hi = 1e13): Check =>
  (v) =>
    typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? null : `a number from ${lo} to ${hi}`;
const int =
  (lo: number, hi: number): Check =>
  (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? null : `a whole number from ${lo} to ${hi}`;
const str =
  (max: number): Check =>
  (v) =>
    typeof v === 'string' && v.length <= max ? null : `text of at most ${max} characters`;
const bool: Check = (v) => (typeof v === 'boolean' ? null : 'true or false');
const oneOf = (ids: readonly string[]): Check => {
  const set = new Set(ids);
  return (v) => (typeof v === 'string' && set.has(v) ? null : `one of ${ids.slice(0, 5).join(', ')}${ids.length > 5 ? ', ...' : ''}`);
};
const opt =
  (c: Check): Check =>
  (v) =>
    v === undefined ? null : c(v);
const orNull =
  (c: Check): Check =>
  (v) =>
    v === null ? null : c(v);
const arr =
  (c: Check, max: number, min = 0): Check =>
  (v) => {
    if (!Array.isArray(v) || v.length > max || v.length < min) return `a list of ${min} to ${max}`;
    for (let i = 0; i < v.length; i++) {
      const why = c(v[i]);
      if (why) return `[${i}] ${why}`;
    }
    return null;
  };
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const rec =
  (c: Check, max: number): Check =>
  (v) => {
    if (!isRecord(v)) return 'a table';
    const keys = Object.keys(v);
    if (keys.length > max) return `a table of at most ${max} entries`;
    for (const k of keys) {
      if (UNSAFE_KEYS.has(k)) return `a table without the key ${k}`;
      const why = c(v[k]);
      if (why) return `${k}: ${why}`;
    }
    return null;
  };
const obj =
  (shape: Record<string, Check>): Check =>
  (v) => {
    if (!isRecord(v)) return 'an object';
    for (const [k, c] of Object.entries(shape)) {
      const why = c(v[k]);
      if (why) return `${k}: ${why}`;
    }
    return null;
  };

const money = num(-1e12, 1e12);
const count = int(0, 1e7);
const day = num(-1e4, 1e5);
const index = int(0, 999);
const tag = str(80);
const AWARD_IDS = ['gold', 'silver', 'wholesome', 'helpful', 'facepalm', 'deceased', 'rocket', 'copium'];

const look = obj({ skin: index, hair: index, hairColor: index, outfit: index, pants: opt(index), accessory: index } satisfies Record<keyof Look, Check>);
const skills = obj(Object.fromEntries(SKILL_KEYS.map((k) => [k, num(0, 999)])));
const stats = obj(Object.fromEntries(STAT_KEYS.map((k) => [k, num(-1e4, 1e6)])));
const ledgerLine = obj({ label: str(160), amount: money, note: opt(str(400)) } satisfies Record<keyof LedgerLine, Check>);
const voiceLine = obj({
  kind: oneOf(['vo']),
  id: (v) => (typeof v === 'string' && /^[a-z]+-[0-9a-f]{8}$/.test(v) ? null : 'a voice clip id'),
  voice: oneOf(VOICES),
  text: str(600),
  delivery: opt(str(200)),
});
const payday = obj({
  month: int(0, 400),
  year: int(0, 40),
  income: money,
  lines: arr(ledgerLine, 200),
  recap: arr(ledgerLine, 200),
  total: money,
  cashAfter: money,
  headline: str(400),
  warnings: arr(str(400), 20),
} satisfies Record<keyof PaydayReport, Check>);
const ending = obj({ endingId: tag, rank: oneOf(['S', 'A', 'B', 'C', 'D', 'F']), score: money, valuation: money, bankrupt: bool, day } satisfies Record<keyof EndingResult, Check>);

/** Prompts by their `t`. Each shape must name every key of its kind of prompt. */
function promptChecks(content: Content): Map<string, Check> {
  const eventIds = content.events.map((e) => e.id);
  const cardIds = CARDS.map((c) => c.id);
  type Kind<T extends Prompt['t']> = keyof Extract<Prompt, { t: T }>;
  return new Map<string, Check>([
    [
      'event',
      obj({
        eventId: oneOf(eventIds),
        title: str(300),
        body: str(3000),
        speaker: oneOf([...VOICES, 'system']),
        line: opt(voiceLine),
        choices: arr(obj({ label: str(200), hint: opt(str(300)), enabled: bool }), 8, 1),
      } satisfies Record<Exclude<Kind<'event'>, 't'>, Check>),
    ],
    ['card', obj({ phase: int(0, 3), options: arr(oneOf(cardIds), 6) } satisfies Record<Exclude<Kind<'card'>, 't'>, Check>)],
    ['ready', obj({})],
    ['payday', obj({ report: payday } satisfies Record<Exclude<Kind<'payday'>, 't'>, Check>)],
    ['funding', obj({ year: int(1, 3), valuation: money, target: money, passed: bool } satisfies Record<Exclude<Kind<'funding'>, 't'>, Check>)],
    ['awards', obj({ year: int(1, 3) } satisfies Record<Exclude<Kind<'awards'>, 't'>, Check>)],
    ['friday', obj({})],
    ['ending', obj({})],
  ]);
}

function stateCheck(content: Content): Check {
  const ids = <T extends { id: string }>(xs: readonly T[]) => xs.map((x) => x.id);
  const archetype = oneOf(ids(content.archetypes));
  const trait = oneOf(ids(content.traits));
  const tool = oneOf(ids(content.tools));
  const vignette = oneOf(ids(content.vignettes));
  const stat = oneOf([...STAT_KEYS]);
  const scope = oneOf(Object.keys(SCOPES));

  const staff = obj({
    id: tag,
    name: str(60),
    archetype,
    look,
    skills,
    level: int(1, 99),
    xp: num(0, 1e9),
    mood: num(-1e3, 1e3),
    salary: num(0, 1e9),
    traits: arr(trait, 12),
    hiredOn: day,
    assign: oneOf(['build', 'support']),
    awayUntil: day,
    awayWhy: opt(str(200)),
    isFounder: opt(bool),
    grumpyDays: int(0, 1e5),
    quote: opt(str(400)),
  } satisfies Record<keyof Staff, Check>);

  const candidate = obj({ id: tag, name: str(60), archetype, look, skills, traits: arr(trait, 12), salary: num(0, 1e9), fee: num(0, 1e9) } satisfies Record<keyof Candidate, Check>);

  const project = obj({
    id: count,
    name: str(80),
    kind: oneOf(ids(content.kinds)),
    niche: oneOf(ids(content.niches)),
    tool,
    scope,
    startDay: day,
    progress: num(0, 1e4),
    workTotal: num(0, 1e6),
    stats,
    hype: num(-1e3, 1e4),
    hotIdeas: count,
    status: oneOf(['dev', 'ready', 'waiting']),
    readyOn: day,
    idea: orNull(obj({ id: count, staffId: tag, until: day, stat })),
    card: orNull(oneOf(CARDS.map((c) => c.id))),
    cardPhase: int(-1, 3),
    offered: arr(oneOf(CARDS.map((c) => c.id)), 6),
    flags: arr(str(80), 60),
    delayed: num(0, 1e5),
    stalledUntil: day,
    rateLimitedDays: num(0, 1e5),
    fridayDeploy: bool,
    tagline: str(300),
  } satisfies Record<keyof Project, Check>);

  const thread = obj({
    channel: oneOf(ids(content.channels)),
    title: str(400),
    body: str(4000),
    opVotes: num(-1e9, 1e9),
    vignettes: arr(obj({ id: vignette, rating: num(-1e4, 1e4), judges: str(60), votes: arr(num(-1e9, 1e9), 60) }), 40),
    awards: arr(obj({ vignette: str(80), index: int(0, 99), award: oneOf(AWARD_IDS) }), 80),
    mod: opt(voiceLine),
    edit: opt(voiceLine),
  } satisfies Record<keyof ThreadRecord, Check>);

  const shipped = obj({
    id: count,
    name: str(80),
    kind: oneOf(ids(content.kinds)),
    niche: oneOf(ids(content.niches)),
    tool,
    scope,
    launchDay: day,
    channel: oneOf(ids(content.channels)),
    quality: num(-1e4, 1e4),
    hype: num(-1e3, 1e4),
    stats,
    score: num(0, 100),
    ratings: arr(num(-1e4, 1e4), 40),
    karma: num(-1e9, 1e9),
    lifetime: money,
    earned: money,
    spikeAmp: num(-1e12, 1e12),
    tailAmp: num(-1e12, 1e12),
    fridayDeploy: bool,
    incident: bool,
    thread,
    review: opt(obj({ stars: int(1, 5), text: str(600), user: str(80) })),
  } satisfies Record<keyof ShippedApp, Check>);

  const prompts = promptChecks(content);
  const prompt: Check = (v) => {
    if (!isRecord(v) || typeof v.t !== 'string') return 'a prompt';
    const c = prompts.get(v.t);
    return c ? c(v) : 'a prompt of a known kind';
  };

  return obj({
    v: (v) => (v === SAVE_VERSION ? null : `version ${SAVE_VERSION}`),
    seed: num(-1e15, 1e15),
    rng: num(-1e15, 1e15),
    difficulty: oneOf(DIFFICULTIES.map((d) => d.id)),
    daily: opt(str(10)),
    day: int(0, TOTAL_DAYS + 2),
    nextId: int(0, 1e7),
    company: obj({
      name: str(60),
      founderOrigin: oneOf(FOUNDER_ORIGINS.map((o) => o.id)),
      cash: money,
      tokens: num(-1e12, 1e12),
      tokenPlan: oneOf(TOKEN_PLANS.map((p) => p.id)),
      karma: num(-1e9, 1e9),
      spaghetti: num(-1e6, 1e6),
      officeTier: int(0, OFFICE_TIERS.length - 1),
      items: arr(oneOf(SHOP.map((i) => i.id)), 80),
      tools: arr(tool, 40, 1),
      activeTool: tool,
      bankruptStrikes: int(0, 1e3),
      crunch: bool,
      fundingTaken: arr(str(80), 20),
      totalRevenue: money,
      monthlyRevenue: arr(money, 400),
    } satisfies Record<keyof GameState['company'], Check>),
    staff: arr(staff, 40, 1),
    candidates: arr(candidate, 40),
    project: orNull(project),
    shipped: arr(shipped, 400),
    flags: arr(str(80), 600),
    counters: rec(num(-1e12, 1e12), 600),
    achievements: arr(str(80), 400),
    seenEvents: rec(day, 2000),
    seenVignettes: rec(day, 2000),
    pending: arr(prompt, 20),
    tally: obj({ revenue: money, appsLaunched: count }),
    ledger: arr(ledgerLine, 400),
    ending: orNull(ending),
    tutorial: arr(str(80), 200),
  } satisfies Record<keyof GameState, Check>);
}

/** Days played forward on a copy before a save is believed. Two paydays and a month start. */
const TRIAL_DAYS = 60;

/** The sim moves only when no prompt waits, so the trial clears the way and lets the days run. */
function playsOn(state: GameState, content: Content): string | null {
  const copy = JSON.parse(JSON.stringify(state)) as GameState;
  try {
    const game = new Game(content, copy);
    for (let i = 0; i < TRIAL_DAYS && !copy.ending; i++) {
      copy.pending.length = 0;
      game.tick();
      game.drain();
    }
    return null;
  } catch (e) {
    return `it cannot be played on: ${e instanceof Error ? e.message : String(e)}`;
  }
}

const checks = new WeakMap<Content, Check>();

/**
 * What is wrong with this save, in a few words, or null when the game can open it.
 * `raw` is the parsed JSON. Reading it checks every field; then 60 days are played on a copy.
 */
export function problemWithSave(raw: unknown, content: Content): string | null {
  let check = checks.get(content);
  if (!check) checks.set(content, (check = stateCheck(content)));
  const why = check(raw);
  return why ?? playsOn(raw as GameState, content);
}
