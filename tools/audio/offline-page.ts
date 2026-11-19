/**
 * The page tools/audio/chromium.ts drives. It runs the exact render job the node
 * backend runs, on the browser's own OfflineAudioContext, so loudness can be
 * checked on the audio stack the game ships on.
 *
 * QUIET MACHINE: only OfflineAudioContext is ever constructed here, and the
 * browser is launched with --mute-audio.
 */
import { renderJob, type OfflineCtor, type RenderJob, type RenderResult } from './job';
import { probeWaves } from './probe-core';
import { probeStarts, type StartMode } from './start-core';

/** A render with its sample buffers as base64, which is what crosses from the page to node. */
export interface WireResult {
  sampleRate: number;
  seconds: number;
  loopSeconds: number;
  attempts: number;
  meta: RenderResult['meta'];
  left: string;
  right: string;
}

function toBase64(samples: Float32Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([samples.buffer as ArrayBuffer]));
  });
}

async function renderForNode(job: RenderJob, sampleRate: number, seed: number): Promise<WireResult> {
  const r = await renderJob(OfflineAudioContext as unknown as OfflineCtor, job, sampleRate, seed);
  return {
    sampleRate: r.sampleRate,
    seconds: r.seconds,
    loopSeconds: r.loopSeconds,
    attempts: r.attempts,
    meta: r.meta,
    left: await toBase64(r.left),
    right: await toBase64(r.right),
  };
}

/** Milliseconds one render takes, without the cost of shipping the samples out. */
async function timeJob(job: RenderJob, sampleRate: number, seed: number): Promise<number> {
  const t0 = performance.now();
  await renderJob(OfflineAudioContext as unknown as OfflineCtor, job, sampleRate, seed);
  return performance.now() - t0;
}

declare global {
  interface Window {
    __renderJob: typeof renderForNode;
    __timeJob: typeof timeJob;
    __probeWaves: () => ReturnType<typeof probeWaves>;
    __probeStarts: (wave: string, mode: StartMode) => ReturnType<typeof probeStarts>;
    __ready: boolean;
  }
}

window.__renderJob = renderForNode;
window.__timeJob = timeJob;
window.__probeWaves = () => probeWaves(OfflineAudioContext as unknown as OfflineCtor);
window.__probeStarts = (wave, mode) => probeStarts(OfflineAudioContext as unknown as OfflineCtor, wave, 24, mode);
window.__ready = true;
