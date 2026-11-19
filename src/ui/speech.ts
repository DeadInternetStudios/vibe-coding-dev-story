import Phaser from 'phaser';
import { app } from '../core/app';
import { audio, type VoiceHandle } from '../core/audio';
import type { VoiceLine } from '../content/vo';

const SILENT_CPS = 46;

/**
 * Types words into a bitmap text while a voice line plays. The words arrive as
 * they are spoken. With no recording the text types at a steady clip, so the
 * game reads the same way with the sound off.
 */
export class Speech {
  private scene: Phaser.Scene;
  private target: Phaser.GameObjects.BitmapText;
  private lines: string[] = [];
  private full = '';
  private handle: VoiceHandle | null = null;
  private timer: Phaser.Time.TimerEvent | null = null;
  private startedAt = 0;
  private dur = 1;
  private shown = 0;
  private cancelled = false;
  typed = false;
  onWord: ((index: number) => void) | null = null;
  private lastWord = -1;
  /** 0 to 1, how loud the voice is right now, for mouths */
  get level(): number {
    return this.handle ? this.handle.level() : 0;
  }
  /** resolves when the voice ends and the text is all there */
  done: Promise<void>;
  private resolveDone!: () => void;

  constructor(scene: Phaser.Scene, target: Phaser.GameObjects.BitmapText) {
    this.scene = scene;
    this.target = target;
    this.done = new Promise((r) => (this.resolveDone = r));
  }

  /** Say a line. `text` is what shows, usually line.text. */
  async say(text: string, line?: VoiceLine): Promise<void> {
    this.full = text;
    // let the font wrap the whole thing once, then reveal the wrapped copy so words never jump lines
    this.target.setText(text);
    const wrapped = this.target.getTextBounds().wrappedText ?? text;
    this.lines = [wrapped];
    this.target.setText('');
    this.typed = false;
    this.shown = 0;
    if (line && !this.cancelled) this.handle = await audio.voice(line);
    if (this.cancelled) return;
    const chars = wrapped.length;
    this.dur = this.handle ? Math.max(0.6, this.handle.dur * (this.handle.real ? 0.92 : 1)) : chars / SILENT_CPS;
    if (!this.handle) this.dur = chars / SILENT_CPS;
    if (this.handle && !this.handle.real) this.dur = Math.min(this.dur, Math.max(0.8, chars / SILENT_CPS));
    this.startedAt = performance.now();
    if (app.settings.reducedMotion) {
      this.finishTyping();
    } else {
      this.timer = this.scene.time.addEvent({ delay: 30, loop: true, callback: () => this.step() });
    }
    if (this.handle) void this.handle.done.then(() => this.checkDone());
    else this.checkDone();
  }

  private step(): void {
    if (this.cancelled || this.typed) return;
    const t = (performance.now() - this.startedAt) / 1000;
    const p = Math.min(1, t / this.dur);
    const w = this.lines[0]!;
    // reveal up to a word boundary so the text lands in whole words
    let n = Math.floor(p * w.length);
    if (n < w.length) {
      const next = w.indexOf(' ', n);
      const nl = w.indexOf('\n', n);
      const cut = [next, nl].filter((x) => x >= 0).sort((a, b) => a - b)[0];
      if (cut !== undefined && cut - n < 6) n = cut;
    }
    if (n !== this.shown) {
      this.shown = n;
      this.target.setText(w.slice(0, n));
      const wordIdx = w.slice(0, n).split(/\s+/).filter(Boolean).length - 1;
      if (wordIdx !== this.lastWord) {
        this.lastWord = wordIdx;
        this.onWord?.(wordIdx);
      }
    }
    if (p >= 1) this.finishTyping();
  }

  private finishTyping(): void {
    this.timer?.remove();
    this.timer = null;
    this.typed = true;
    this.target.setText(this.lines[0] ?? this.full);
    this.checkDone();
  }

  private checkDone(): void {
    if (!this.typed) return;
    if (this.handle && this.handle.elapsed() < this.handle.dur - 0.05 && this.handle.real) {
      void this.handle.done.then(() => this.resolveDone());
      return;
    }
    this.resolveDone();
  }

  /** Show all the text now. The voice keeps going. */
  skip(): void {
    if (!this.typed) this.finishTyping();
  }

  /** Cut the voice and the typing. */
  stop(): void {
    this.cancelled = true;
    this.timer?.remove();
    this.handle?.stop();
    this.resolveDone();
  }

  get finished(): boolean {
    return this.typed;
  }
}
