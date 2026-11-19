import type { Song } from '../sequencer';
import { loopSeconds } from '../sequencer';
import type { DrumId } from '../synth/drums';
import type { Adsr } from '../synth/envelope';
import type { PitchSpec } from '../synth/notes';
import { toHz } from '../synth/notes';
import type { ArpSpec, FilterSpec, LayerSpec, VibratoSpec, VoiceSpec } from '../synth/voice';
import type { NoiseId, WaveId } from '../synth/waves';

/** A pitched or noisy voice, placed `at` seconds after the sound effect starts. */
export interface ToneEvent {
  at: number;
  /** Gate length in seconds. */
  dur: number;
  wave?: WaveId;
  layers?: readonly LayerSpec[];
  /** Note name or Hz. For noise waves this is the LFSR clock in Hz. */
  f: PitchSpec;
  /** Slide target. */
  to?: PitchSpec;
  /** Slide time in seconds. Defaults to `dur`. */
  slide?: number;
  /** Peak gain. Default 0.3. */
  vol?: number;
  a?: number;
  d?: number;
  s?: number;
  r?: number;
  vib?: VibratoSpec;
  arp?: ArpSpec;
  filter?: FilterSpec;
  pan?: number;
}

export interface DrumEvent {
  at: number;
  drum: DrumId;
  vel?: number;
  tune?: number;
  dur?: number;
}

export type SfxEvent = ToneEvent | DrumEvent;

export function isDrumEvent(e: SfxEvent): e is DrumEvent {
  return 'drum' in e;
}

export interface ComboSpec {
  /** Seconds. Another call inside this window moves one step up. */
  window: number;
  /** Semitones above the base pitch for each step of the streak. */
  steps: readonly number[];
}

export interface SfxBody {
  events?: readonly SfxEvent[];
  /** A short one shot song, for jingles. */
  song?: Song;
  /** Linear trim, part of the design. The calibrated dB trims in levels.ts sit on top of it. */
  gain?: number;
  /**
   * How loud this sound should be next to the family target of -14 LUFS, in dB.
   * A hover or a key tap is meant to sit well under a coin, so it asks for -8.
   * The calibrate tool turns this into a trim.
   */
  level?: number;
  /** Random pitch spread in cents per play, so repeats never sound robotic. */
  jitter?: number;
  /** Minimum seconds between two plays of this id. */
  cooldown?: number;
  combo?: ComboSpec;
}

/** Tone: a held note. */
export function tone(at: number, wave: WaveId, f: PitchSpec, dur: number, o: Partial<ToneEvent> = {}): ToneEvent {
  return { at, dur, wave, f, ...o };
}

/** Slide: a note that glides from one pitch to another over its length. */
export function slide(at: number, wave: WaveId, from: PitchSpec, to: PitchSpec, dur: number, o: Partial<ToneEvent> = {}): ToneEvent {
  return { at, dur, wave, f: from, to, slide: dur, ...o };
}

/** Noise burst. `clock` is the LFSR clock in Hz, 4000 is dark and 24000 is bright. */
export function noise(at: number, kind: NoiseId, clock: number, dur: number, o: Partial<ToneEvent> = {}): ToneEvent {
  return { at, dur, wave: kind, f: clock, ...o };
}

export function hit(at: number, drum: DrumId, vel = 1, o: Partial<DrumEvent> = {}): DrumEvent {
  return { at, drum, vel, ...o };
}

const DEFAULT_ENV = { a: 0.002, d: 0.08, s: 0.6, r: 0.05 } as const;

/** Turn a tone event into a voice. `rate` scales pitch up and time down, like tape speed. */
export function toneVoice(e: ToneEvent, t0: number, rate: number): VoiceSpec {
  const env: Adsr = {
    a: (e.a ?? DEFAULT_ENV.a) / rate,
    d: (e.d ?? DEFAULT_ENV.d) / rate,
    s: e.s ?? DEFAULT_ENV.s,
    r: (e.r ?? DEFAULT_ENV.r) / rate,
  };
  const hasSlide = e.to !== undefined;
  return {
    layers: e.layers ?? [{ wave: e.wave ?? 'p50' }],
    t: t0 + e.at / rate,
    dur: e.dur / rate,
    freq: toHz(e.f) * rate,
    slideTo: hasSlide ? toHz(e.to!) * rate : undefined,
    slideTime: hasSlide ? (e.slide ?? e.dur) / rate : undefined,
    vol: e.vol ?? 0.3,
    env,
    vib: e.vib ? { rate: e.vib.rate * rate, depth: e.vib.depth, delay: e.vib.delay / rate } : undefined,
    arp: e.arp ? { semis: e.arp.semis, rate: e.arp.rate * rate } : undefined,
    filter: e.filter,
    pan: e.pan,
  };
}

const DRUM_TAIL: Readonly<Record<DrumId, number>> = {
  kick: 0.35,
  snare: 0.25,
  hat: 0.08,
  ohat: 0.3,
  tom: 0.35,
  clap: 0.22,
  rim: 0.08,
  shaker: 0.12,
  crash: 1.4,
  cowbell: 0.3,
  riser: 0.1,
};

/** Rough length of a sound effect in seconds at rate 1, for buffers and tests. */
export function sfxDuration(body: SfxBody): number {
  if (body.song) return loopSeconds(body.song) + 0.8;
  let end = 0;
  for (const e of body.events ?? []) {
    if (isDrumEvent(e)) end = Math.max(end, e.at + (e.drum === 'riser' ? (e.dur ?? 1) : 0) + DRUM_TAIL[e.drum]);
    else end = Math.max(end, e.at + e.dur + (e.r ?? DEFAULT_ENV.r) + 0.02);
  }
  return end;
}
