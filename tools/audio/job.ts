/**
 * Offline render jobs. Used by the node renderer (node-web-audio-api) and by
 * the Chromium renderer, so both run exactly the same engine code.
 *
 * QUIET MACHINE: this only ever builds OfflineAudioContext. Never AudioContext.
 *
 * The engine runs in manual clock mode. We register an OfflineAudioContext
 * suspend every few milliseconds of audio time and pump the engine's scheduler
 * from there, which is what the live timer does, only deterministic.
 */
import { SoundEngine } from '../../src/audio/engine';
import type { MusicId, SfxId } from '../../src/audio/ids';
import { MUSIC_TRIM_DB, SFX_TRIM_DB } from '../../src/audio/levels';
import { SFX_DEFS } from '../../src/audio/sfx';
import { sfxDuration } from '../../src/audio/sfx/dsl';
import { barDuration, loopSeconds } from '../../src/audio/sequencer';
import { SONGS } from '../../src/audio/songs';
import { mulberry32 } from '../../src/audio/synth/notes';

export type TimelineAction =
  | { do: 'sfx'; id: SfxId; volume?: number; rate?: number; pan?: number }
  | { do: 'music'; id: MusicId; intensity?: number; fadeMs?: number }
  | { do: 'stopMusic'; fadeMs?: number }
  | { do: 'intensity'; value: number }
  | { do: 'tempo'; value: number }
  | { do: 'duck'; amount: number; ms: number }
  | { do: 'unduck'; ms: number }
  | { do: 'volumes'; master?: number; music?: number; sfx?: number }
  | { do: 'mute'; value: boolean };

export type TimelineEvent = { at: number } & TimelineAction;

export type RenderJob =
  | {
      kind: 'sfx';
      id: SfxId;
      volume?: number;
      rate?: number;
      pan?: number;
      /** Seconds of silence after the sound's nominal end. Default 0.35. */
      tail?: number;
    }
  | {
      kind: 'music';
      id: MusicId;
      /** Full passes through the song. Default 3. */
      loops?: number;
      /** Overrides loops. */
      seconds?: number;
      intensity?: number;
      tail?: number;
      events?: TimelineEvent[];
    }
  | { kind: 'timeline'; seconds: number; events: TimelineEvent[] };

export interface RenderResult {
  sampleRate: number;
  left: Float32Array;
  right: Float32Array;
  seconds: number;
  /** Seconds of one pass through the song (music) or the nominal sfx length. */
  loopSeconds: number;
  meta: Record<string, string | number | boolean | null>;
}

/** The slice of OfflineAudioContext the job needs, so both backends fit. */
export type OfflineCtor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;

const PUMP_STEP = 0.025;
/** Render quantum, frames. suspend() times snap to this. */
const QUANTUM = 128;

function applyAction(engine: SoundEngine, a: TimelineAction): void {
  switch (a.do) {
    case 'sfx':
      engine.sfx(a.id, { volume: a.volume, rate: a.rate, pan: a.pan });
      break;
    case 'music':
      engine.music(a.id, { intensity: a.intensity, fadeMs: a.fadeMs });
      break;
    case 'stopMusic':
      engine.stopMusic(a.fadeMs);
      break;
    case 'intensity':
      engine.setIntensity(a.value);
      break;
    case 'tempo':
      engine.setTempoScale(a.value);
      break;
    case 'duck':
      engine.duck(a.amount, a.ms);
      break;
    case 'unduck':
      engine.unduck(a.ms);
      break;
    case 'volumes':
      engine.setVolumes({ master: a.master ?? 1, music: a.music ?? 1, sfx: a.sfx ?? 1 });
      break;
    case 'mute':
      engine.setMuted(a.value);
      break;
  }
}

function planJob(job: RenderJob): { seconds: number; loopSec: number; events: TimelineEvent[]; meta: RenderResult['meta'] } {
  if (job.kind === 'sfx') {
    const body = SFX_DEFS[job.id];
    const rate = job.rate ?? 1;
    const nominal = sfxDuration(body) / rate;
    return {
      seconds: nominal + 0.1 + (job.tail ?? 0.35),
      loopSec: nominal,
      events: [{ at: 0, do: 'sfx', id: job.id, volume: job.volume, rate: job.rate, pan: job.pan }],
      meta: { kind: 'sfx', id: job.id, rate, level: body.level ?? 0, trimDb: SFX_TRIM_DB[job.id] ?? 0 },
    };
  }
  if (job.kind === 'music') {
    const song = SONGS[job.id];
    if (!song) throw new Error(`no song for ${job.id}`);
    const loopSec = loopSeconds(song);
    const seconds = job.seconds ?? (song.loop ? loopSec * (job.loops ?? 3) + (job.tail ?? 2) + 0.1 : loopSec + (job.tail ?? 4) + 0.1);
    const events: TimelineEvent[] = [
      { at: 0, do: 'music', id: job.id, intensity: job.intensity, fadeMs: 0 },
      ...(job.events ?? []),
    ];
    return {
      seconds,
      loopSec,
      events,
      meta: {
        kind: 'music',
        id: job.id,
        bpm: song.bpm,
        key: song.key,
        bars: song.bars,
        barSeconds: barDuration(song),
        loop: song.loop,
        intensity: job.intensity ?? song.defaultIntensity,
        swing: song.swing,
        trimDb: MUSIC_TRIM_DB[job.id] ?? 0,
      },
    };
  }
  return { seconds: job.seconds, loopSec: job.seconds, events: job.events, meta: { kind: 'timeline' } };
}

export async function renderJob(Ctor: OfflineCtor, job: RenderJob, sampleRate = 48000, seed = 1): Promise<RenderResult> {
  const plan = planJob(job);
  const frames = Math.ceil(plan.seconds * sampleRate);
  const ctx = new Ctor(2, frames, sampleRate);
  const engine = new SoundEngine(ctx as unknown as AudioContext, ctx.destination, {
    manualClock: true,
    random: mulberry32(seed),
  });

  const events = plan.events.slice().sort((a, b) => a.at - b.at);
  let next = 0;
  const runDue = (t: number): void => {
    while (next < events.length && events[next]!.at <= t + 1e-6) {
      applyAction(engine, events[next]!);
      next++;
    }
  };

  // time zero happens before rendering starts
  runDue(0);
  engine.pump();

  const step = Math.max(Math.round((PUMP_STEP * sampleRate) / QUANTUM), 1) * QUANTUM;
  for (let f = step; f < frames; f += step) {
    const t = f / sampleRate;
    ctx
      .suspend(t)
      .then(() => {
        runDue(t);
        engine.pump();
        return ctx.resume();
      })
      .catch(() => undefined);
  }

  const buffer = await ctx.startRendering();
  engine.dispose();
  const left = new Float32Array(buffer.getChannelData(0));
  const right = new Float32Array(buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0));
  return { sampleRate, left, right, seconds: frames / sampleRate, loopSeconds: plan.loopSec, meta: plan.meta };
}
