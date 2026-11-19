/**
 * The review state: marks, progress, the flag export and the sign-off. Pure functions plus a small
 * storage layer over anything shaped like localStorage. No DOM, so the tests run these in node.
 */
import type { Clip, TierId } from './types';

export const REASONS = [
  { id: 'sung', label: 'Sung or musical word', key: '1' },
  { id: 'stress', label: 'Wrong stress', key: '2' },
  { id: 'glitch', label: 'Glitch or breath', key: '3' },
  { id: 'voice', label: 'Wrong voice or accent', key: '4' },
  { id: 'level', label: 'Too quiet or too loud', key: '5' },
  { id: 'cutoff', label: 'Cut off', key: '6' },
  { id: 'other', label: 'Other', key: '7' },
] as const;

export type ReasonId = (typeof REASONS)[number]['id'];

const REASON_IDS: ReadonlySet<string> = new Set(REASONS.map((r) => r.id));

export function isReasonId(x: unknown): x is ReasonId {
  return typeof x === 'string' && REASON_IDS.has(x);
}

/** The words written into flagged-lines.json: the label in lower case, for example "wrong stress". */
export function reasonText(id: ReasonId): string {
  const found = REASONS.find((r) => r.id === id);
  return (found?.label ?? id).toLowerCase();
}

/** What a listener decided about one clip. */
export interface Mark {
  readonly s: 'ok' | 'flag';
  /** why, for a flag */
  readonly r: readonly ReasonId[];
  readonly n: string;
  /** when, ms since the epoch */
  readonly t: number;
  /** the clip's audio revision at that moment */
  readonly v: string;
  /** this clip was flagged, rendered again, and heard again since */
  readonly h?: true;
}

/** todo: no mark. ok, flag: marked. stale: marked, but the audio was rendered again since, so it needs another listen. */
export type Status = 'todo' | 'ok' | 'flag' | 'stale';

export function statusOf(clip: Clip, mark: Mark | undefined): Status {
  if (mark === undefined) return 'todo';
  return mark.v === clip.r ? mark.s : 'stale';
}

export function isMarked(status: Status): boolean {
  return status === 'ok' || status === 'flag';
}

export function nextMark(prev: Mark | undefined, clip: Clip, s: 'ok' | 'flag', reasons: readonly ReasonId[], note: string, now: number): Mark {
  const carried = prev !== undefined && (prev.h === true || (prev.s === 'flag' && prev.v !== clip.r));
  const r = s === 'flag' ? (reasons.length > 0 ? [...reasons] : (['other'] as const)) : [];
  return { s, r, n: s === 'flag' ? note.trim() : '', t: now, v: clip.r, ...(carried ? { h: true as const } : {}) };
}

/** Stored JSON is untrusted: it may be from an older page, edited by hand, or cut off. */
export function parseMark(value: unknown): Mark | null {
  if (typeof value !== 'object' || value === null) return null;
  const o = value as Record<string, unknown>;
  if (o.s !== 'ok' && o.s !== 'flag') return null;
  if (typeof o.v !== 'string' || typeof o.t !== 'number' || !Number.isFinite(o.t)) return null;
  const r = Array.isArray(o.r) ? o.r.filter(isReasonId) : [];
  return { s: o.s, r, n: typeof o.n === 'string' ? o.n : '', t: o.t, v: o.v, ...(o.h === true ? { h: true as const } : {}) };
}

export type Marks = ReadonlyMap<string, Mark>;

export interface Progress {
  readonly total: number;
  readonly ok: number;
  readonly flag: number;
  /** marked, but rendered again since */
  readonly stale: number;
  readonly todo: number;
  /** ok + flag */
  readonly marked: number;
  /** audio still to hear, seconds: everything not marked */
  readonly secondsLeft: number;
}

export function progressOf(ids: readonly string[], clips: ReadonlyMap<string, Clip>, marks: Marks): Progress {
  let ok = 0;
  let flag = 0;
  let stale = 0;
  let todo = 0;
  let secondsLeft = 0;
  for (const id of ids) {
    const clip = clips.get(id);
    if (clip === undefined) continue;
    const status = statusOf(clip, marks.get(id));
    if (status === 'ok') ok += 1;
    else if (status === 'flag') flag += 1;
    else {
      if (status === 'stale') stale += 1;
      else todo += 1;
      secondsLeft += clip.d;
    }
  }
  return { total: ok + flag + stale + todo, ok, flag, stale, todo, marked: ok + flag, secondsLeft };
}

export interface Signoff {
  readonly a: Progress;
  readonly b: Progress;
  readonly c: Progress;
  /** marks Tier C needs before the sign-off appears */
  readonly cNeeded: number;
  readonly ready: boolean;
  /** distinct clips with a mark, over all three tiers */
  readonly heard: number;
  /** flagged, rendered again, heard again and marked ok */
  readonly fixed: number;
  /** flagged and the audio is still the one that was flagged */
  readonly open: number;
  /** flagged, rendered again, not heard again yet */
  readonly waiting: number;
}

export function signoffOf(tiers: Readonly<Record<TierId, readonly string[]>>, clips: ReadonlyMap<string, Clip>, marks: Marks, cShare: number): Signoff {
  const a = progressOf(tiers.A, clips, marks);
  const b = progressOf(tiers.B, clips, marks);
  const c = progressOf(tiers.C, clips, marks);
  const cNeeded = Math.ceil(c.total * cShare);
  const all = new Set([...tiers.A, ...tiers.B, ...tiers.C]);
  let heard = 0;
  let fixed = 0;
  let open = 0;
  let waiting = 0;
  for (const id of all) {
    const clip = clips.get(id);
    if (clip === undefined) continue;
    const mark = marks.get(id);
    const status = statusOf(clip, mark);
    if (isMarked(status)) heard += 1;
    if (status === 'flag') open += 1;
    else if (status === 'ok' && mark?.h === true) fixed += 1;
    else if (status === 'stale' && mark !== undefined && (mark.s === 'flag' || mark.h === true)) waiting += 1;
  }
  const ready = a.marked === a.total && b.marked === b.total && c.marked >= cNeeded;
  return { a, b, c, cNeeded, ready, heard, fixed, open, waiting };
}

/** The line for README.md. Open flags are named, so the line is never untrue. */
export function signoffLine(name: string, date: string, s: Pick<Signoff, 'heard' | 'fixed' | 'open'>): string {
  const who = name.trim() === '' ? '<your name>' : name.trim();
  const tail = s.open > 0 ? `, ${s.open} flagged and still open` : '';
  return `Voices heard by ${who} on ${date}: ${s.heard} clips, ${s.fixed} flagged and re-rendered${tail}.`;
}

/** One entry of flagged-lines.json. */
export interface FlagRecord {
  readonly clip: string;
  readonly voice: string;
  readonly text: string;
  readonly reasons: readonly string[];
  readonly note: string;
}

/** Clips whose current audio is flagged, most-heard voices first, then by text. */
export function flagExport(clips: readonly Clip[], marks: Marks, voiceOrder: readonly string[]): FlagRecord[] {
  const rank = new Map(voiceOrder.map((v, i) => [v, i]));
  return clips
    .filter((c) => statusOf(c, marks.get(c.id)) === 'flag')
    .sort((a, b) => (rank.get(a.v) ?? 99) - (rank.get(b.v) ?? 99) || (a.t.toLowerCase() < b.t.toLowerCase() ? -1 : a.t.toLowerCase() > b.t.toLowerCase() ? 1 : a.id < b.id ? -1 : 1))
    .map((c) => {
      const mark = marks.get(c.id);
      return { clip: c.id, voice: c.v, text: c.t, reasons: (mark?.r ?? []).map(reasonText), note: mark?.n ?? '' };
    });
}

// ---- storage -------------------------------------------------------------------------------------------

/** The part of localStorage this page uses. */
export interface KeyValueStore {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const NAMESPACE = 'vcds.listen';

/** One key per clip, so two tabs never overwrite each other's marks. The manifest version is part of the key. */
export const markPrefix = (manifestVersion: number): string => `${NAMESPACE}/m${manifestVersion}/`;
export const markKey = (manifestVersion: number, clipId: string): string => `${markPrefix(manifestVersion)}${clipId}`;
export const PREFS_KEY = `${NAMESPACE}/prefs`;

export function loadMarks(store: KeyValueStore, manifestVersion: number): Map<string, Mark> {
  const prefix = markPrefix(manifestVersion);
  const out = new Map<string, Mark>();
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key === null || !key.startsWith(prefix)) continue;
    const raw = store.getItem(key);
    if (raw === null) continue;
    try {
      const mark = parseMark(JSON.parse(raw));
      if (mark !== null) out.set(key.slice(prefix.length), mark);
    } catch {
      // a cut-off value: treat the clip as not marked
    }
  }
  return out;
}

export function saveMark(store: KeyValueStore, manifestVersion: number, clipId: string, mark: Mark): void {
  store.setItem(markKey(manifestVersion, clipId), JSON.stringify(mark));
}

export function clearMark(store: KeyValueStore, manifestVersion: number, clipId: string): void {
  store.removeItem(markKey(manifestVersion, clipId));
}

export function clearAllMarks(store: KeyValueStore, manifestVersion: number): number {
  const prefix = markPrefix(manifestVersion);
  const keys: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key !== null && key.startsWith(prefix)) keys.push(key);
  }
  for (const key of keys) store.removeItem(key);
  return keys.length;
}

// ---- progress file -------------------------------------------------------------------------------------

export interface ProgressFile {
  readonly kind: 'vcds-listening-progress';
  readonly format: 1;
  readonly manifestVersion: number;
  readonly listener: string;
  readonly savedAt: string;
  readonly marks: Readonly<Record<string, Mark>>;
}

export function toProgressFile(manifestVersion: number, listener: string, savedAt: string, marks: Marks): ProgressFile {
  return { kind: 'vcds-listening-progress', format: 1, manifestVersion, listener, savedAt, marks: Object.fromEntries(marks) };
}

/** Read a progress file the user picked. Returns the marks, or the reason it cannot be used. */
export function parseProgressFile(text: string, manifestVersion: number): { readonly marks: Map<string, Mark>; readonly listener: string } | string {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return 'That file is not JSON.';
  }
  if (typeof doc !== 'object' || doc === null) return 'That file is not a progress file.';
  const o = doc as Record<string, unknown>;
  if (o.kind !== 'vcds-listening-progress') return 'That file is not a listening-pass progress file.';
  if (o.manifestVersion !== manifestVersion) return `That file is for manifest version ${String(o.manifestVersion)}, this page is for ${manifestVersion}.`;
  if (typeof o.marks !== 'object' || o.marks === null) return 'That file has no marks.';
  const marks = new Map<string, Mark>();
  for (const [id, raw] of Object.entries(o.marks)) {
    const mark = parseMark(raw);
    if (mark !== null) marks.set(id, mark);
  }
  return { marks, listener: typeof o.listener === 'string' ? o.listener : '' };
}

/** Newer mark wins. Returns the ids that changed. */
export function mergeMarks(into: Map<string, Mark>, incoming: ReadonlyMap<string, Mark>): string[] {
  const changed: string[] = [];
  for (const [id, mark] of incoming) {
    const have = into.get(id);
    if (have === undefined || mark.t > have.t) {
      into.set(id, mark);
      changed.push(id);
    }
  }
  return changed;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, seconds);
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

/** "41 min", "1 h 12 min", "under a minute" */
export function formatLeft(seconds: number): string {
  const min = Math.round(seconds / 60);
  if (seconds <= 0) return 'none left';
  if (min < 1) return 'under a minute left';
  if (min < 60) return `${min} min left`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min left`;
}
