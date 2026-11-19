import type { Content } from '../sim/content';
import type { GameState } from '../sim/types';
import { problemWithSave } from './saveCheck';

const PREFIX = 'VCDS1:';
/** the longest code that is read: a save is a few hundred KB, so this is far above any real one */
const MAX_CODE_CHARS = 4_000_000;

/** A save as one line of text: paste it in a note, a chat or a DM, and the game on another device picks it up. */
export function encodeSave(state: GameState): string {
  let bin = '';
  new TextEncoder().encode(JSON.stringify(state)).forEach((b) => (bin += String.fromCharCode(b)));
  return PREFIX + btoa(bin);
}

/** The game state inside a save code, or null when the text is not one of ours, is from another version, or does not pass the save check. */
export function decodeSave(code: string, content: Content): GameState | null {
  const text = code.trim().replace(/\s+/g, '');
  if (!text.startsWith(PREFIX) || text.length > MAX_CODE_CHARS) return null;
  try {
    const bin = atob(text.slice(PREFIX.length));
    const s: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    return problemWithSave(s, content) ? null : (s as GameState);
  } catch {
    return null;
  }
}
