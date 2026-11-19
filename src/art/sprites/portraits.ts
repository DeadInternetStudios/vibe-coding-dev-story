/**
 * Faces for the voices. Each speaker gets one stable look so a voice is
 * recognizable on sight: the same hair, the same glasses, every time.
 */
import { Px } from '../pixel';
import { buildPerson, type Face, type Look } from './people';
import type { VoiceId } from '../../content/vo';

export const PORTRAIT_LOOKS: Record<VoiceId, { look: Look; face: Face }> = {
  clod: { look: { skin: 4, hair: 7, hairColor: 6, outfit: 11, accessory: 1 }, face: 'happy' },
  chad: { look: { skin: 2, hair: 2, hairColor: 2, outfit: 1, accessory: 0 }, face: 'smug' },
  dave: { look: { skin: 3, hair: 0, hairColor: 4, outfit: 9, accessory: 1 }, face: 'sad' },
  jenny: { look: { skin: 1, hair: 4, hairColor: 1, outfit: 10, accessory: 3 }, face: 'panic' },
  automod: { look: { skin: 4, hair: 7, hairColor: 8, outfit: 8, accessory: 2 }, face: 'normal' },
  announcer: { look: { skin: 2, hair: 3, hairColor: 5, outfit: 5, accessory: 0 }, face: 'happy' },
  narrator: { look: { skin: 3, hair: 0, hairColor: 8, outfit: 6, accessory: 1 }, face: 'normal' },
  vc: { look: { skin: 4, hair: 1, hairColor: 0, outfit: 12, accessory: 0 }, face: 'smug' },
  karen: { look: { skin: 3, hair: 5, hairColor: 3, outfit: 4, accessory: 0 }, face: 'angry' },
  bro: { look: { skin: 2, hair: 6, hairColor: 5, outfit: 7, accessory: 2 }, face: 'smug' },
  pedant: { look: { skin: 4, hair: 0, hairColor: 6, outfit: 3, accessory: 1 }, face: 'smug' },
  doomer: { look: { skin: 3, hair: 4, hairColor: 8, outfit: 8, accessory: 0 }, face: 'sad' },
  linkedin: { look: { skin: 1, hair: 1, hairColor: 2, outfit: 0, accessory: 3 }, face: 'happy' },
  arch: { look: { skin: 3, hair: 7, hairColor: 0, outfit: 2, accessory: 2 }, face: 'smug' },
  ghost: { look: { skin: 5, hair: 7, hairColor: 8, outfit: 13, accessory: 0 }, face: 'dead' },
  duck: { look: { skin: 5, hair: 7, hairColor: 7, outfit: 14, accessory: 0 }, face: 'normal' },
  hacker: { look: { skin: 2, hair: 3, hairColor: 8, outfit: 8, accessory: 1 }, face: 'smug' },
  wholesome: { look: { skin: 1, hair: 2, hairColor: 1, outfit: 15, accessory: 0 }, face: 'happy' },
  grandma: { look: { skin: 4, hair: 5, hairColor: 9, outfit: 5, accessory: 1 }, face: 'happy' },
  kid: { look: { skin: 2, hair: 6, hairColor: 4, outfit: 6, accessory: 0 }, face: 'happy' },
};

/** Head and shoulders of a speaker, 16 x 17 before scaling. */
export function portraitPx(voice: VoiceId): Px {
  const spec = PORTRAIT_LOOKS[voice];
  return buildPerson(spec.look, 'stand', spec.face).crop(0, 0, 16, 17);
}
