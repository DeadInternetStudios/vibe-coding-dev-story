import type { Content } from '../sim/content';
import { playBot } from '../sim/bot';
import type { Game } from '../sim/game';
import type { GameState } from '../sim/types';

/**
 * Jump straight to a moment in a game, for screenshots and for fixing the screens one at a time.
 * A bot plays a seeded game until the moment shows up, and we keep a copy of the state right then.
 * Only reached through `?demo=name`, so it costs nothing in a normal run.
 */
export interface Demo {
  scene: string;
  data?: object;
  state: GameState;
}

type Pick = (g: Game) => boolean;

const MOMENTS: Record<string, { scene: string; pick: Pick; data?: (s: GameState) => object; patch?: (s: GameState, c: Content) => void }> = {
  thread: { scene: 'Thread', pick: (g) => g.s.shipped.length === 2 && !g.pending, data: (s) => ({ appId: s.shipped[s.shipped.length - 1]!.id }) },
  /** the first launch, made a flop: low ratings, a score under the line where the mods take the post down */
  flop: {
    scene: 'Thread',
    pick: (g) => g.s.shipped.length === 1 && !g.pending,
    data: (s) => ({ appId: s.shipped[0]!.id }),
    patch: (s, c) => {
      const a = s.shipped[0]!;
      // AutoModerator belongs to Reddit, so the demo flops there
      a.channel = 'sideproject';
      a.thread.channel = 'sideproject';
      a.score = 6;
      a.ratings = a.ratings.map(() => 2);
      a.thread.vignettes.forEach((v) => (v.rating = 2));
      const mod = c.modNotices[0];
      const edit = c.opEdits.flop[0];
      if (mod) a.thread.mod = mod;
      if (edit) a.thread.edit = edit;
    },
  },
  thread1: { scene: 'Thread', pick: (g) => g.s.shipped.length === 1 && !g.pending, data: (s) => ({ appId: s.shipped[0]!.id }) },
  ready: { scene: 'Office', pick: (g) => g.pending?.t === 'ready' },
  payday: { scene: 'Office', pick: (g) => g.pending?.t === 'payday' && g.s.shipped.length >= 2 },
  event: { scene: 'Office', pick: (g) => g.pending?.t === 'event' },
  card: { scene: 'Office', pick: (g) => g.pending?.t === 'card' },
  funding: { scene: 'Office', pick: (g) => g.pending?.t === 'funding' },
  awards: { scene: 'Office', pick: (g) => g.pending?.t === 'awards' },
  friday: { scene: 'Office', pick: (g) => g.pending?.t === 'friday' },
  dev: { scene: 'Office', pick: (g) => !g.pending && g.s.project?.status === 'dev' && g.s.day > 90 && g.s.staff.length >= 4 },
  rich: { scene: 'Office', pick: (g) => !g.pending && g.s.day > 500 && g.s.company.officeTier >= 2 },
  late: { scene: 'Office', pick: (g) => !g.pending && g.s.day > 900 },
  hire: { scene: 'Office', pick: (g) => !g.pending && g.s.day > 60 && !g.s.project && g.s.candidates.length > 0 },
};

export function buildDemo(content: Content, name: string, seed = 11): Demo | null {
  const key = name === 'ending' ? null : name;
  if (key !== null && !MOMENTS[key]) return null;
  let snap: GameState | null = null;
  const m = key ? MOMENTS[key]! : null;
  const result = playBot(content, seed, 'smart', 'normal', (g) => {
    if (!snap && m && m.pick(g)) snap = JSON.parse(JSON.stringify(g.snapshot())) as GameState;
  });
  if (!m) return { scene: 'Ending', state: JSON.parse(JSON.stringify(result.game.snapshot())) as GameState };
  if (!snap) return null;
  m.patch?.(snap, content);
  return { scene: m.scene, state: snap, ...(m.data ? { data: m.data(snap) } : {}) };
}
