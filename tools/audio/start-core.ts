/**
 * Where does a note really begin? Starts a 1 kHz oscillator at many fractional sample
 * positions and measures when its fundamental actually crosses zero, against the time it was
 * asked to start. Runs on any backend, in node or in the page, so it imports nothing from node.
 * See tools/audio/startprobe.ts for the driver.
 *
 * QUIET MACHINE: OfflineAudioContext only.
 */
import { WaveBank, type WaveId } from '../../src/audio/synth/waves';
import type { OfflineCtor } from './job';

export interface StartRow {
  /** Requested start, in samples (fractional). */
  start: number;
  /** Where the start falls inside the 128 frame render quantum. */
  quantumOffset: number;
  /** Measured start of the wave in samples, minus the requested start, relative to the first row. 0 is perfect. */
  error: number;
}

const RATE = 48000;
const HZ = 1000;
const PERIOD = RATE / HZ; // 48 samples

/** Phase of the fundamental over [from, to) by correlation with sin and cos, as a delay in samples within one period. */
function fundamentalDelay(x: Float32Array, from: number, to: number): number {
  let s = 0;
  let c = 0;
  for (let n = from; n < to; n++) {
    const w = (2 * Math.PI * HZ * n) / RATE;
    s += x[n]! * Math.sin(w);
    c += x[n]! * Math.cos(w);
  }
  const phase = Math.atan2(-c, s);
  return ((phase / (2 * Math.PI)) * PERIOD + PERIOD) % PERIOD;
}

const wrap = (d: number): number => ((d + PERIOD / 2 + PERIOD * 4) % PERIOD) - PERIOD / 2;

/**
 * How the oscillator is driven. 'value' sets frequency.value, which is what a toy does. The synth
 * sets the frequency with an automation event at the note's start ('event'), and a vibrato voice
 * also feeds an LFO into detune ('lfo'), so those are the cases that matter. 'value+lfo' is the
 * vibrato alone, without the automation event.
 */
export type StartMode = 'value' | 'event' | 'lfo' | 'value+lfo';

/** `wave` is 'native:<type>' for the backend's own oscillator, or a synth wave id. */
export async function probeStarts(Ctor: OfflineCtor, wave: string = 'native:sine', count = 24, mode: StartMode = 'value'): Promise<StartRow[]> {
  const rows: StartRow[] = [];
  let first = 0;
  for (let k = 0; k < count; k++) {
    const start = 4800 + 13.37 * k + 0.25 * (k % 4);
    const ctx = new Ctor(1, RATE / 4, RATE);
    const osc = ctx.createOscillator();
    if (wave.startsWith('native:')) osc.type = wave.slice(7) as OscillatorType;
    else {
      const src = new WaveBank(ctx).osc(wave as WaveId);
      if (src.wave) osc.setPeriodicWave(src.wave);
      else osc.type = src.type ?? 'sine';
    }
    if (mode === 'value' || mode === 'value+lfo') osc.frequency.value = HZ;
    else osc.frequency.setValueAtTime(HZ, start / RATE);
    if (mode === 'lfo' || mode === 'value+lfo') {
      // a vibrato of zero depth: it is connected and running but adds nothing, so the pitch stays 1 kHz
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.5;
      const depth = ctx.createGain();
      depth.gain.value = 0;
      lfo.connect(depth).connect(osc.detune);
      lfo.start(start / RATE);
    }
    osc.connect(ctx.destination);
    osc.start(start / RATE);
    const x = (await ctx.startRendering()).getChannelData(0);
    const from = Math.ceil(start) + PERIOD * 4; // clear of the first cycles, inside the steady tone
    const delay = fundamentalDelay(x, from, from + PERIOD * 100);
    const err = wrap(delay - (((start % PERIOD) + PERIOD) % PERIOD));
    if (k === 0) first = err;
    rows.push({ start, quantumOffset: start % 128, error: wrap(err - first) });
  }
  return rows;
}
