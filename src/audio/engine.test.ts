import { OfflineAudioContext } from 'node-web-audio-api';
import { describe, expect, it, vi } from 'vitest';
import { renderJob, type OfflineCtor, type RenderJob, type RenderResult, type TimelineEvent } from '../../tools/audio/job';
import { SoundEngine } from './engine';
import { SFX_IDS, type MusicId, type SfxId } from './ids';
import { PEAK_LIMIT } from './synth/master';
import { mulberry32 } from './synth/notes';

// QUIET MACHINE: tests only ever build OfflineAudioContext, never AudioContext.
const Ctor = OfflineAudioContext as unknown as OfflineCtor;
const render = (job: RenderJob, seed = 1): Promise<RenderResult> => renderJob(Ctor, job, 48000, seed);

function peakOf(r: RenderResult, from = 0, to = r.seconds): number {
  let p = 0;
  const a = Math.floor(from * r.sampleRate);
  const b = Math.min(Math.floor(to * r.sampleRate), r.left.length);
  for (let i = a; i < b; i++) p = Math.max(p, Math.abs(r.left[i]!), Math.abs(r.right[i]!));
  return p;
}

function rmsOf(r: RenderResult, from: number, to: number): number {
  const a = Math.floor(from * r.sampleRate);
  const b = Math.min(Math.floor(to * r.sampleRate), r.left.length);
  let s = 0;
  for (let i = a; i < b; i++) s += r.left[i]! * r.left[i]!;
  return Math.sqrt(s / Math.max(b - a, 1));
}

/** First and last time the signal is above a threshold. */
function activeSpan(r: RenderResult, thresh = 1e-3): { first: number; last: number } {
  let first = -1;
  let last = -1;
  for (let i = 0; i < r.left.length; i++) {
    if (Math.abs(r.left[i]!) > thresh || Math.abs(r.right[i]!) > thresh) {
      if (first < 0) first = i;
      last = i;
    }
  }
  return { first: first / r.sampleRate, last: last / r.sampleRate };
}

function finite(r: RenderResult): boolean {
  for (let i = 0; i < r.left.length; i++) if (!Number.isFinite(r.left[i]!) || !Number.isFinite(r.right[i]!)) return false;
  return true;
}

const timeline = (seconds: number, events: TimelineEvent[]): RenderJob => ({ kind: 'timeline', seconds, events });

describe('SoundEngine before the context is running', () => {
  it('drops or queues quietly and never throws, whatever it is asked', () => {
    // An offline context is "suspended" until rendering starts, like a browser context before a click.
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const engine = new SoundEngine(ctx as unknown as AudioContext, ctx.destination);
    expect(() => {
      engine.sfx('click');
      engine.sfx('coin', { volume: Number.NaN, rate: -3, pan: 99 });
      engine.sfx('definitely_not_a_sound' as SfxId);
      engine.music('title');
      engine.music('definitely_not_music' as MusicId, { fadeMs: -1, intensity: Number.NaN });
      engine.setIntensity(Number.NaN);
      engine.setTempoScale(Number.NaN);
      engine.duck(Number.NaN, Number.NaN);
      engine.unduck(-5);
      engine.setVolumes({ master: Number.NaN, music: 7, sfx: -2 });
      engine.setMuted(true);
      engine.stopMusic(-10);
    }).not.toThrow();
    expect(engine.currentMusic() === null || typeof engine.currentMusic() === 'string').toBe(true);
    engine.dispose();
  });

  it('resume() resolves even when the browser leaves the promise pending for ever', async () => {
    vi.useFakeTimers();
    try {
      const ctx = new OfflineAudioContext(2, 48000, 48000);
      (ctx as unknown as { resume: () => Promise<void> }).resume = () => new Promise<void>(() => undefined);
      const engine = new SoundEngine(ctx as unknown as AudioContext, ctx.destination);
      const done = engine.resume();
      await vi.advanceTimersByTimeAsync(1500);
      await expect(done).resolves.toBeUndefined();
      engine.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('resume() resolves when the browser refuses, and when resume throws outright', async () => {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const hooks = ctx as unknown as { resume: () => Promise<void> };
    const engine = new SoundEngine(ctx as unknown as AudioContext, ctx.destination);
    hooks.resume = () => Promise.reject(new Error('NotAllowedError'));
    await expect(engine.resume()).resolves.toBeUndefined();
    hooks.resume = () => {
      throw new Error('InvalidStateError');
    };
    await expect(engine.resume()).resolves.toBeUndefined();
    engine.dispose();
  });

  it('is inert but safe after dispose', () => {
    const ctx = new OfflineAudioContext(2, 4800, 48000);
    const engine = new SoundEngine(ctx as unknown as AudioContext, ctx.destination, { manualClock: true });
    engine.dispose();
    expect(() => {
      engine.sfx('click');
      engine.music('office');
      engine.duck(0.5, 100);
      engine.setMuted(false);
      engine.dispose();
    }).not.toThrow();
  });
});

describe('every sound effect, rendered offline through the real engine', () => {
  it.each([...SFX_IDS])('%s is audible, finite, under -3 dBFS, ends cleanly and has no DC', async (id) => {
    const r = await render({ kind: 'sfx', id });
    expect(finite(r)).toBe(true);
    const peak = peakOf(r);
    expect(peak).toBeGreaterThan(0.01);
    expect(peak).toBeLessThanOrEqual(PEAK_LIMIT);
    // nothing left hanging at the end of the render window
    expect(rmsOf(r, r.seconds - 0.05, r.seconds)).toBeLessThan(1e-3);
    // DC check. A decaying sub 100 Hz thump never completes its last cycle, so it
    // averages to about 1% of its rms: that is residue, not DC. A real DC bug (a
    // pulse table with a nonzero mean, say) averages to tens of percent.
    let mean = 0;
    for (const v of r.left) mean += v;
    mean /= r.left.length;
    const allowed = Math.min(0.01, Math.max(0.002, 0.02 * rmsOf(r, 0, r.seconds)));
    expect(Math.abs(mean)).toBeLessThan(allowed);
    // it starts promptly: the first sound lands within 40 ms of the call
    expect(activeSpan(r, 5e-4).first).toBeLessThan(0.04);
  });
});

describe('SoundEngine behaviour', () => {
  it('renders identically for the same seed and differently for another one', async () => {
    const a = await render({ kind: 'sfx', id: 'type' }, 5);
    const b = await render({ kind: 'sfx', id: 'type' }, 5);
    const c = await render({ kind: 'sfx', id: 'type' }, 6);
    expect(Buffer.from(a.left.buffer).equals(Buffer.from(b.left.buffer))).toBe(true);
    expect(Buffer.from(a.left.buffer).equals(Buffer.from(c.left.buffer))).toBe(false);
  });

  it('a call at t = 0.5 s starts sounding at 0.5 s, not before (the scheduler really runs)', async () => {
    const r = await render(timeline(1.5, [{ at: 0.5, do: 'sfx', id: 'coin' }]));
    const span = activeSpan(r, 1e-4);
    expect(span.first).toBeGreaterThanOrEqual(0.5);
    expect(span.first).toBeLessThan(0.55);
  });

  it('per call volume scales the level, sfx slider is squared', async () => {
    const base = peakOf(await render({ kind: 'sfx', id: 'coin' }));
    const half = peakOf(await render({ kind: 'sfx', id: 'coin', volume: 0.5 }));
    expect(half / base).toBeGreaterThan(0.47);
    expect(half / base).toBeLessThan(0.53);
    const slider = peakOf(
      await render(
        timeline(1, [
          { at: 0, do: 'volumes', sfx: 0.5 },
          { at: 0.1, do: 'sfx', id: 'coin' },
        ]),
      ),
    );
    expect(slider / base).toBeGreaterThan(0.22);
    expect(slider / base).toBeLessThan(0.28);
  });

  it('mute makes it silent, and unmute brings it back', async () => {
    const r = await render(
      timeline(1.5, [
        { at: 0, do: 'mute', value: true },
        { at: 0.1, do: 'sfx', id: 'coin' },
        { at: 0.5, do: 'mute', value: false },
        { at: 0.8, do: 'sfx', id: 'coin' },
      ]),
    );
    expect(peakOf(r, 0, 0.75)).toBeLessThan(1e-4);
    expect(peakOf(r, 0.8, 1.3)).toBeGreaterThan(0.05);
  });

  it('rate speeds a sound up and shortens it', async () => {
    const slow = activeSpan(await render({ kind: 'sfx', id: 'level_up' }));
    const fast = activeSpan(await render({ kind: 'sfx', id: 'level_up', rate: 2 }));
    const ratio = (fast.last - fast.first) / (slow.last - slow.first);
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.62);
  });

  it('pan puts the sound on one side', async () => {
    const left = await render({ kind: 'sfx', id: 'coin', pan: -1 });
    const right = await render({ kind: 'sfx', id: 'coin', pan: 1 });
    const side = (r: RenderResult, ch: 'left' | 'right') => Math.max(...r[ch].map(Math.abs));
    expect(side(left, 'left')).toBeGreaterThan(side(left, 'right') * 20);
    expect(side(right, 'right')).toBeGreaterThan(side(right, 'left') * 20);
  });

  it('survives hundreds of calls: finite, under the ceiling, and quick', async () => {
    const rand = mulberry32(42);
    const events: TimelineEvent[] = [];
    for (let i = 0; i < 600; i++) {
      events.push({
        at: rand() * 2,
        do: 'sfx',
        id: SFX_IDS[Math.floor(rand() * SFX_IDS.length)]!,
        volume: rand() * 1.5,
        rate: 0.5 + rand() * 2,
        pan: rand() * 2 - 1,
      });
    }
    const t0 = Date.now();
    const r = await render(timeline(8, events));
    expect(Date.now() - t0).toBeLessThan(30_000);
    expect(finite(r)).toBe(true);
    expect(peakOf(r)).toBeLessThanOrEqual(PEAK_LIMIT);
    expect(peakOf(r, 1, 2)).toBeGreaterThan(0.1); // it really played something
    expect(rmsOf(r, 7.5, 8)).toBeLessThan(1e-3); // and everything finished
  });

  it('a click spammed in the same instant plays once (cooldown), not a wall of clicks', async () => {
    const one = await render(timeline(0.6, [{ at: 0.1, do: 'sfx', id: 'click' }]));
    const many = await render(
      timeline(
        0.6,
        Array.from({ length: 50 }, () => ({ at: 0.1, do: 'sfx' as const, id: 'click' as const })),
      ),
    );
    expect(peakOf(many)).toBeLessThan(peakOf(one) * 1.05);
  });
});
