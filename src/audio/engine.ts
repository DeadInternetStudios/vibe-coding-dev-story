import { MUSIC_IDS, MUSIC_LABELS, SFX_CATALOG, type MusicId, type SfxId } from './ids';
import { SFX_TRIM_DB, MUSIC_TRIM_DB } from './levels';
import { MusicPlayer, createTrackNodes, playNote } from './player';
import { SFX_DEFS } from './sfx';
import { isDrumEvent, sfxDuration, toneVoice, type SfxBody } from './sfx/dsl';
import { stepDuration, swingOffset, type Song } from './sequencer';
import { SONGS } from './songs';
import { playDrum } from './synth/drums';
import { createMasterChain, volumeToGain, type MasterChain } from './synth/master';
import { centsToRatio, clamp, clamp01, dbToGain, semitoneRatio } from './synth/notes';
import { createRuntime, type AudioCtx, type SynthRuntime } from './synth/runtime';
import { playVoice } from './synth/voice';

export type { MusicId, SfxId };

export interface SfxOpts {
  /** Linear volume multiplier, default 1. */
  volume?: number;
  /** Playback rate: pitch up and time down together, default 1. */
  rate?: number;
  /** -1 (left) to 1 (right). */
  pan?: number;
}

export interface MusicOpts {
  /** Crossfade time. Default 500 over another song, 150 from silence. */
  fadeMs?: number;
  /** 0..1. Defaults to the song's own default intensity. */
  intensity?: number;
}

export interface Volumes {
  master: number;
  music: number;
  sfx: number;
}

export interface EngineOptions {
  /**
   * Offline rendering and tests: do not use a timer or wait for the context to
   * run. The caller drives time by calling `pump()` whenever the context clock
   * has moved (for example from OfflineAudioContext.suspend callbacks).
   */
  manualClock?: boolean;
  /** Random source, swapped for a seeded one when rendering. */
  random?: () => number;
  maxVoices?: number;
  /** Songs to use instead of the built in ones. For tools and tests, for example to solo one layer. */
  songs?: Readonly<Partial<Record<MusicId, Song>>>;
}

/** How far ahead of the clock notes get scheduled, seconds. */
export const LOOKAHEAD = 0.2;
/** How often the scheduler wakes up, milliseconds. */
export const TICK_MS = 25;
/**
 * Nominal level of the music bus. Layers are gained like sound effects (a lone
 * note peaks around 0.3), so a full mix runs hot. This puts the nominal song
 * near -18 LUFS and leaves the per song trims in levels.ts small.
 */
export const MUSIC_BASE_DB = -6;
/** First notes land this long after the call so the graph is ready. */
const START_DELAY = 0.06;
/** Longest `resume()` waits for the browser. Autoplay policy can leave the promise pending for ever. */
const RESUME_WAIT_MS = 1000;

/** Run `start`, and resolve when its promise settles or after `ms`, whichever comes first. Never rejects. */
function settleWithin(start: () => Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    const done = (): void => {
      clearTimeout(timer);
      resolve();
    };
    try {
      start().then(done, done);
    } catch {
      done();
    }
  });
}

/**
 * The game's whole sound system. Everything here is safe to call at any time:
 * before the context runs, hundreds of times in a row, with bad ids. Nothing
 * throws.
 */
export class SoundEngine {
  static readonly SFX: readonly { id: SfxId; label: string; family: string }[] = SFX_CATALOG.map(([id, label, family]) => ({
    id,
    label,
    family,
  }));

  static readonly MUSIC: readonly { id: MusicId; label: string; layers: string[] }[] = MUSIC_IDS.map((id) => ({
    id,
    label: MUSIC_LABELS[id],
    layers: (SONGS[id]?.tracks ?? []).map((t) => t.id),
  }));

  private readonly ctx: AudioCtx;
  private readonly manual: boolean;
  private readonly songs: Readonly<Partial<Record<MusicId, Song>>>;
  private rt!: SynthRuntime;
  private chain!: MasterChain;
  private dead = false;

  private volumes: Volumes = { master: 1, music: 1, sfx: 1 };
  private muted = false;
  private intensity = 1;
  private tempoScale = 1;

  private players: MusicPlayer[] = [];
  private current: MusicPlayer | null = null;
  private pending: { id: MusicId; opts?: MusicOpts } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  private readonly lastPlayed = new Map<SfxId, number>();
  private readonly combos = new Map<SfxId, { t: number; n: number }>();
  private readonly onState = (): void => {
    if (this.ctx.state === 'running') {
      this.flushPending();
      this.ensureTimer();
    }
  };

  constructor(ctx: AudioContext, out: AudioNode, opts?: EngineOptions) {
    this.ctx = ctx;
    this.manual = opts?.manualClock ?? false;
    this.songs = opts?.songs ?? SONGS;
    try {
      this.rt = createRuntime(ctx, {
        maxVoices: opts?.maxVoices,
        rand: opts?.random,
      });
      this.chain = createMasterChain(ctx, out);
      this.applyVolumes(true);
      if (!this.manual) ctx.addEventListener?.('statechange', this.onState);
    } catch {
      this.dead = true;
    }
  }

  // ---------------------------------------------------------------- context

  /**
   * Call from a user gesture (a click or key press). Always resolves, within
   * about a second, whether or not the browser allowed audio to start. If it
   * did not, the next gesture can call this again, and a late start is picked up
   * by the context's statechange event.
   */
  async resume(): Promise<void> {
    if (this.dead) return;
    if (!this.manual && this.ctx.state !== 'running') await settleWithin(() => (this.ctx as AudioContext).resume(), RESUME_WAIT_MS);
    try {
      if (this.ready()) {
        this.flushPending();
        this.ensureTimer();
      }
    } catch {
      /* never throw */
    }
  }

  // ------------------------------------------------------------------ mixer

  setVolumes(v: Partial<Volumes>): void {
    if (this.dead) return;
    try {
      this.volumes = {
        master: clamp01(v.master ?? this.volumes.master),
        music: clamp01(v.music ?? this.volumes.music),
        sfx: clamp01(v.sfx ?? this.volumes.sfx),
      };
      this.applyVolumes(false);
    } catch {
      /* never throw */
    }
  }

  setMuted(m: boolean): void {
    if (this.dead) return;
    try {
      this.muted = !!m;
      this.chain.mute.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.015);
    } catch {
      /* never throw */
    }
  }

  // -------------------------------------------------------------------- sfx

  sfx(id: SfxId, opts?: SfxOpts): void {
    try {
      this.playSfx(id, opts);
    } catch {
      /* a broken sound must never break the game */
    }
  }

  // ------------------------------------------------------------------ music

  music(id: MusicId, opts?: MusicOpts): void {
    try {
      this.startMusic(id, opts);
    } catch {
      /* never throw */
    }
  }

  stopMusic(fadeMs = 400): void {
    try {
      this.pending = null;
      if (this.current && this.ready()) {
        this.current.fadeOut(this.ctx.currentTime, fadeMs / 1000);
      }
      this.current = null;
    } catch {
      /* never throw */
    }
  }

  /** 0..1. Layers fade in and out at the next bar line. */
  setIntensity(n: number): void {
    try {
      this.intensity = clamp01(Number.isFinite(n) ? n : 0);
      this.current?.seq.setIntensity(this.intensity);
    } catch {
      /* never throw */
    }
  }

  /** Playback speed of the music, 0.5 to 2. Stays set until you change it. */
  setTempoScale(n: number): void {
    try {
      this.tempoScale = clamp(Number.isFinite(n) ? n : 1, 0.5, 2);
      for (const p of this.players) p.seq.setTempoScale(this.tempoScale);
    } catch {
      /* never throw */
    }
  }

  /** Lower the music while a voice line plays. `amount` 0..1 is how much to cut, `ms` how fast. */
  duck(amount: number, ms: number): void {
    try {
      const level = 1 - clamp01(Number.isFinite(amount) ? amount : 0.5);
      this.chain.musicDuck.gain.setTargetAtTime(level, this.ctx.currentTime, Math.max(ms, 1) / 3000);
    } catch {
      /* never throw */
    }
  }

  unduck(ms: number): void {
    try {
      this.chain.musicDuck.gain.setTargetAtTime(1, this.ctx.currentTime, Math.max(ms, 1) / 3000);
    } catch {
      /* never throw */
    }
  }

  currentMusic(): MusicId | null {
    if (this.current && !this.current.ended) return this.current.song.id as MusicId;
    return this.pending?.id ?? null;
  }

  // ----------------------------------------------------------- extras (safe)

  /** Run the scheduler once. Only offline renders and tests call this. */
  pump(): void {
    this.tick();
  }

  /** Tear everything down. The engine is inert afterwards. */
  dispose(): void {
    try {
      this.stopTimer();
      for (const p of this.players) p.dispose();
      this.players = [];
      this.current = null;
      this.pending = null;
      this.rt.sweep(Infinity);
      if (!this.manual) this.ctx.removeEventListener?.('statechange', this.onState);
      this.chain.dispose();
    } catch {
      /* never throw */
    }
    this.dead = true;
  }

  // ------------------------------------------------------------- internals

  private ready(): boolean {
    return !this.dead && (this.manual || this.ctx.state === 'running');
  }

  private applyVolumes(initial: boolean): void {
    const now = this.ctx.currentTime;
    const set = (p: AudioParam, v: number) => {
      if (initial) p.value = v;
      else p.setTargetAtTime(v, now, 0.02);
    };
    set(this.chain.master.gain, volumeToGain(this.volumes.master));
    set(this.chain.musicVol.gain, volumeToGain(this.volumes.music));
    set(this.chain.sfxVol.gain, volumeToGain(this.volumes.sfx));
  }

  private flushPending(): void {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    this.startMusic(p.id, p.opts);
  }

  private playSfx(id: SfxId, opts?: SfxOpts): void {
    if (!this.ready() || this.muted) return;
    const def: SfxBody | undefined = SFX_DEFS[id];
    if (!def) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const last = this.lastPlayed.get(id);
    if (last !== undefined && now >= last && now - last < (def.cooldown ?? 0.02)) return;
    this.lastPlayed.set(id, now);

    let rate = clamp(Number.isFinite(opts?.rate ?? 1) ? (opts?.rate ?? 1) : 1, 0.25, 4);
    if (def.jitter) rate *= centsToRatio((this.rt.rand() * 2 - 1) * def.jitter);
    if (def.combo) {
      const c = this.combos.get(id);
      const n = c && now - c.t < def.combo.window ? Math.min(c.n + 1, def.combo.steps.length - 1) : 0;
      this.combos.set(id, { t: now, n });
      rate *= semitoneRatio(def.combo.steps[n]!);
    }

    const volume = clamp(Number.isFinite(opts?.volume ?? 1) ? (opts?.volume ?? 1) : 1, 0, 2);
    const trim = dbToGain(SFX_TRIM_DB[id] ?? 0) * (def.gain ?? 1);
    const pan = clamp(Number.isFinite(opts?.pan ?? 0) ? (opts?.pan ?? 0) : 0, -1, 1);

    const nodes: AudioNode[] = [];
    const sink = ctx.createGain();
    sink.gain.value = volume * trim;
    nodes.push(sink);
    if (pan !== 0) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      sink.connect(p);
      p.connect(this.chain.sfxVol);
      nodes.push(p);
    } else {
      sink.connect(this.chain.sfxVol);
    }

    const t0 = now + 0.004;
    if (def.song) this.playJingle(def.song, t0, rate, sink, nodes);
    else this.playEvents(def, t0, rate, sink);

    this.rt.retire(nodes, now + sfxDuration(def) / rate + 1);
    this.ensureTimer();
  }

  private playEvents(def: SfxBody, t0: number, rate: number, dest: AudioNode): void {
    for (const e of def.events ?? []) {
      if (isDrumEvent(e)) {
        playDrum(this.rt, e.drum, t0 + e.at / rate, e.vel ?? 1, dest, {
          tune: (e.tune ?? 1) * rate,
          dur: e.dur !== undefined ? e.dur / rate : undefined,
        });
      } else {
        playVoice(this.rt, toneVoice(e, t0, rate), dest, false);
      }
    }
  }

  /** A short non looping song played all at once, for fanfares. */
  private playJingle(song: Song, t0: number, rate: number, dest: AudioNode, nodes: AudioNode[]): void {
    const stepSec = stepDuration(song.bpm, song.stepsPerBeat) / rate;
    const tracks = createTrackNodes(this.ctx, song.tracks, dest, true);
    for (const t of tracks) nodes.push(...t.nodes);
    song.tracks.forEach((track, i) => {
      for (const n of track.notes) {
        const local = n.step % song.stepsPerBar;
        const time = t0 + n.step * stepSec + swingOffset(local, song.stepsPerBeat, song.swing, stepSec);
        playNote(this.rt, track, n, time, n.dur * stepSec, tracks[i]!.input, rate, false);
      }
    });
  }

  private startMusic(id: MusicId, opts?: MusicOpts): void {
    if (this.dead) return;
    const song = this.songs[id];
    if (!song) return;
    if (!this.ready()) {
      this.pending = { id, opts };
      return;
    }
    this.pending = null;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    if (this.current && this.current.song.id === id && !this.current.ended) {
      if (opts?.intensity !== undefined) this.setIntensity(opts.intensity);
      return;
    }

    const hadMusic = this.current !== null;
    const fadeMs = Math.max(opts?.fadeMs ?? (hadMusic ? 500 : 150), 0);
    if (this.current) this.current.fadeOut(now, fadeMs / 1000);

    this.intensity = clamp01(opts?.intensity ?? song.defaultIntensity);
    const player = new MusicPlayer(this.rt, song, this.chain.musicDuck, {
      intensity: this.intensity,
      tempoScale: this.tempoScale,
      level: dbToGain(MUSIC_BASE_DB + (MUSIC_TRIM_DB[id] ?? 0)),
      fadeInSec: fadeMs / 1000,
    });
    player.start(now + START_DELAY);
    this.players.push(player);
    this.current = player;
    this.ensureTimer();
    this.tick();
  }

  private readonly tick = (): void => {
    try {
      if (!this.ready()) return;
      const now = this.ctx.currentTime;
      for (const p of this.players) p.tick(now, LOOKAHEAD);

      let keep = 0;
      for (const p of this.players) {
        const gone = (p.disposeAt !== null && now >= p.disposeAt) || p.isOver(now);
        if (gone) {
          p.dispose();
          if (this.current === p) this.current = null;
        } else {
          this.players[keep++] = p;
        }
      }
      this.players.length = keep;

      this.rt.sweep(now);
      if (this.players.length === 0 && this.rt.waiting === 0) this.stopTimer();
    } catch {
      /* the scheduler must survive anything */
    }
  };

  private ensureTimer(): void {
    if (this.manual || this.timer !== null || this.dead) return;
    const t = setInterval(this.tick, TICK_MS);
    (t as unknown as { unref?: () => void }).unref?.();
    this.timer = t;
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
