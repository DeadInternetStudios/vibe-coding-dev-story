/**
 * Game state. Plain data only (numbers, strings, arrays, records) so a save
 * file is JSON.stringify of it. No Phaser in here, no classes, no Sets.
 */
import type { AwardId, SkillKey, StatKey } from '../content/types';
import type { VoiceId, VoiceLine } from '../content/vo';
import type { Scope } from './config';

export interface Look {
  skin: number;
  hair: number;
  hairColor: number;
  outfit: number;
  pants?: number;
  accessory: number;
}

export type Assign = 'build' | 'support';

export interface Staff {
  id: string;
  name: string;
  archetype: string;
  look: Look;
  skills: Record<SkillKey, number>;
  level: number;
  xp: number;
  mood: number;
  /** dollars a month, year 1 prices */
  salary: number;
  traits: string[];
  hiredOn: number;
  assign: Assign;
  /** not working until this day (training, sick day, therapy) */
  awayUntil: number;
  /** what they are away doing, shown in the UI */
  awayWhy?: string;
  isFounder?: boolean;
  /** days in a row at mood below 15 */
  grumpyDays: number;
  /** last words, shown once if they quit */
  quote?: string;
}

export interface Candidate {
  id: string;
  name: string;
  archetype: string;
  look: Look;
  skills: Record<SkillKey, number>;
  traits: string[];
  salary: number;
  /** one time signing fee */
  fee: number;
}

export interface Project {
  id: number;
  name: string;
  kind: string;
  niche: string;
  tool: string;
  scope: Scope;
  startDay: number;
  /** 0 to 100 */
  progress: number;
  workTotal: number;
  stats: Record<StatKey, number>;
  hype: number;
  hotIdeas: number;
  /** dev: being built. ready: waiting for the launch prompt. waiting: ready, but holding for Monday. */
  status: 'dev' | 'ready' | 'waiting';
  /** the day a waiting project becomes ready again */
  readyOn: number;
  /** a spark waiting to be tapped */
  idea: { id: number; staffId: string; until: number; stat: StatKey } | null;
  /** card in effect for the current phase */
  card: string | null;
  cardPhase: number;
  /** three cards offered for this phase, empty once picked */
  offered: string[];
  flags: string[];
  /** how many days the project lost to delays */
  delayed: number;
  /** stalled until this day */
  stalledUntil: number;
  /** days the whole team was rate limited */
  rateLimitedDays: number;
  fridayDeploy: boolean;
  /** tag line picked at start */
  tagline: string;
}

export interface ThreadComment {
  vignette: string;
  index: number;
  votes: number;
}

export interface ThreadRecord {
  channel: string;
  title: string;
  body: string;
  opVotes: number;
  /** vignette ids in the order shown, each with the rating its root comment gave */
  vignettes: { id: string; rating: number; judges: string; votes: number[] }[];
  awards: { vignette: string; index: number; award: AwardId }[];
}

export interface ShippedApp {
  id: number;
  name: string;
  kind: string;
  niche: string;
  tool: string;
  scope: Scope;
  launchDay: number;
  channel: string;
  quality: number;
  hype: number;
  stats: Record<StatKey, number>;
  /** 0 to 40 */
  score: number;
  ratings: number[];
  karma: number;
  /** projected dollars over the app's life */
  lifetime: number;
  /** dollars earned so far */
  earned: number;
  /** daily income curve */
  spikeAmp: number;
  tailAmp: number;
  fridayDeploy: boolean;
  /** a Friday deploy that took production down */
  incident: boolean;
  thread: ThreadRecord;
  review?: { stars: number; text: string; user: string };
}

export interface LedgerLine {
  label: string;
  /** negative is money out */
  amount: number;
  note?: string;
}

export interface PaydayReport {
  month: number;
  year: number;
  income: number;
  /** deducted now */
  lines: LedgerLine[];
  /** already settled during the month, shown for the story */
  recap: LedgerLine[];
  total: number;
  cashAfter: number;
  headline: string;
  warnings: string[];
}

/** Things the game waits on the player for. The sim does not tick while one is pending. */
export type Prompt =
  | {
      t: 'event';
      eventId: string;
      title: string;
      body: string;
      speaker: VoiceId | 'system';
      line?: VoiceLine;
      choices: { label: string; hint?: string; enabled: boolean }[];
    }
  | { t: 'card'; phase: number; options: string[] }
  | { t: 'ready' }
  | { t: 'payday'; report: PaydayReport }
  | { t: 'funding'; year: number; valuation: number; target: number; passed: boolean }
  | { t: 'awards'; year: number }
  | { t: 'friday' }
  | { t: 'ending' };

export interface EndingResult {
  endingId: string;
  rank: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
  valuation: number;
  bankrupt: boolean;
  day: number;
}

export interface MonthTally {
  revenue: number;
  appsLaunched: number;
}

export interface GameState {
  v: 1;
  seed: number;
  rng: number;
  difficulty: string;
  /** the UTC date (2026-11-19) of the daily challenge this run is, absent for a normal run */
  daily?: string;
  day: number;
  nextId: number;
  company: {
    name: string;
    founderOrigin: string;
    cash: number;
    tokens: number;
    tokenPlan: string;
    karma: number;
    spaghetti: number;
    officeTier: number;
    items: string[];
    tools: string[];
    activeTool: string;
    bankruptStrikes: number;
    crunch: boolean;
    fundingTaken: string[];
    totalRevenue: number;
    /** revenue of each past month, newest last, for valuation */
    monthlyRevenue: number[];
  };
  staff: Staff[];
  candidates: Candidate[];
  project: Project | null;
  shipped: ShippedApp[];
  flags: string[];
  counters: Record<string, number>;
  achievements: string[];
  /** event id to the last day it fired */
  seenEvents: Record<string, number>;
  /** vignette ids used recently, to keep threads fresh */
  seenVignettes: Record<string, number>;
  pending: Prompt[];
  tally: MonthTally;
  /** lines for the next payday: one time costs and gains since the last one */
  ledger: LedgerLine[];
  ending: EndingResult | null;
  /** tutorial beats already shown */
  tutorial: string[];
}

/* ------------------------------------------------------------------ notices */

export type Tone = 'good' | 'bad' | 'info' | 'wow';

/** What the presentation layer hears about while the sim runs. Not saved. */
export type Notice =
  | { t: 'toast'; text: string; tone: Tone; staffId?: string }
  | { t: 'cash'; amount: number; why: string }
  | { t: 'idea'; staffId: string; stat: StatKey }
  | { t: 'ideaGone' }
  | { t: 'phase'; phase: number; project: string }
  | { t: 'levelUp'; staffId: string; level: number }
  | { t: 'quit'; staffId: string; name: string; why: string }
  | { t: 'achievement'; id: string }
  | { t: 'prompt'; prompt: Prompt }
  | { t: 'launched'; appId: number }
  | { t: 'newMonth'; month: number; year: number }
  | { t: 'newYear'; year: number }
  | { t: 'rateLimited'; on: boolean }
  | { t: 'sound'; id: string };

/** One line under an event result: a tiny icon and a number. */
export interface Chip {
  kind: 'cash' | 'tokens' | 'karma' | 'spaghetti' | 'mood' | 'stat' | 'progress' | 'hype' | 'delay' | 'fire' | 'hire' | 'skill' | 'xp' | 'flag';
  text: string;
  good: boolean;
}

export interface EventOutcome {
  result: string;
  line?: VoiceLine;
  chips: Chip[];
}
