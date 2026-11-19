/**
 * A session is a running game plus the clock that feeds it. Scenes read
 * state from it, call actions on it, and drain the notices it collects.
 */
import { Game, type NewGameOptions } from '../sim/game';
import type { Content } from '../sim/content';
import type { GameState, Notice } from '../sim/types';
import { SPEEDS } from '../sim/config';
import { clearSave, writeSave } from '../core/save';

export class Session {
  /** a multiplier on the clock, only the test driver sets it */
  static turbo = 1;
  game: Game;
  /** index into SPEEDS */
  speedIdx: number;
  paused = false;
  /** the UI layers that want the clock stopped (open menus, dialogues), by token, with a name for debugging */
  private holds = new Map<symbol, string>();
  private acc = 0;
  private notices: Notice[] = [];
  private lastSaveDay = -999;

  constructor(game: Game, speedIdx = 1) {
    this.game = game;
    this.speedIdx = speedIdx;
    this.lastSaveDay = game.s.day;
  }

  static fresh(content: Content, opts: NewGameOptions, speedIdx: number): Session {
    clearSave();
    const s = new Session(Game.create(content, opts), speedIdx);
    s.save();
    return s;
  }

  static resume(content: Content, state: GameState, speedIdx: number): Session {
    return new Session(new Game(content, state), speedIdx);
  }

  get s(): GameState {
    return this.game.s;
  }

  get speed(): number {
    return SPEEDS[this.speedIdx] ?? 1;
  }

  /** Stop the clock while a layer is open. Returns the release function, which is safe to call twice or after `clearHolds`. */
  hold(tag = ''): () => void {
    const token = Symbol(tag);
    this.holds.set(token, tag);
    return () => {
      this.holds.delete(token);
    };
  }

  get held(): boolean {
    return this.holds.size > 0;
  }

  /** Who is holding the clock right now. */
  get holders(): string[] {
    return [...this.holds.values()];
  }

  /** Every layer that held the clock has been destroyed (a scene change or a rebuild), so none of them will release it. */
  clearHolds(): void {
    this.holds.clear();
  }

  get ticking(): boolean {
    return !this.paused && this.holds.size === 0 && this.game.running && !this.game.pending;
  }

  /** Advance by real milliseconds. Returns the number of days that passed. */
  update(dtMs: number): number {
    this.collect();
    if (!this.ticking) {
      this.acc = 0;
      return 0;
    }
    this.acc += (dtMs / 1000) * this.speed * Session.turbo;
    let days = 0;
    while (this.acc >= 1 && this.ticking && days < 6 * Session.turbo) {
      this.acc -= 1;
      this.game.tick();
      days += 1;
      this.collect();
    }
    if (days > 0) this.autosave();
    return days;
  }

  /** true while the whole team is out of tokens */
  rateLimited = false;

  private collect(): void {
    const n = this.game.drain();
    if (!n.length) return;
    for (const x of n) if (x.t === 'rateLimited') this.rateLimited = x.on;
    this.notices.push(...n);
  }

  /** Everything that happened since the last call. */
  takeNotices(): Notice[] {
    this.collect();
    const n = this.notices;
    this.notices = [];
    return n;
  }

  save(): void {
    writeSave(this.game.snapshot());
    this.lastSaveDay = this.s.day;
  }

  /** Save every game week, and whenever someone asks. */
  private autosave(): void {
    if (this.s.day - this.lastSaveDay >= 7) this.save();
  }

  setSpeed(i: number): void {
    this.speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, i));
  }
}
