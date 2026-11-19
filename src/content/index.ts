import { EVENTS as BASE_EVENTS } from './events';
import { VIGNETTES as BASE_VIGNETTES } from './threads';
import { LOADING as BASE_LOADING, TIPS as BASE_TIPS, HEADLINES as BASE_HEADLINES } from './flavor';
import { ACHIEVEMENTS as BASE_ACHIEVEMENTS } from './achievements';
import { REDDIT_VIGNETTES, REDDIT_LOADING, REDDIT_TIPS, REDDIT_HEADLINES } from './reddit';
import { REDDIT_EVENTS, REDDIT_ACHIEVEMENTS } from './redditEvents';

export * from './types';
export * from './vo';
export * from './collect';
export { KINDS } from './kinds';
export { NICHES } from './niches';
export { TOOLS } from './tools';
export { TRAITS } from './traits';
export { ARCHETYPES, FIRST_NAMES, LAST_NAMES, COMPANY_NAMES } from './staff';
export { CHANNELS } from './channels';
export { OP_BODIES } from './threads';
export { PAYDAY_ITEMS, COMMIT_MESSAGES, APP_REVIEWS, AMBIENT, TITLE_QUIPS } from './flavor';
export { ENDINGS } from './endings';
export { INTRO, TUTORIAL, YEAR_END, FUNDING, FRIDAY, DEPLOY, MONTH_NARRATION } from './story';

/** The Reddit tropes pack lives in reddit.ts and redditEvents.ts and is merged in here. */
export const EVENTS = [...BASE_EVENTS, ...REDDIT_EVENTS];
export const VIGNETTES = [...BASE_VIGNETTES, ...REDDIT_VIGNETTES];
export const ACHIEVEMENTS = [...BASE_ACHIEVEMENTS, ...REDDIT_ACHIEVEMENTS];
export const LOADING = [...BASE_LOADING, ...REDDIT_LOADING];
export const TIPS = [...BASE_TIPS, ...REDDIT_TIPS];
export const HEADLINES = [...BASE_HEADLINES, ...REDDIT_HEADLINES];

/** The OP's closing edit, one voiced line by the founder, picked by how the launch went. */
export { OP_EDITS, MOD_NOTICES } from './reddit';
