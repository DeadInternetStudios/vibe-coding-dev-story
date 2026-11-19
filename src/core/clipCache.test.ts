import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClipCache } from './clipCache';

/** A fetch we control: every ask is recorded, and each one is answered when the test says so. */
function fakeFetch() {
  const asked: string[] = [];
  const open = new Map<string, (clip: string | null | undefined) => void>();
  let inFlight = 0;
  let mostAtOnce = 0;
  const fetchClip = (id: string) => {
    asked.push(id);
    inFlight++;
    mostAtOnce = Math.max(mostAtOnce, inFlight);
    return new Promise<string | null | undefined>((resolve) => {
      open.set(id, (clip) => {
        inFlight--;
        resolve(clip);
      });
    });
  };
  return { asked, fetchClip, answer: (id: string, clip: string | null | undefined) => open.get(id)!(clip), mostAtOnce: () => mostAtOnce };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('a clip that is slow to arrive', () => {
  it('is not waited for past the limit, and is there for the next ask once it lands', async () => {
    const f = fakeFetch();
    const cache = new ClipCache(f.fetchClip, 10);
    const waited = cache.within('a', 350);
    await vi.advanceTimersByTimeAsync(349);
    let settled = false;
    void waited.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await waited).toBeNull();

    f.answer('a', 'clip-a');
    await vi.advanceTimersByTimeAsync(0);
    expect(await cache.within('a', 350)).toBe('clip-a');
    expect(f.asked).toEqual(['a']);
  });

  it('is handed over the moment it arrives when it makes the limit', async () => {
    const f = fakeFetch();
    const cache = new ClipCache(f.fetchClip, 10);
    const waited = cache.within('a', 350);
    await vi.advanceTimersByTimeAsync(100);
    f.answer('a', 'clip-a');
    expect(await waited).toBe('clip-a');
  });
});

describe('asking for the same clip twice', () => {
  it('costs one fetch, whether it is a preload and a line or two lines', async () => {
    const f = fakeFetch();
    const cache = new ClipCache(f.fetchClip, 10);
    const ahead = cache.preload(['a'], 3);
    const line = cache.get('a');
    expect(f.asked).toEqual(['a']);
    f.answer('a', 'clip-a');
    expect(await line).toBe('clip-a');
    await ahead;
    expect(await cache.get('a')).toBe('clip-a');
    expect(f.asked).toEqual(['a']);
  });
});

describe('what is remembered', () => {
  it('a line with no clip stays silent without asking again', async () => {
    const f = fakeFetch();
    const cache = new ClipCache(f.fetchClip, 10);
    const first = cache.get('a');
    f.answer('a', null);
    expect(await first).toBeNull();
    expect(await cache.get('a')).toBeNull();
    expect(f.asked).toEqual(['a']);
  });

  it('a clip that could not be fetched, or could not be known yet, is asked for again next time', async () => {
    const f = fakeFetch();
    const cache = new ClipCache(f.fetchClip, 10);
    const first = cache.get('a');
    f.answer('a', undefined);
    expect(await first).toBeNull();
    const second = cache.get('a');
    f.answer('a', 'clip-a');
    expect(await second).toBe('clip-a');
    expect(f.asked).toEqual(['a', 'a']);
  });

  it('the oldest clip goes when the cache is full, and is fetched again if it is needed', async () => {
    const f = fakeFetch();
    const cache = new ClipCache(f.fetchClip, 2);
    for (const id of ['a', 'b', 'c']) {
      const p = cache.get(id);
      f.answer(id, `clip-${id}`);
      await p;
    }
    void cache.get('b');
    void cache.get('c');
    expect(f.asked).toEqual(['a', 'b', 'c']);
    const again = cache.get('a');
    expect(f.asked).toEqual(['a', 'b', 'c', 'a']);
    f.answer('a', 'clip-a');
    await again;
  });
});

describe('loading a scene ahead of time', () => {
  it('fetches in the order the lines will be said, a few at a time', async () => {
    const f = fakeFetch();
    const cache = new ClipCache(f.fetchClip, 10);
    const ahead = cache.preload(['a', 'b', 'c', 'd', 'e', 'a'], 2);
    expect(f.asked).toEqual(['a', 'b']);
    f.answer('a', 'clip-a');
    await vi.advanceTimersByTimeAsync(0);
    expect(f.asked).toEqual(['a', 'b', 'c']);
    f.answer('b', 'clip-b');
    f.answer('c', 'clip-c');
    await vi.advanceTimersByTimeAsync(0);
    expect(f.asked).toEqual(['a', 'b', 'c', 'd', 'e']);
    f.answer('d', 'clip-d');
    f.answer('e', 'clip-e');
    await ahead;
    expect(f.mostAtOnce()).toBe(2);
  });

  it('leaves out what it already has', async () => {
    const f = fakeFetch();
    const cache = new ClipCache(f.fetchClip, 10);
    const first = cache.get('a');
    f.answer('a', 'clip-a');
    await first;
    const ahead = cache.preload(['a', 'b'], 3);
    expect(f.asked).toEqual(['a', 'b']);
    f.answer('b', 'clip-b');
    await ahead;
  });
});
