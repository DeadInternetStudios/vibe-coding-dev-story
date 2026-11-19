import type { SfxIdOf } from '../ids';
import { tone, type SfxBody } from './dsl';

/** PLACEHOLDER blips until the fanfares are composed. Same ids, final API. */
const blip = (note: string): SfxBody => ({ events: [tone(0, 'p25', note, 0.2, { vol: 0.25, d: 0.15, s: 0.3, r: 0.08 })], jitter: 10 });

export const fanfares: Record<SfxIdOf<'fanfare'>, SfxBody> = {
  fanfare_small: blip('C6'),
  fanfare_big: blip('G5'),
  award_win: blip('E6'),
  game_over: blip('C3'),
  victory: blip('C6'),
  achievement: blip('A6'),
};
