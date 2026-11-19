import { applyEnvelope, buildEnvelope, type Adsr } from './envelope';
import { clamp, semitoneRatio } from './notes';
import type { SynthRuntime } from './runtime';
import { isNoise, type WaveId } from './waves';

/** One oscillator inside a voice. Several layers make chorus, octaves, bells. */
export interface LayerSpec {
  wave: WaveId;
  /** Frequency multiplier (2 = octave up, 2.76 = bell). */
  ratio?: number;
  /** Static detune in cents. */
  detune?: number;
  /** Level inside the voice, default 1. */
  vol?: number;
}

export interface VibratoSpec {
  /** Hz */
  rate: number;
  /** Cents peak */
  depth: number;
  /** Seconds before it fades in */
  delay: number;
}

export interface ArpSpec {
  /** Semitone offsets cycled through, e.g. [0, 4, 7] */
  semis: readonly number[];
  /** Steps per second. Trackers use 50 or 60, 24 to 32 sounds like a fast arpeggio. */
  rate: number;
}

export interface FilterSpec {
  type: BiquadFilterType;
  f0: number;
  /** Sweep target, reached after `time` seconds (exponential). */
  f1?: number;
  time?: number;
  q?: number;
}

export interface VoiceSpec {
  layers: readonly LayerSpec[];
  /** Start time on the context clock */
  t: number;
  /** Gate length in seconds (note off after this) */
  dur: number;
  /** Hz. For noiseL this is the LFSR clock in Hz. For noiseS it is the pitch of the tone. */
  freq: number;
  /** Pitch slide target in Hz, reached after slideTime seconds. */
  slideTo?: number;
  slideTime?: number;
  /** Peak gain */
  vol: number;
  env: Adsr;
  vib?: VibratoSpec;
  arp?: ArpSpec;
  filter?: FilterSpec;
  /** -1 .. 1 */
  pan?: number;
}

const MIN_FREQ = 1;

/**
 * Build one voice and schedule it. Returns false if the voice pool refused it.
 * Every curve is computed from the note length up front, so nothing is left
 * hanging and nothing clicks.
 */
export function playVoice(rt: SynthRuntime, v: VoiceSpec, dest: AudioNode, essential = false): boolean {
  const ctx = rt.ctx;
  const env = buildEnvelope(v.env, v.t, v.dur, v.vol);
  const stopAt = env.end + 0.02;
  if (!rt.pool.tryAdd(ctx.currentTime, v.t, stopAt, essential)) return false;

  const envGain = ctx.createGain();
  envGain.gain.value = 0;
  applyEnvelope(envGain.gain, env.points);

  const nodes: AudioNode[] = [envGain];
  let sink: AudioNode = envGain;

  if (v.filter) {
    const f = ctx.createBiquadFilter();
    f.type = v.filter.type;
    f.Q.value = v.filter.q ?? 0.7;
    f.frequency.setValueAtTime(Math.max(v.filter.f0, 20), v.t);
    if (v.filter.f1 !== undefined) {
      f.frequency.exponentialRampToValueAtTime(Math.max(v.filter.f1, 20), v.t + (v.filter.time ?? v.dur));
    }
    f.connect(envGain);
    nodes.push(f);
    sink = f;
  }

  if (v.pan) {
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(v.pan, -1, 1);
    envGain.connect(p);
    p.connect(dest);
    nodes.push(p);
  } else {
    envGain.connect(dest);
  }

  let lfoGain: GainNode | undefined;
  let lfo: OscillatorNode | undefined;
  if (v.vib && v.vib.depth > 0) {
    lfo = ctx.createOscillator();
    lfo.frequency.value = v.vib.rate;
    lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0, v.t);
    lfoGain.gain.setValueAtTime(0, v.t + v.vib.delay);
    lfoGain.gain.linearRampToValueAtTime(v.vib.depth, v.t + v.vib.delay + 0.18);
    lfo.connect(lfoGain);
    lfo.start(v.t);
    lfo.stop(stopAt);
    nodes.push(lfo, lfoGain);
  }

  const sources: AudioScheduledSourceNode[] = [];
  const f0 = Math.max(v.freq, MIN_FREQ);
  const slide = v.slideTo !== undefined && v.slideTime !== undefined && v.slideTime > 0;
  const slideRatio = slide ? Math.max(v.slideTo!, MIN_FREQ) / f0 : 1;

  for (const layer of v.layers) {
    const ratio = layer.ratio ?? 1;
    let lvl = layer.vol ?? 1;
    let src: AudioScheduledSourceNode;

    if (isNoise(layer.wave)) {
      const buf = rt.bank.noiseBuffer(layer.wave);
      const bs = ctx.createBufferSource();
      bs.buffer = buf;
      bs.loop = true;
      // noiseS: freq is the tone, so the clock is freq * cycle length. noiseL: freq is the clock.
      const clock = layer.wave === 'noiseS' ? f0 * ratio * buf.length : f0 * ratio;
      const rate = Math.max(clock / ctx.sampleRate, 0.001);
      bs.playbackRate.setValueAtTime(rate, v.t);
      if (slide) bs.playbackRate.exponentialRampToValueAtTime(rate * slideRatio, v.t + v.slideTime!);
      bs.start(v.t, rt.rand() * buf.duration);
      bs.stop(stopAt);
      src = bs;
    } else {
      const osc = ctx.createOscillator();
      const w = rt.bank.osc(layer.wave);
      if (w.wave) osc.setPeriodicWave(w.wave);
      else if (w.type) osc.type = w.type;
      lvl *= w.gain;
      const base = f0 * ratio;
      osc.frequency.setValueAtTime(base, v.t);
      if (slide) {
        osc.frequency.exponentialRampToValueAtTime(base * slideRatio, v.t + v.slideTime!);
      } else if (v.arp && v.arp.semis.length > 1 && v.arp.rate > 0) {
        const step = 1 / v.arp.rate;
        const n = v.arp.semis.length;
        for (let k = 1, tk = v.t + step; tk < v.t + v.dur; k++, tk += step) {
          osc.frequency.setValueAtTime(base * semitoneRatio(v.arp.semis[k % n]!), tk);
        }
      }
      if (layer.detune) osc.detune.value = layer.detune;
      if (lfoGain) lfoGain.connect(osc.detune);
      osc.start(v.t);
      osc.stop(stopAt);
      src = osc;
    }

    if (lvl !== 1) {
      const lg = ctx.createGain();
      lg.gain.value = lvl;
      src.connect(lg);
      lg.connect(sink);
      nodes.push(lg);
    } else {
      src.connect(sink);
    }
    sources.push(src);
  }

  rt.retire([...sources, ...nodes], stopAt + 0.05);
  return true;
}
