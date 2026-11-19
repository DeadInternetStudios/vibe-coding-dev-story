import { describe, expect, it } from 'vitest';
import * as C from './index';
import { collectVoiceLines } from './collect';
import { EVENTS as BASE_EVENTS } from './events';
import { VIGNETTES as BASE_VIGNETTES } from './threads';
import { LOADING as BASE_LOADING, TIPS as BASE_TIPS, HEADLINES as BASE_HEADLINES } from './flavor';
import { ACHIEVEMENTS as BASE_ACHIEVEMENTS } from './achievements';
import { OP_EDITS, MOD_NOTICES, REDDIT_VIGNETTES, REDDIT_HEADLINES, REDDIT_LOADING, REDDIT_TIPS } from './reddit';
import { REDDIT_ACHIEVEMENTS, REDDIT_EVENTS } from './redditEvents';
import type { CompanyView, Effect, EventCtx, GameEvent, ProjectView, StatKey, ThreadCtx } from './types';

/**
 * Guards for the Reddit tropes pack. They keep the pack inside its voice budget, keep
 * every event hint honest, and make sure no joke lands twice.
 */

const NEW_VOICED_BUDGET = 230;
const NEW_LINE_MAX_CHARS = 140;
const SIM_COUNTERS = [
  'apps_shipped', 'best_rating', 'perfect_scores', 'friday_deploys', 'friday_incidents', 'bankrupt_scares',
  'months_survived', 'hires', 'fires', 'quits', 'events_seen', 'hot_ideas', 'cards_played',
];

/* ------------------------------------------------------------------ views */

function company(over: Partial<CompanyView> = {}): CompanyView {
  return {
    year: 1, month: 1, day: 0, cash: 40000, tokens: 300, karma: 0, spaghetti: 10,
    staffCount: 3, deskCount: 4, officeTier: 0, appsShipped: 0,
    flags: new Set<string>(), counters: {},
    hasArchetype: () => false,
    hasTrait: () => false,
    ...over,
  };
}

function project(over: Partial<ProjectView> = {}): ProjectView {
  const stats = { vibes: 60, features: 60, polish: 60, stability: 60, security: 60 } as Record<StatKey, number>;
  return {
    name: 'Fetchly', kind: 'todo', niche: 'dogs', tool: 'tab', scope: 'mvp', stats, quality: 60,
    hype: 60, channel: 'quiet', weeksTaken: 8, fridayDeploy: false, hotIdeas: 0, flags: new Set<string>(), ...over,
  };
}

const threadCtx = (channel: string): ThreadCtx => ({ company: company(), project: project({ channel }), rand: () => 0.5 });

/* ---------------------------------------------------------------- helpers */

const packLines = collectVoiceLines({ REDDIT_VIGNETTES, OP_EDITS, MOD_NOTICES, REDDIT_EVENTS });
const baseLines = collectVoiceLines({ BASE_VIGNETTES, BASE_EVENTS });

const words = (s: string): string[] => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);

function* effectsOf(list: Effect[]): Generator<Effect> {
  for (const e of list) {
    yield e;
    if (e.t === 'chance') {
      yield* effectsOf(e.yes);
      yield* effectsOf(e.no ?? []);
    }
  }
}

/** Something that costs the player, now or on a bad roll. */
function isDownside(e: Effect): boolean {
  switch (e.t) {
    case 'cash': case 'tokens': case 'karma': case 'mood': case 'hype': case 'stat': case 'progress': return e.n < 0;
    case 'spaghetti': return e.n > 0;
    case 'delay': return e.days > 0;
    case 'fire': return true;
    case 'chance': return [...e.yes, ...(e.no ?? [])].some(isDownside);
    default: return false;
  }
}

/** The sums a hint is allowed to promise: only effects that always happen. */
function certain(list: Effect[]) {
  const sum = { cash: 0, tokens: 0, days: 0, spaghetti: 0, progress: 0 };
  for (const e of list) {
    if (e.t === 'cash') sum.cash += e.n;
    if (e.t === 'tokens') sum.tokens += e.n;
    if (e.t === 'delay') sum.days += e.days;
    if (e.t === 'spaghetti') sum.spaghetti += e.n;
    if (e.t === 'progress') sum.progress += e.n;
  }
  return sum;
}

type Promise = Partial<ReturnType<typeof certain>>;

function parseHint(hint: string): Promise | null {
  const out: Promise = {};
  for (const part of hint.split(', ')) {
    let m: RegExpMatchArray | null;
    if ((m = part.match(/^([+-])\$([\d,]+)$/))) out.cash = (m[1] === '-' ? -1 : 1) * Number(m[2]!.replace(/,/g, ''));
    else if ((m = part.match(/^tokens ([+-])(\d+)$/))) out.tokens = (m[1] === '-' ? -1 : 1) * Number(m[2]);
    else if ((m = part.match(/^(\d+) days?$/))) out.days = Number(m[1]);
    else if ((m = part.match(/^spaghetti ([+-])(\d+)$/))) out.spaghetti = (m[1] === '-' ? -1 : 1) * Number(m[2]);
    else if ((m = part.match(/^progress ([+-])(\d+)%?$/))) out.progress = (m[1] === '-' ? -1 : 1) * Number(m[2]);
    else return null;
  }
  return out;
}

/* ---------------------------------------------------------------- vignettes */

describe('reddit vignettes', () => {
  it('adds at least 36 with unique rd- ids', () => {
    expect(REDDIT_VIGNETTES.length).toBeGreaterThanOrEqual(36);
    const ids = REDDIT_VIGNETTES.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !id.startsWith('rd-'))).toEqual([]);
    const baseIds = new Set(BASE_VIGNETTES.map((v) => v.id));
    expect(ids.filter((id) => baseIds.has(id))).toEqual([]);
  });

  it('gives every channel at least three vignettes that appear nowhere else', () => {
    const short: string[] = [];
    for (const ch of C.CHANNELS) {
      const own = REDDIT_VIGNETTES.filter((v) => v.when(threadCtx(ch.id)) && C.CHANNELS.every((o) => o.id === ch.id || !v.when(threadCtx(o.id))));
      if (own.length < 3) short.push(`${ch.id}: ${own.length}`);
    }
    expect(short).toEqual([]);
  });

  it('mixes praise, roast, neutral and chaos', () => {
    const tones = new Set(REDDIT_VIGNETTES.map((v) => v.tone));
    expect([...tones].sort()).toEqual(['chaos', 'neutral', 'praise', 'roast']);
  });
});

/* ------------------------------------------------------- edits and notices */

describe('OP_EDITS and MOD_NOTICES', () => {
  it('has enough edits per outcome, all spoken by the founder in one or two edits', () => {
    expect(OP_EDITS.viral.length).toBeGreaterThanOrEqual(8);
    expect(OP_EDITS.solid.length).toBeGreaterThanOrEqual(6);
    expect(OP_EDITS.flop.length).toBeGreaterThanOrEqual(8);
    const problems: string[] = [];
    for (const [outcome, list] of Object.entries(OP_EDITS)) {
      for (const l of list) {
        if (l.voice !== 'chad') problems.push(`${outcome}: ${l.id} is not chad`);
        if (l.text.length > 120) problems.push(`${outcome}: ${l.id} is ${l.text.length} characters`);
        if (!l.text.startsWith('Edit')) problems.push(`${outcome}: ${l.id} does not start with Edit`);
        const edits = l.text.match(/\bEdit\b/g)?.length ?? 0;
        if (edits < 1 || edits > 2) problems.push(`${outcome}: ${l.id} has ${edits} Edit sentences`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('has at least eight removal notices read by the bot', () => {
    expect(MOD_NOTICES.length).toBeGreaterThanOrEqual(8);
    expect(MOD_NOTICES.filter((l) => l.voice !== 'automod')).toEqual([]);
  });
});

/* -------------------------------------------------------------- voice budget */

describe('reddit voiced lines', () => {
  it('stays inside the TTS budget and keeps each line speakable', () => {
    expect(packLines.length).toBeLessThanOrEqual(NEW_VOICED_BUDGET);
    const problems: string[] = [];
    for (const l of packLines) {
      if (l.text.length > NEW_LINE_MAX_CHARS) problems.push(`${l.id}: ${l.text.length} characters`);
      if (/[0-9$%/&@#[\]*_~^|\\=+<>]/.test(l.text)) problems.push(`${l.id}: has a symbol or digit a voice would read badly: ${l.text}`);
      if (/\b(dave|drake|streisand)\b/i.test(l.text)) problems.push(`${l.id}: says a name the game never speaks`);
    }
    expect(problems).toEqual([]);
  });

  it('does not pile onto one voice, and never onto dave', () => {
    const per = new Map<string, number>();
    for (const l of packLines) per.set(l.voice, (per.get(l.voice) ?? 0) + 1);
    expect(per.get('dave') ?? 0).toBeLessThanOrEqual(4);
    const over = [...per.entries()].filter(([, n]) => n > 40);
    expect(over).toEqual([]);
  });

  it('never reuses a line that is already in the game', () => {
    const base = new Set(baseLines.map((l) => `${l.voice}|${l.text}`));
    expect(packLines.filter((l) => base.has(`${l.voice}|${l.text}`)).map((l) => l.text)).toEqual([]);
  });
});

/* ------------------------------------------------------------------- events */

describe('reddit events', () => {
  it('adds at least 16 with unique rd- ids across all four stages', () => {
    expect(REDDIT_EVENTS.length).toBeGreaterThanOrEqual(16);
    const ids = REDDIT_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !id.startsWith('rd-'))).toEqual([]);
    const baseIds = new Set(BASE_EVENTS.map((e) => e.id));
    expect(ids.filter((id) => baseIds.has(id))).toEqual([]);
    expect(new Set(REDDIT_EVENTS.map((e) => e.stage)).size).toBe(4);
  });

  it('gives every choice a real cost or a real risk', () => {
    const free: string[] = [];
    for (const ev of REDDIT_EVENTS) {
      if (ev.choices.length < 2) free.push(`${ev.id}: only one choice`);
      for (const [i, ch] of ev.choices.entries()) if (!ch.effects.some(isDownside)) free.push(`${ev.id} choice ${i} (${ch.label})`);
    }
    expect(free).toEqual([]);
  });

  it('keeps every hint equal to what the effects do', () => {
    const wrong: string[] = [];
    for (const ev of REDDIT_EVENTS) {
      for (const [i, ch] of ev.choices.entries()) {
        const sure = certain(ch.effects);
        const where = `${ev.id} choice ${i} (${ch.label})`;
        const said = ch.hint === undefined ? {} : parseHint(ch.hint);
        if (said === null) { wrong.push(`${where}: hint "${ch.hint}" is not a number the game can check`); continue; }
        for (const [k, v] of Object.entries(said) as [keyof ReturnType<typeof certain>, number][]) {
          if (sure[k] !== v) wrong.push(`${where}: hint says ${k} ${v}, effects do ${sure[k]}`);
        }
        if (sure.cash < 0 && said.cash === undefined) wrong.push(`${where}: costs cash and the hint does not say so`);
        if (sure.tokens < 0 && said.tokens === undefined) wrong.push(`${where}: costs tokens and the hint does not say so`);
        if (sure.days > 0 && said.days === undefined) wrong.push(`${where}: costs days and the hint does not say so`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('lets month and rare events fire with no product in development', () => {
    const idle: EventCtx = { company: company({ karma: 5000, appsShipped: 3, hasArchetype: () => true }), project: null, rand: () => 0.5 };
    const bad: string[] = [];
    const needsProject = (list: Effect[]) => [...effectsOf(list)].some((e) => e.t === 'stat' || e.t === 'progress' || e.t === 'delay');
    for (const ev of REDDIT_EVENTS.filter((e) => e.stage === 'month' || e.stage === 'rare')) {
      if (!ev.when(idle)) continue;
      for (const [i, ch] of ev.choices.entries()) {
        if (ch.requires && !ch.requires(idle)) continue;
        if (needsProject(ch.effects)) bad.push(`${ev.id} choice ${i} (${ch.label}) leans on a project that is not there`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('keeps launch and dev events that move a project behind a project', () => {
    const idle: EventCtx = { company: company({ karma: 5000, appsShipped: 3, hasArchetype: () => true }), project: null, rand: () => 0.5 };
    const bad: GameEvent[] = REDDIT_EVENTS.filter((e) => (e.stage === 'dev' || e.stage === 'launch') && e.when(idle) && e.choices.some((c) => [...effectsOf(c.effects)].some((x) => x.t === 'stat' || x.t === 'delay')));
    expect(bad.map((e) => e.id)).toEqual([]);
  });
});

/* ------------------------------------------------------------- achievements */

describe('reddit achievements', () => {
  it('adds at least ten that can be earned and are not already earned', () => {
    expect(REDDIT_ACHIEVEMENTS.length).toBeGreaterThanOrEqual(10);
    const ids = REDDIT_ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    const baseIds = new Set(BASE_ACHIEVEMENTS.map((a) => a.id));
    expect(ids.filter((id) => !id.startsWith('rd-') || baseIds.has(id))).toEqual([]);
    const baseNames = new Set(BASE_ACHIEVEMENTS.map((a) => a.name.toLowerCase()));
    expect(REDDIT_ACHIEVEMENTS.filter((a) => baseNames.has(a.name.toLowerCase())).map((a) => a.name)).toEqual([]);
  });

  it('reads only counters that something in the game sets', () => {
    const counters: Record<string, number> = {};
    for (const id of SIM_COUNTERS) counters[id] = 99;
    for (const ev of C.EVENTS) for (const ch of ev.choices) for (const e of effectsOf(ch.effects)) if (e.t === 'counter') counters[e.id] = 99;
    const co = company();
    const unreachable = REDDIT_ACHIEVEMENTS.filter((a) => !a.when({ counters, company: co })).map((a) => a.id);
    expect(unreachable).toEqual([]);
    const alreadyEarned = REDDIT_ACHIEVEMENTS.filter((a) => a.when({ counters: {}, company: co })).map((a) => a.id);
    expect(alreadyEarned).toEqual([]);
  });

  it('gives every achievement a short teaser', () => {
    expect(REDDIT_ACHIEVEMENTS.filter((a) => !a.hint || a.hint.length > 60).map((a) => a.id)).toEqual([]);
  });
});

/* ------------------------------------------------------------------- flavor */

describe('reddit flavor lines', () => {
  it('adds twenty headlines, ten tips and ten loading lines in the house style', () => {
    expect(REDDIT_HEADLINES.length).toBeGreaterThanOrEqual(20);
    expect(REDDIT_TIPS.length).toBeGreaterThanOrEqual(10);
    expect(REDDIT_LOADING.length).toBeGreaterThanOrEqual(10);
    expect(REDDIT_HEADLINES.filter((s) => s.endsWith('.'))).toEqual([]);
    expect(REDDIT_LOADING.filter((s) => !s.endsWith('...'))).toEqual([]);
    expect(REDDIT_TIPS.filter((s) => !s.endsWith('.'))).toEqual([]);
  });

  it('does not repeat a line the game already has', () => {
    const base = new Set([...BASE_HEADLINES, ...BASE_TIPS, ...BASE_LOADING].map((s) => s.toLowerCase()));
    const all = [...REDDIT_HEADLINES, ...REDDIT_TIPS, ...REDDIT_LOADING];
    expect(all.filter((s) => base.has(s.toLowerCase()))).toEqual([]);
    expect(new Set(all).size).toBe(all.length);
  });
});

/* ---------------------------------------------------------- no repeated jokes */

describe('no repeated jokes', () => {
  /**
   * Six words is long enough to let stock phrases through ("I am a bot", "well, actually") and
   * short enough to catch a joke copied from elsewhere. For a stricter read, lower it to four,
   * run this file and read the hits by hand.
   */
  const SHINGLE = 6;

  function shingles(texts: string[]): Map<string, string> {
    const out = new Map<string, string>();
    for (const t of texts) {
      const w = words(t);
      for (let i = 0; i + SHINGLE <= w.length; i++) out.set(w.slice(i, i + SHINGLE).join(' '), t);
    }
    return out;
  }

  it('shares no six word phrase with the writing that was already in the game', () => {
    const baseTexts: string[] = [
      ...baseLines.map((l) => l.text),
      ...BASE_EVENTS.flatMap((e) => [e.body, ...e.choices.map((c) => c.result)]),
      ...BASE_HEADLINES, ...BASE_TIPS, ...BASE_LOADING,
      ...BASE_ACHIEVEMENTS.map((a) => a.desc),
    ];
    const known = shingles(baseTexts);
    const newTexts: string[] = [
      ...packLines.map((l) => l.text),
      ...REDDIT_EVENTS.flatMap((e) => [e.body, ...e.choices.map((c) => c.result)]),
      ...REDDIT_HEADLINES, ...REDDIT_TIPS, ...REDDIT_LOADING,
      ...REDDIT_ACHIEVEMENTS.map((a) => a.desc),
    ];
    const clashes: string[] = [];
    for (const t of newTexts) {
      const w = words(t);
      for (let i = 0; i + SHINGLE <= w.length; i++) {
        const key = w.slice(i, i + SHINGLE).join(' ');
        if (known.has(key)) { clashes.push(`"${key}" in: ${t}  |  already in: ${known.get(key)}`); break; }
      }
    }
    expect(clashes).toEqual([]);
  });
});
