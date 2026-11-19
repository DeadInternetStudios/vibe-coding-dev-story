/**
 * Every sound id the game can ask for. This file is the single source of truth:
 * the SfxId and MusicId unions, the labels and the families all come from here,
 * and tests make sure every id has a sound behind it.
 */

export const SFX_CATALOG = [
  // ui
  ['click', 'Click', 'ui'],
  ['hover', 'Hover', 'ui'],
  ['back', 'Back', 'ui'],
  ['open', 'Open window', 'ui'],
  ['close', 'Close window', 'ui'],
  ['tab', 'Tab switch', 'ui'],
  ['toggle', 'Toggle', 'ui'],
  ['error', 'Error', 'ui'],
  ['confirm', 'Confirm', 'ui'],
  ['deny', 'Deny', 'ui'],
  ['select', 'Select', 'ui'],
  ['type', 'Type key', 'ui'],
  ['type2', 'Type key (alt)', 'ui'],
  // money
  ['coin', 'Coin', 'money'],
  ['coins', 'Coin shower', 'money'],
  ['cash_register', 'Cash register', 'money'],
  ['payday', 'Payday', 'money'],
  ['bill', 'Bill due', 'money'],
  ['broke', 'Broke', 'money'],
  // progress
  ['level_up', 'Level up', 'progress'],
  ['hot_idea', 'Hot idea', 'progress'],
  ['bubble', 'Thought bubble', 'progress'],
  ['phase_done', 'Phase done', 'progress'],
  ['ship_it', 'Ship it', 'progress'],
  ['deploy_beep', 'Deploy beep', 'progress'],
  ['deploy_go', 'Deploy go', 'progress'],
  // thread
  ['upvote', 'Upvote', 'thread'],
  ['downvote', 'Downvote', 'thread'],
  ['award', 'Award given', 'thread'],
  ['comment_in', 'Comment arrives', 'thread'],
  ['karma_tick', 'Karma tick', 'thread'],
  ['thread_open', 'Thread opens', 'thread'],
  ['removed', 'Removed by mods', 'thread'],
  ['roast', 'Roast', 'thread'],
  ['praise', 'Praise', 'thread'],
  // office
  ['hire', 'Hire', 'office'],
  ['fire', 'Fire', 'office'],
  ['coffee', 'Coffee', 'office'],
  ['pizza', 'Pizza', 'office'],
  ['phone', 'Phone rings', 'office'],
  ['keyboard_burst', 'Keyboard burst', 'office'],
  ['rate_limit', 'Rate limited', 'office'],
  ['alert', 'Alert', 'office'],
  ['bug', 'Bug', 'office'],
  ['fix', 'Fix', 'office'],
  ['explosion', 'Explosion', 'office'],
  ['quack', 'Duck quack', 'office'],
  ['meow', 'Cat meow', 'office'],
  ['ghost', 'Ghost', 'office'],
  // fanfares
  ['fanfare_small', 'Small fanfare', 'fanfare'],
  ['fanfare_big', 'Big fanfare', 'fanfare'],
  ['award_win', 'Award won', 'fanfare'],
  ['game_over', 'Game over', 'fanfare'],
  ['victory', 'Victory', 'fanfare'],
  ['achievement', 'Achievement', 'fanfare'],
] as const;

export type SfxId = (typeof SFX_CATALOG)[number][0];
export type SfxFamily = (typeof SFX_CATALOG)[number][2];
/** The ids of one family, so each sfx file must define exactly its own. */
export type SfxIdOf<F extends SfxFamily> = Extract<(typeof SFX_CATALOG)[number], readonly [string, string, F]>[0];

export const SFX_IDS: readonly SfxId[] = SFX_CATALOG.map((e) => e[0]);

export const SFX_FAMILIES: readonly SfxFamily[] = ['ui', 'money', 'progress', 'thread', 'office', 'fanfare'];

export const MUSIC_IDS = ['title', 'office', 'crunch', 'thread', 'launch', 'awards', 'shop', 'win', 'lose', 'menu'] as const;

export type MusicId = (typeof MUSIC_IDS)[number];

export const MUSIC_LABELS: Readonly<Record<MusicId, string>> = {
  title: 'Title screen',
  office: 'Office (cozy)',
  crunch: 'Crunch time',
  thread: 'Reddit thread',
  launch: 'Launch hype',
  awards: 'Awards show',
  shop: 'Shopping mall',
  win: 'You win',
  lose: 'Sad trombone',
  menu: 'Menu (calm)',
};
