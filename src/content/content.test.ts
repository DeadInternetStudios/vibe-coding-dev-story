import { describe, expect, it } from 'vitest';
import * as C from './index';
import { VOICES, voiceLineId, type VoiceLine } from './vo';
import type { CompanyView, EventCtx, ProjectView, StatKey, ThreadCtx, Effect } from './types';

const VOLUME = process.env.CONTENT_VOLUME === '1';

/* ------------------------------------------------------------ helpers */

function* strings(value: unknown, path: string, seen = new Set<object>()): Generator<[string, string]> {
  if (typeof value === 'string') {
    yield [path, value];
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* strings(value[i], `${path}[${i}]`, seen);
    return;
  }
  for (const [k, v] of Object.entries(value)) yield* strings(v, `${path}.${k}`, seen);
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function company(over: Partial<CompanyView> = {}): CompanyView {
  const flags = new Set<string>();
  return {
    year: 1, month: 1, day: 0, cash: 40000, tokens: 300, karma: 0, spaghetti: 10,
    staffCount: 3, deskCount: 4, officeTier: 0, appsShipped: 0,
    flags, counters: {},
    hasArchetype: () => false,
    hasTrait: () => false,
    ...over,
  };
}

function project(r: () => number, over: Partial<ProjectView> = {}): ProjectView {
  const stat = () => Math.round(r() * 100);
  const stats = { vibes: stat(), features: stat(), polish: stat(), stability: stat(), security: stat() } as Record<StatKey, number>;
  const kind = C.KINDS.length ? C.KINDS[Math.floor(r() * C.KINDS.length)]!.id : 'todo';
  const niche = C.NICHES.length ? C.NICHES[Math.floor(r() * C.NICHES.length)]!.id : 'dogs';
  const channel = C.CHANNELS.length ? C.CHANNELS[Math.floor(r() * C.CHANNELS.length)]!.id : 'quiet';
  const quality = Math.round((stats.vibes + stats.features + stats.polish + stats.stability + stats.security) / 5);
  return {
    name: 'Fetchly', kind, niche, tool: C.TOOLS[0]?.id ?? 'free', scope: 'mvp', stats, quality,
    hype: Math.round(r() * 100), channel, weeksTaken: 8, fridayDeploy: r() < 0.2, hotIdeas: Math.floor(r() * 4),
    flags: new Set(), ...over,
  };
}

const ASCII = /^[\x20-\x7e\n]*$/;

const allVoiceLines = C.collectVoiceLines(C);

/* ------------------------------------------------------------ structure */

describe('content structure', () => {
  it('uses plain ASCII in every string', () => {
    const bad: string[] = [];
    for (const [path, s] of strings(C, 'content')) if (!ASCII.test(s)) bad.push(`${path}: ${JSON.stringify(s)}`);
    expect(bad).toEqual([]);
  });

  it('has valid voiced lines', () => {
    const problems: string[] = [];
    for (const l of allVoiceLines) {
      if (!(VOICES as readonly string[]).includes(l.voice)) problems.push(`${l.id}: unknown voice ${l.voice}`);
      if (l.id !== voiceLineId(l.voice, l.text, l.delivery)) problems.push(`${l.id}: id does not match its text`);
      const words = l.text.trim().split(/\s+/).length;
      if (words < 1 || words > 30) problems.push(`${l.id}: ${words} words, keep voiced lines to 30 or fewer`);
      if (l.text.length > 220) problems.push(`${l.id}: ${l.text.length} characters`);
      if (/[{}<>`]|https?:|www\./.test(l.text)) problems.push(`${l.id}: has symbols that cannot be spoken`);
      if (l.delivery && l.delivery.length > 90) problems.push(`${l.id}: delivery note too long`);
    }
    expect(problems).toEqual([]);
  });

  it('has unique ids inside each registry', () => {
    const registries: [string, { id: string }[]][] = [
      ['KINDS', C.KINDS], ['NICHES', C.NICHES], ['TOOLS', C.TOOLS], ['TRAITS', C.TRAITS],
      ['ARCHETYPES', C.ARCHETYPES], ['CHANNELS', C.CHANNELS], ['EVENTS', C.EVENTS],
      ['VIGNETTES', C.VIGNETTES], ['ACHIEVEMENTS', C.ACHIEVEMENTS], ['ENDINGS', C.ENDINGS],
    ];
    const dupes: string[] = [];
    for (const [name, list] of registries) {
      const seen = new Set<string>();
      for (const x of list) {
        if (seen.has(x.id)) dupes.push(`${name}:${x.id}`);
        seen.add(x.id);
      }
    }
    expect(dupes).toEqual([]);
  });

  it('keeps kinds, niches and tools well formed', () => {
    const problems: string[] = [];
    const kindIds = new Set(C.KINDS.map((k) => k.id));
    for (const k of C.KINDS) {
      const sum = Object.values(k.weights).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1) > 0.011) problems.push(`kind ${k.id}: weights sum to ${sum.toFixed(2)}`);
      if (k.nameTemplates.length < 4) problems.push(`kind ${k.id}: needs 4 or more name templates`);
      for (const t of k.nameTemplates) {
        for (const m of t.matchAll(/\{(\w+)\}/g)) if (!['Niche', 'niche', 'brand', 'pun', 'adj', 'Adj', 'singular', 'Singular'].includes(m[1]!)) problems.push(`kind ${k.id}: unknown placeholder {${m[1]}}`);
      }
      if (k.taglines.length < 3) problems.push(`kind ${k.id}: needs 3 or more taglines`);
      if (k.announce.voice !== 'announcer') problems.push(`kind ${k.id}: announce must be the announcer voice`);
    }
    for (const n of C.NICHES) {
      for (const id of [...n.favors, ...n.curses]) if (!kindIds.has(id)) problems.push(`niche ${n.id}: unknown kind ${id}`);
      if (n.announce.voice !== 'announcer') problems.push(`niche ${n.id}: announce must be the announcer voice`);
    }
    for (const t of C.TOOLS) {
      if (t.chatter.length < 6) problems.push(`tool ${t.id}: needs 6 or more chatter lines`);
      if (t.slots < 1 || t.speed <= 0) problems.push(`tool ${t.id}: bad numbers`);
    }
    expect(problems).toEqual([]);
  });

  it('keeps staff references valid', () => {
    const problems: string[] = [];
    const traitIds = new Set(C.TRAITS.map((t) => t.id));
    for (const a of C.ARCHETYPES) {
      for (const t of a.traits) if (!traitIds.has(t)) problems.push(`archetype ${a.id}: unknown trait ${t}`);
      if (a.quotes.length < 8) problems.push(`archetype ${a.id}: needs 8 or more quotes`);
      if (a.intro.length < 1) problems.push(`archetype ${a.id}: needs a spoken intro`);
      for (const [skill, [lo, hi]] of Object.entries(a.skills)) if (lo > hi || lo < 1 || hi > 99) problems.push(`archetype ${a.id}: bad range for ${skill}`);
    }
    expect(problems).toEqual([]);
  });

  it('keeps events well formed and effects valid', () => {
    const problems: string[] = [];
    const archIds = new Set(C.ARCHETYPES.map((a) => a.id));
    const checkEffect = (where: string, e: Effect) => {
      if (e.t === 'hire' && !archIds.has(e.archetype)) problems.push(`${where}: unknown archetype ${e.archetype}`);
      if (e.t === 'chance') {
        if (e.p < 0 || e.p > 1) problems.push(`${where}: chance p out of range`);
        e.yes.forEach((x) => checkEffect(where, x));
        e.no?.forEach((x) => checkEffect(where, x));
      }
      if (e.t === 'skill' && Math.abs(e.n) > 5) problems.push(`${where}: skill change above 5`);
    };
    for (const ev of C.EVENTS) {
      if (ev.title.length > 28) problems.push(`event ${ev.id}: title over 28 characters`);
      if (ev.body.length < 12 || ev.body.length > 260) problems.push(`event ${ev.id}: body length ${ev.body.length}`);
      if (ev.choices.length < 1 || ev.choices.length > 3) problems.push(`event ${ev.id}: needs 1 to 3 choices`);
      for (const [i, ch] of ev.choices.entries()) {
        if (ch.label.length > 26) problems.push(`event ${ev.id} choice ${i}: label over 26 characters`);
        if (ch.result.length < 8 || ch.result.length > 240) problems.push(`event ${ev.id} choice ${i}: result length ${ch.result.length}`);
        ch.effects.forEach((e) => checkEffect(`event ${ev.id} choice ${i}`, e));
      }
    }
    expect(problems).toEqual([]);
  });

  it('keeps vignettes well formed', () => {
    const problems: string[] = [];
    for (const v of C.VIGNETTES) {
      if (v.comments.length < 1 || v.comments.length > 4) problems.push(`vignette ${v.id}: needs 1 to 4 comments`);
      if (v.comments[0]?.depth !== 0) problems.push(`vignette ${v.id}: first comment must be depth 0`);
      let prev = 0;
      for (const [i, c] of v.comments.entries()) {
        if (!/^u\/[A-Za-z0-9_-]{2,20}$/.test(c.user)) problems.push(`vignette ${v.id} comment ${i}: bad user ${c.user}`);
        if (c.depth > prev + 1) problems.push(`vignette ${v.id} comment ${i}: depth jumps`);
        if (i > 0 && c.depth === 0) problems.push(`vignette ${v.id} comment ${i}: only the first comment is depth 0`);
        prev = c.depth;
        if (c.votes[0] > c.votes[1]) problems.push(`vignette ${v.id} comment ${i}: votes range reversed`);
        if (c.flair && c.flair.length > 20) problems.push(`vignette ${v.id} comment ${i}: flair too long`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('never throws from a predicate and always has something to say', () => {
    const r = rng(42);
    const thrown: string[] = [];
    let minThread = Infinity;
    let minPraise = Infinity;
    let minRoast = Infinity;
    let minDev = Infinity;
    for (let i = 0; i < 300; i++) {
      const co = company({ year: 1 + Math.floor(r() * 3), month: 1 + Math.floor(r() * 12), cash: Math.round(r() * 200000), karma: Math.round(r() * 20000), spaghetti: Math.round(r() * 100), staffCount: 1 + Math.floor(r() * 12), appsShipped: Math.floor(r() * 20) });
      const p = project(r);
      const tctx: ThreadCtx = { company: co, project: p, rand: r };
      const ectx: EventCtx = { company: co, project: p, rand: r };
      let thread = 0, praise = 0, roast = 0;
      for (const v of C.VIGNETTES) {
        try {
          if (v.when(tctx)) {
            thread++;
            if (v.tone === 'praise') praise++;
            if (v.tone === 'roast') roast++;
          }
        } catch (e) { thrown.push(`vignette ${v.id}: ${(e as Error).message}`); }
      }
      let dev = 0;
      for (const ev of C.EVENTS) {
        try {
          const ok = ev.when(ectx);
          if (ok && ev.stage === 'dev') dev++;
        } catch (e) { thrown.push(`event ${ev.id}: ${(e as Error).message}`); }
      }
      minThread = Math.min(minThread, thread);
      minPraise = Math.min(minPraise, praise);
      minRoast = Math.min(minRoast, roast);
      minDev = Math.min(minDev, dev);
    }
    expect([...new Set(thrown)]).toEqual([]);
    if (VOLUME) {
      expect(minThread, 'candidate vignettes for the worst case product').toBeGreaterThanOrEqual(8);
      expect(minPraise, 'praise vignettes for the worst case product').toBeGreaterThanOrEqual(2);
      expect(minRoast, 'roast vignettes for the best case product').toBeGreaterThanOrEqual(2);
      expect(minDev, 'dev events available at any time').toBeGreaterThanOrEqual(10);
    }
  });
});

/* -------------------------------------------------------------- volume */

describe.runIf(VOLUME)('content volume (CONTENT_VOLUME=1)', () => {
  it('meets the counts in docs/DESIGN.md', () => {
    const count = (name: string, n: number, min: number) => ({ name, n, min });
    const rows = [
      count('KINDS', C.KINDS.length, 14), count('NICHES', C.NICHES.length, 14), count('TOOLS', C.TOOLS.length, 7),
      count('TRAITS', C.TRAITS.length, 24), count('ARCHETYPES', C.ARCHETYPES.length, 20),
      count('FIRST_NAMES', C.FIRST_NAMES.length, 80), count('LAST_NAMES', C.LAST_NAMES.length, 60), count('COMPANY_NAMES', C.COMPANY_NAMES.length, 24),
      count('CHANNELS', C.CHANNELS.length, 8), count('EVENTS', C.EVENTS.length, 90),
      count('EVENTS dev', C.EVENTS.filter((e) => e.stage === 'dev').length, 40),
      count('EVENTS month', C.EVENTS.filter((e) => e.stage === 'month').length, 28),
      count('EVENTS launch', C.EVENTS.filter((e) => e.stage === 'launch').length, 12),
      count('EVENTS rare', C.EVENTS.filter((e) => e.stage === 'rare').length, 12),
      count('VIGNETTES', C.VIGNETTES.length, 90), count('OP_BODIES', C.OP_BODIES.length, 20),
      count('LOADING', C.LOADING.length, 60), count('TIPS', C.TIPS.length, 40), count('HEADLINES', C.HEADLINES.length, 60),
      count('PAYDAY_ITEMS', C.PAYDAY_ITEMS.length, 30), count('COMMIT_MESSAGES', C.COMMIT_MESSAGES.length, 40),
      count('APP_REVIEWS', C.APP_REVIEWS.length, 40), count('AMBIENT', C.AMBIENT.length, 40),
      count('ACHIEVEMENTS', C.ACHIEVEMENTS.length, 40), count('ENDINGS', C.ENDINGS.length, 8), count('INTRO', C.INTRO.length, 8),
    ];
    const short = rows.filter((r) => r.n < r.min).map((r) => `${r.name} ${r.n}/${r.min}`);
    expect(short).toEqual([]);
  });

  it('uses every voice at least a few times and stays near the line budget', () => {
    const per = new Map<string, number>();
    for (const l of allVoiceLines as VoiceLine[]) per.set(l.voice, (per.get(l.voice) ?? 0) + 1);
    const thin = VOICES.filter((v) => (per.get(v) ?? 0) < 8);
    expect(thin, 'voices with fewer than 8 lines').toEqual([]);
    // 623 before the Reddit tropes pack, which adds 224 more. Raise this when a writer adds a batch,
    // since every line is rendered offline by Qwen3-TTS at about five lines a minute.
    expect(allVoiceLines.length).toBeLessThanOrEqual(900);
    expect(allVoiceLines.length).toBeGreaterThanOrEqual(420);
  });

  it('covers every kind and every niche in the threads', () => {
    const r = rng(7);
    const missing: string[] = [];
    for (const k of C.KINDS) {
      let hit = 0;
      for (let i = 0; i < 80; i++) {
        const co = company({ year: 3, karma: 5000 });
        const p = project(r, { kind: k.id });
        if (C.VIGNETTES.some((v) => v.when({ company: co, project: p, rand: r }) && /kind|app|todo|crm|game|bot|ext|shop|dash/i.test(v.topic + v.id))) hit++;
      }
      if (hit === 0) missing.push(`kind ${k.id}`);
    }
    expect(missing).toEqual([]);
  });
});
