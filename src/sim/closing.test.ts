import { describe, expect, it } from 'vitest';
import { buildFromSource } from '../content/runtime';
import { playBot, type Strategy } from './bot';
import { REMOVED_BELOW, SOLID_FROM, VIRAL_FROM } from './config';
import type { ShippedApp } from './types';

const content = buildFromSource();

function launches(): ShippedApp[] {
  const out: ShippedApp[] = [];
  const strategies: Strategy[] = ['smart', 'random', 'idle', 'yolo'];
  for (const strategy of strategies) for (const seed of [1, 2, 3]) out.push(...playBot(content, seed, strategy).game.s.shipped);
  return out;
}

describe('the end of a thread', () => {
  const apps = launches();

  it('ends with the founder Edit that matches how the launch went', () => {
    expect(apps.length).toBeGreaterThan(10);
    for (const a of apps) {
      const tier = a.score >= VIRAL_FROM ? 'viral' : a.score >= SOLID_FROM ? 'solid' : 'flop';
      expect(a.thread.edit, `${a.name} scored ${a.score}`).toBeDefined();
      expect(content.opEdits[tier].map((l) => l.id)).toContain(a.thread.edit!.id);
      expect(a.thread.edit!.voice).toBe('chad');
    }
  });

  it('has AutoModerator take down exactly the flops', () => {
    for (const a of apps) {
      if (a.score < REMOVED_BELOW) {
        expect(a.thread.mod, `${a.name} scored ${a.score}`).toBeDefined();
        expect(content.modNotices.map((l) => l.id)).toContain(a.thread.mod!.id);
        expect(a.thread.mod!.voice).toBe('automod');
      } else expect(a.thread.mod).toBeUndefined();
    }
  });

  it('survives a save and a load', () => {
    const a = apps.find((x) => x.thread.edit);
    expect(a).toBeDefined();
    const back = JSON.parse(JSON.stringify(a)) as ShippedApp;
    expect(back.thread.edit).toEqual(a!.thread.edit);
  });
});
