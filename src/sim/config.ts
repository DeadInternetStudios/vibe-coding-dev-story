/**
 * Balance knobs and fixed tables. Numbers live here so tuning never touches
 * logic. Money is written in year 1 dollars and scaled by YEAR_MULT.
 */
import type { SkillKey, StatKey, Unlock } from '../content/types';

export const DAYS_PER_WEEK = 7;
export const DAYS_PER_MONTH = 28;
export const MONTHS_PER_YEAR = 12;
export const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR;
export const YEARS = 3;
export const TOTAL_DAYS = DAYS_PER_YEAR * YEARS;

/** Money from events and prices grows each year so late game still matters. */
export const YEAR_MULT = [1, 1.9, 3.6] as const;

export type Scope = 'hack' | 'mvp' | 'full';

export const SCOPES: Record<Scope, { label: string; blurb: string; weeks: number; money: number; hype: number; unlock: Unlock }> = {
  hack: { label: 'Weekend Hack', blurb: 'Half the work, half the glory.', weeks: 0.5, money: 0.42, hype: 0, unlock: {} },
  mvp: { label: 'MVP', blurb: 'Minimum viable. Maximum vibes.', weeks: 1, money: 1, hype: 4, unlock: {} },
  full: { label: 'The Full Thing', blurb: 'Auth, billing, dark mode, the works.', weeks: 1.8, money: 2.5, hype: 9, unlock: { karma: 120 } },
};

/**
 * How long a project takes. A kind's `weeks` times this is the working weeks of an MVP
 * at normal pace. The team's size does not change it; tools, mood, cards and crunch do.
 */
export const WEEKS_SCALE = 0.55;
export const WORKDAYS_PER_WEEK = 5;

export const PHASES = [
  { id: 'plan', label: 'Plan', from: 0, to: 15 },
  { id: 'prompt', label: 'Prompt', from: 15, to: 60 },
  { id: 'fix', label: 'Fix', from: 60, to: 90 },
  { id: 'ship', label: 'Ship', from: 90, to: 100 },
] as const;

export function phaseAt(progress: number): 0 | 1 | 2 | 3 {
  if (progress < 15) return 0;
  if (progress < 60) return 1;
  if (progress < 90) return 2;
  return 3;
}

/** How strongly each phase builds each stat. */
export const PHASE_WEIGHTS: Record<0 | 1 | 2 | 3, Record<StatKey, number>> = {
  0: { vibes: 1.0, features: 0.4, polish: 0.1, stability: 0.1, security: 0.2 },
  1: { vibes: 0.3, features: 1.0, polish: 0.5, stability: 0.2, security: 0.1 },
  2: { vibes: 0.1, features: 0.2, polish: 0.4, stability: 1.0, security: 0.7 },
  3: { vibes: 0.6, features: 0.1, polish: 0.8, stability: 0.4, security: 0.4 },
};

/** Which skills feed which stat, as [skill, share]. */
export const STAT_SKILLS: Record<StatKey, readonly [SkillKey, number][]> = {
  vibes: [['taste', 0.6], ['hustle', 0.4]],
  features: [['prompt', 1]],
  polish: [['taste', 1]],
  stability: [['debug', 1]],
  security: [['paranoia', 1]],
};

/**
 * Stat gain. Every builder adds to the pile each day, so a bigger or better team
 * builds a better product in the same time. Tuned so the starting crew lands near
 * quality 45 on an MVP and a strong team of ten reaches the 90s.
 */
export const STAT_GAIN_K = 0.128;
/** Stats stop growing near this cap, with diminishing returns. */
export const STAT_SOFT_CAP = 110;
/** The AI does a share of the work for everyone, so a skill of 1 still counts for something. */
export const SKILL_FLOOR = 8;
/** Staff pay is the archetype's range times this. */
export const SALARY_SCALE = 0.8;

export const START = {
  cash: 40000,
  tokens: 300,
  spaghetti: 10,
  mood: 70,
} as const;

export interface OfficeTier {
  name: string;
  desks: number;
  rent: number;
  upgrade: number;
  blurb: string;
}

export const OFFICE_TIERS: readonly OfficeTier[] = [
  { name: 'The Garage', desks: 4, rent: 800, upgrade: 0, blurb: 'Smells of coffee and ambition. And oil.' },
  { name: 'Shared Office', desks: 8, rent: 2800, upgrade: 30000, blurb: 'A real address. A real printer. Real passive aggression.' },
  { name: 'The Loft', desks: 12, rent: 6500, upgrade: 120000, blurb: 'Exposed brick. Exposed pipes. Exposed runway.' },
  { name: 'The Tower', desks: 16, rent: 14000, upgrade: 400000, blurb: 'A floor with a view and a ping pong table nobody uses.' },
];

export interface TokenPlan {
  id: string;
  name: string;
  /** thousands of tokens each month */
  tokens: number;
  monthly: number;
  blurb: string;
}

export const TOKEN_PLANS: readonly TokenPlan[] = [
  { id: 'hobby', name: 'Hobby', tokens: 300, monthly: 0, blurb: 'Free. Generous, until you use it.' },
  { id: 'pro', name: 'Pro', tokens: 900, monthly: 200, blurb: 'For people with a credit card and a dream.' },
  { id: 'max', name: 'Max', tokens: 2800, monthly: 700, blurb: 'Fewer limits. Same panic.' },
  { id: 'maxmax', name: 'Max Max', tokens: 9000, monthly: 2400, blurb: 'Fair use applies to you personally.' },
];

/** Dollars (year 1) for each 100k tokens bought outside a plan. */
export const TOPUP_PRICE = 140;

/** Speeds the player can pick, in game days per second. */
export const SPEEDS = [1, 2, 4, 8] as const;

/**
 * The Friday deploy gamble. A clean one rides the weekend crowd; an incident costs
 * hype, money, mood and a slice of the app's lifetime revenue.
 */
export const FRIDAY = { hype: 6, incidentHype: 8, incidentCost: 4000, incidentMood: 7, incidentRevenue: 0.6 } as const;

/** Each round of outside money takes this share of the final score. The check is bigger than the bite, early. */
export const DILUTION = { vc: 0.2, angel: 0.05 } as const;

/** Chance per working day that an event fires. */
export const EVENT_CHANCE = { dev: 0.07, month: 0.7, launch: 0.4, rare: 0.012 };
/** Do not repeat an event within this many days. */
export const EVENT_COOLDOWN_DAYS = 120;

/** Each extra builder past the third costs this much of everyone's output. A product manager gives some back. */
export const COORDINATION = { perHead: 0.05, freeHeads: 3, pmRelief: 0.02, floor: 0.01 };

/** Mood to speed multiplier: 100 is a happy dev, 0 is a hostage. */
export function moodSpeed(mood: number): number {
  return 0.45 + 0.7 * Math.min(1, Math.max(0, mood) / 100);
}

/** Mood to bug multiplier. */
export function moodBugs(mood: number): number {
  return 1.5 - Math.min(1, Math.max(0, mood) / 100) * 0.7;
}

/** Cash needed to be bankrupt: below this at a payday twice. */
export const BANKRUPT_CASH = -2000;

export const FOUNDER_ORIGINS = [
  {
    id: 'burnout',
    name: 'Big Tech Burnout',
    blurb: 'Left a 9-year career at a company with a slide. Knows where the bodies are buried. Keeps burying them.',
    skills: { prompt: 8, taste: 2, debug: 14, paranoia: 12, hustle: 4 },
    trait: 'tired',
  },
  {
    id: 'bootcamp',
    name: 'Bootcamp Graduate',
    blurb: 'Six weeks, one portfolio, zero fear. Types faster than anyone can review.',
    skills: { prompt: 16, taste: 8, debug: 4, paranoia: 2, hustle: 8 },
    trait: 'eager',
  },
  {
    id: 'pivoter',
    name: 'Serial Pivoter',
    blurb: 'Four startups, three pivots each. The pitch deck is always a little different.',
    skills: { prompt: 6, taste: 6, debug: 4, paranoia: 4, hustle: 18 },
    trait: 'charming',
  },
  {
    id: 'designer',
    name: 'Figma Poet',
    blurb: 'Has strong opinions about 1px borders and weak opinions about databases.',
    skills: { prompt: 6, taste: 18, debug: 3, paranoia: 3, hustle: 8 },
    trait: 'picky',
  },
] as const;

export type FounderOriginId = (typeof FOUNDER_ORIGINS)[number]['id'];

export const DIFFICULTIES = [
  { id: 'chill', name: 'Chill', blurb: 'More cash, kinder events. Good for vibes.', cash: 60000, bad: 0.7, revenue: 1.15 },
  { id: 'normal', name: 'Normal', blurb: 'The intended experience.', cash: 40000, bad: 1, revenue: 1 },
  { id: 'ramen', name: 'Ramen Profitable', blurb: 'Less cash, meaner events. Eat noodles.', cash: 28000, bad: 1.3, revenue: 0.9 },
] as const;

export type DifficultyId = (typeof DIFFICULTIES)[number]['id'];

/** Everyone has an AI by year two, so the same product impresses less. Subtracted from quality in ratings and revenue. */
export const MARKET_BAR = [0, 6, 12] as const;

/** Reddit gets tired of the same thing. Each recent app of the same kind or niche trims the next one. */
export const NOVELTY = { sameKind: 0.78, sameNiche: 0.86, memoryDays: 130, floor: 0.3 };

/** Revenue model: a spike that fades fast, plus a long tail. */
export const REVENUE = {
  /** dollars of lifetime revenue for quality 50, kind money 5, fit 1, hype 30, scope mvp */
  base: 13800,
  /** how hard money leans on quality */
  qualityExp: 1.25,
  /** how hard money leans on the kind's money rating */
  moneyExp: 0.75,
  /** later years pay a little more per app, on top of everything else */
  yearMult: [1, 1.3, 1.8] as const,
  spikeShare: 0.62,
  spikeTau: 16,
  tailTau: 150,
};

/** A Reddit score under this and the mods take the post down. The score card calls it REMOVED BY MODS. */
export const REMOVED_BELOW = 10;
/** The founder's closing Edit is picked by score: at least this is viral, at least SOLID_FROM is solid, anything under is a flop. */
export const VIRAL_FROM = 28;
export const SOLID_FROM = 16;
