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
  /** set by main: recompute the canvas size, used when the UI size setting changes */
  refreshViewport?: () => void;
}

export const app: App = {
  settings: loadSettings(),
  content: undefined as unknown as Content,
  session: null,
};
