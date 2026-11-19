import { describe, expect, it } from 'vitest';
import { allocate, countVoices, fnv1a32, planTierA, planTierB, planTierC, type Manifest, type ManifestLine } from './tiers';

/** A made-up manifest: `counts` is how many clips each voice has. Text is "<voice> line <n>". */
function manifestOf(counts: Record<string, number>, dur = 2): Manifest {
  const lines: Record<string, ManifestLine> = {};
  for (const [voice, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i += 1) {
      const id = `${voice}-${String(i).padStart(2, '0')}`;
      lines[id] = { voice, text: `${voice} line ${String(i).padStart(2, '0')}`, file: `${id}.mp3`, dur, env: '' };
    }
  }
  return { version: 1, voices: Object.fromEntries(Object.keys(counts).map((v) => [v, { name: v.toUpperCase() }])), lines };
}

const voiceOf = (id: string): string => id.split('-')[0] ?? '';

describe('fnv1a32', () => {
  it('matches the published test vectors', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('gives the voice contract its line id', () => {
    expect(fnv1a32('dave|Did anyone actually read the diff?|').toString(16)).toBe('f3434638');
  });
});

describe('countVoices', () => {
  it('lists voices by clip count, then by id, and adds up their seconds', () => {
    const counts = countVoices(manifestOf({ b: 2, a: 2, c: 5 }, 1.5));
    expect(counts.map((c) => c.voice)).toEqual(['c', 'a', 'b']);
    expect(counts[0]).toEqual({ voice: 'c', clips: 5, seconds: 7.5 });
  });
});

describe('Tier A', () => {
  it('takes every clip of the voices with the most clips, grouped by voice', () => {
    const manifest = manifestOf({ a: 3, b: 5, c: 5, d: 1 });
    const plan = planTierA(manifest, 2);
    expect(plan.voices).toEqual(['b', 'c']);
    expect(plan.ids).toHaveLength(10);
    expect(plan.ids.map(voiceOf)).toEqual(['b', 'b', 'b', 'b', 'b', 'c', 'c', 'c', 'c', 'c']);
  });

  it('does not take a voice that is not among the most', () => {
    const plan = planTierA(manifestOf({ a: 3, b: 5, c: 5, d: 1 }), 2);
    expect(plan.ids.some((id) => voiceOf(id) === 'a' || voiceOf(id) === 'd')).toBe(false);
  });
});

describe('Tier B', () => {
  const manifest = manifestOf({ a: 4, b: 4 });
  const line = (id: string) => ({ id, voice: voiceOf(id), text: manifest.lines[id]?.text ?? '' });

  it('matches story lines to clips by id, in story order, and counts what it read', () => {
    const plan = planTierB(manifest, [
      { label: 'Intro', lines: [line('a-02'), line('b-00')] },
      { label: 'Tutorial', lines: [line('a-01')] },
    ]);
    expect(plan.groups.map((g) => [g.label, g.ids])).toEqual([
      ['Intro', ['a-02', 'b-00']],
      ['Tutorial', ['a-01']],
    ]);
    expect(plan).toMatchObject({ read: 3, matched: 3, skipped: 0 });
    expect(plan.ids).toEqual(['a-02', 'b-00', 'a-01']);
  });

  it('falls back to the one clip with the same voice and exact text when the id is not in the manifest', () => {
    const plan = planTierB(manifest, [{ label: 'Intro', lines: [{ id: 'a-zzzzzzzz', voice: 'a', text: 'a line 03' }] }]);
    expect(plan.ids).toEqual(['a-03']);
    expect(plan.skipped).toBe(0);
  });

  it('skips a line with no clip, and one whose voice and text fit two clips', () => {
    const twin: Manifest = { ...manifest, lines: { ...manifest.lines, 'a-twin': { ...(manifest.lines['a-00'] as ManifestLine), file: 'a-twin.mp3' } } };
    const plan = planTierB(twin, [
      {
        label: 'Intro',
        lines: [
          { id: 'a-gone', voice: 'a', text: 'never rendered' },
          { id: 'a-nope', voice: 'a', text: 'a line 00' },
          line('b-01'),
        ],
      },
    ]);
    expect(plan.ids).toEqual(['b-01']);
    expect(plan).toMatchObject({ read: 3, matched: 1, skipped: 2 });
  });

  it('lists a clip once, under the first beat that has it, and drops a beat with nothing new', () => {
    const plan = planTierB(manifest, [
      { label: 'One', lines: [line('a-00')] },
      { label: 'Two', lines: [line('a-00')] },
      { label: 'Three', lines: [line('a-00'), line('b-03')] },
    ]);
    expect(plan.groups.map((g) => g.label)).toEqual(['One', 'Three']);
    expect(plan.ids).toEqual(['a-00', 'b-03']);
    expect(plan.matched).toBe(4);
  });
});

describe('allocate', () => {
  it('splits the seats in proportion to the pools and adds up to the total', () => {
    const seats = allocate({ a: 60, b: 30, c: 10 }, 10);
    expect(seats).toEqual({ a: 6, b: 3, c: 1 });
  });

  it('gives the leftover seats to the largest remainders, ties to the smaller key', () => {
    const seats = allocate({ a: 1, b: 1, c: 1 }, 2);
    expect(Object.values(seats).reduce((x, y) => x + y, 0)).toBe(2);
    expect(seats).toEqual({ a: 1, b: 1, c: 0 });
  });

  it('never gives a pool more seats than it has clips', () => {
    const seats = allocate({ a: 1, b: 9 }, 8);
    expect(seats.a).toBeLessThanOrEqual(1);
    expect(Object.values(seats).reduce((x, y) => x + y, 0)).toBe(8);
  });
});

describe('Tier C', () => {
  const manifest = manifestOf({ a: 40, b: 30, c: 20, d: 10 });
  const none = new Set<string>();

  it('samples the rate of what is left, the same share from every voice', () => {
    const plan = planTierC(manifest, none, 0.2, 'seed');
    expect(plan.rest).toBe(100);
    expect(plan.ids).toHaveLength(20);
    const per = (v: string) => plan.ids.filter((id) => voiceOf(id) === v).length;
    expect([per('a'), per('b'), per('c'), per('d')]).toEqual([8, 6, 4, 2]);
  });

  it('leaves out what Tier A and B already have', () => {
    const excluded = new Set(Object.keys(manifest.lines).filter((id) => voiceOf(id) === 'a'));
    const plan = planTierC(manifest, excluded, 0.2, 'seed');
    expect(plan.rest).toBe(60);
    expect(plan.ids.every((id) => !excluded.has(id))).toBe(true);
    expect(plan.ids).toHaveLength(12);
  });

  it('gives the same sample for the same seed and another for another seed', () => {
    const first = planTierC(manifest, none, 0.2, 'seed').ids;
    expect(planTierC(manifest, none, 0.2, 'seed').ids).toEqual(first);
    expect(planTierC(manifest, none, 0.2, 'other seed').ids).not.toEqual(first);
  });

  it('keeps a smaller sample inside a bigger one for each voice', () => {
    const small = planTierC(manifest, none, 0.1, 'seed').ids;
    const big = new Set(planTierC(manifest, none, 0.3, 'seed').ids);
    expect(small.every((id) => big.has(id))).toBe(true);
  });

  it('hears every voice at least once, however small its pool', () => {
    const lopsided = manifestOf({ a: 90, b: 9, c: 1 });
    const plan = planTierC(lopsided, none, 0.05, 'seed');
    expect(new Set(plan.ids.map(voiceOf))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('lists the picks by voice, most clips first, then by text', () => {
    const plan = planTierC(manifest, none, 0.2, 'seed');
    const voices = plan.ids.map(voiceOf);
    expect([...new Set(voices)]).toEqual(['a', 'b', 'c', 'd']);
    const texts = plan.ids.filter((id) => voiceOf(id) === 'a').map((id) => manifest.lines[id]?.text ?? '');
    expect(texts).toEqual([...texts].sort());
  });
});
