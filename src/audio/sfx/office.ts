import type { SfxIdOf } from '../ids';
import { tone, type SfxBody } from './dsl';

/** PLACEHOLDER blips until the office family is designed. Same ids, final API. */
const blip = (note: string): SfxBody => ({ events: [tone(0, 'p25', note, 0.1, { vol: 0.25, d: 0.08, s: 0.2, r: 0.04 })], jitter: 20 });

export const office: Record<SfxIdOf<'office'>, SfxBody> = {
  hire: blip('G5'),
  fire: blip('E3'),
  coffee: blip('A4'),
  pizza: blip('D5'),
  phone: blip('B5'),
  keyboard_burst: blip('C5'),
  rate_limit: blip('F4'),
  alert: blip('A5'),
  bug: blip('Eb4'),
  fix: blip('E6'),
  explosion: blip('C3'),
  quack: blip('G4'),
  meow: blip('A5'),
  ghost: blip('D4'),
};
