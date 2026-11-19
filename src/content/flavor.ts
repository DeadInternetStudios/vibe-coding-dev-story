import type { PaydayItem } from './types';
import type { VoiceLine } from './vo';

export const LOADING: string[] = [];
export const TIPS: string[] = [];
export const HEADLINES: string[] = [];
export const PAYDAY_ITEMS: PaydayItem[] = [];
export const COMMIT_MESSAGES: string[] = [];
/** app store style one liners, stars 1 to 5, shown on the launch results screen */
export const APP_REVIEWS: { stars: 1 | 2 | 3 | 4 | 5; text: string; user: string }[] = [];
/** spoken office chatter, played now and then while the team works */
export const AMBIENT: VoiceLine[] = [];
