/**
 * Sound for the whole game: the chiptune engine for effects and music, and a
 * small player for the voiced lines. Everything here fails quietly. No audio,
 * no manifest, a missing line: the game goes on and the text still shows.
 */
import { SoundEngine, type MusicId, type SfxId, type SfxOpts } from '../audio';
import type { VoiceLine } from '../content/vo';
import { app } from './app';

interface ManifestLine {
  voice: string;
  text: string;
  file: string;
  dur: number;
  env: string;
  words?: [number, number][];
}

interface Manifest {
  lines: Record<string, ManifestLine>;
}

export interface VoiceHandle {
  line: VoiceLine;
  /** seconds, real if the clip exists, a guess from the word count if not */
  dur: number;
  /** is there real audio behind this */
  real: boolean;
  /** seconds since it started */
  elapsed(): number;
  /** 0 to 1, how loud the clip is right now, for mouths and bubbles */
  level(): number;
  /** index of the word being spoken, or -1 */
  word(): number;
  stop(): void;
  done: Promise<void>;
}

const WORDS_PER_SEC = 4.2;

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

class AudioHub {
  private ctx: AudioContext | null = null;
  private engine: SoundEngine | null = null;
  private voiceGain: GainNode | null = null;
  private manifest: Manifest | null = null;
  private manifestLoading: Promise<void> | null = null;
  private buffers = new Map<string, AudioBuffer | null>();
  private active: { stop: () => void } | null = null;
  private unlocked = false;
  private wantMusic: MusicId | null = null;
  private base = '';

  /** Create the context. Safe to call many times. Nothing plays until a gesture unlocks it. */
  init(): void {
    if (this.ctx) return;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.engine = new SoundEngine(this.ctx, this.ctx.destination);
      this.voiceGain = this.ctx.createGain();
      this.voiceGain.connect(this.ctx.destination);
      this.base = import.meta.env.BASE_URL ?? '/';
      this.applySettings();
      document.addEventListener('visibilitychange', () => this.followTab());
    } catch {
      this.ctx = null;
      this.engine = null;
    }
  }

  /** Call from any user gesture. */
  unlock(): void {
    this.init();
    if (!this.engine) return;
    void this.engine.resume().then(() => {
      this.unlocked = true;
      if (this.wantMusic) this.engine?.music(this.wantMusic);
    });
    void this.ctx?.resume();
  }

  /** For the test driver: what the sound system is doing right now. */
  status(): { ctx: string; unlocked: boolean; music: MusicId | null } {
    return { ctx: this.ctx?.state ?? 'none', unlocked: this.unlocked, music: this.engine?.currentMusic() ?? null };
  }

  /** A hidden tab goes quiet and picks up where it left off: the music is not left looping behind another page. */
  private followTab(): void {
    if (!this.ctx || !this.unlocked) return;
    void (document.hidden ? this.ctx.suspend() : this.ctx.resume());
  }

  applySettings(): void {
    const s = app.settings;
    this.engine?.setVolumes({ master: s.volMaster, music: s.volMusic, sfx: s.volSfx });
    this.engine?.setMuted(s.muted);
    if (this.voiceGain && this.ctx) this.voiceGain.gain.setTargetAtTime(s.muted ? 0 : s.volVoice * s.volMaster, this.ctx.currentTime, 0.02);
  }

  sfx(id: SfxId, opts?: SfxOpts): void {
    this.engine?.sfx(id, opts);
  }

  music(id: MusicId | null, opts?: { fadeMs?: number; intensity?: number }): void {
    if (id === null) {
      this.wantMusic = null;
      this.engine?.stopMusic(opts?.fadeMs ?? 400);
      return;
    }
    this.wantMusic = id;
    if (this.engine?.currentMusic() === id) return;
    this.engine?.music(id, opts);
  }

  intensity(n: number): void {
    this.engine?.setIntensity(n);
  }

  tempo(n: number): void {
    this.engine?.setTempoScale(n);
  }

  private async loadManifest(): Promise<void> {
    if (this.manifest) return;
    this.manifestLoading ??= (async () => {
      try {
        const res = await fetch(`${this.base}audio/vo/manifest.json`);
        if (res.ok) this.manifest = (await res.json()) as Manifest;
      } catch {
        /* no voices yet */
      }
      this.manifest ??= { lines: {} };
    })();
    await this.manifestLoading;
  }

  /** Is there a recorded clip for this line. Needs the manifest loaded. */
  has(line: VoiceLine): boolean {
    return !!this.manifest?.lines[line.id];
  }

  /** Fetch the manifest and clips ahead of time so the first line does not stutter. */
  async preload(lines: readonly VoiceLine[]): Promise<void> {
    await this.loadManifest();
    await Promise.all(lines.map((l) => this.buffer(l)));
  }

  private async buffer(line: VoiceLine): Promise<AudioBuffer | null> {
    if (this.buffers.has(line.id)) return this.buffers.get(line.id) ?? null;
    const m = this.manifest?.lines[line.id];
    if (!m || !this.ctx) {
      this.buffers.set(line.id, null);
      return null;
    }
    try {
      const res = await fetch(`${this.base}audio/vo/${m.file}`);
      if (!res.ok) throw new Error('missing');
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this.buffers.set(line.id, buf);
      if (this.buffers.size > 60) {
        const first = this.buffers.keys().next().value;
        if (first !== undefined) this.buffers.delete(first);
      }
      return buf;
    } catch {
      this.buffers.set(line.id, null);
      return null;
    }
  }

  stopVoice(): void {
    this.active?.stop();
    this.active = null;
  }

  /**
   * Say a line. Always returns a handle: with real audio when the clip exists,
   * and a silent timer shaped like speech when it does not, so scenes can pace
   * themselves the same way either way.
   */
  async voice(line: VoiceLine): Promise<VoiceHandle> {
    await this.loadManifest();
    this.stopVoice();
    const m = this.manifest?.lines[line.id];
    const ctx = this.ctx;
    const guess = Math.max(1.2, wordCount(line.text) / WORDS_PER_SEC);
    let resolve!: () => void;
    const done = new Promise<void>((r) => (resolve = r));
    const t0 = performance.now();
    let src: AudioBufferSourceNode | null = null;
    let stopped = false;
    let buf: AudioBuffer | null = null;
    if (m && ctx && this.unlocked && !app.settings.muted && app.settings.volVoice > 0) buf = await this.buffer(line);
    const real = !!buf;
    const dur = real ? buf!.duration : guess;
    const startedAt = performance.now();
    void t0;
    const finish = () => {
      if (stopped) return;
      stopped = true;
      this.engine?.unduck(350);
      if (this.active === handleStop) this.active = null;
      resolve();
    };
    if (buf && ctx && this.voiceGain) {
      src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.voiceGain);
      src.onended = finish;
      this.engine?.duck(0.5, 120);
      src.start();
    } else {
      window.setTimeout(finish, dur * 1000);
    }
    const handleStop = {
      stop: () => {
        try {
          src?.stop();
        } catch {
          /* already stopped */
        }
        finish();
      },
    };
    this.active = handleStop;
    const env = m?.env ?? '';
    const words = m?.words;
    const nWords = wordCount(line.text);
    const elapsed = () => (performance.now() - startedAt) / 1000;
    return {
      line,
      dur,
      real,
      elapsed,
      level: () => {
        if (stopped) return 0;
        if (!env) return 0.35 + 0.35 * Math.abs(Math.sin(elapsed() * 11));
        const i = Math.floor(elapsed() * 20);
        const c = env[i];
        return c ? parseInt(c, 16) / 15 : 0;
      },
      word: () => {
        const t = elapsed();
        if (t > dur) return nWords - 1;
        if (words && words.length) {
          for (let i = 0; i < words.length; i++) if (t < words[i]![1]) return t >= words[i]![0] ? i : Math.max(0, i - 1);
          return words.length - 1;
        }
        return Math.min(nWords - 1, Math.floor((t / dur) * nWords));
      },
      stop: handleStop.stop,
      done,
    };
  }
}

export const audio = new AudioHub();
