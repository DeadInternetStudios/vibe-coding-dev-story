import { OfflineAudioContext } from 'node-web-audio-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOOKAHEAD, SoundEngine, TICK_MS } from './engine';

/**
 * The engine on its live path: a timer wakes it every 25 ms and it plans 200 ms ahead of the
 * context clock. Every other test drives the engine by hand (manual clock), so this is the only
 * place the timer, the look-ahead and the resume flow are exercised.
 *
 * QUIET MACHINE: the context is an OfflineAudioContext that is never rendered, so nothing is
 * ever produced. It reports itself as running and its clock is moved by the test.
 */
interface Live {
  engine: SoundEngine;
  clock: { now: number };
  state: { value: AudioContextState };
  /** For every oscillator started: the clock when it was scheduled. */
  at: number[];
  /** For every oscillator started: how far ahead of the clock it was scheduled, seconds. */
  leads: number[];
}

function live(initial: AudioContextState = 'running'): Live {
  const offline = new OfflineAudioContext(2, 48000, 48000);
  const clock = { now: 1 };
  const state = { value: initial };
  Object.defineProperty(offline, 'currentTime', { get: () => clock.now });
  Object.defineProperty(offline, 'state', { get: () => state.value });
  const ctx = offline as unknown as AudioContext;
  const at: number[] = [];
  const leads: number[] = [];
  const create = ctx.createOscillator.bind(ctx);
  ctx.createOscillator = () => {
    const osc = create();
    const start = osc.start.bind(osc);
    osc.start = (when?: number) => {
      at.push(clock.now);
      leads.push((when ?? clock.now) - clock.now);
      start(when);
    };
    return osc;
  };
  return { engine: new SoundEngine(ctx, ctx.destination), clock, state, at, leads };
}

/** `times` timer ticks: the audio clock and the wall clock move together. */
function tick(l: Live, times = 1): void {
  for (let i = 0; i < times; i++) {
    l.clock.now += TICK_MS / 1000;
    vi.advanceTimersByTime(TICK_MS);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('SoundEngine on a live clock', () => {
  it('keeps a song playing on a clock that moves in real time: never late, never far ahead, never stalled', () => {
    const l = live();
    l.engine.music('crunch');
    tick(l, 240); // 6 s
    expect(l.leads.length).toBeGreaterThan(100);
    expect(Math.min(...l.leads)).toBeGreaterThanOrEqual(-0.001);
    // a note is planned at most one look-ahead (plus a swing or a step) before it sounds
    expect(Math.max(...l.leads)).toBeLessThan(LOOKAHEAD + 0.15);
    // notes keep being scheduled in every second of the run: the timer never stopped
    for (let s = 1; s <= 5; s++) {
      const inSecond = l.at.filter((t) => t >= 1 + s && t < 2 + s).length;
      expect(inSecond, `notes scheduled during second ${s}`).toBeGreaterThan(3);
    }
    l.engine.dispose();
  });

  it('stops scheduling once the music has faded out', () => {
    const l = live();
    l.engine.music('crunch');
    tick(l, 40);
    l.engine.stopMusic(100);
    tick(l, 80); // 2 s: the fade is long over
    const settled = l.at.length;
    tick(l, 80);
    expect(l.at.length).toBe(settled);
    expect(l.engine.currentMusic()).toBeNull();
    l.engine.dispose();
  });

  it('a main thread stall of two seconds does not make a burst of late notes', () => {
    const l = live();
    l.engine.music('crunch');
    tick(l, 40);
    const before = l.at.length;
    tick(l, 8); // a normal 200 ms stretch
    const normal = l.at.length - before;
    expect(normal).toBeGreaterThan(0);

    const afterNormal = l.at.length;
    l.clock.now += 2; // the page is blocked: the audio clock runs on, the timer does not fire
    vi.advanceTimersByTime(TICK_MS); // the first tick after the stall
    const burst = l.at.length - afterNormal;
    expect(burst).toBeLessThanOrEqual(normal * 2);
    // nothing was scheduled in the past: the song resumes where it left off, from now
    expect(Math.min(...l.leads.slice(afterNormal))).toBeGreaterThanOrEqual(-0.001);
    l.engine.dispose();
  });

  it('remembers music asked for before the context runs, and starts it when resume() finds it running', async () => {
    const l = live('suspended');
    l.engine.music('title');
    tick(l, 8);
    expect(l.at.length).toBe(0);
    expect(l.engine.currentMusic()).toBe('title');

    l.state.value = 'running';
    await l.engine.resume();
    tick(l, 2);
    expect(l.at.length).toBeGreaterThan(0);
    expect(l.engine.currentMusic()).toBe('title');
    l.engine.dispose();
  });

  it('a sound effect asked for while the context is suspended is dropped, not played late', () => {
    const l = live('suspended');
    l.engine.sfx('coin');
    l.state.value = 'running';
    tick(l, 20);
    expect(l.at.length).toBe(0);
    l.engine.dispose();
  });

  it('a sound effect on a running context sounds at once', () => {
    const l = live();
    l.engine.sfx('coin');
    expect(l.leads.length).toBeGreaterThan(0);
    expect(Math.min(...l.leads)).toBeLessThan(0.02);
    l.engine.dispose();
  });
});
