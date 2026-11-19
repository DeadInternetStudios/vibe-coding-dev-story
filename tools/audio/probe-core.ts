/**
 * The part of the wave probe that runs on any backend, in node or in the page, so it
 * must not import anything from node. See tools/audio/waveprobe.ts for the driver.
 *
 * QUIET MACHINE: OfflineAudioContext only.
 */
import { WaveBank, type WaveId } from '../../src/audio/synth/waves';
import type { OfflineCtor } from './job';

export interface WaveRow {
  /** A synth wave id, or `native:<type>` for the backend's own built in oscillator. */
  wave: string;
  hz: number;
  /** Peak and RMS of the wave as the synth plays it (bank gain applied), at unit voice gain. */
  peak: number;
  rms: number;
}

export const PROBE_WAVES: readonly WaveId[] = ['sine', 'tri', 'saw', 'p12', 'p25', 'p50', 'p75', 'tri4', 'warm', 'organ'];
export const PROBE_NATIVE: readonly OscillatorType[] = ['sine', 'triangle', 'sawtooth', 'square'];
export const PROBE_PITCHES: readonly number[] = [110, 440, 1760];
const RATE = 48000;

async function measure(Ctor: OfflineCtor, hz: number, setup: (osc: OscillatorNode, ctx: BaseAudioContext) => number): Promise<{ peak: number; rms: number }> {
  const ctx = new Ctor(1, RATE / 2, RATE);
  const osc = ctx.createOscillator();
  const gain = setup(osc, ctx);
  osc.frequency.value = hz;
  const g = ctx.createGain();
  g.gain.value = gain;
  osc.connect(g).connect(ctx.destination);
  osc.start();
  const x = (await ctx.startRendering()).getChannelData(0).subarray(RATE / 10); // skip the first 100 ms
  let peak = 0;
  let sum = 0;
  for (const v of x) {
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
  }
  return { peak, rms: Math.sqrt(sum / x.length) };
}

/** Render every wave at every pitch, alone at unit gain, and measure it. */
export async function probeWaves(Ctor: OfflineCtor): Promise<WaveRow[]> {
  const rows: WaveRow[] = [];
  for (const wave of PROBE_WAVES) {
    for (const hz of PROBE_PITCHES) {
      const r = await measure(Ctor, hz, (osc, ctx) => {
        const src = new WaveBank(ctx).osc(wave);
        if (src.wave) osc.setPeriodicWave(src.wave);
        else osc.type = src.type ?? 'sine';
        return src.gain;
      });
      rows.push({ wave, hz, ...r });
    }
  }
  for (const type of PROBE_NATIVE) {
    for (const hz of PROBE_PITCHES) {
      const r = await measure(Ctor, hz, (osc) => {
        osc.type = type;
        return 1;
      });
      rows.push({ wave: `native:${type}`, hz, ...r });
    }
  }
  return rows;
}
