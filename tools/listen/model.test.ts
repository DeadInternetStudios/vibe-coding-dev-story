import { describe, expect, it } from 'vitest';
import {
  REASONS,
  clearAllMarks,
  clearMark,
  flagExport,
  formatDuration,
  formatLeft,
  isMarked,
  loadMarks,
  markKey,
  mergeMarks,
  nextMark,
  parseMark,
  parseProgressFile,
  progressOf,
  reasonText,
  saveMark,
  signoffLine,
  signoffOf,
  statusOf,
  toProgressFile,
  type KeyValueStore,
  type Mark,
} from './model';
import type { Clip } from './types';

const clip = (id: string, over: Partial<Clip> = {}): Clip => ({ id, v: id.split('-')[0] ?? '', t: `text of ${id}`, d: 2, e: '', r: 'r1', ...over });
const mark = (s: 'ok' | 'flag', v = 'r1', over: Partial<Mark> = {}): Mark => ({ s, r: s === 'flag' ? ['stress'] : [], n: '', t: 1, v, ...over });

function memoryStore(): KeyValueStore & { dump(): Record<string, string> } {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    dump: () => Object.fromEntries(data),
  };
}

describe('status', () => {
  it('is todo without a mark, the mark when the audio is the one that was heard, stale when it changed', () => {
    const c = clip('dave-1');
    expect(statusOf(c, undefined)).toBe('todo');
    expect(statusOf(c, mark('ok'))).toBe('ok');
    expect(statusOf(c, mark('flag'))).toBe('flag');
    expect(statusOf(c, mark('ok', 'old'))).toBe('stale');
  });

  it('counts only ok and flag as marked', () => {
    expect(['todo', 'ok', 'flag', 'stale'].map((s) => isMarked(s as 'todo'))).toEqual([false, true, true, false]);
  });
});

describe('nextMark', () => {
  const c = clip('dave-1');

  it('drops reasons and note from an OK', () => {
    expect(nextMark(mark('flag'), c, 'ok', ['stress'], 'x', 5)).toEqual({ s: 'ok', r: [], n: '', t: 5, v: 'r1' });
  });

  it('files a flag with no reason under other, and trims the note', () => {
    expect(nextMark(undefined, c, 'flag', [], '  held breath  ', 5)).toEqual({ s: 'flag', r: ['other'], n: 'held breath', t: 5, v: 'r1' });
  });

  it('remembers that a flagged clip was rendered again and heard again', () => {
    const rerendered = clip('dave-1', { r: 'r2' });
    const heardAgain = nextMark(mark('flag', 'r1'), rerendered, 'ok', [], '', 9);
    expect(heardAgain).toMatchObject({ s: 'ok', v: 'r2', h: true });
    expect(nextMark(heardAgain, rerendered, 'ok', [], '', 10).h).toBe(true);
  });

  it('does not claim a fix when the audio never changed or the clip was never flagged', () => {
    expect(nextMark(mark('flag', 'r1'), c, 'ok', [], '', 9).h).toBeUndefined();
    expect(nextMark(mark('ok', 'r1'), clip('dave-1', { r: 'r2' }), 'ok', [], '', 9).h).toBeUndefined();
  });
});

describe('parseMark', () => {
  it('reads what nextMark wrote', () => {
    const m = mark('flag', 'abc', { n: 'note', h: true });
    expect(parseMark(JSON.parse(JSON.stringify(m)))).toEqual(m);
  });

  it('refuses anything that is not a mark', () => {
    for (const junk of [null, 'ok', 7, {}, { s: 'maybe', v: 'x', t: 1 }, { s: 'ok', t: 1 }, { s: 'ok', v: 'x', t: 'now' }, { s: 'ok', v: 'x', t: Number.NaN }]) {
      expect(parseMark(junk)).toBeNull();
    }
  });

  it('keeps known reasons only and an h that is exactly true', () => {
    expect(parseMark({ s: 'flag', v: 'x', t: 1, r: ['stress', 'banana', 3], h: 'yes' })).toEqual({ s: 'flag', r: ['stress'], n: '', t: 1, v: 'x' });
  });
});

describe('progress', () => {
  const clips = new Map([clip('a-1', { d: 10 }), clip('a-2', { d: 20 }), clip('a-3', { d: 30 }), clip('a-4', { d: 40 })].map((c) => [c.id, c]));
  const marks = new Map<string, Mark>([
    ['a-1', mark('ok')],
    ['a-2', mark('flag')],
    ['a-3', mark('ok', 'old')],
  ]);

  it('counts each status and the seconds still to hear', () => {
    expect(progressOf(['a-1', 'a-2', 'a-3', 'a-4'], clips, marks)).toEqual({ total: 4, ok: 1, flag: 1, stale: 1, todo: 1, marked: 2, secondsLeft: 70 });
  });

  it('skips ids it does not know', () => {
    expect(progressOf(['a-1', 'zzz'], clips, marks).total).toBe(1);
  });
});

describe('sign-off', () => {
  const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}-${i}`);
  const tiers = { A: ids('a', 3), B: ['a-0', 'b-0'], C: ids('c', 10) };
  const clips = new Map([...new Set([...tiers.A, ...tiers.B, ...tiers.C])].map((id) => [id, clip(id)]));
  const markAll = (list: readonly string[], m: Mark = mark('ok')) => list.map((id): [string, Mark] => [id, m]);

  it('is ready when A and B are fully marked and C has 90%', () => {
    const marks = new Map([...markAll(tiers.A), ...markAll(tiers.B), ...markAll(tiers.C.slice(0, 9))]);
    const s = signoffOf(tiers, clips, marks, 0.9);
    expect(s.cNeeded).toBe(9);
    expect(s.ready).toBe(true);
  });

  it('is not ready one clip short in C, or with one clip of A to do', () => {
    const base = [...markAll(tiers.B), ...markAll(tiers.C.slice(0, 8))];
    expect(signoffOf(tiers, clips, new Map([...base, ...markAll(tiers.A)]), 0.9).ready).toBe(false);
    expect(signoffOf(tiers, clips, new Map([...base, ...markAll(tiers.C.slice(8, 9)), ...markAll(tiers.A.slice(0, 2))]), 0.9).ready).toBe(false);
  });

  it('rounds the 90% up: 85 clips in C need 77, not 76', () => {
    const bigC = ids('c', 85);
    const all = new Map([...new Set([...tiers.A, ...tiers.B, ...bigC])].map((id) => [id, clip(id)]));
    const done = [...markAll(tiers.A), ...markAll(tiers.B)];
    const at = (n: number) => signoffOf({ ...tiers, C: bigC }, all, new Map([...done, ...markAll(bigC.slice(0, n))]), 0.9);
    expect(at(76)).toMatchObject({ cNeeded: 77, ready: false });
    expect(at(77).ready).toBe(true);
  });

  it('counts a clip that is in two tiers once', () => {
    const marks = new Map([...markAll(tiers.A), ...markAll(tiers.B)]);
    expect(signoffOf(tiers, clips, marks, 0.9).heard).toBe(4);
  });

  it('tells fixed, open and waiting flags apart', () => {
    const marks = new Map<string, Mark>([
      ['a-0', mark('ok', 'r1', { h: true })],
      ['a-1', mark('flag')],
      ['a-2', mark('flag', 'old')],
      ['b-0', mark('ok')],
    ]);
    const s = signoffOf(tiers, clips, marks, 0.9);
    expect({ fixed: s.fixed, open: s.open, waiting: s.waiting, heard: s.heard }).toEqual({ fixed: 1, open: 1, waiting: 1, heard: 3 });
  });

  it('writes one line for README.md and does not hide open flags', () => {
    expect(signoffLine(' Sam ', '2026-11-19', { heard: 525, fixed: 4, open: 0 })).toBe('Voices heard by Sam on 2026-11-19: 525 clips, 4 flagged and re-rendered.');
    expect(signoffLine('', '2026-11-19', { heard: 525, fixed: 4, open: 2 })).toBe('Voices heard by <your name> on 2026-11-19: 525 clips, 4 flagged and re-rendered, 2 flagged and still open.');
  });
});

describe('flagExport', () => {
  const clips = [clip('clod-1', { t: 'Zeta' }), clip('dave-1', { t: 'beta' }), clip('dave-2', { t: 'Alpha' }), clip('dave-3', { t: 'gamma' })];

  it('lists clips whose current audio is flagged, by voice order then text, with readable reasons', () => {
    const marks = new Map<string, Mark>([
      ['clod-1', mark('flag', 'r1', { r: ['sung', 'cutoff'], n: 'sings "Zeta"' })],
      ['dave-1', mark('flag', 'r1', { r: ['level'] })],
      ['dave-2', mark('flag', 'r1', { r: ['voice'] })],
      ['dave-3', mark('ok')],
    ]);
    const out = flagExport(clips, marks, ['dave', 'clod']);
    expect(out.map((f) => f.clip)).toEqual(['dave-2', 'dave-1', 'clod-1']);
    expect(out[2]).toEqual({ clip: 'clod-1', voice: 'clod', text: 'Zeta', reasons: ['sung or musical word', 'cut off'], note: 'sings "Zeta"' });
  });

  it('leaves out a flag whose clip has been rendered again since', () => {
    expect(flagExport(clips, new Map([['dave-1', mark('flag', 'old')]]), ['dave'])).toEqual([]);
  });

  it('has a readable word for every reason, in lower case', () => {
    expect(REASONS.map((r) => reasonText(r.id))).toEqual(['sung or musical word', 'wrong stress', 'glitch or breath', 'wrong voice or accent', 'too quiet or too loud', 'cut off', 'other']);
  });
});

describe('storage', () => {
  it('saves one key per clip and loads them back', () => {
    const store = memoryStore();
    saveMark(store, 1, 'dave-1', mark('ok'));
    saveMark(store, 1, 'dave-2', mark('flag'));
    expect(Object.keys(store.dump()).sort()).toEqual([markKey(1, 'dave-1'), markKey(1, 'dave-2')]);
    expect([...loadMarks(store, 1).keys()].sort()).toEqual(['dave-1', 'dave-2']);
  });

  it('keeps manifest versions apart and other keys alone', () => {
    const store = memoryStore();
    saveMark(store, 1, 'dave-1', mark('ok'));
    saveMark(store, 2, 'dave-1', mark('flag'));
    store.setItem('something-else', '1');
    expect(loadMarks(store, 1).get('dave-1')?.s).toBe('ok');
    expect(loadMarks(store, 2).get('dave-1')?.s).toBe('flag');
    expect(clearAllMarks(store, 1)).toBe(1);
    expect(Object.keys(store.dump()).sort()).toEqual(['something-else', markKey(2, 'dave-1')]);
  });

  it('treats a cut-off or edited value as not marked', () => {
    const store = memoryStore();
    store.setItem(markKey(1, 'dave-1'), '{"s":"ok"');
    store.setItem(markKey(1, 'dave-2'), '{"s":"maybe","v":"x","t":1}');
    expect(loadMarks(store, 1).size).toBe(0);
  });

  it('removes a mark', () => {
    const store = memoryStore();
    saveMark(store, 1, 'dave-1', mark('ok'));
    clearMark(store, 1, 'dave-1');
    expect(loadMarks(store, 1).size).toBe(0);
  });
});

describe('progress file', () => {
  const marks = new Map<string, Mark>([['dave-1', mark('flag', 'r1', { n: 'a note' })]]);

  it('round-trips through JSON', () => {
    const text = JSON.stringify(toProgressFile(1, 'Sam', '2026-11-19T10:00:00Z', marks));
    const back = parseProgressFile(text, 1);
    expect(typeof back).toBe('object');
    if (typeof back === 'string') return;
    expect(back.listener).toBe('Sam');
    expect(back.marks.get('dave-1')).toEqual(marks.get('dave-1'));
  });

  it('says why a file cannot be used', () => {
    expect(parseProgressFile('nope', 1)).toBe('That file is not JSON.');
    expect(parseProgressFile('{"kind":"other"}', 1)).toBe('That file is not a listening-pass progress file.');
    const other = JSON.stringify(toProgressFile(2, 'Sam', 'x', marks));
    expect(parseProgressFile(other, 1)).toBe('That file is for manifest version 2, this page is for 1.');
  });

  it('merges by newest mark and reports what changed', () => {
    const into = new Map<string, Mark>([
      ['a', mark('ok', 'r1', { t: 5 })],
      ['b', mark('ok', 'r1', { t: 5 })],
    ]);
    const incoming = new Map<string, Mark>([
      ['a', mark('flag', 'r1', { t: 9 })],
      ['b', mark('flag', 'r1', { t: 1 })],
      ['c', mark('ok', 'r1', { t: 1 })],
    ]);
    expect(mergeMarks(into, incoming).sort()).toEqual(['a', 'c']);
    expect(into.get('a')?.s).toBe('flag');
    expect(into.get('b')?.s).toBe('ok');
  });
});

describe('formatting', () => {
  it('writes a clip length as m:ss.t', () => {
    expect(formatDuration(5)).toBe('0:05.0');
    expect(formatDuration(65.46)).toBe('1:05.5');
    expect(formatDuration(-3)).toBe('0:00.0');
  });

  it('writes the time left in plain words', () => {
    expect(formatLeft(0)).toBe('none left');
    expect(formatLeft(20)).toBe('under a minute left');
    expect(formatLeft(47 * 60)).toBe('47 min left');
    expect(formatLeft(72 * 60)).toBe('1 h 12 min left');
  });
});
