/**
 * Everything the browser remembers: the running game, the settings, the hall of fame.
 * localStorage can throw (private mode, quota), so every call is guarded and the
 * game keeps going without a save.
 */
import type { GameState } from '../sim/types';
import { SAVE_VERSION } from '../sim/game';

const SAVE_KEY = 'vcds.save.v1';
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

export function loadSave(): GameState | null {
  const s = readJson<GameState>(SAVE_KEY);
  if (!s || s.v !== SAVE_VERSION) return null;
  return s;
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
}

export function loadHall(): HallEntry[] {
  return readJson<HallEntry[]>(HALL_KEY) ?? [];
}

export function pushHall(e: HallEntry): HallEntry[] {
  const list = [e, ...loadHall()].sort((a, b) => b.score - a.score).slice(0, 20);
  writeJson(HALL_KEY, list);
  return list;
}
