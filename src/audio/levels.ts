import type { MusicId, SfxId } from './ids';

/**
 * Loudness trims in dB, one per sound. Written by tools/audio/calibrate.ts from
 * offline renders so music lands near -18 LUFS and sound effects near -14 LUFS
 * (plus each sound's own `level`). Run the tool, do not edit by hand.
 */
/** dB per sound effect, 0 when absent. */
export const SFX_TRIM_DB: Readonly<Partial<Record<SfxId, number>>> = {
  click: 3.3,
  hover: 7.2,
  back: 1.5,
  open: 1.7,
  close: 3,
  tab: 6.3,
  toggle: 0.5,
  error: 0.7,
  confirm: 0.6,
  deny: 4.7,
  select: 2.2,
  type: 6.4,
  type2: 5.4,
  coins: 1.7,
  cash_register: 5.7,
  payday: 2.6,
  bill: 1.5,
  broke: 4.5,
  level_up: 1.9,
  hot_idea: 4.5,
  bubble: 1.8,
  phase_done: 4.9,
  deploy_beep: -1.3,
  deploy_go: 1.6,
  upvote: 4.9,
  downvote: 1.5,
  award: 7.6,
  comment_in: 1.3,
  karma_tick: 0.7,
  thread_open: 3.8,
  removed: 6.1,
  roast: 4.7,
  praise: 2.6,
  hire: 3.2,
  fire: -0.4,
  coffee: 3.7,
  pizza: 4.6,
  phone: -3.7,
  keyboard_burst: 6.3,
  rate_limit: 4.3,
  alert: 0.7,
  bug: 6,
  fix: 3.9,
  explosion: -0.4,
  quack: 3.1,
  meow: 6.7,
  ghost: 3.6,
  fanfare_small: -0.8,
  fanfare_big: -2.1,
  award_win: 0.1,
  game_over: 0.1,
  victory: -2.7,
  achievement: 4.1,
};

/** dB per song, 0 when absent. */
export const MUSIC_TRIM_DB: Readonly<Partial<Record<MusicId, number>>> = {
  title: -1.2,
  thread: 5.5,
};
