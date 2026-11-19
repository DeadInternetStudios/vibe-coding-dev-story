/**
 * 12 x 12 icons for the project wizard, the launch screen and the prompt cards:
 * `kind_<id>`, `niche_<id>`, `tool_<id>`, `chan_<id>` and `card_<name>`.
 *
 * Each picture is drawn at most 10 x 10 with the letters of icons.ts
 * (`ICON_LEGEND`). `iconPx` adds the ink0 outline and centers it in 12 x 12.
 */
import { CARD_ART } from './bigCards';
import { CHANNEL_ART } from './bigChannels';
import { KIND_ART } from './bigKinds';
import { NICHE_ART } from './bigNiches';
import { TOOL_ART } from './bigTools';

export const BIG_ART: Record<string, string[]> = {
  ...KIND_ART,
  ...NICHE_ART,
  ...TOOL_ART,
  ...CHANNEL_ART,
  ...CARD_ART,
};
