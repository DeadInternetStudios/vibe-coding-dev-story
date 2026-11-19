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
  upvote: 6,
  downvote: 7.4,
  award: 5.2,
  comment_in: 6.9,
  karma_tick: 6.3,
  thread_open: 7,
  removed: 7.4,
  roast: 7.1,
  praise: 5.5,
  hire: 6.6,
  fire: 7.8,
  coffee: 7.2,
  pizza: 7,
  phone: 6.1,
  keyboard_burst: 7.1,
  rate_limit: 7.4,
  alert: 6.3,
  bug: 7.4,
  fix: 5.5,
  explosion: 7.8,
  quack: 7.3,
  meow: 6.3,
  ghost: 7.4,
  fanfare_small: 5.1,
  fanfare_big: 5.7,
  award_win: 4.6,
  game_over: 7.2,
  victory: 5.1,
  achievement: 4.1,
};

/** dB per song, 0 when absent. */
export const MUSIC_TRIM_DB: Readonly<Partial<Record<MusicId, number>>> = {
  title: -1.2,
  thread: 5.5,
};
