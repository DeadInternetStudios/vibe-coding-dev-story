import type { DialogueStep } from './types';

/** the first minute of the game, plays after New Game */
export const INTRO: DialogueStep[] = [];
/** short teaching beats, keyed by the moment that triggers them */
export const TUTORIAL: Record<string, DialogueStep[]> = {};
/** awards show at the end of each year, keyed by year number as a string */
export const YEAR_END: Record<string, DialogueStep[]> = {};
/** the investor meeting at the end of years 1 and 2, keyed 'pass' and 'fail' */
export const FUNDING: Record<string, DialogueStep[]> = {};
/** the Friday deploy decision, keyed 'ask', 'yolo', 'wait' */
export const FRIDAY: Record<string, DialogueStep[]> = {};
/** deploy countdown beats before the thread opens */
export const DEPLOY: DialogueStep[] = [];
/** narrator lines at the start of a new month, short */
export const MONTH_NARRATION: DialogueStep[] = [];
