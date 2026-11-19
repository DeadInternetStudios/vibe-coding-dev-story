import type { DrumId } from './synth/drums';
import type { InstrumentId } from './synth/instruments';
import { clamp, clamp01 } from './synth/notes';

/**
 * Songs are data and the sequencer is a pure state machine: it knows nothing
 * about Web Audio. Each call to `tick` schedules every step that falls inside
 * the look ahead window by calling back with an absolute time. The engine turns
 * those callbacks into voices. That split keeps the timing math testable.
 */

export interface NoteEvent {
  /** Start step inside the loop, 0 based. */
  readonly step: number;
  /** Length in steps. */
  readonly dur: number;
  /** MIDI note number. Ignored for drums. */
  readonly pitch: number;
  /** 0..1 */
  readonly vel: number;
  readonly drum?: DrumId;
  /** Drum pitch multiplier (toms). */
  readonly tune?: number;
  /** Semitone offsets cycled quickly through (tracker style chord arpeggio). */
  readonly arp?: readonly number[];
}

export interface Track {
  /** Layer name: base, bass, lead, perc, extra, ... */
  readonly id: string;
  readonly inst: InstrumentId | 'drums';
  /** The layer is on while intensity >= at ... */
  readonly at: number;
  /** ... and intensity <= to. */
  readonly to: number;
  readonly pan: number;
  /** Track trim, linear. */
  readonly vol: number;
  /** Notes by start step. Built once from `notes`. */
  readonly grid: ReadonlyArray<readonly NoteEvent[] | undefined>;
  readonly notes: readonly NoteEvent[];
}

export interface Song {
  readonly id: string;
  readonly title: string;
  /** For example "F major". Used by tests and docs. */
  readonly key: string;
  readonly bpm: number;
  readonly stepsPerBeat: number;
  readonly beatsPerBar: number;
  readonly stepsPerBar: number;
  readonly bars: number;
  readonly totalSteps: number;
  /** Off beat eighths are pushed late by this many steps. 0 is straight. */
  readonly swing: number;
  readonly loop: boolean;
  /** Intensity used when `music(id)` is called without one. */
  readonly defaultIntensity: number;
  /** Pitch classes (0..11) allowed outside the key. Only the diatonic test reads this. */
  readonly chromatic: readonly number[];
  readonly tracks: readonly Track[];
}

export interface SeqCallbacks {
  /** A note starts. `durSec` is the written length, instruments apply their own gate. */
  note(trackIndex: number, note: NoteEvent, time: number, durSec: number): void;
  /** A layer turns on or off. `immediate` is true for the very first bar (no fade). */
  layer(trackIndex: number, on: boolean, time: number, immediate: boolean): void;
  /** Called once per bar, on its first step. */
  bar?(bar: number, time: number, loops: number): void;
  /** A non looping song has played its last step. `time` is the end of that step. */
  end?(time: number): void;
}

/** Seconds per step. */
export function stepDuration(bpm: number, stepsPerBeat: number, tempoScale = 1): number {
  return 60 / (bpm * tempoScale * stepsPerBeat);
}

export function barDuration(song: Pick<Song, 'bpm' | 'stepsPerBeat' | 'stepsPerBar'>, tempoScale = 1): number {
  return song.stepsPerBar * stepDuration(song.bpm, song.stepsPerBeat, tempoScale);
}

/** One full pass through the song, seconds (swing does not change the grid). */
export function loopSeconds(song: Pick<Song, 'bpm' | 'stepsPerBeat' | 'totalSteps'>, tempoScale = 1): number {
  return song.totalSteps * stepDuration(song.bpm, song.stepsPerBeat, tempoScale);
}

/**
 * How late a step lands because of swing. Only the off beat eighth (the "and"
 * of each beat) moves, 16ths stay straight so fast arpeggios keep their shape.
 */
export function swingOffset(localStep: number, stepsPerBeat: number, swing: number, stepDurSec: number): number {
  if (swing <= 0 || stepsPerBeat < 2) return 0;
  return localStep % stepsPerBeat === stepsPerBeat / 2 ? swing * stepDurSec : 0;
}

/** Layer on/off with a little hysteresis so a wobbly intensity does not flap a layer. */
export function layerWanted(track: Pick<Track, 'at' | 'to'>, intensity: number, wasOn: boolean): boolean {
  const h = wasOn ? 0.04 : 0;
  return intensity >= track.at - h && intensity <= track.to + h;
}

export const MIN_TEMPO_SCALE = 0.5;
export const MAX_TEMPO_SCALE = 2;
/** If the clock is further behind than this, skip ahead instead of firing a burst of late notes. */
export const MAX_LAG = 0.25;

export class Sequencer {
  private step = 0;
  private nextTime = 0;
  private loops = 0;
  private running = false;
  private done = false;
  private intensity: number;
  private tempoScale: number;
  private readonly layerOn: boolean[];

  constructor(
    readonly song: Song,
    private readonly cb: SeqCallbacks,
    init?: { intensity?: number; tempoScale?: number },
  ) {
    this.intensity = clamp01(init?.intensity ?? song.defaultIntensity);
    this.tempoScale = clamp(init?.tempoScale ?? 1, MIN_TEMPO_SCALE, MAX_TEMPO_SCALE);
    this.layerOn = song.tracks.map(() => false);
  }

  /** Begin playing. The first step lands exactly at `time`. */
  start(time: number): void {
    this.step = 0;
    this.loops = 0;
    this.nextTime = time;
    this.running = true;
    this.done = false;
    this.layerOn.fill(false);
  }

  stop(): void {
    this.running = false;
  }

  get isRunning(): boolean {
    return this.running && !this.done;
  }

  get finished(): boolean {
    return this.done;
  }

  setIntensity(v: number): void {
    this.intensity = clamp01(Number.isFinite(v) ? v : 0);
  }

  getIntensity(): number {
    return this.intensity;
  }

  setTempoScale(v: number): void {
    this.tempoScale = clamp(Number.isFinite(v) ? v : 1, MIN_TEMPO_SCALE, MAX_TEMPO_SCALE);
  }

  getTempoScale(): number {
    return this.tempoScale;
  }

  isLayerOn(trackIndex: number): boolean {
    return this.layerOn[trackIndex] ?? false;
  }

  /** Where the next step to be scheduled sits. */
  position(): { bar: number; step: number; loops: number; nextTime: number } {
    return {
      bar: Math.floor(this.step / this.song.stepsPerBar),
      step: this.step,
      loops: this.loops,
      nextTime: this.nextTime,
    };
  }

  /**
   * Schedule every step that starts before `now + lookahead`.
   * Calling it twice with the same arguments schedules nothing new.
   */
  tick(now: number, lookahead: number): void {
    if (!this.running || this.done) return;
    if (this.nextTime < now - MAX_LAG) this.nextTime = now + 0.02;
    const horizon = now + lookahead;
    // hard cap on work per tick, so a bad clock can never spin forever
    for (let guard = 0; guard < 4096 && this.nextTime < horizon && !this.done; guard++) this.advance();
  }

  private advance(): void {
    const song = this.song;
    const local = this.step % song.stepsPerBar;
    const stepSec = stepDuration(song.bpm, song.stepsPerBeat, this.tempoScale);

    if (local === 0) {
      const bar = this.step / song.stepsPerBar;
      const first = bar === 0 && this.loops === 0;
      for (let i = 0; i < song.tracks.length; i++) {
        const want = layerWanted(song.tracks[i]!, this.intensity, this.layerOn[i]!);
        if (want !== this.layerOn[i] || first) {
          this.layerOn[i] = want;
          this.cb.layer(i, want, this.nextTime, first);
        }
      }
      this.cb.bar?.(bar, this.nextTime, this.loops);
    }

    const when = this.nextTime + swingOffset(local, song.stepsPerBeat, song.swing, stepSec);
    for (let i = 0; i < song.tracks.length; i++) {
      if (!this.layerOn[i]) continue;
      const events = song.tracks[i]!.grid[this.step];
      if (!events) continue;
      for (const n of events) this.cb.note(i, n, when, n.dur * stepSec);
    }

    this.nextTime += stepSec;
    this.step++;
    if (this.step >= song.totalSteps) {
      if (song.loop) {
        this.step = 0;
        this.loops++;
      } else {
        this.done = true;
        this.cb.end?.(this.nextTime);
      }
    }
  }
}
