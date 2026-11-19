import { describe, expect, it } from 'vitest';
import { MUSIC_IDS, MUSIC_LABELS, SFX_CATALOG, SFX_FAMILIES, SFX_IDS } from './ids';
import { SFX_DEFS } from './sfx';
import { sfxDuration } from './sfx/dsl';
import { SoundEngine } from './engine';

/** The ids the game was promised. If one disappears, this fails loudly. */
const PROMISED = [
  'click', 'hover', 'back', 'open', 'close', 'tab', 'toggle', 'error', 'confirm', 'deny', 'select', 'type', 'type2',
  'coin', 'coins', 'cash_register', 'payday', 'bill', 'broke',
  'level_up', 'hot_idea', 'bubble', 'phase_done', 'ship_it', 'deploy_beep', 'deploy_go',
  'upvote', 'downvote', 'award', 'comment_in', 'karma_tick', 'thread_open', 'removed', 'roast', 'praise',
  'hire', 'fire', 'coffee', 'pizza', 'phone', 'keyboard_burst', 'rate_limit', 'alert', 'bug', 'fix', 'explosion', 'quack', 'meow', 'ghost',
  'fanfare_small', 'fanfare_big', 'award_win', 'game_over', 'victory', 'achievement',
];

describe('sound ids', () => {
  it('every promised sfx id exists', () => {
    for (const id of PROMISED) expect(SFX_IDS, id).toContain(id);
    expect(PROMISED.length).toBe(55);
  });

  it('ids are unique, snake case and ASCII', () => {
    expect(new Set(SFX_IDS).size).toBe(SFX_IDS.length);
    for (const id of SFX_IDS) expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('every sfx belongs to a known family and has a label', () => {
    for (const [id, label, family] of SFX_CATALOG) {
      expect(SFX_FAMILIES, id).toContain(family);
      expect(label.length, id).toBeGreaterThan(2);
    }
  });

  it('every sfx id has a sound behind it, and nothing extra', () => {
    expect(Object.keys(SFX_DEFS).sort()).toEqual([...SFX_IDS].sort());
    for (const id of SFX_IDS) {
      const body = SFX_DEFS[id];
      expect(body.events?.length || body.song, id).toBeTruthy();
      const len = sfxDuration(body);
      expect(len, id).toBeGreaterThan(0.02);
      expect(len, id).toBeLessThan(8);
    }
  });

  it('the public static lists mirror the catalog', () => {
    expect(SoundEngine.SFX.map((s) => s.id)).toEqual([...SFX_IDS]);
    for (const s of SoundEngine.SFX) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.family.length).toBeGreaterThan(0);
    }
    expect(SoundEngine.MUSIC.map((m) => m.id)).toEqual([...MUSIC_IDS]);
    for (const m of MUSIC_IDS) expect(MUSIC_LABELS[m].length).toBeGreaterThan(0);
  });
});
