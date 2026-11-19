import { OfflineAudioContext } from 'node-web-audio-api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderJob, type OfflineCtor, type RenderJob } from '../../tools/audio/job';

// QUIET MACHINE: only OfflineAudioContext, never AudioContext.

/**
 * node-web-audio-api sometimes rejects a suspend() with InvalidStateError, because the
 * renderer is already past its time. A lost pump leaves a hole in the audio and shifts the
 * song, so renderJob has to notice and redo the render instead of handing it on.
 */
function flakyCtor(shouldReject: (contextNumber: number, t: number) => boolean): { Ctor: OfflineCtor; contexts: () => number } {
  let made = 0;
  class Flaky extends OfflineAudioContext {
    private readonly n: number;
    constructor(channels: number, length: number, sampleRate: number) {
      super(channels, length, sampleRate);
      this.n = ++made;
    }
    override suspend(t: number): Promise<void> {
      if (shouldReject(this.n, t)) return Promise.reject(new DOMException('already past', 'InvalidStateError'));
      return super.suspend(t);
    }
  }
  return { Ctor: Flaky as unknown as OfflineCtor, contexts: () => made };
}

const SHORT: RenderJob = { kind: 'sfx', id: 'click' };

describe('render harness audit', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  afterEach(() => warn.mockClear());

  it('returns a clean first render untouched', async () => {
    const { Ctor, contexts } = flakyCtor(() => false);
    const r = await renderJob(Ctor, SHORT, 48000, 1);
    expect(r.attempts).toBe(1);
    expect(contexts()).toBe(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('throws away a render that lost a pump and redoes it', async () => {
    // Only the first context loses pumps (like a cold process); the second is clean.
    const { Ctor, contexts } = flakyCtor((n, t) => n === 1 && t > 0.1 && t < 0.2);
    const r = await renderJob(Ctor, SHORT, 48000, 1);
    expect(r.attempts).toBe(2);
    expect(contexts()).toBe(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toMatch(/attempt 1\/\d+ discarded .*suspend\(0\.\d+\) rejected/);
  });

  it('keeps the redone render equal to a render that never failed', async () => {
    const clean = await renderJob(flakyCtor(() => false).Ctor, SHORT, 48000, 1);
    const redone = await renderJob(flakyCtor((n, t) => n === 1 && t > 0.05).Ctor, SHORT, 48000, 1);
    expect(redone.attempts).toBeGreaterThan(1);
    expect(redone.left.length).toBe(clean.left.length);
    let worst = 0;
    for (let i = 0; i < clean.left.length; i++) worst = Math.max(worst, Math.abs(clean.left[i]! - redone.left[i]!));
    expect(worst).toBeLessThan(1e-5); // float noise from the native mixer, not a different performance
  });

  it('gives up loudly instead of returning a tainted render', async () => {
    const { Ctor } = flakyCtor((_, t) => t > 0.1);
    await expect(renderJob(Ctor, SHORT, 48000, 1)).rejects.toThrow(/render sfx click failed \d+ attempts/);
  });
});
