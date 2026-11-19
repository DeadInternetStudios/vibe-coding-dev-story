import { WaveBank } from './waves';

/** Live or offline. The engine only needs what both share. */
export type AudioCtx = AudioContext | OfflineAudioContext;

/**
 * Tracks how many voices overlap in time so a flood of calls cannot melt the
 * audio thread. Polyphony is measured at each new voice's start time, so a long
 * jingle scheduled in one go does not count against itself.
 */
export class VoicePool {
  private starts: number[] = [];
  private ends: number[] = [];

  constructor(readonly max: number) {}

  /** Drop voices that are over. In place, no allocation. */
  prune(now: number): void {
    let w = 0;
    for (let r = 0; r < this.ends.length; r++) {
      if (this.ends[r]! > now) {
        this.starts[w] = this.starts[r]!;
        this.ends[w] = this.ends[r]!;
        w++;
      }
    }
    this.starts.length = w;
    this.ends.length = w;
  }

  polyphony(at: number): number {
    let n = 0;
    for (let i = 0; i < this.starts.length; i++) {
      if (this.starts[i]! <= at && this.ends[i]! > at) n++;
    }
    return n;
  }

  /** Essential voices (music) always get in. Others are refused when the pool is full. */
  tryAdd(now: number, start: number, end: number, essential: boolean): boolean {
    this.prune(now);
    if (!essential && this.polyphony(start) >= this.max) return false;
    this.starts.push(start);
    this.ends.push(end);
    return true;
  }

  get size(): number {
    return this.starts.length;
  }

  clear(): void {
    this.starts.length = 0;
    this.ends.length = 0;
  }
}

export interface SynthRuntime {
  readonly ctx: AudioCtx;
  readonly bank: WaveBank;
  readonly pool: VoicePool;
  /** Random source in [0,1). Swapped for a seeded one when rendering. */
  rand: () => number;
  /**
   * Hand over the nodes of a finished or soon to be finished sound. They are
   * disconnected once the context clock passes `at`. Dead nodes left in the
   * graph cost time on every render quantum, which adds up fast in a long song.
   */
  retire(nodes: readonly AudioNode[], at: number): void;
  /** Disconnect everything whose time has come. The engine calls this from its tick. */
  sweep(now: number): void;
  /** How many sounds are waiting to be disconnected. */
  readonly waiting: number;
}

export function createRuntime(ctx: AudioCtx, opts?: { maxVoices?: number; rand?: () => number }): SynthRuntime {
  let graveyard: Array<{ at: number; nodes: readonly AudioNode[] }> = [];
  return {
    ctx,
    bank: new WaveBank(ctx),
    pool: new VoicePool(opts?.maxVoices ?? 44),
    rand: opts?.rand ?? Math.random,
    retire(nodes, at) {
      graveyard.push({ at, nodes });
    },
    sweep(now) {
      if (graveyard.length === 0) return;
      const keep: typeof graveyard = [];
      for (const g of graveyard) {
        if (g.at > now) {
          keep.push(g);
          continue;
        }
        for (const n of g.nodes) {
          try {
            n.disconnect();
          } catch {
            /* already gone */
          }
        }
      }
      graveyard = keep;
    },
    get waiting() {
      return graveyard.length;
    },
  };
}
