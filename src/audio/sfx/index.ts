import type { SfxId } from '../ids';
import type { SfxBody } from './dsl';
import { fanfares } from './fanfares';
import { money } from './money';
import { office } from './office';
import { progress } from './progress';
import { thread } from './thread';
import { ui } from './ui';

/** Every sound effect body by id. TypeScript fails the build if an id is missing. */
export const SFX_DEFS: Readonly<Record<SfxId, SfxBody>> = {
  ...ui,
  ...money,
  ...progress,
  ...thread,
  ...office,
  ...fanfares,
};
