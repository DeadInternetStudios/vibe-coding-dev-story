/**
 * Everything the browser remembers: the running game, the settings, the hall of fame.
 * localStorage can throw (private mode, quota), so every call is guarded and the
 * game keeps going without a save.
 */
import type { Content } from '../sim/content';
import type { GameState } from '../sim/types';
import { SAVE_VERSION } from '../sim/game';
import { problemWithSave } from './saveCheck';

const SAVE_KEY = 'vcds.save.v1';
/** where a run goes that crashed the game while it was opening, so it is kept and not lost */
const ASIDE_KEY = 'vcds.save.aside';
const CRASH_KEY = 'vcds.save.crashed';
/** a real save is a few hundred KB at most: anything near this size is not parsed at all */
const MAX_SAVE_CHARS = 3_000_000;
const SETTINGS_KEY = 'vcds.settings.v1';
const HALL_KEY = 'vcds.hall.v1';

export interface Settings {
  volMaster: number;
  volMusic: number;
  volSfx: number;
  volVoice: number;
  /** show the words under every voice line */
  subtitles: boolean;
  reducedMotion: boolean;
  /** -1 smaller UI, 0 normal, 1 bigger */
  uiSize: -1 | 0 | 1;
  /** index into SPEEDS */
  speed: number;
  /** shake the screen on bad news */
  shake: boolean;
  muted: boolean;
  /** which intro and tutorial beats were already seen */
  seen: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  volMaster: 0.8,
  volMusic: 0.55,
  volSfx: 0.8,
  volVoice: 1,
  subtitles: true,
  reducedMotion: false,
  uiSize: 0,
  speed: 1,
  shake: true,
  muted: false,
  seen: [],
};

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadSettings(): Settings {
  const saved = readJson<Partial<Settings>>(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(saved ?? {}), seen: saved?.seen ?? [] };
}

export function saveSettings(s: Settings): void {
  writeJson(SETTINGS_KEY, s);
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The last text that was checked, so the title (which is rebuilt on every resize) does not play 60 days again for the same save. */
let lastVerdict: { content: Content; raw: string; why: string | null } | null = null;

/** What is wrong with the stored text, or null when the game can open it. */
function verdict(raw: string, content: Content): string | null {
  if (lastVerdict && lastVerdict.content === content && lastVerdict.raw === raw) return lastVerdict.why;
  let why: string | null;
  if (raw.length > MAX_SAVE_CHARS) why = 'too big';
  else {
    try {
      why = problemWithSave(JSON.parse(raw), content);
    } catch {
      why = 'not readable';
    }
  }
  lastVerdict = { content, raw, why };
  return why;
}

/**
 * The saved run, or null. Only a run that passes `problemWithSave` is handed out. A save from another version of the game is
 * not opened here: when SAVE_VERSION changes, turn the old shape into the new one in this function first, or those players lose their run.
 */
export function loadSave(content: Content): GameState | null {
  const raw = readRaw(SAVE_KEY);
  if (!raw || verdict(raw, content)) return null;
  return JSON.parse(raw) as GameState;
}

export type SaveProblem = 'older' | 'damaged';

/** Why the browser holds a run this game will not open, so the title can say so instead of silently starting over. Null when there is none or it opens. */
export function saveProblem(content: Content): SaveProblem | null {
  const raw = readRaw(SAVE_KEY);
  if (!raw || verdict(raw, content) === null) return null;
  const parsed = readJson<{ v?: unknown }>(SAVE_KEY);
  return parsed && typeof parsed === 'object' && typeof parsed.v === 'number' && parsed.v !== SAVE_VERSION ? 'older' : 'damaged';
}

/** A run that crashed the game while it was opening: kept under another name, taken off the title, and the next title says so once. */
export function setSaveAside(): void {
  const raw = readRaw(SAVE_KEY);
  try {
    if (raw) localStorage.setItem(ASIDE_KEY, raw);
  } catch {
    /* no room to keep a copy: the run still has to go, or the game would crash on every start */
  }
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.setItem(CRASH_KEY, '1');
  } catch {
    /* nothing more to do */
  }
}

/** True once after a run was set aside. */
export function takeCrashNote(): boolean {
  const had = readRaw(CRASH_KEY) !== null;
  if (had) {
    try {
      localStorage.removeItem(CRASH_KEY);
    } catch {
      /* nothing to do */
    }
  }
  return had;
}

export function writeSave(state: GameState): boolean {
  return writeJson(SAVE_KEY, state);
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* nothing to do */
  }
}

export interface HallEntry {
  company: string;
  founder: string;
  rank: string;
  score: number;
  valuation: number;
  apps: number;
  days: number;
  endingId: string;
  difficulty: string;
  bankrupt: boolean;
  when: number;
  /** the UTC date of the daily challenge, absent for a normal run */
  daily?: string;
}

export function loadHall(): HallEntry[] {
  return readJson<HallEntry[]>(HALL_KEY) ?? [];
}

/** How many runs the hall keeps. */
export const HALL_SIZE = 20;

export function pushHall(e: HallEntry): HallEntry[] {
  const list = [e, ...loadHall()].sort((a, b) => b.score - a.score).slice(0, HALL_SIZE);
  writeJson(HALL_KEY, list);
  return list;
}
