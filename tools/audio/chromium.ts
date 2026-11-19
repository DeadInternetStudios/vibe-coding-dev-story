import type { RenderJob, RenderResult } from './job';

/** Filled in by the Chromium backend. See tools/audio/render.ts --backend chromium. */
export async function renderInChromium(_jobs: RenderJob[], _sampleRate: number, _seed: number): Promise<RenderResult[]> {
  throw new Error('chromium backend not written yet');
}
