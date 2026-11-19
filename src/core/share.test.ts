import { describe, expect, it } from 'vitest';
import { playBot } from '../sim/bot';
import { FIXTURE } from '../sim/fixtures';
import type { GameState } from '../sim/types';
import { shareText } from './share';

const URL = 'https://example.test/play';
const DAILY_LINE = 'Same start for everyone today. Beat my score.';

const finished = JSON.parse(JSON.stringify(playBot(FIXTURE, 3, 'smart').game.snapshot())) as GameState;
const lines = (s: GameState) => shareText(s, 'Some Ending', URL).split('\n');

describe('the post a player shares', () => {
  it('tells the story of a normal run, with the link last', () => {
    const l = lines(finished);
    expect(l[0]).toMatch(/^I vibe coded .+ in Vibe Coding Dev Story\. Rank [SABCDF] \(/);
    expect(l).toContain('Ending: "Some Ending"');
    expect(l[l.length - 1]).toBe(URL);
    const text = l.join('\n');
    expect(text).not.toMatch(/daily/i);
    expect(text).not.toContain(DAILY_LINE);
  });

  it('says on the first line that it was the daily challenge, and which day', () => {
    const normal = lines(finished);
    const daily = lines({ ...finished, daily: '2026-11-19' });
    expect(daily[0]).toBe(`Daily Challenge 2026-11-19: ${normal[0]}`);
    expect(daily).toContain(DAILY_LINE);
    expect(daily[daily.length - 1]).toBe(URL);
  });

  it('changes nothing else for a daily run', () => {
    const normal = lines(finished);
    const daily = lines({ ...finished, daily: '2026-11-19' }).filter((l) => l !== DAILY_LINE);
    expect(daily.slice(1)).toEqual(normal.slice(1));
  });

  it('says it on the first line when the money ran out too', () => {
    const broke = { ...finished, daily: '2026-11-19', ending: { ...finished.ending!, bankrupt: true } };
    const first = lines(broke)[0]!;
    expect(first).toMatch(/^Daily Challenge 2026-11-19: I vibe coded .+ and the money ran out\. Rank /);
  });

  it('is only the link before the run has an ending', () => {
    expect(shareText({ ...finished, ending: null, daily: '2026-11-19' }, undefined, URL)).toBe(URL);
  });
});
