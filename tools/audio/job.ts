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
import { barDuration, loopSeconds, type Song } from '../../src/audio/sequencer';
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
      /** Full passes through the song. Default 2: one to settle, one to measure. */
      loops?: number;
      /** Overrides loops. */
      seconds?: number;
      intensity?: number;
      tail?: number;
      events?: TimelineEvent[];
      /** Render only these layers (all switched on), to judge the balance of a mix. */
      solo?: string[];
    }
  | { kind: 'timeline'; seconds: number; events: TimelineEvent[] };

export interface RenderResult {
  sampleRate: number;
  left: Float32Array;
  right: Float32Array;
  seconds: number;
  /** Seconds of one pass through the song (music) or the nominal sfx length. */
  loopSeconds: number;
  /** 1 when the first render was clean; more means earlier ones lost pumps and were redone. */
  attempts: number;
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
    const seconds = job.seconds ?? (song.loop ? loopSec * (job.loops ?? 2) + (job.tail ?? 2) + 0.1 : loopSec + (job.tail ?? 4) + 0.1);
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

/** A copy of the song with only the named layers, all of them on. */
function soloSong(song: Song, layers: readonly string[]): Song {
  const missing = layers.filter((l) => !song.tracks.some((t) => t.id === l));
  if (missing.length > 0) throw new Error(`song ${song.id} has no layer ${missing.join(', ')}`);
  return { ...song, tracks: song.tracks.filter((t) => layers.includes(t.id)).map((t) => ({ ...t, at: 0, to: 1 })) };
}

/**
 * node-web-audio-api hands suspend() to a worker thread, so a suspend registered
 * "now" can land after the renderer has already passed its time. It then rejects
 * with InvalidStateError and that pump never runs. Measured on a fresh process:
 * 4 of 20 first renders lost 5 to 48 of 833 pumps; with a 5 ms yield between
 * registering and rendering, 0 of 20. Ten milliseconds keeps a margin.
 */
const REGISTRATION_SETTLE_MS = 10;
/** A pump may see the clock one quantum past its suspend time (binding rounds up); more means it ran late. */
const MAX_PUMP_LAG_QUANTA = 2;
/** A pump that is lost leaves a hole in the audio, so such a render is thrown away and redone. */
const MAX_ATTEMPTS = 8;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const describe = (e: unknown): string => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

interface Attempt {
  result: Omit<RenderResult, 'attempts'>;
  /** Everything that went wrong with the pump schedule. Empty means the render is trustworthy. */
  problems: string[];
}

async function renderAttempt(
  Ctor: OfflineCtor,
  job: RenderJob,
  plan: ReturnType<typeof planJob>,
  sampleRate: number,
  seed: number,
): Promise<Attempt> {
  const frames = Math.ceil(plan.seconds * sampleRate);
  const ctx = new Ctor(2, frames, sampleRate);
  const solo = job.kind === 'music' && job.solo ? { [job.id]: soloSong(SONGS[job.id]!, job.solo) } : undefined;
  const engine = new SoundEngine(ctx as unknown as AudioContext, ctx.destination, {
    manualClock: true,
    random: mulberry32(seed),
    songs: solo,
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

  const problems: string[] = [];
  const note = (msg: string): void => {
    if (problems.length < 6) problems.push(msg);
  };
  const maxLag = (MAX_PUMP_LAG_QUANTA * QUANTUM) / sampleRate + 1e-9;
  let expected = 0;
  let pumped = 0;

  const step = Math.max(Math.round((PUMP_STEP * sampleRate) / QUANTUM), 1) * QUANTUM;
  for (let f = step; f < frames; f += step) {
    const t = f / sampleRate;
    expected++;
    ctx
      .suspend(t)
      .then(
        () => {
          const lag = ctx.currentTime - t;
          if (lag > maxLag) note(`pump at ${t.toFixed(3)} s ran ${(lag * 1000).toFixed(1)} ms late`);
          pumped++;
          runDue(t);
          engine.pump();
          return ctx.resume();
        },
        (e: unknown) => note(`suspend(${t.toFixed(3)}) rejected, ${describe(e)}`),
      )
      .catch((e: unknown) => note(`pump at ${t.toFixed(3)} s threw, ${describe(e)}`));
  }

  await sleep(REGISTRATION_SETTLE_MS);
  const buffer = await ctx.startRendering();
  await sleep(2); // rejections arrive on their own tick
  engine.dispose();
  if (pumped !== expected) note(`${expected - pumped} of ${expected} pumps never ran`);

  const left = new Float32Array(buffer.getChannelData(0));
  const right = new Float32Array(buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0));
  return {
    result: { sampleRate, left, right, seconds: frames / sampleRate, loopSeconds: plan.loopSec, meta: plan.meta },
    problems,
  };
}

/**
 * Render one job. The engine is pumped from suspend() callbacks, so a lost or
 * late pump would silently punch a hole in the audio and shift the song. Every
 * attempt is audited and a bad one is redone; this never returns a tainted render.
 */
export async function renderJob(Ctor: OfflineCtor, job: RenderJob, sampleRate = 48000, seed = 1): Promise<RenderResult> {
  const plan = planJob(job);
  let last: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { result, problems } = await renderAttempt(Ctor, job, plan, sampleRate, seed);
    if (problems.length === 0) return { ...result, attempts: attempt };
    last = problems;
    console.warn(`render ${jobLabel(job)}: attempt ${attempt}/${MAX_ATTEMPTS} discarded (${problems[0]}${problems.length > 1 ? `, +${problems.length - 1} more` : ''})`);
  }
  throw new Error(`render ${jobLabel(job)} failed ${MAX_ATTEMPTS} attempts: ${last.join('; ')}`);
}

function jobLabel(job: RenderJob): string {
  return job.kind === 'timeline' ? 'timeline' : `${job.kind} ${job.id}`;
}
