import { describe, expect, it } from 'vitest';
import { buildFromSource } from '../content/runtime';
import { playBot, type Strategy } from '../sim/bot';
import { DIFFICULTIES } from '../sim/config';
import type { GameState } from '../sim/types';
import { problemWithSave } from './saveCheck';

const content = buildFromSource();
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Real saves: a snapshot every 150 days of whole bot games, plus the first one of every kind of prompt the game can hold. */
const real: { label: string; state: GameState }[] = [];
const prompts = new Map<string, GameState>();
for (const difficulty of DIFFICULTIES.map((d) => d.id)) {
  for (const strategy of ['smart', 'casual', 'random', 'idle', 'yolo'] as Strategy[]) {
    for (const seed of [3, 4]) {
      let nextSnap = 0;
      const r = playBot(content, seed, strategy, difficulty, (g) => {
        for (const p of g.s.pending) if (!prompts.has(p.t)) prompts.set(p.t, clone(g.s));
        if (g.s.day >= nextSnap && !g.s.ending) {
          nextSnap = g.s.day + 150;
          real.push({ label: `${strategy} ${difficulty} seed ${seed} day ${g.s.day}`, state: clone(g.s) });
        }
      });
      real.push({ label: `${strategy} ${difficulty} seed ${seed} at the end`, state: clone(r.game.snapshot()) });
    }
  }
}
/** A late game with many shipped apps and threads, still running: the biggest thing a save holds. */
const late = real.filter((r) => r.label.startsWith('smart normal seed 3 day')).at(-1)!.state;
// the bots answer a Friday prompt in the same breath it is raised, so none of their snapshots holds one
prompts.set('friday', { ...clone(late), pending: [{ t: 'friday' }] });

describe('the save check lets every real save in', () => {
  it('turns none of the snapshots of whole bot games away', () => {
    expect(real.length).toBeGreaterThan(100);
    expect(late.day).toBeGreaterThan(700);
    expect(late.shipped.length).toBeGreaterThan(10);
    for (const r of real) expect(problemWithSave(r.state, content), r.label).toBeNull();
  });

  it('knows every kind of prompt the game can hold, and meets each in a real save', () => {
    for (const kind of ['event', 'card', 'ready', 'payday', 'funding', 'awards', 'friday', 'ending']) {
      const state = prompts.get(kind);
      expect(state, `no bot game held a ${kind} prompt`).toBeDefined();
      expect(problemWithSave(state, content), kind).toBeNull();
    }
  });
});

describe('the save check turns away what is not a real save', () => {
  it('turns away the saves that broke the game in review', () => {
    expect(problemWithSave({ v: 1, day: 5, company: 'x', staff: [null], shipped: [] }, content)).not.toBeNull();
    expect(problemWithSave({ v: 1 }, content)).not.toBeNull();
  });

  it('turns away things that are not objects at all', () => {
    for (const junk of [null, undefined, 7, 'save', [], [late], true]) expect(problemWithSave(junk, content)).not.toBeNull();
  });

  it('names the field that is wrong', () => {
    const s = clone(late);
    s.staff[0]!.look.skin = 1.5;
    expect(problemWithSave(s, content)).toBe('staff: [0] look: skin: a whole number from 0 to 999');
  });

  it('turns away a company that is not an object, a missing company and a hole in the team', () => {
    const edits: ((s: Record<string, unknown>) => void)[] = [(s) => (s.company = 'x'), (s) => delete s.company, (s) => ((s.staff as unknown[])[0] = null)];
    for (const edit of edits) {
      const s = clone(late) as unknown as Record<string, unknown>;
      edit(s);
      expect(problemWithSave(s, content)).not.toBeNull();
    }
  });

  it('turns away ids the content does not know, in a tool, a channel, a prompt and a voice clip', () => {
    const edits: ((s: GameState) => void)[] = [
      (s) => (s.company.activeTool = 'nope'),
      (s) => (s.shipped[0]!.channel = 'nope'),
      (s) => (s.staff[0]!.archetype = 'nope'),
      (s) => (s.shipped[0]!.thread.vignettes[0]!.id = 'nope'),
      (s) => (s.pending = [{ t: 'event', eventId: 'nope', title: 't', body: 'b', speaker: 'clod', choices: [{ label: 'ok', enabled: true }] }]),
      (s) => (s.pending = [{ t: 'event', eventId: content.events[0]!.id, title: 't', body: 'b', speaker: 'clod', line: { kind: 'vo', id: '../../secret', voice: 'clod', text: 'x' }, choices: [{ label: 'ok', enabled: true }] }]),
    ];
    for (const edit of edits) {
      const s = clone(late);
      edit(s);
      expect(problemWithSave(s, content)).not.toBeNull();
    }
  });

  it('turns away a table that tries to set its own prototype', () => {
    const s = JSON.parse(JSON.stringify(late).replace('"counters":{', '"counters":{"__proto__":1,')) as GameState;
    expect(problemWithSave(s, content)).toMatch(/__proto__/);
  });

  it('turns away a save with nobody on the team', () => {
    const s = clone(late);
    s.staff = [];
    expect(problemWithSave(s, content)).not.toBeNull();
  });
});

type Path = (string | number)[];

/** Every place in a save, as the path to it. */
function nodes(x: unknown, at: Path = [], out: Path[] = []): Path[] {
  if (Array.isArray(x)) x.forEach((v, i) => nodes(v, [...at, i], out));
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) nodes(v, [...at, k], out);
  if (at.length) out.push(at);
  return out;
}

type Cell = Record<string | number, unknown>;
const read = (state: GameState, path: Path) => path.reduce<unknown>((x, k) => (x as Cell)[k], state);

/** Runs `run` on the save with one place changed, and puts it back after: a copy of the whole save for every try would take minutes. */
function changed<T>(state: GameState, path: Path, value: unknown, run: (s: GameState) => T): T {
  const holder = path.slice(0, -1).reduce<unknown>((x, k) => (x as Cell)[k], state) as Cell;
  const last = path[path.length - 1]!;
  const was = holder[last];
  holder[last] = value;
  try {
    return run(state);
  } finally {
    holder[last] = was;
  }
}

describe('the save check has a rule for every value a save holds', () => {
  const states = [late, ...prompts.values()];

  it('turns away a value of the wrong kind wherever it is put (a field the check forgot would let it in)', () => {
    let tried = 0;
    for (const state of states) {
      for (const path of nodes(state)) {
        const wrong = typeof read(state, path) === 'string' ? 7 : '7';
        const why = changed(state, path, wrong, (s) => problemWithSave(s, content));
        expect(why, `${path.join('.')} was let through as ${JSON.stringify(wrong)}`).not.toBeNull();
        tried += 1;
      }
    }
    expect(tried).toBeGreaterThan(2000);
  });

  it('turns away a number that is not a number, or is far too big, wherever one sits', () => {
    let tried = 0;
    for (const state of states) {
      for (const path of nodes(state).filter((p) => typeof read(state, p) === 'number')) {
        for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, 1e300]) {
          const why = changed(state, path, bad, (s) => problemWithSave(s, content));
          expect(why, `${path.join('.')} was let through as ${bad}`).not.toBeNull();
          tried += 1;
        }
      }
    }
    expect(tried).toBeGreaterThan(3000);
  });

  it('never throws, whatever it is given', () => {
    const all = nodes(late);
    const stride = Math.ceil(all.length / 150);
    for (const path of all.filter((_, i) => i % stride === 0)) {
      for (const bad of [null, undefined, {}, [], 'x', -1, 0.5, true]) expect(() => changed(late, path, bad, (s) => problemWithSave(s, content))).not.toThrow();
    }
  });
});

describe('the save check plays the save forward before it believes it', () => {
  it('turns away a save the game cannot play on, even when every field has the right kind', () => {
    const broken = {
      ...content,
      trait: () => {
        throw new Error('boom');
      },
    };
    expect(problemWithSave(clone(late), broken)).toBe('it cannot be played on: boom');
  });

  it('does not touch the save it was given', () => {
    const s = clone(late);
    const before = JSON.stringify(s);
    problemWithSave(s, content);
    expect(JSON.stringify(s)).toBe(before);
  });
});
