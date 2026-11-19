/**
 * Builds the playable content from the written source files. While a part is
 * still empty the small fixture fills the gap, so the game always runs.
 */
import { FIXTURE } from '../sim/fixtures';
import { buildContent, type Content, type RawContent } from '../sim/content';
import * as C from './index';

function pick<T>(real: readonly T[], fallback: readonly T[]): T[] {
  return (real.length > 0 ? real : fallback).slice();
}

function pickMap<T>(real: Record<string, T[]>, fallback: Record<string, T[]>): Record<string, T[]> {
  return Object.keys(real).length > 0 ? real : fallback;
}

export function rawFromSource(): RawContent {
  const worldReady =
    C.KINDS.length >= 3 && C.NICHES.length >= 3 && C.TOOLS.length >= 1 && C.TRAITS.length >= 2 && C.ARCHETYPES.length >= 5 && C.CHANNELS.length >= 2 && C.FIRST_NAMES.length > 4 && C.LAST_NAMES.length > 4;
  const f = FIXTURE;
  const world = worldReady
    ? {
        kinds: C.KINDS,
        niches: C.NICHES,
        tools: C.TOOLS,
        traits: C.TRAITS,
        archetypes: C.ARCHETYPES,
        firstNames: C.FIRST_NAMES,
        lastNames: C.LAST_NAMES,
        companyNames: C.COMPANY_NAMES.length > 0 ? C.COMPANY_NAMES : f.companyNames,
        channels: C.CHANNELS,
      }
    : {
        kinds: f.kinds,
        niches: f.niches,
        tools: f.tools,
        traits: f.traits,
        archetypes: f.archetypes,
        firstNames: f.firstNames,
        lastNames: f.lastNames,
        companyNames: f.companyNames,
        channels: f.channels,
      };
  return {
    ...world,
    events: pick(C.EVENTS, f.events),
    vignettes: pick(C.VIGNETTES, f.vignettes),
    opBodies: pick(C.OP_BODIES, f.opBodies),
    opEdits: { viral: pick(C.OP_EDITS.viral, f.opEdits.viral), solid: pick(C.OP_EDITS.solid, f.opEdits.solid), flop: pick(C.OP_EDITS.flop, f.opEdits.flop) },
    modNotices: pick(C.MOD_NOTICES, f.modNotices),
    paydayItems: pick(C.PAYDAY_ITEMS, f.paydayItems),
    appReviews: pick(C.APP_REVIEWS, f.appReviews),
    achievements: pick(C.ACHIEVEMENTS, f.achievements),
    endings: pick(C.ENDINGS, f.endings),
    ambient: pick(C.AMBIENT, f.ambient),
    titleQuips: pick(C.TITLE_QUIPS, f.titleQuips),
    loading: pick(C.LOADING, f.loading),
    tips: pick(C.TIPS, f.tips),
    headlines: pick(C.HEADLINES, f.headlines),
    commitMessages: pick(C.COMMIT_MESSAGES, f.commitMessages),
    story: {
      intro: pick(C.INTRO, f.story.intro),
      tutorial: pickMap(C.TUTORIAL, f.story.tutorial),
      yearEnd: pickMap(C.YEAR_END, f.story.yearEnd),
      funding: pickMap(C.FUNDING, f.story.funding),
      friday: pickMap(C.FRIDAY, f.story.friday),
      deploy: pick(C.DEPLOY, f.story.deploy),
      monthNarration: pick(C.MONTH_NARRATION, f.story.monthNarration),
    },
  };
}

export function buildFromSource(): Content {
  return buildContent(rawFromSource());
}
