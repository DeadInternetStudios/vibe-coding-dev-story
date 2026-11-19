/**
 * The sim reads content through this one shape, so tests can pass a tiny
 * fixture and the game passes the real thing.
 */
import type {
  Achievement,
  Channel,
  DialogueStep,
  Ending,
  GameEvent,
  Niche,
  PaydayItem,
  ProductKind,
  StaffArchetype,
  Tool,
  Trait,
  Vignette,
} from '../content/types';
import type { VoiceLine } from '../content/vo';

export interface RawContent {
  kinds: ProductKind[];
  niches: Niche[];
  tools: Tool[];
  traits: Trait[];
  archetypes: StaffArchetype[];
  firstNames: string[];
  lastNames: string[];
  companyNames: string[];
  channels: Channel[];
  events: GameEvent[];
  vignettes: Vignette[];
  opBodies: string[];
  /** the last Edit the founder adds under the thread, by how the launch went */
  opEdits: Record<'viral' | 'solid' | 'flop', VoiceLine[]>;
  /** what AutoModerator says when a flop gets taken down */
  modNotices: VoiceLine[];
  paydayItems: PaydayItem[];
  appReviews: { stars: 1 | 2 | 3 | 4 | 5; text: string; user: string }[];
  achievements: Achievement[];
  endings: Ending[];
  ambient: VoiceLine[];
  /** one is said when the first tap on the title screen wakes the sound */
  titleQuips: VoiceLine[];
  loading: string[];
  tips: string[];
  headlines: string[];
  commitMessages: string[];
  story: {
    intro: DialogueStep[];
    tutorial: Record<string, DialogueStep[]>;
    yearEnd: Record<string, DialogueStep[]>;
    funding: Record<string, DialogueStep[]>;
    friday: Record<string, DialogueStep[]>;
    deploy: DialogueStep[];
    monthNarration: DialogueStep[];
  };
}

export interface Content extends RawContent {
  kind: (id: string) => ProductKind;
  niche: (id: string) => Niche;
  tool: (id: string) => Tool;
  trait: (id: string) => Trait;
  archetype: (id: string) => StaffArchetype;
  channel: (id: string) => Channel;
  event: (id: string) => GameEvent | undefined;
  vignette: (id: string) => Vignette | undefined;
}

function table<T extends { id: string }>(items: readonly T[], label: string): (id: string) => T {
  const map = new Map(items.map((i) => [i.id, i]));
  return (id) => {
    const hit = map.get(id);
    if (!hit) throw new Error(`unknown ${label}: ${id}`);
    return hit;
  };
}

export function buildContent(raw: RawContent): Content {
  const events = new Map(raw.events.map((e) => [e.id, e]));
  const vignettes = new Map(raw.vignettes.map((v) => [v.id, v]));
  return {
    ...raw,
    kind: table(raw.kinds, 'kind'),
    niche: table(raw.niches, 'niche'),
    tool: table(raw.tools, 'tool'),
    trait: table(raw.traits, 'trait'),
    archetype: table(raw.archetypes, 'archetype'),
    channel: table(raw.channels, 'channel'),
    event: (id) => events.get(id),
    vignette: (id) => vignettes.get(id),
  };
}
