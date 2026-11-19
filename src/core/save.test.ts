import { afterEach, describe, expect, it, vi } from 'vitest';
import { playBot } from '../sim/bot';
import { FIXTURE } from '../sim/fixtures';
import { SAVE_VERSION } from '../sim/game';
import { loadHall, loadSave, pushHall, saveProblem, setSaveAside, takeCrashNote, writeJson } from './save';
import { fakeStorage } from './storage.fake';

afterEach(() => vi.unstubAllGlobals());

const SAVE = 'vcds.save.v1';
const state = playBot(FIXTURE, 5, 'smart').game.snapshot();

describe('a save from another version', () => {
  it('is not opened, and the title is told so instead of quietly starting over', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    expect(loadSave(FIXTURE)).toBeNull();
    expect(saveProblem(FIXTURE)).toBeNull();
    writeJson(SAVE, { ...state, v: SAVE_VERSION + 1 });
    expect(loadSave(FIXTURE)).toBeNull();
    expect(saveProblem(FIXTURE)).toBe('older');
  });

  it('is not reported when the save is current', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    writeJson(SAVE, state);
    expect(loadSave(FIXTURE)).toEqual(state);
    expect(saveProblem(FIXTURE)).toBeNull();
  });

  it('leaves the hall of fame alone', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    pushHall({ company: 'Ramen Capital', founder: 'Sam', rank: 'A', score: 31_000_000, valuation: 20_000_000, apps: 24, days: 1008, endingId: 'acquired', difficulty: 'normal', bankrupt: false, when: 1 });
    writeJson(SAVE, { v: SAVE_VERSION + 1 });
    expect(loadHall()).toHaveLength(1);
  });
});

describe('a save that is damaged', () => {
  it('is not opened, the title says so, and the title can still be built (it used to fail on a company that was not there)', () => {
    for (const bad of [{ v: SAVE_VERSION }, { v: SAVE_VERSION, day: 5, company: 'x', staff: [null], shipped: [] }, { ...state, company: null }, [], 'save']) {
      vi.stubGlobal('localStorage', fakeStorage());
      writeJson(SAVE, bad);
      expect(loadSave(FIXTURE)).toBeNull();
      expect(saveProblem(FIXTURE)).toBe('damaged');
    }
  });

  it('is not opened when the text is not JSON at all', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [SAVE]: '{"v":1,' }));
    expect(loadSave(FIXTURE)).toBeNull();
    expect(saveProblem(FIXTURE)).toBe('damaged');
  });

  it('is not opened when it is far bigger than any save can be', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [SAVE]: JSON.stringify({ ...state, flags: ['x'.repeat(3_100_000)] }) }));
    expect(loadSave(FIXTURE)).toBeNull();
    expect(saveProblem(FIXTURE)).toBe('damaged');
  });
});

describe('a run that crashed the game while it was opening', () => {
  it('is put aside whole, no longer offered, and the next title hears about it once', () => {
    const store = fakeStorage();
    vi.stubGlobal('localStorage', store);
    writeJson(SAVE, state);
    expect(loadSave(FIXTURE)).not.toBeNull();
    setSaveAside();
    expect(loadSave(FIXTURE)).toBeNull();
    expect(store.getItem(SAVE)).toBeNull();
    expect(JSON.parse(store.getItem('vcds.save.aside')!)).toEqual(state);
    expect(takeCrashNote()).toBe(true);
    expect(takeCrashNote()).toBe(false);
  });

  it('still goes when the browser has no room to keep a copy, or it would crash on every start', () => {
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k === SAVE ? JSON.stringify(state) : null),
      setItem: (k: string) => {
        if (k === 'vcds.save.aside') throw new Error('quota');
      },
      removeItem: vi.fn(),
    });
    setSaveAside();
    expect(localStorage.removeItem).toHaveBeenCalledWith(SAVE);
  });
});
