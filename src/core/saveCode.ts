import type { GameState } from '../sim/types';
import { SAVE_VERSION } from '../sim/game';

const PREFIX = 'VCDS1:';

/** A save as one line of text: paste it in a note, a chat or a DM, and the game on another device picks it up. */
export function encodeSave(state: GameState): string {
  let bin = '';
  new TextEncoder().encode(JSON.stringify(state)).forEach((b) => (bin += String.fromCharCode(b)));
  return PREFIX + btoa(bin);
}

/** The game state inside a save code, or null when the text is not one of ours or is from another version. */
export function decodeSave(code: string): GameState | null {
  const text = code.trim().replace(/\s+/g, '');
  if (!text.startsWith(PREFIX)) return null;
  try {
    const bin = atob(text.slice(PREFIX.length));
    const s = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as Partial<GameState> | null;
    if (!s || typeof s !== 'object' || s.v !== SAVE_VERSION) return null;
    if (typeof s.day !== 'number' || !s.company || !Array.isArray(s.staff) || !Array.isArray(s.shipped)) return null;
    return s as GameState;
  } catch {
    return null;
  }
}
