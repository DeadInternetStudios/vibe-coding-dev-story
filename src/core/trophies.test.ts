import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasIcon } from '../art/sprites/icons';
import { ACHIEVEMENTS } from '../content/achievements';
import type { Achievement } from '../content/types';
import { fakeStorage } from './storage.fake';
import { loadTrophies, recordTrophies, TROPHY_ICONS, trophyHint, trophyIcon, trophyQuip, trophyView } from './trophies';

const never = () => false;
const mk = (id: string, desc: string, extra: Partial<Achievement> = {}): Achievement => ({ id, name: `Name ${id}`, desc, when: never, ...extra });

afterEach(() => vi.unstubAllGlobals());

describe('trophy memory', () => {
  it('starts empty and keeps going in a browser with no storage', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(loadTrophies()).toEqual([]);
    expect(recordTrophies(['a'])).toEqual(['a']);
  });

  it('adds ids, never repeats one and never removes one', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    expect(recordTrophies(['a', 'b'])).toEqual(['a', 'b']);
    expect(recordTrophies(['b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(recordTrophies([])).toEqual(['a', 'b', 'c']);
    expect(loadTrophies()).toEqual(['a', 'b', 'c']);
  });

  it('only writes when something is new', () => {
    const store = fakeStorage();
    const setItem = vi.spyOn(store, 'setItem');
    vi.stubGlobal('localStorage', store);
    recordTrophies(['a']);
    recordTrophies(['a']);
    recordTrophies([]);
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('ignores junk in the saved value', () => {
    for (const [raw, want] of [['["a",3,null,"b"]', ['a', 'b']], ['{"a":1}', []], ['"a"', []], ['not json', []]] as const) {
      vi.stubGlobal('localStorage', fakeStorage({ 'vcds.trophies.v1': raw }));
      expect(loadTrophies()).toEqual(want);
    }
  });
});

describe('the hint a locked trophy shows', () => {
  it('uses the written hint first', () => {
    expect(trophyHint(mk('x', 'Do the thing. Then laugh.', { hint: 'Do a thing.' }))).toBe('Do a thing.');
    expect(trophyHint(mk('x', 'Do the thing. Then laugh.', { hint: 'Do a thing.', secret: true }))).toBe('Do a thing.');
  });

  it('gives a secret trophy a teaser that says nothing about it', () => {
    const a = mk('hire-the-thing', 'Hire the thing. It was already there.', { secret: true });
    const hint = trophyHint(a);
    expect(hint.startsWith('Secret.')).toBe(true);
    expect(hint).not.toContain('thing');
    expect(trophyHint(a)).toBe(hint);
  });

  it('falls back to the first sentence, so the joke after it stays a reward', () => {
    expect(trophyHint(mk('x', 'Deploy on a Friday. Nothing happened. Yet.'))).toBe('Deploy on a Friday.');
    expect(trophyHint(mk('x', 'Become a meme on r/ProgrammerHumor. Not the good kind.'))).toBe('Become a meme on r/ProgrammerHumor.');
    expect(trophyHint(mk('x', 'Can you ship it? You cannot.'))).toBe('Can you ship it?');
    expect(trophyHint(mk('x', 'No full stop here'))).toBe('No full stop here');
  });

  it('is written for the first fifteen achievements', () => {
    expect(ACHIEVEMENTS.slice(0, 15).filter((a) => !a.hint)).toEqual([]);
  });

  it('is short, plain and never the whole text, for all of them', () => {
    const bad: string[] = [];
    for (const a of ACHIEVEMENTS) {
      const h = trophyHint(a);
      if (h.length === 0 || h.length > 60) bad.push(`${a.id}: length ${h.length}`);
      if (!/^[\x20-\x7e]*$/.test(h)) bad.push(`${a.id}: not plain text`);
      if (!a.secret && h.length >= a.desc.length) bad.push(`${a.id}: gives away the whole text`);
    }
    expect(bad).toEqual([]);
  });
});

describe('trophy icons', () => {
  it('only names icons that exist, for achievements that exist', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    const bad = Object.entries(TROPHY_ICONS).filter(([id, icon]) => !ids.has(id) || !hasIcon(icon));
    expect(bad).toEqual([]);
  });

  it('falls back to the cup', () => {
    expect(trophyIcon('not-a-trophy')).toBe('trophy');
    expect(trophyIcon('first-ship')).toBe('ship');
  });
});

describe('trophyView', () => {
  const all = [mk('a', 'Do a. Joke a.', { hint: 'Hint a.' }), mk('b', 'Do b. Joke b.', { secret: true }), mk('c', 'Do c. Joke c.')];

  it('shows an earned trophy in full and a locked one with its hint', () => {
    const { rows } = trophyView(all, ['a'], []);
    expect(rows[0]).toMatchObject({ name: 'Name a', text: 'Do a. Joke a.', locked: false });
    expect(rows[2]).toMatchObject({ name: 'Name c', text: 'Do c.', locked: true, icon: 'lock' });
  });

  it('hides the name and the goal of a locked secret one', () => {
    const row = trophyView(all, [], []).rows[1]!;
    expect(row).toMatchObject({ name: '???', locked: true, icon: 'question' });
    expect(row.text).not.toContain('Do b');
    const open = trophyView(all, ['b'], []).rows[1]!;
    expect(open).toMatchObject({ name: 'Name b', text: 'Do b. Joke b.', locked: false });
  });

  it('keeps the order of the content', () => {
    expect(trophyView(all, ['c', 'a'], []).rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('counts earned ones from earlier runs and from this one together', () => {
    expect(trophyView(all, ['a'], ['c', 'a'])).toMatchObject({ got: 2, total: 3 });
    expect(trophyView(all, [], [])).toMatchObject({ got: 0, total: 3 });
  });

  it('marks only what this run earned as new', () => {
    const rows = trophyView(all, ['a', 'b'], ['b', 'c']).rows;
    expect(rows.map((r) => r.isNew)).toEqual([false, true, true]);
  });

  it('never marks a locked trophy as new, and skips saved ids it does not know', () => {
    const v = trophyView(all, ['gone'], []);
    expect(v.rows.some((r) => r.isNew)).toBe(false);
    expect(v.got).toBe(0);
  });

  it('lists all of the real achievements', () => {
    const v = trophyView(ACHIEVEMENTS, [], []);
    expect(v.total).toBe(ACHIEVEMENTS.length);
    expect(v.rows.every((r) => r.locked)).toBe(true);
  });
});

describe('trophyQuip', () => {
  it('has a line for empty, early, middle, late and full, all plain text', () => {
    const lines = [0, 5, 20, 30, 45, 49].map((n) => trophyQuip(n, 49));
    expect(new Set(lines).size).toBe(lines.length);
    for (const l of lines) expect(l).toMatch(/^[\x20-\x7e]+$/);
  });

  it('copes with an empty list', () => {
    expect(trophyQuip(0, 0)).toBe(trophyQuip(0, 49));
  });
});
