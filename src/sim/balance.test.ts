import { describe, expect, it } from 'vitest';
import { buildFromSource } from '../content/runtime';
import { playBot, type BotResult, type Strategy } from './bot';

/**
 * The money has to reward care. These play whole three year games on the shipped content (the other tests use the small
 * fixture and cannot see this), and fail if spamming weekend hacks and Friday deploys ever becomes the best way to play.
 * `npx tsx tools/balance.ts 48 normal` prints the full picture, docs/balance-notes.md says how to move it.
 */
const content = buildFromSource();
const SEEDS = Array.from({ length: 12 }, (_, i) => (i + 1) * 7919 + 13);
const TIMEOUT = 180_000;

type Difficulty = 'chill' | 'normal' | 'ramen';
const played = new Map<string, BotResult[]>();
const play = (strategy: Strategy, difficulty: Difficulty = 'normal'): BotResult[] => {
  const key = `${strategy}/${difficulty}`;
  if (!played.has(key)) played.set(key, SEEDS.map((seed) => playBot(content, seed, strategy, difficulty)));
  return played.get(key)!;
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('balance on the shipped content', () => {
  it('pays for care: the careful bot finishes clearly ahead of the casual one and of the reckless one', () => {
    const smart = mean(play('smart').map((r) => r.score));
    const casual = mean(play('casual').map((r) => r.score));
    const yolo = mean(play('yolo').map((r) => r.score));
    expect(smart).toBeGreaterThan(casual * 1.05);
    expect(smart).toBeGreaterThan(yolo * 1.6);
  }, TIMEOUT);

  it('does not pay for volume: the reckless bot ships twice the apps, they are worse, and it does not end richer', () => {
    const smart = play('smart');
    const yolo = play('yolo');
    expect(mean(yolo.map((r) => r.apps))).toBeGreaterThan(mean(smart.map((r) => r.apps)) * 1.5);
    expect(mean(yolo.map((r) => r.avgScore))).toBeLessThan(mean(smart.map((r) => r.avgScore)) - 3);
    const cash = (rs: BotResult[]) => mean(rs.map((r) => r.game.s.company.cash));
    expect(cash(yolo)).toBeLessThanOrEqual(cash(smart) * 1.05);
  }, TIMEOUT);

  it('does not let reckless play win the top rank', () => {
    const runs = play('yolo');
    expect(runs.filter((r) => r.rank === 'S').length).toBeLessThanOrEqual(2);
  }, TIMEOUT);

  it('keeps the careful bot alive on every difficulty', () => {
    for (const difficulty of ['chill', 'normal', 'ramen'] as const) {
      expect(play('smart', difficulty).filter((r) => r.bankrupt)).toHaveLength(0);
    }
  }, TIMEOUT);

  it('keeps the comment threads fresh: a whole game rarely reads the same comment twice', () => {
    const fractions = play('smart').map((r) => {
      const ids = r.game.s.shipped.flatMap((app) => app.thread.vignettes.map((v) => v.id));
      const seen = new Set(ids);
      expect(ids.length).toBeGreaterThan(40);
      return 1 - seen.size / ids.length;
    });
    expect(mean(fractions)).toBeLessThan(0.2);
  }, TIMEOUT);

  it('loses the company of a bot that does nothing, and of most that mash buttons', () => {
    expect(play('idle').every((r) => r.bankrupt)).toBe(true);
    expect(play('random').filter((r) => r.bankrupt).length).toBeGreaterThanOrEqual(SEEDS.length / 2);
  }, TIMEOUT);
});
