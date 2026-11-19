/**
 * The listening-pass page. build.ts bundles this file (and model.ts) into docs/listening-pass.html.
 *
 * Audio is only ever started by something the person does: a click or tap on Play, a word, the
 * waveform or a row, or a key (Space, N). With Auto-advance on, a clip that was started that way
 * is followed by the next one. Nothing here plays on load, and no MP3 is requested before that.
 */
import {
  REASONS,
  clearAllMarks,
  clearMark,
  flagExport,
  formatDuration,
  formatLeft,
  isMarked,
  isReasonId,
  loadMarks,
  mergeMarks,
  nextMark,
  parseProgressFile,
  progressOf,
  reasonText,
  saveMark,
  signoffLine,
  signoffOf,
  statusOf,
  toProgressFile,
  PREFS_KEY,
  type KeyValueStore,
  type Mark,
  type Progress,
  type ReasonId,
  type Status,
} from './model';
import type { Clip, PageData, TierId } from './types';

// ---- small helpers -----------------------------------------------------------------------------------

function byId<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`listening pass: #${id} is missing or is not a ${type.name}`);
  return el;
}

type Attr = string | number | boolean | null | undefined | ((event: Event) => void);
type Kid = Node | string | null | false | undefined;

/** Build an element. Keys like onclick become listeners, `class` sets the class, `true` sets a bare attribute. */
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, Attr> = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = String(value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const kid of kids) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  return el;
}

const pct = (n: number, of: number): number => (of === 0 ? 0 : Math.round((n / of) * 1000) / 10);
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

const ICON_PLAY = '<svg class="ico i-play" viewBox="0 0 8 8" width="16" height="16" shape-rendering="crispEdges" aria-hidden="true"><path d="M1 0h2v8H1zM3 1h2v6H3zM5 2h2v4H5z"/></svg>';
const ICON_PAUSE = '<svg class="ico i-pause" viewBox="0 0 8 8" width="16" height="16" shape-rendering="crispEdges" aria-hidden="true"><path d="M1 0h2v8H1zM5 0h2v8H5z"/></svg>';

// ---- data ----------------------------------------------------------------------------------------------

const dataEl = document.getElementById('data');
if (dataEl === null || dataEl.textContent === null) throw new Error('listening pass: the embedded data is missing');
const data: PageData = JSON.parse(dataEl.textContent);

const clipById = new Map<string, Clip>(data.clips.map((c) => [c.id, c]));
const voiceById = new Map(data.voices.map((v) => [v.id, v]));
const TIERS: readonly TierId[] = ['A', 'B', 'C'];
const tierIds: Record<TierId, readonly string[]> = { A: data.tiers.A.ids, B: data.tiers.B.ids, C: data.tiers.C.ids };
const tierSets: Record<TierId, ReadonlySet<string>> = { A: new Set(tierIds.A), B: new Set(tierIds.B), C: new Set(tierIds.C) };
const allIds: readonly string[] = [...new Set([...tierIds.A, ...tierIds.B, ...tierIds.C])];

function voiceName(id: string): string {
  return voiceById.get(id)?.name ?? id;
}

/** voices that have clips in a tier, most clips overall first */
function voicesIn(tier: TierId): string[] {
  const present = new Set<string>();
  for (const id of tierIds[tier]) {
    const voice = clipById.get(id)?.v;
    if (voice !== undefined) present.add(voice);
  }
  return data.voices.filter((v) => present.has(v.id)).map((v) => v.id);
}

// ---- storage -------------------------------------------------------------------------------------------

function openStore(): { store: KeyValueStore; persistent: boolean } {
  try {
    const probe = `${PREFS_KEY}/probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return { store: window.localStorage, persistent: true };
  } catch {
    const memory = new Map<string, string>();
    const store: KeyValueStore = {
      get length() {
        return memory.size;
      },
      key: (i) => [...memory.keys()][i] ?? null,
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => void memory.set(k, v),
      removeItem: (k) => void memory.delete(k),
    };
    return { store, persistent: false };
  }
}

const { store, persistent } = openStore();
const marks = loadMarks(store, data.manifestVersion);

type StatusFilter = 'all' | 'todo' | 'ok' | 'flag';

interface Prefs {
  listener: string;
  auto: boolean;
  tier: TierId;
  voices: Record<TierId, string>;
  status: StatusFilter;
  cursor: string | null;
}

const isTier = (x: unknown): x is TierId => x === 'A' || x === 'B' || x === 'C';
const isFilter = (x: unknown): x is StatusFilter => x === 'all' || x === 'todo' || x === 'ok' || x === 'flag';

function defaultPrefs(): Prefs {
  return { listener: '', auto: false, tier: 'A', voices: { A: voicesIn('A')[0] ?? '*', B: '*', C: '*' }, status: 'all', cursor: null };
}

function loadPrefs(): Prefs {
  const prefs = defaultPrefs();
  try {
    const raw = store.getItem(PREFS_KEY);
    const o: unknown = raw === null ? null : JSON.parse(raw);
    if (typeof o !== 'object' || o === null) return prefs;
    const p = o as Record<string, unknown>;
    if (typeof p.listener === 'string') prefs.listener = p.listener.slice(0, 60);
    if (typeof p.auto === 'boolean') prefs.auto = p.auto;
    if (isTier(p.tier)) prefs.tier = p.tier;
    if (isFilter(p.status)) prefs.status = p.status;
    if (typeof p.cursor === 'string' && clipById.has(p.cursor)) prefs.cursor = p.cursor;
    if (typeof p.voices === 'object' && p.voices !== null) {
      const v = p.voices as Record<string, unknown>;
      for (const t of TIERS) {
        const want = v[t];
        if (typeof want === 'string' && (want === '*' ? t !== 'A' : voicesIn(t).includes(want))) prefs.voices[t] = want;
      }
    }
  } catch {
    // unreadable preferences: start from the defaults
  }
  return prefs;
}

const prefs = loadPrefs();

function savePrefs(): void {
  try {
    store.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // storage full or blocked: the marks warning already told the person
  }
}

// ---- elements ------------------------------------------------------------------------------------------

const el = {
  subCount: byId('sub-count', HTMLElement),
  listener: byId('listener', HTMLInputElement),
  overall: byId('overall', HTMLElement),
  btnExport: byId('btn-export', HTMLButtonElement),
  menu: byId('menu', HTMLDetailsElement),
  btnKeys: byId('btn-keys', HTMLButtonElement),
  btnSave: byId('btn-save', HTMLButtonElement),
  fileLoad: byId('file-load', HTMLInputElement),
  btnReset: byId('btn-reset', HTMLButtonElement),
  tiers: byId('tiers', HTMLElement),
  voicesH: byId('voices-h', HTMLElement),
  voices: byId('voices', HTMLElement),
  signoffHint: byId('signoff-hint', HTMLElement),
  signoff: byId('signoff', HTMLElement),
  head: byId('head', HTMLElement),
  segStatus: byId('seg-status', HTMLElement),
  q: byId('q', HTMLInputElement),
  auto: byId('auto', HTMLInputElement),
  btnNext: byId('btn-next-todo', HTMLButtonElement),
  list: byId('list', HTMLElement),
  end: byId('end', HTMLElement),
  toast: byId('toast', HTMLElement),
  dlgExport: byId('dlg-export', HTMLDialogElement),
  exportSum: byId('export-sum', HTMLElement),
  exportJson: byId('export-json', HTMLTextAreaElement),
  exportCopy: byId('export-copy', HTMLButtonElement),
  exportDl: byId('export-dl', HTMLButtonElement),
  exportClose: byId('export-close', HTMLButtonElement),
  dlgKeys: byId('dlg-keys', HTMLDialogElement),
  keysClose: byId('keys-close', HTMLButtonElement),
  top: byId('top', HTMLElement),
  warn: byId('warn', HTMLElement),
};

// ---- view state ------------------------------------------------------------------------------------------

const view = { query: '' };
let cursor: string | null = prefs.cursor;

function statusById(id: string): Status {
  const clip = clipById.get(id);
  return clip === undefined ? 'todo' : statusOf(clip, marks.get(id));
}

function matchesStatus(status: Status, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'todo') return !isMarked(status);
  return status === filter;
}

/** clips of the tier and voice selected, in display order, ignoring status and search */
function baseIds(): readonly string[] {
  const voice = prefs.voices[prefs.tier];
  const ids = tierIds[prefs.tier];
  return voice === '*' ? ids : ids.filter((id) => clipById.get(id)?.v === voice);
}

function visibleIds(): string[] {
  const q = view.query.trim().toLowerCase();
  return baseIds().filter((id) => {
    const clip = clipById.get(id);
    if (clip === undefined) return false;
    if (!matchesStatus(statusById(id), prefs.status)) return false;
    return q === '' || clip.t.toLowerCase().includes(q) || id.includes(q);
  });
}

function progress(ids: readonly string[]): Progress {
  return progressOf(ids, clipById, marks);
}

// ---- audio ---------------------------------------------------------------------------------------------

const audio = new Audio();
audio.preload = 'none';
let loadedId: string | null = null;
let playingId: string | null = null;
let raf = 0;
let autoTimer = 0;
let lastWord = -1;

const AUTO_GAP_MS = 1200;

function clipUrl(clip: Clip): string {
  const rel = `${data.audioBase}${clip.f ?? `${clip.id}.mp3`}`;
  const url = new URL(rel, window.location.href);
  // a fresh render must not come from the browser cache; file: pages have no cache to fight
  if (url.protocol === 'http:' || url.protocol === 'https:') url.searchParams.set('v', clip.r);
  return url.href;
}

function cancelAuto(): void {
  if (autoTimer !== 0) window.clearTimeout(autoTimer);
  autoTimer = 0;
}

function setPlayingUi(id: string, playing: boolean): void {
  const row = rows.get(id);
  if (row !== undefined) row.el.classList.toggle('is-playing', playing);
}

function setFill(id: string, fraction: number): void {
  const row = rows.get(id);
  if (row === undefined) return;
  const left = Math.max(0, Math.min(100, 100 - fraction * 100));
  row.fill.style.clipPath = `inset(0 ${left}% 0 0)`;
}

function setWord(id: string, index: number): void {
  const row = rows.get(id);
  if (row === undefined || index === lastWord) return;
  lastWord = index;
  row.words.forEach((w, i) => w.classList.toggle('on', i === index));
}

function wordAt(clip: Clip, t: number): number {
  const w = clip.w;
  if (w === undefined) return -1;
  let found = -1;
  for (let i = 0; i * 2 < w.length; i += 1) {
    if ((w[i * 2] ?? 0) <= t) found = i;
    else break;
  }
  const end = found >= 0 ? (w[found * 2 + 1] ?? 0) : 0;
  return found >= 0 && t > end + 0.35 ? -1 : found;
}

function tick(): void {
  raf = 0;
  if (playingId === null) return;
  const clip = clipById.get(playingId);
  if (clip === undefined) return;
  const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : clip.d;
  setFill(playingId, audio.currentTime / dur);
  setWord(playingId, wordAt(clip, audio.currentTime));
  raf = window.requestAnimationFrame(tick);
}

function resetPlayUi(id: string): void {
  setPlayingUi(id, false);
  setFill(id, 0);
  const row = rows.get(id);
  if (row !== undefined) row.words.forEach((w) => w.classList.remove('on'));
  lastWord = -1;
}

function stopPlayback(): void {
  cancelAuto();
  audio.pause();
  if (raf !== 0) window.cancelAnimationFrame(raf);
  raf = 0;
  const id = playingId ?? loadedId;
  playingId = null;
  loadedId = null;
  if (id !== null) resetPlayUi(id);
}

function playClip(id: string, from?: number): void {
  const clip = clipById.get(id);
  if (clip === undefined) return;
  cancelAuto();
  if (loadedId !== null && loadedId !== id) stopPlayback();
  if (cursor !== id) setCursor(id);
  if (loadedId !== id) {
    audio.src = clipUrl(clip);
    loadedId = id;
    lastWord = -1;
  }
  if (from !== undefined) audio.currentTime = from;
  else if (audio.ended) audio.currentTime = 0;
  playingId = id;
  setPlayingUi(id, true);
  const started = audio.play();
  started.catch((err: unknown) => {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    if (playingId === id) playingId = null;
    setPlayingUi(id, false);
    toast(`Cannot play ${clip.id}.mp3. Open this page from the repo, as docs/listening-pass.md says.`, 6000);
  });
  if (raf === 0) raf = window.requestAnimationFrame(tick);
}

function pausePlayback(): void {
  cancelAuto();
  audio.pause();
}

function togglePlay(id: string): void {
  if (playingId === id) pausePlayback();
  else playClip(id);
}

audio.addEventListener('pause', () => {
  // a pause event is delivered late: when a new clip has started since, it is not about that clip
  if (!audio.paused || audio.ended) return;
  if (playingId !== null) setPlayingUi(playingId, false);
  playingId = null;
});

audio.addEventListener('playing', () => {
  if (loadedId !== null) {
    playingId = loadedId;
    setPlayingUi(loadedId, true);
    if (raf === 0) raf = window.requestAnimationFrame(tick);
  }
});

audio.addEventListener('ended', () => {
  const id = loadedId;
  playingId = null;
  if (id === null) return;
  setPlayingUi(id, false);
  setFill(id, 1);
  setWord(id, -1);
  if (prefs.auto && cursor === id && pickerFor === null) {
    autoTimer = window.setTimeout(() => {
      autoTimer = 0;
      if (prefs.auto && cursor === id && pickerFor === null) goNext(true);
    }, AUTO_GAP_MS);
  }
});

audio.addEventListener('error', () => {
  const id = loadedId;
  if (id === null) return;
  playingId = null;
  setPlayingUi(id, false);
  toast(`Cannot load ${id}.mp3. Open this page from the repo, as docs/listening-pass.md says.`, 6000);
});

// ---- toast -----------------------------------------------------------------------------------------------

let toastTimer = 0;
function toast(message: string, ms = 2400): void {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.toast.classList.remove('show'), ms);
}

// ---- envelope strip --------------------------------------------------------------------------------------

const COLUMN = 4;
const BAR = 3;
const STRIP_H = 32;
const PX_PER_SECOND = 48;

function drawEnvelope(canvas: HTMLCanvasElement, env: string, columns: number, color: string): void {
  const dpr = Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)));
  canvas.width = columns * COLUMN * dpr;
  canvas.height = STRIP_H * dpr;
  canvas.style.width = `${columns * COLUMN}px`;
  canvas.style.height = `${STRIP_H}px`;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = color;
  const n = env.length;
  for (let c = 0; c < columns; c += 1) {
    const from = Math.floor((c * n) / columns);
    const to = Math.max(from + 1, Math.floor(((c + 1) * n) / columns));
    let peak = 0;
    for (let i = from; i < to && i < n; i += 1) peak = Math.max(peak, parseInt(env.charAt(i), 16) || 0);
    const half = Math.max(1, Math.round((peak / 15) * 7)) * 2;
    ctx.fillRect(c * COLUMN, STRIP_H / 2 - half, BAR, half * 2);
  }
}

const css = getComputedStyle(document.documentElement);
const colorIdle = css.getPropertyValue('--ink3').trim() || '#7a6a96';
const colorPlayed = css.getPropertyValue('--accent').trim() || '#ff8a30';

function layoutStrips(): void {
  for (const row of rows.values()) {
    const avail = row.scrub.clientWidth;
    const want = Math.min(row.clip.d * PX_PER_SECOND, avail > 0 ? avail : 240);
    const columns = Math.max(6, Math.floor(want / COLUMN));
    drawEnvelope(row.base, row.clip.e, columns, colorIdle);
    drawEnvelope(row.fill, row.clip.e, columns, colorPlayed);
    if (row.clip.id !== playingId) setFill(row.clip.id, row.clip.id === loadedId && audio.ended ? 1 : 0);
  }
}

let layoutQueued = false;
function queueLayout(): void {
  if (layoutQueued) return;
  layoutQueued = true;
  window.requestAnimationFrame(() => {
    layoutQueued = false;
    layoutStrips();
  });
}

// ---- rows ------------------------------------------------------------------------------------------------

interface Row {
  readonly clip: Clip;
  readonly el: HTMLLIElement;
  readonly ok: HTMLButtonElement;
  readonly flag: HTMLButtonElement;
  readonly verdict: HTMLElement;
  readonly slot: HTMLElement;
  readonly scrub: HTMLElement;
  readonly base: HTMLCanvasElement;
  readonly fill: HTMLCanvasElement;
  readonly words: HTMLElement[];
}

const rows = new Map<string, Row>();

function otherTiers(id: string): string {
  const others = TIERS.filter((t) => t !== prefs.tier && tierSets[t].has(id));
  return others.length === 0 ? '' : `Also in Tier ${others.join(' and ')}`;
}

function buildRow(clip: Clip, ordinal: number): Row {
  const words = clip.t.split(/\s+/).filter((w) => w !== '');
  const wordEls = words.map((w, i) => h('span', { class: 'w', 'data-i': i }, w));
  const text = h('p', { class: 'txt' });
  wordEls.forEach((w, i) => {
    if (i > 0) text.append(' ');
    text.append(w);
  });

  const base = h('canvas', { class: 'env base', 'aria-hidden': 'true' });
  const fill = h('canvas', { class: 'env fill', 'aria-hidden': 'true' });
  const scrub = h('div', { class: 'scrub', title: 'Click the waveform to play from that point' }, base, fill);

  const play = h('button', { type: 'button', class: 'btn play', 'aria-label': `Play or pause: ${clip.t}` });
  play.insertAdjacentHTML('afterbegin', `${ICON_PLAY}${ICON_PAUSE}<span class="t-play">Play</span><span class="t-pause">Pause</span>`);
  const ok = h('button', { type: 'button', class: 'btn ok', 'aria-pressed': 'false' }, 'OK');
  const flag = h('button', { type: 'button', class: 'btn flag', 'aria-pressed': 'false' }, 'FLAG');
  const verdict = h('p', { class: 'verdict', hidden: true });
  const slot = h('div', { class: 'slot' });
  const also = otherTiers(clip.id);

  const li = h(
    'li',
    { class: 'clip', 'data-id': clip.id, 'data-status': 'todo', tabindex: -1, 'aria-current': 'false' },
    h('span', { class: 'n', 'aria-hidden': 'true' }, String(ordinal).padStart(3, '0')),
    h(
      'div',
      { class: 'body' },
      h(
        'p',
        { class: 'meta' },
        h('span', { class: 'voice' }, voiceName(clip.v)),
        h('span', { class: 'dur' }, formatDuration(clip.d)),
        h('span', { class: 'cid' }, clip.id),
        also !== '' && h('span', { class: 'also' }, also),
        clip.u === true && h('span', { class: 'also' }, 'Not played in the game'),
      ),
      text,
      verdict,
      h('div', { class: 'ctl' }, scrub, h('div', { class: 'acts' }, play, ok, flag)),
      slot,
    ),
  );

  play.addEventListener('click', () => togglePlay(clip.id));
  ok.addEventListener('click', () => decide(clip.id, 'ok'));
  flag.addEventListener('click', () => openPicker(clip.id));
  text.addEventListener('click', (event) => {
    const hit = event.target instanceof Element ? event.target.closest('.w') : null;
    if (!(hit instanceof HTMLElement)) return;
    const index = Number(hit.dataset.i);
    const start = clip.w?.[index * 2];
    playClip(clip.id, start === undefined ? 0 : Math.max(0, start - 0.08));
  });
  scrub.addEventListener('click', (event) => {
    const rect = base.getBoundingClientRect();
    if (rect.width === 0) return;
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    playClip(clip.id, fraction * clip.d);
  });
  li.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('button, input, label, form, .scrub, .w')) return;
    moveCursor(clip.id);
  });

  return { clip, el: li, ok, flag, verdict, slot, scrub, base, fill, words: wordEls };
}

function verdictText(clip: Clip, mark: Mark | undefined, status: Status): string {
  if (mark === undefined || status === 'todo') return '';
  const why = mark.r.map(reasonText).join(', ');
  if (status === 'ok') return mark.h === true ? 'OK after a re-render' : 'OK';
  if (status === 'flag') return `FLAGGED: ${why}${mark.n === '' ? '' : `. ${mark.n}`}`;
  const was = mark.s === 'flag' ? `You flagged it (${why})` : 'You marked it OK';
  return `RENDERED AGAIN: ${was}, and the audio has changed since (${clip.r}). Listen again.`;
}

function refreshRow(id: string): void {
  const row = rows.get(id);
  if (row === undefined) return;
  const mark = marks.get(id);
  const status = statusOf(row.clip, mark);
  row.el.dataset.status = status;
  row.ok.setAttribute('aria-pressed', String(status === 'ok'));
  row.flag.setAttribute('aria-pressed', String(status === 'flag'));
  const text = verdictText(row.clip, mark, status);
  row.verdict.hidden = text === '';
  row.verdict.textContent = text;
}

// ---- list ------------------------------------------------------------------------------------------------

function renderList(): void {
  closePicker(false);
  const ids = visibleIds();
  const visible = new Set(ids);
  if (loadedId !== null && !visible.has(loadedId)) stopPlayback();
  rows.clear();
  const ordinals = new Map(baseIds().map((id, i) => [id, i + 1]));
  const frag = document.createDocumentFragment();

  const add = (id: string): void => {
    const clip = clipById.get(id);
    if (clip === undefined) return;
    const row = buildRow(clip, ordinals.get(id) ?? 0);
    rows.set(id, row);
    frag.append(row.el);
  };

  if (prefs.tier === 'B') {
    for (const group of data.tiers.B.groups) {
      const inView = group.ids.filter((id) => visible.has(id));
      if (inView.length === 0) continue;
      frag.append(h('li', { class: 'group', 'aria-hidden': 'true' }, h('span', {}, group.label), h('span', { class: 'cnt' }, plural(inView.length, 'line'))));
      inView.forEach(add);
    }
  } else {
    ids.forEach(add);
  }
  el.list.replaceChildren(frag);
  for (const id of rows.keys()) refreshRow(id);
  layoutStrips();
  if (playingId !== null) setPlayingUi(playingId, true);
  renderEnd(ids);
  if (cursor === null || !rows.has(cursor)) {
    const first = ids.find((id) => !isMarked(statusById(id))) ?? ids[0] ?? null;
    cursor = null;
    setCursor(first, false);
  } else {
    setCursor(cursor, false);
  }
}

function renderEnd(ids: readonly string[]): void {
  const here = progress(baseIds());
  const parts: Kid[] = [];
  if (ids.length === 0) {
    parts.push(h('span', {}, view.query.trim() !== '' || prefs.status !== 'all' ? 'No clips match these filters.' : 'Nothing here.'));
  } else if (here.todo + here.stale === 0) {
    parts.push(h('span', {}, `Everything here is marked. ${plural(here.flag, 'clip')} flagged.`));
  } else {
    parts.push(h('span', {}, `${plural(here.todo + here.stale, 'clip')} still to hear in this view, ${formatLeft(here.secondsLeft)}.`));
  }
  const next = nextTab();
  if (next !== null && here.todo + here.stale === 0) {
    parts.push(' ', h('button', { type: 'button', class: 'btn', onclick: () => selectView(next.tier, next.voice) }, next.label));
  }
  el.end.replaceChildren(...parts.filter((p): p is Node | string => p !== null && p !== false && p !== undefined));
}

/** the next voice in Tier A, or the next tier */
function nextTab(): { tier: TierId; voice: string; label: string } | null {
  if (prefs.tier === 'A') {
    const voices = voicesIn('A');
    const i = voices.indexOf(prefs.voices.A);
    const nextVoice = voices[i + 1];
    if (nextVoice !== undefined) return { tier: 'A', voice: nextVoice, label: `Next voice: ${voiceName(nextVoice)}` };
    return { tier: 'B', voice: prefs.voices.B, label: 'Next: Tier B, first session' };
  }
  if (prefs.tier === 'B') return { tier: 'C', voice: prefs.voices.C, label: 'Next: Tier C, random sample' };
  return null;
}

// ---- cursor and navigation -------------------------------------------------------------------------------

function setCursor(id: string | null, scroll = true): void {
  if (cursor !== null && cursor !== id) rows.get(cursor)?.el.setAttribute('aria-current', 'false');
  cursor = id;
  prefs.cursor = id;
  if (id !== null) {
    const row = rows.get(id);
    if (row !== undefined) {
      row.el.setAttribute('aria-current', 'true');
      if (scroll) row.el.scrollIntoView({ block: 'nearest' });
    }
  }
  savePrefs();
}

/** the person moved on their own: whatever was playing stops, and the cursor follows */
function moveCursor(id: string): void {
  if (cursor === id) return;
  if (loadedId !== null && loadedId !== id) stopPlayback();
  cancelAuto();
  setCursor(id);
}

function neighbour(step: 1 | -1): string | null {
  const ids = [...rows.keys()];
  if (ids.length === 0) return null;
  const at = cursor === null ? -1 : ids.indexOf(cursor);
  if (at === -1) return ids[0] ?? null;
  return ids[at + step] ?? null;
}

function goNext(play: boolean): void {
  const next = neighbour(1);
  if (next === null) {
    toast('End of this list.');
    if (loadedId !== null && !playingId) stopPlayback();
    return;
  }
  if (play) playClip(next);
  else moveCursor(next);
}

function goPrev(): void {
  const prev = neighbour(-1);
  if (prev !== null) moveCursor(prev);
}

function jumpToTodo(): void {
  const ids = [...rows.keys()];
  const start = cursor === null ? 0 : ids.indexOf(cursor) + 1;
  const ordered = [...ids.slice(start), ...ids.slice(0, start)];
  const found = ordered.find((id) => !isMarked(statusById(id)));
  if (found === undefined) toast('Nothing left to do in this view.');
  else moveCursor(found);
}

// ---- marking ---------------------------------------------------------------------------------------------

function applyMark(id: string, s: 'ok' | 'flag', reasons: readonly ReasonId[] = [], note = ''): void {
  const clip = clipById.get(id);
  if (clip === undefined) return;
  const mark = nextMark(marks.get(id), clip, s, reasons, note, Date.now());
  marks.set(id, mark);
  try {
    saveMark(store, data.manifestVersion, id, mark);
  } catch {
    toast('The browser would not save that mark. Use Tools, Save progress file.', 5000);
  }
  refreshRow(id);
  refreshChrome();
}

function decide(id: string, s: 'ok' | 'flag', reasons: readonly ReasonId[] = [], note = ''): void {
  applyMark(id, s, reasons, note);
  if (cursor !== id) moveCursor(id);
  if (prefs.auto) goNext(true);
}

function undo(id: string): void {
  if (!marks.has(id)) return;
  marks.delete(id);
  clearMark(store, data.manifestVersion, id);
  refreshRow(id);
  refreshChrome();
  toast('Mark removed.');
}

// ---- flag picker -----------------------------------------------------------------------------------------

let pickerFor: string | null = null;

function closePicker(refocus = true): void {
  if (pickerFor === null) return;
  const id = pickerFor;
  pickerFor = null;
  rows.get(id)?.slot.replaceChildren();
  rows.get(id)?.el.classList.remove('picking');
  if (refocus) rows.get(id)?.el.focus({ preventScroll: true });
}

function openPicker(id: string): void {
  const row = rows.get(id);
  if (row === undefined) return;
  closePicker(false);
  moveCursor(id);
  cancelAuto();
  const mark = marks.get(id);
  const current = mark !== undefined && statusOf(row.clip, mark) === 'flag' ? mark : undefined;
  const chips = REASONS.map((r) =>
    h(
      'label',
      { class: 'chip' },
      h('input', { type: 'checkbox', name: 'reason', value: r.id, ...(current?.r.includes(r.id) ? { checked: true } : {}) }),
      h('span', { class: 'tick', 'aria-hidden': 'true' }),
      h('span', { class: 'k', 'aria-hidden': 'true' }, r.key),
      h('span', { class: 'lbl' }, r.label),
    ),
  );
  const note = h('input', { type: 'text', name: 'note', maxlength: 400, autocomplete: 'off', spellcheck: 'false', placeholder: 'Which word? What did you hear?', value: current?.n ?? '' });
  const form = h(
    'form',
    { class: 'picker', 'aria-label': 'Why flag this clip?' },
    h('p', { class: 'picker-h' }, 'Why flag this take?', h('span', { class: 'hint' }, ' Press 1 to 7, then Enter. Esc cancels.')),
    h('div', { class: 'chips' }, ...chips),
    h('label', { class: 'note' }, h('span', {}, 'Note, optional'), note),
    h(
      'div',
      { class: 'picker-actions' },
      h('button', { type: 'submit', class: 'btn flag on' }, 'Save flag'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => closePicker() }, 'Cancel'),
      current !== undefined &&
        h(
          'button',
          {
            type: 'button',
            class: 'btn ghost',
            onclick: () => {
              closePicker(false);
              undo(id);
              rows.get(id)?.el.focus({ preventScroll: true });
            },
          },
          'Remove flag',
        ),
    ),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const reasons = [...form.querySelectorAll('input[name="reason"]')]
      .filter((x): x is HTMLInputElement => x instanceof HTMLInputElement && x.checked)
      .map((x) => x.value)
      .filter(isReasonId);
    closePicker(false);
    decide(id, 'flag', reasons, note.value);
    rows.get(cursor ?? id)?.el.focus({ preventScroll: true });
  });
  pickerFor = id;
  row.el.classList.add('picking');
  row.slot.replaceChildren(form);
  form.scrollIntoView({ block: 'nearest' });
  form.querySelector('input')?.focus({ preventScroll: true });
}

// ---- rail, head, chrome ----------------------------------------------------------------------------------

function bar(p: Progress): HTMLElement {
  const wrap = h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': p.total, 'aria-valuenow': p.marked });
  wrap.append(h('i', { class: 'ok', style: `width:${pct(p.ok, p.total)}%` }), h('i', { class: 'flag', style: `width:${pct(p.flag, p.total)}%` }));
  return wrap;
}

function setBar(wrap: Element | null, p: Progress): void {
  if (wrap === null) return;
  wrap.setAttribute('aria-valuemax', String(p.total));
  wrap.setAttribute('aria-valuenow', String(p.marked));
  const [ok, flag] = [wrap.querySelector('.ok'), wrap.querySelector('.flag')];
  if (ok instanceof HTMLElement) ok.style.width = `${pct(p.ok, p.total)}%`;
  if (flag instanceof HTMLElement) flag.style.width = `${pct(p.flag, p.total)}%`;
}

const TIER_NAMES: Record<TierId, string> = { A: 'Tier A', B: 'Tier B', C: 'Tier C' };

function renderTiers(): void {
  const items = TIERS.map((t) => {
    const tier = data.tiers[t];
    const p = progress(tier.ids);
    const button = h(
      'button',
      { type: 'button', class: 'tier', 'data-tier': t, 'aria-pressed': String(prefs.tier === t), onclick: () => selectView(t, prefs.voices[t]) },
      h('span', { class: 'tier-k' }, TIER_NAMES[t]),
      h('span', { class: 'tier-t' }, tier.title),
      h('span', { class: 'tier-n' }, h('b', { class: 'm' }, String(p.marked)), ` / ${p.total}`, h('span', { class: 'left' }, ` · ${formatLeft(p.secondsLeft)}`)),
      bar(p),
    );
    return h('li', {}, button);
  });
  el.tiers.replaceChildren(...items);
}

function updateTiers(): void {
  for (const t of TIERS) {
    const button = el.tiers.querySelector(`[data-tier="${t}"]`);
    if (!(button instanceof HTMLElement)) continue;
    const p = progress(data.tiers[t].ids);
    button.setAttribute('aria-pressed', String(prefs.tier === t));
    const m = button.querySelector('.m');
    if (m !== null) m.textContent = String(p.marked);
    const left = button.querySelector('.left');
    if (left !== null) left.textContent = ` · ${formatLeft(p.secondsLeft)}`;
    setBar(button.querySelector('.bar'), p);
  }
}

function renderVoices(): void {
  const tier = prefs.tier;
  const voices = voicesIn(tier);
  el.voicesH.textContent = tier === 'A' ? 'The six voices' : 'Voices in this tier';
  const entries: { id: string; name: string; ids: readonly string[] }[] = [];
  if (tier !== 'A') entries.push({ id: '*', name: 'All voices', ids: tierIds[tier] });
  for (const v of voices) entries.push({ id: v, name: voiceName(v), ids: tierIds[tier].filter((id) => clipById.get(id)?.v === v) });
  const items = entries.map((e) => {
    const p = progress(e.ids);
    const minutes = e.ids.reduce((s, id) => s + (clipById.get(id)?.d ?? 0), 0) / 60;
    return h(
      'li',
      {},
      h(
        'button',
        { type: 'button', class: 'voice-btn', 'data-voice': e.id, 'aria-pressed': String(prefs.voices[tier] === e.id), onclick: () => selectView(tier, e.id) },
        h('span', { class: 'vn' }, e.name),
        h('span', { class: 'vc' }, h('b', { class: 'm' }, String(p.marked)), ` / ${p.total} · ${minutes.toFixed(1)} min`),
        bar(p),
      ),
    );
  });
  el.voices.replaceChildren(...items);
}

function updateVoices(): void {
  const tier = prefs.tier;
  for (const button of el.voices.querySelectorAll('.voice-btn')) {
    if (!(button instanceof HTMLElement)) continue;
    const id = button.dataset.voice ?? '';
    const ids = id === '*' ? tierIds[tier] : tierIds[tier].filter((x) => clipById.get(x)?.v === id);
    const p = progress(ids);
    button.setAttribute('aria-pressed', String(prefs.voices[tier] === id));
    const m = button.querySelector('.m');
    if (m !== null) m.textContent = String(p.marked);
    setBar(button.querySelector('.bar'), p);
  }
}

function renderHead(): void {
  const tier = prefs.tier;
  const voice = prefs.voices[tier];
  const base = baseIds();
  const p = progress(base);
  const minutes = base.reduce((s, id) => s + (clipById.get(id)?.d ?? 0), 0) / 60;
  const info = voice === '*' ? undefined : voiceById.get(voice);
  const title = info?.name ?? data.tiers[tier].title;
  // with a voice picked the heading is the voice, so the crumb names the tier; otherwise the heading already is the tier name
  const crumb = info === undefined ? TIER_NAMES[tier] : `${TIER_NAMES[tier]} · ${data.tiers[tier].title}`;
  const kids: Kid[] = [
    h('p', { class: 'crumb' }, crumb),
    h('h2', {}, title),
    h('p', { class: 'stats' }, `${plural(p.total, 'clip')} · ${minutes.toFixed(1)} min · `, h('b', {}, String(p.marked)), ' marked', p.flag > 0 && `, ${p.flag} flagged`),
  ];
  if (tier === 'B') kids.push(h('p', { class: 'blurb' }, data.tiers.B.blurb));
  if (tier === 'C') kids.push(h('p', { class: 'blurb' }, data.tiers.C.blurb));
  if (info !== undefined) {
    kids.push(h('details', { class: 'intent' }, h('summary', {}, `Meant to sound like: ${info.role}`), h('p', {}, info.description)));
  }
  el.head.replaceChildren(...kids.filter((k): k is Node | string => k !== null && k !== false && k !== undefined));
}

function updateHeadStats(): void {
  const stats = el.head.querySelector('.stats');
  if (stats === null) return;
  const base = baseIds();
  const p = progress(base);
  const minutes = base.reduce((s, id) => s + (clipById.get(id)?.d ?? 0), 0) / 60;
  stats.replaceChildren(`${plural(p.total, 'clip')} · ${minutes.toFixed(1)} min · `, h('b', {}, String(p.marked)), ' marked', p.flag > 0 ? `, ${p.flag} flagged` : '');
}

const STATUS_LABELS: readonly { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'todo', label: 'To do' },
  { id: 'ok', label: 'OK' },
  { id: 'flag', label: 'Flagged' },
];

function renderSeg(): void {
  const base = baseIds();
  const counts: Record<StatusFilter, number> = { all: base.length, todo: 0, ok: 0, flag: 0 };
  for (const id of base) {
    const clip = clipById.get(id);
    if (clip === undefined) continue;
    const status = statusOf(clip, marks.get(id));
    if (status === 'ok') counts.ok += 1;
    else if (status === 'flag') counts.flag += 1;
    else counts.todo += 1;
  }
  el.segStatus.replaceChildren(
    ...STATUS_LABELS.map((s) =>
      h(
        'button',
        { type: 'button', class: 'seg-btn', 'aria-pressed': String(prefs.status === s.id), 'data-status': s.id, onclick: () => setStatusFilter(s.id) },
        s.label,
        h('span', { class: 'c' }, String(counts[s.id])),
      ),
    ),
  );
}

function setStatusFilter(filter: StatusFilter): void {
  prefs.status = filter;
  savePrefs();
  renderSeg();
  renderList();
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function renderSignoff(): void {
  const s = signoffOf(tierIds, clipById, marks, data.cShare);
  const reqs: { label: string; done: boolean; detail: string }[] = [
    { label: 'Tier A', done: s.a.marked === s.a.total, detail: s.a.marked === s.a.total ? `all ${s.a.total} marked` : `${s.a.total - s.a.marked} left of ${s.a.total}` },
    { label: 'Tier B', done: s.b.marked === s.b.total, detail: s.b.marked === s.b.total ? `all ${s.b.total} marked` : `${s.b.total - s.b.marked} left of ${s.b.total}` },
    {
      label: 'Tier C',
      done: s.c.marked >= s.cNeeded,
      detail: s.c.marked >= s.cNeeded ? `${s.c.marked} of ${s.c.total} marked, ${Math.round(data.cShare * 100)}% needed` : `${s.cNeeded - s.c.marked} more for ${Math.round(data.cShare * 100)}% (${s.cNeeded} of ${s.c.total})`,
    },
  ];
  el.signoffHint.replaceChildren(
    h('h2', { class: 'rail-h' }, 'Sign-off needs'),
    h('ul', { class: 'reqs' }, ...reqs.map((r) => h('li', { 'data-done': String(r.done) }, h('span', { class: 'chk', 'aria-hidden': 'true' }), h('span', {}, h('b', {}, r.label), ` ${r.detail}`)))),
  );

  el.signoff.hidden = !s.ready;
  if (!s.ready) return;
  const name = el.listener.value;
  const line = signoffLine(name, today(), s);
  const notes: HTMLElement[] = [];
  if (name.trim() === '') notes.push(h('p', { class: 'warn' }, 'Type your name in the Listener field first.'));
  if (s.open > 0) notes.push(h('p', { class: 'warn' }, `${plural(s.open, 'flag')} still open: the audio is the same as when you flagged it. Render those clips again, build this page again, and listen again before you paste this.`));
  if (s.waiting > 0) notes.push(h('p', { class: 'warn' }, `${plural(s.waiting, 'clip')} rendered again and not heard again yet. Find them with the To do filter.`));
  el.signoff.replaceChildren(
    h('h2', {}, 'Sign-off'),
    h('p', { class: 'lede' }, 'All three tiers are done. Paste this line into README.md.'),
    h('p', { class: 'line', id: 'signoff-line' }, line),
    ...notes,
    h(
      'div',
      { class: 'row' },
      h('button', { type: 'button', class: 'btn play', id: 'signoff-copy', onclick: () => void copyText(line, 'Sign-off line copied.') }, 'Copy sign-off line'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => openExport() }, 'Export flags'),
    ),
  );
}

function renderOverall(): void {
  const p = progress(allIds);
  el.overall.replaceChildren(
    h('p', { class: 'ov-t' }, h('b', {}, String(p.marked)), ` of ${p.total} clips marked`, p.flag > 0 && h('span', { class: 'ov-f' }, ` · ${p.flag} flagged`), p.stale > 0 && h('span', { class: 'ov-s' }, ` · ${p.stale} to hear again`)),
    bar(p),
  );
  const flagged = p.flag;
  el.btnExport.replaceChildren('Export', h('span', { class: 'long' }, ' flags'), ` (${flagged})`);
}

/** everything that depends on the marks, after a mark changed */
function refreshChrome(): void {
  renderOverall();
  updateTiers();
  updateVoices();
  updateHeadStats();
  renderSeg();
  renderSignoff();
  renderEnd([...rows.keys()]);
}

function selectView(tier: TierId, voice: string): void {
  stopPlayback();
  closePicker(false);
  prefs.tier = tier;
  prefs.voices[tier] = tier === 'A' && voice === '*' ? (voicesIn('A')[0] ?? '*') : voice;
  view.query = '';
  el.q.value = '';
  cursor = null;
  savePrefs();
  renderTiers();
  renderVoices();
  renderHead();
  renderSeg();
  renderList();
  if (window.scrollY > 0 && window.matchMedia('(max-width: 959px)').matches) el.head.scrollIntoView({ block: 'start' });
}

// ---- export, copy, files ---------------------------------------------------------------------------------

async function copyText(text: string, done: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
    return;
  } catch {
    // no clipboard access on this origin: fall back to selecting a text area
  }
  const area = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;left:-9999px;top:0' });
  area.value = text;
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  toast(ok ? done : 'Copy failed. Select the text and copy it by hand.', ok ? 2400 : 5000);
}

function download(name: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function flagJson(): { text: string; count: number } {
  const records = flagExport(data.clips, marks, data.voices.map((v) => v.id));
  return { text: `${JSON.stringify(records, null, 2)}\n`, count: records.length };
}

function openExport(): void {
  const { text, count } = flagJson();
  el.exportJson.value = text;
  el.exportSum.textContent = count === 0 ? 'Nothing is flagged, so the file is an empty list.' : `${plural(count, 'flagged clip')}. flagged-lines.json was downloaded; the same text is below.`;
  download('flagged-lines.json', text);
  if (!el.dlgExport.open) el.dlgExport.showModal();
}

function saveProgressFile(): void {
  const file = toProgressFile(data.manifestVersion, el.listener.value, new Date().toISOString(), marks);
  download(`listening-progress-${today()}.json`, `${JSON.stringify(file, null, 2)}\n`);
  toast('Progress file saved.');
}

async function loadProgressFile(file: File): Promise<void> {
  const parsed = parseProgressFile(await file.text(), data.manifestVersion);
  if (typeof parsed === 'string') {
    toast(parsed, 5000);
    return;
  }
  const changed = mergeMarks(marks, parsed.marks);
  for (const id of changed) {
    const mark = marks.get(id);
    if (mark !== undefined) saveMark(store, data.manifestVersion, id, mark);
  }
  if (el.listener.value.trim() === '' && parsed.listener !== '') {
    el.listener.value = parsed.listener;
    prefs.listener = parsed.listener;
    savePrefs();
  }
  renderVoices();
  renderTiers();
  renderHead();
  renderSeg();
  renderList();
  refreshChrome();
  toast(`Loaded ${plural(changed.length, 'mark')} from the file.`);
}

// ---- keyboard --------------------------------------------------------------------------------------------

/** a field the person types in: every key belongs to it */
function isTextTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLElement && target.isContentEditable;
}

/** the Tools menu header: Space and Enter open it, the letter keys still work */
const isSummary = (target: EventTarget | null): boolean => target instanceof HTMLElement && target.tagName === 'SUMMARY';

function pickerKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    closePicker();
    return;
  }
  const typing = event.target instanceof HTMLInputElement && event.target.type === 'text';
  if (typing) return;
  const reason = REASONS.find((r) => r.key === event.key);
  if (reason !== undefined) {
    event.preventDefault();
    const box = el.list.querySelector(`.picker input[value="${reason.id}"]`);
    if (box instanceof HTMLInputElement) box.checked = !box.checked;
    return;
  }
  if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
    event.preventDefault();
    event.target.closest('form')?.requestSubmit();
  }
}

document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  if (el.dlgExport.open || el.dlgKeys.open) return;
  if (pickerFor !== null) {
    pickerKey(event);
    return;
  }
  if (event.key === 'Escape') {
    if (el.menu.open) el.menu.open = false;
    else if (document.activeElement instanceof HTMLElement && isTextTarget(document.activeElement)) document.activeElement.blur();
    return;
  }
  if (isTextTarget(event.target) || (isSummary(event.target) && (event.key === ' ' || event.key === 'Enter'))) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  switch (key) {
    case ' ':
      event.preventDefault();
      if (cursor !== null) togglePlay(cursor);
      return;
    case 'j':
    case 'ArrowDown':
      event.preventDefault();
      goNext(false);
      return;
    case 'k':
    case 'ArrowUp':
      event.preventDefault();
      goPrev();
      return;
    case 'n':
      event.preventDefault();
      goNext(true);
      return;
    case 'o':
      event.preventDefault();
      if (cursor !== null) decide(cursor, 'ok');
      return;
    case 'f':
      event.preventDefault();
      if (cursor !== null) openPicker(cursor);
      return;
    case 'u':
      event.preventDefault();
      if (cursor !== null) undo(cursor);
      return;
    case 't':
      event.preventDefault();
      jumpToTodo();
      return;
    case 'a':
      event.preventDefault();
      el.auto.checked = !el.auto.checked;
      setAuto(el.auto.checked);
      return;
    case '/':
      event.preventDefault();
      el.q.focus();
      return;
    case '?':
      event.preventDefault();
      el.dlgKeys.showModal();
      return;
    default:
  }
});

// A button that has focus would also click on Space (on key up). The page already used Space for play and pause.
document.addEventListener('keyup', (event) => {
  if (event.key === ' ' && !isTextTarget(event.target) && !isSummary(event.target) && pickerFor === null && !el.dlgExport.open && !el.dlgKeys.open) event.preventDefault();
});

function setAuto(on: boolean): void {
  prefs.auto = on;
  savePrefs();
  if (!on) cancelAuto();
  toast(on ? 'Auto-advance on: the next clip plays after a short pause.' : 'Auto-advance off.');
}

// ---- wiring ----------------------------------------------------------------------------------------------

el.listener.value = prefs.listener;
el.listener.addEventListener('input', () => {
  prefs.listener = el.listener.value.slice(0, 60);
  savePrefs();
  renderSignoff();
});
el.auto.checked = prefs.auto;
el.auto.addEventListener('change', () => setAuto(el.auto.checked));
let searchTimer = 0;
el.q.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    view.query = el.q.value;
    renderList();
  }, 120);
});
el.q.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    el.q.value = '';
    view.query = '';
    el.q.blur();
    renderList();
  }
});
el.btnNext.addEventListener('click', jumpToTodo);
el.btnExport.addEventListener('click', openExport);
el.exportCopy.addEventListener('click', () => void copyText(el.exportJson.value, 'Flags copied.'));
el.exportDl.addEventListener('click', () => download('flagged-lines.json', el.exportJson.value));
el.exportClose.addEventListener('click', () => el.dlgExport.close());
el.exportJson.addEventListener('focus', () => el.exportJson.select());
el.btnKeys.addEventListener('click', () => {
  el.menu.open = false;
  el.dlgKeys.showModal();
});
el.keysClose.addEventListener('click', () => el.dlgKeys.close());
el.btnSave.addEventListener('click', () => {
  el.menu.open = false;
  saveProgressFile();
});
el.fileLoad.addEventListener('change', () => {
  const file = el.fileLoad.files?.[0];
  el.menu.open = false;
  if (file !== undefined) void loadProgressFile(file);
  el.fileLoad.value = '';
});
el.btnReset.addEventListener('click', () => {
  el.menu.open = false;
  if (!window.confirm(`Clear all ${marks.size} marks in this browser? Save a progress file first if you may want them back.`)) return;
  stopPlayback();
  clearAllMarks(store, data.manifestVersion);
  marks.clear();
  renderVoices();
  renderTiers();
  renderHead();
  renderList();
  refreshChrome();
  toast('All marks cleared.');
});
for (const dialog of [el.dlgExport, el.dlgKeys]) {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}
window.addEventListener('resize', queueLayout);

const headObserver = new ResizeObserver(() => document.documentElement.style.setProperty('--head-h', `${el.top.offsetHeight}px`));
headObserver.observe(el.top);

el.subCount.textContent = `${plural(data.clips.length, 'clip')}${data.leftOut > 0 ? `, ${data.leftOut} the game never plays left out` : ''} · build ${data.build}`;
if (!persistent) {
  el.warn.hidden = false;
  el.warn.textContent = 'This browser blocks storage for this page, so marks cannot be saved between visits. Use Tools, Save progress file as you go.';
}

renderTiers();
renderVoices();
renderHead();
renderSeg();
renderList();
refreshChrome();
