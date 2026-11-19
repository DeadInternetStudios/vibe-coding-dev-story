import { OfflineAudioContext as NodeOfflineAudioContext } from 'node-web-audio-api';
import { describe, expect, it } from 'vitest';
import type { OfflineCtor } from '../../tools/audio/job';
import { PROBE_PITCHES, PROBE_WAVES, probeWaves } from '../../tools/audio/probe-core';
import { WAVE_RMS } from './synth/waves';

/**
 * node-web-audio-api peak-normalizes custom waves even when told not to, a browser does
 * not. The synth builds its tables to survive that, so what this checks (in node, the
 * backend that misbehaves) is that every wave plays at the one level it was designed
 * for. tools/audio/waveprobe.ts runs the same probe against a real browser.
 */
describe('wave levels on node-web-audio-api', () => {
  it('every synth wave plays at its designed RMS at low and middle pitch, whatever its duty or shape', async () => {
    const rows = await probeWaves(NodeOfflineAudioContext as unknown as OfflineCtor);
    const synth = rows.filter((r) => !r.wave.startsWith('native:'));
    expect(synth.length).toBe(PROBE_WAVES.length * PROBE_PITCHES.length);
    for (const r of synth) {
      if (r.hz > 500) continue;
      const designed = r.wave === 'sine' ? Math.SQRT1_2 : r.wave === 'tri' ? Math.sqrt(1 / 3) : WAVE_RMS;
      const off = 20 * Math.log10(r.rms / designed);
      expect(Math.abs(off), `${r.wave} at ${r.hz} Hz is ${off.toFixed(2)} dB off its design level`).toBeLessThan(0.15);
    }
  });
});
