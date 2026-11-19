import { afterEach, describe, expect, it, vi } from 'vitest';
import { SAVE_VERSION } from '../sim/game';
import { hasOutdatedSave, loadHall, loadSave, pushHall, writeJson } from './save';
import { fakeStorage } from './storage.fake';

afterEach(() => vi.unstubAllGlobals());

describe('a save from another version', () => {
  it('is not opened, and the title is told so instead of quietly starting over', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    expect(loadSave()).toBeNull();
    expect(hasOutdatedSave()).toBe(false);
    writeJson('vcds.save.v1', { v: SAVE_VERSION + 1, day: 400 });
    expect(loadSave()).toBeNull();
    expect(hasOutdatedSave()).toBe(true);
  });

  it('is not reported when the save is current', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    writeJson('vcds.save.v1', { v: SAVE_VERSION, day: 12 });
    expect(loadSave()).not.toBeNull();
    expect(hasOutdatedSave()).toBe(false);
  });

  it('leaves the hall of fame alone', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    pushHall({ company: 'Ramen Capital', founder: 'Sam', rank: 'A', score: 31_000_000, valuation: 20_000_000, apps: 24, days: 1008, endingId: 'acquired', difficulty: 'normal', bankrupt: false, when: 1 });
    writeJson('vcds.save.v1', { v: SAVE_VERSION + 1 });
    expect(loadHall()).toHaveLength(1);
  });
});
