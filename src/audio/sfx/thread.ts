import type { SfxIdOf } from '../ids';
import { tone, type SfxBody } from './dsl';

/** PLACEHOLDER blips until the thread family is designed. Same ids, final API. */
const blip = (note: string): SfxBody => ({ events: [tone(0, 'p25', note, 0.1, { vol: 0.25, d: 0.08, s: 0.2, r: 0.04 })], jitter: 20 });

export const thread: Record<SfxIdOf<'thread'>, SfxBody> = {
  upvote: blip('C6'),
  downvote: blip('C4'),
  award: blip('G6'),
  comment_in: blip('E5'),
  karma_tick: blip('A5'),
  thread_open: blip('D5'),
  removed: blip('F3'),
  roast: blip('Bb4'),
  praise: blip('E6'),
};
