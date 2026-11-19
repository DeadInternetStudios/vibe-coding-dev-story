import { Sequencer, type NoteEvent, type Song, type Track } from './sequencer';
import { playDrum } from './synth/drums';
import { INSTRUMENTS, noteVoice } from './synth/instruments';
import { midiToFreq } from './synth/notes';
import type { AudioCtx, SynthRuntime } from './synth/runtime';
import { playVoice } from './synth/voice';

/** Play one sequenced note (pitched or drum) on a track's input node. */
export function playNote(
  rt: SynthRuntime,
  track: Track,
  note: NoteEvent,
  time: number,
  durSec: number,
  dest: AudioNode,
  pitchMul = 1,
  essential = true,
): void {
  if (track.inst === 'drums') {
    if (note.drum) {
      playDrum(rt, note.drum, time, note.vel * track.vol, dest, { tune: (note.tune ?? 1) * pitchMul, dur: durSec });
    }
    return;
  }
  const voice = noteVoice(INSTRUMENTS[track.inst], midiToFreq(note.pitch) * pitchMul, time, durSec, note.vel * track.vol, note.arp, note.bend);
  playVoice(rt, voice, dest, essential);
}

export interface TrackNodes {
  /** Notes of this track connect here. Gain is the layer switch. */
  input: GainNode;
  nodes: AudioNode[];
}

export function createTrackNodes(ctx: AudioCtx, tracks: readonly Track[], dest: AudioNode, startOn: boolean): TrackNodes[] {
  return tracks.map((t) => {
    const input = ctx.createGain();
    input.gain.value = startOn ? 1 : 0;
    const nodes: AudioNode[] = [input];
    if (t.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = t.pan;
      input.connect(p);
      p.connect(dest);
      nodes.push(p);
    } else {
      input.connect(dest);
    }
    return { input, nodes };
  });
}

/** Seconds a layer takes to fade when it switches off at a bar line. */
const LAYER_FADE_TAU = 0.06;
/** A stinger is cleaned up this long after its last step. */
const END_TAIL = 3;

export interface PlayerOptions {
  intensity: number;
  tempoScale: number;
  /** Linear bus level (loudness trim for this song). */
  level: number;
  fadeInSec: number;
}

/**
 * One song on its own bus. Switching songs means a new player fades in while
 * the old one fades out, so each song can be torn down independently.
 */
export class MusicPlayer {
  readonly bus: GainNode;
  readonly seq: Sequencer;
  /** Context time after which this player can be thrown away. */
  disposeAt: number | null = null;
  private endedAt: number | null = null;
  private readonly tracks: TrackNodes[];
  private fadingOut = false;

  constructor(
    rt: SynthRuntime,
    readonly song: Song,
    dest: AudioNode,
    private readonly opts: PlayerOptions,
  ) {
    const ctx = rt.ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = opts.fadeInSec > 0 ? 0 : opts.level;
    this.bus.connect(dest);
    this.tracks = createTrackNodes(ctx, song.tracks, this.bus, false);
    this.seq = new Sequencer(
      song,
      {
        note: (i, n, time, dur) => playNote(rt, song.tracks[i]!, n, time, dur, this.tracks[i]!.input),
        layer: (i, on, time, immediate) => this.setLayer(i, on, time, immediate),
        end: (time) => {
          this.endedAt = time;
        },
      },
      { intensity: opts.intensity, tempoScale: opts.tempoScale },
    );
  }

  start(at: number): void {
    if (this.opts.fadeInSec > 0) {
      this.bus.gain.setValueAtTime(0, at);
      this.bus.gain.setTargetAtTime(this.opts.level, at, this.opts.fadeInSec / 3);
    }
    this.seq.start(at);
  }

  tick(now: number, lookahead: number): void {
    if (!this.fadingOut) this.seq.tick(now, lookahead);
  }

  /** True once a non looping song has finished and rung out. */
  isOver(now: number): boolean {
    return this.endedAt !== null && now > this.endedAt + END_TAIL;
  }

  get ended(): boolean {
    return this.endedAt !== null;
  }

  fadeOut(now: number, sec: number): void {
    this.fadingOut = true;
    this.seq.stop();
    const s = Math.max(sec, 0.02);
    this.bus.gain.setTargetAtTime(0, now, s / 3);
    this.disposeAt = now + s * 1.6 + 0.2;
  }

  dispose(): void {
    this.seq.stop();
    for (const t of this.tracks) {
      for (const n of t.nodes) {
        try {
          n.disconnect();
        } catch {
          /* gone */
        }
      }
    }
    try {
      this.bus.disconnect();
    } catch {
      /* gone */
    }
  }

  private setLayer(i: number, on: boolean, time: number, immediate: boolean): void {
    const g = this.tracks[i]!.input.gain;
    if (immediate) {
      g.setValueAtTime(on ? 1 : 0, time);
    } else if (on) {
      g.setValueAtTime(1, time);
    } else {
      g.setTargetAtTime(0, time, LAYER_FADE_TAU);
    }
  }
}
