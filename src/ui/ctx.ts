import type Phaser from 'phaser';
import type { SfxId } from '../audio';
import type { Content } from '../sim/content';
import type { Tone } from '../sim/types';
import type { Session } from '../game/session';
import type { Room } from '../game/room';
import type { TermKind } from './dash';
import type { Modal } from './modal';

/**
 * What a menu or popup is allowed to reach. The office scene implements it,
 * so every popup can stay a plain function that builds some widgets.
 */
export interface UiCtx {
  scene: Phaser.Scene;
  session: Session;
  content: Content;
  room: Room;
  /** stop the clock while something is open, call the result to let it run again */
  hold(tag?: string): () => void;
  toast(text: string, tone?: Tone, icon?: string): void;
  /** call after any change to the game so the room and bars catch up now */
  refresh(): void;
  sfx(id: SfxId): void;
  /** floating money at the cash counter */
  cashPop(amount: number): void;
  /** register a popup so the scene knows one is open */
  track(m: Modal): Modal;
  /** open another menu by id */
  open(id: string): void;
  /** a big ribbon across the screen */
  banner(text: string, sub?: string, tone?: Tone): void;
  /** a line in the terminal beside the room */
  log(kind: TermKind, head: string, text: string): void;
  /** shake the camera a little */
  shake(power?: number): void;
}
