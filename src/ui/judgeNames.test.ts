import { describe, expect, it } from 'vitest';
import { judgeNames, type Judged } from './judgeNames';

const KINDS: Judged[] = ['vibes', 'features', 'polish', 'stability', 'security', 'overall', 'hype'];

describe('the words for a thread rating', () => {
  it('the first rating of a kind is the plain word for it', () => {
    expect(judgeNames(['features', 'security', 'overall', 'hype'])).toEqual(['FEATURES', 'SECURITY', 'OVERALL', 'HYPE']);
  });

  // the Thread Score showed "SECURITY 2": a copy with a number on it
  it.each(KINDS)('%s rated again gets another word, never a number', (kind) => {
    const names = judgeNames([kind, kind, kind, kind]);
    expect(new Set(names).size).toBe(4);
    for (const n of names) expect(n).not.toMatch(/\d/);
  });

  it('no two ratings in any thread of four share a word', () => {
    const all: string[] = [];
    for (const kind of KINDS) all.push(...judgeNames([kind, kind, kind, kind]));
    expect(new Set(all).size).toBe(all.length);
  });

  // the wide Thread Score has room for eight letters before the number: STABILITY came out as "STABI..."
  it('every word fits where the room is eight letters', () => {
    for (const kind of KINDS) for (const n of judgeNames([kind, kind, kind, kind], 8)) expect(n.length).toBeLessThanOrEqual(8);
    expect(judgeNames(['stability'], 8)).toEqual(['STABLE']);
    expect(judgeNames(['stability'], 14)).toEqual(['STABILITY']);
  });
});
