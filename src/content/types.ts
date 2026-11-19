/**
 * The content contract. Everything funny in the game is data shaped by these
 * types, so a writer can add jokes without touching the sim or the scenes.
 * Predicates are plain functions over the read-only views below.
 */
import type { VoiceId, VoiceLine } from './vo';

export type StatKey = 'vibes' | 'features' | 'polish' | 'stability' | 'security';
export type SkillKey = 'prompt' | 'taste' | 'debug' | 'paranoia' | 'hustle';

export const STAT_KEYS: readonly StatKey[] = ['vibes', 'features', 'polish', 'stability', 'security'];
export const SKILL_KEYS: readonly SkillKey[] = ['prompt', 'taste', 'debug', 'paranoia', 'hustle'];

/** What a content predicate may see of the company. All numbers are plain and current. */
export interface CompanyView {
  /** 1 to 3 */
  readonly year: number;
  /** 1 to 12 */
  readonly month: number;
  /** days since the start, 0 based */
  readonly day: number;
  readonly cash: number;
  /** thousands of AI tokens left */
  readonly tokens: number;
  readonly karma: number;
  /** 0 to 100, how cursed the codebase is */
  readonly spaghetti: number;
  readonly staffCount: number;
  readonly deskCount: number;
  /** 0 garage, 1 shared office, 2 loft, 3 tower */
  readonly officeTier: number;
  readonly appsShipped: number;
  /** story flags set by earlier effects */
  readonly flags: ReadonlySet<string>;
  /** counters set by earlier effects, for example `prod_deleted` */
  readonly counters: Readonly<Record<string, number>>;
  hasArchetype(id: string): boolean;
  hasTrait(id: string): boolean;
}

/** A product in development or just shipped. */
export interface ProjectView {
  readonly name: string;
  readonly kind: string;
  readonly niche: string;
  readonly tool: string;
  readonly scope: 'hack' | 'mvp' | 'full';
  /** each 0 to 100 */
  readonly stats: Readonly<Record<StatKey, number>>;
  /** 0 to 100, kind weighted blend of the stats */
  readonly quality: number;
  /** 0 to 100, launch hype */
  readonly hype: number;
  /** channel id it launched on, or '' while in development */
  readonly channel: string;
  readonly weeksTaken: number;
  /** deployed on a Friday against advice */
  readonly fridayDeploy: boolean;
  readonly hotIdeas: number;
  readonly flags: ReadonlySet<string>;
}

export interface EventCtx {
  readonly company: CompanyView;
  /** the project in development, or null */
  readonly project: ProjectView | null;
  /** uniform 0 to 1, seeded */
  readonly rand: () => number;
}

export interface ThreadCtx {
  readonly company: CompanyView;
  readonly project: ProjectView;
  readonly rand: () => number;
}

/* ----------------------------------------------------------------- effects */

/**
 * Things an event choice can do. Money is written in year 1 dollars and the sim
 * scales it up in later years, so write ±300 to ±1500 for small, ±2000 to ±6000
 * for medium, ±10000 to ±25000 for big.
 */
export type Effect =
  | { t: 'cash'; n: number }
  /** thousands of tokens, ±20 small, ±100 big */
  | { t: 'tokens'; n: number }
  /** ±20 small, ±800 big */
  | { t: 'karma'; n: number }
  /** points of 0 to 100, ±2 small, ±15 big */
  | { t: 'spaghetti'; n: number }
  /** staff mood 0 to 100, ±5 small, ±25 big */
  | { t: 'mood'; n: number; who?: 'all' | 'random' }
  /** adds points to a stat of the project in development (does nothing with no project) */
  | { t: 'stat'; stat: StatKey; n: number }
  /** percent of the current phase, ±5 small, ±25 big */
  | { t: 'progress'; n: number }
  /** hype for the next launch, 0 to 100 scale, ±5 small, ±30 big */
  | { t: 'hype'; n: number }
  /** stalls the project for this many days (negative speeds it up) */
  | { t: 'delay'; days: number }
  /** somebody quits or gets fired */
  | { t: 'fire'; who: 'random' | 'worst' | 'best' }
  /** a free hire of this archetype id, if there is a desk */
  | { t: 'hire'; archetype: string }
  /** raises a skill by n points for one or all staff */
  | { t: 'skill'; skill: SkillKey; n: number; who?: 'all' | 'random' }
  | { t: 'xp'; n: number; who?: 'all' | 'random' }
  | { t: 'flag'; id: string; value?: boolean }
  | { t: 'counter'; id: string; n: number }
  /** roll once, then run yes or no */
  | { t: 'chance'; p: number; yes: Effect[]; no?: Effect[] };

/* ------------------------------------------------------------------ events */

export interface EventChoice {
  /** button text, at most 26 characters */
  label: string;
  /** shown after picking, one or two sentences, the punchline goes here */
  result: string;
  /** optional spoken reaction */
  line?: VoiceLine;
  effects: Effect[];
  /** small gray hint under the button, for example "costs $500" */
  hint?: string;
  /** hide or disable the choice unless true */
  requires?: (c: EventCtx) => boolean;
}

export interface GameEvent {
  id: string;
  /** dev: while an app is in development. month: at the start of a month. launch: right before shipping. rare: any time, small chance */
  stage: 'dev' | 'month' | 'launch' | 'rare';
  when: (c: EventCtx) => boolean;
  /** relative likelihood, 1 is normal, 0.2 is rare, 3 is common */
  weight: number;
  /** headline, at most 28 characters */
  title: string;
  /** one to three short sentences */
  body: string;
  /** who is talking, for the portrait and the voice. 'system' for notifications. */
  speaker: VoiceId | 'system';
  /** spoken when the popup opens */
  line?: VoiceLine;
  choices: EventChoice[];
}

/* ------------------------------------------------------------------ world */

export interface Unlock {
  year?: number;
  karma?: number;
}

export interface ProductKind {
  id: string;
  /** "To-Do App" */
  name: string;
  /** "a" or "an", for "a To-Do App" */
  article: 'a' | 'an';
  blurb: string;
  /** how much each stat counts toward quality, sums to 1 */
  weights: Readonly<Record<StatKey, number>>;
  /** weeks for a minimum viable version */
  weeks: number;
  /** 1 to 10 revenue scale */
  money: number;
  unlock: Unlock;
  /** templates using {Niche} {niche} {brand} {pun} {adj}. 4 to 6 each. */
  nameTemplates: string[];
  /** hook for the OP post: "I built {name} in a weekend with AI. {tagline}" */
  taglines: string[];
  /** the announcer says this before the niche line: "a to-do app" */
  announce: VoiceLine;
}

export interface Niche {
  id: string;
  /** "Dogs" */
  plural: string;
  /** "Dog" */
  singular: string;
  /** "Canine" */
  adj: string;
  /** a short made-up brand stem, "Doggo" */
  brand: string;
  /** a pun stem, "Paws" */
  pun: string;
  blurb: string;
  /** kind ids that sell well to this niche (2 to 4) */
  favors: string[];
  /** kind ids that go badly (1 to 3) */
  curses: string[];
  unlock: Unlock;
  /** the announcer says this after the kind line: "for dogs" */
  announce: VoiceLine;
}

export interface Tool {
  id: string;
  name: string;
  blurb: string;
  /** one time license, dollars */
  price: number;
  /** per month, dollars */
  monthly: number;
  /** 0.4 to 2.5 */
  speed: number;
  /** multiplier on bug chance, 1 is normal */
  bugs: number;
  /** thousands of tokens per working day per staff member */
  tokens: number;
  /** how many staff can work an app at once */
  slots: number;
  unlock: Unlock;
  /** what staff say while using it, unvoiced bubbles, 6 to 12 short lines */
  chatter: string[];
}

export interface Trait {
  id: string;
  name: string;
  blurb: string;
  /** all optional multipliers or flat bonuses */
  mods: {
    speed?: number;
    bugs?: number;
    mood?: number;
    skills?: Partial<Record<SkillKey, number>>;
    salary?: number;
    xp?: number;
  };
}

export interface StaffLook {
  skin: number;
  hair: number;
  hairColor: number;
  outfit: number;
  accessory: number;
}

export interface StaffArchetype {
  id: string;
  /** job title shown in the UI, "Vibe Coder" */
  role: string;
  blurb: string;
  /** cast voice that speaks for this archetype */
  voice: VoiceId;
  /** starting skill ranges, 1 to 20 */
  skills: Readonly<Record<SkillKey, readonly [number, number]>>;
  /** monthly dollars, year 1 */
  salary: readonly [number, number];
  traits: string[];
  /** pool of first names, if empty the global pool is used */
  names: string[];
  /** spoken self introductions on the hire screen, 2 to 3 each */
  intro: VoiceLine[];
  /** unvoiced speech bubbles while working, 10 to 20 short lines */
  quotes: string[];
  /** sprite look ranges, indexes into the art tables */
  look: { hair: number[]; outfit: number[]; accessory: number[] };
  unlock: Unlock;
  /** appears only through events, never in the job list */
  special?: boolean;
}

export interface Channel {
  id: string;
  name: string;
  /** the subreddit or site shown above the post, "r/SideProject" */
  where: string;
  blurb: string;
  cost: number;
  /** hype added at launch, 0 to 40 */
  hype: number;
  /** how wild the traffic is, 0 steady to 1 jackpot or flop */
  variance: number;
  /** how likely the comments are to roast, 0 to 1 */
  roast: number;
  karmaMult: number;
  unlock: Unlock;
  /** titles for the OP post, {name} and {tagline} filled in */
  titles: string[];
}

/* --------------------------------------------------------------- reddit */

export type AwardId = 'gold' | 'silver' | 'wholesome' | 'helpful' | 'facepalm' | 'deceased' | 'rocket' | 'copium';

export interface ThreadComment {
  /** "u/SeniorDave_42", always start with u/ */
  user: string;
  /** small tag next to the name, "Staff Engineer", "Verified Human", "Mod" */
  flair?: string;
  /** the words, spoken and shown. The voice here is the commenter's voice. */
  line: VoiceLine;
  /** 0 top level, 1 reply, 2 reply to reply */
  depth: 0 | 1 | 2;
  /** upvote range, negative means downvoted */
  votes: readonly [number, number];
  awards?: AwardId[];
}

/**
 * A vignette is a tiny comment-section scene: a root comment and up to three
 * replies that land a punchline. A thread is the OP post plus two or three vignettes.
 */
export interface Vignette {
  id: string;
  /** only one vignette per topic per thread, keeps the jokes varied */
  topic: string;
  tone: 'praise' | 'roast' | 'neutral' | 'chaos';
  /** which stat this commenter is judging, used for the N/10 chip on the root comment */
  judges: StatKey | 'overall' | 'hype';
  when: (c: ThreadCtx) => boolean;
  /** 1 normal, 3 common, 0.3 rare */
  weight: number;
  /** 1 to 4 comments, the first is the root */
  comments: ThreadComment[];
}

/* ------------------------------------------------------------- flavor etc. */

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  /** hidden until earned */
  secret?: boolean;
  /** checked after every launch, month and event with the counters */
  when: (k: { counters: Readonly<Record<string, number>>; company: CompanyView }) => boolean;
}

export interface Ending {
  id: string;
  /** letter rank for the results card */
  rank: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  title: string;
  body: string;
  /** the announcer reads this */
  line: VoiceLine;
  /** shown under the title, "Valuation $1.2B" is filled by the sim */
  tag: string;
}

export interface DialogueStep {
  speaker: VoiceId | 'system';
  line: VoiceLine;
}

export interface PaydayItem {
  /** "Coffee" */
  label: string;
  /** dollars, year 1 */
  cost: readonly [number, number];
  /** funny one-line footnote */
  note: string;
}
