/**
 * The few things every scene shares. Scenes come and go, these stay.
 */
import type { Content } from '../sim/content';
import type { Session } from '../game/session';
import type { Settings } from './save';
import { loadSettings } from './save';

export interface App {
  settings: Settings;
  content: Content;
  session: Session | null;
  /** true from CONTINUE until the Office is built: an error in that time means the saved run cannot be opened (see main.ts) */
  resuming: boolean;
  /** set by main: recompute the canvas size, used when the UI size setting changes */
  refreshViewport?: () => void;
}

export const app: App = {
  settings: loadSettings(),
  content: undefined as unknown as Content,
  session: null,
  resuming: false,
};

/** The running game. Scenes that only exist during a run call this. */
export function current(): Session {
  if (!app.session) throw new Error('no game is running');
  return app.session;
}
