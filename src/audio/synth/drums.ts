import type { SynthRuntime } from './runtime';

export const DRUM_IDS = ['kick', 'snare', 'hat', 'ohat', 'tom', 'clap', 'rim', 'shaker', 'crash', 'cowbell', 'riser'] as const;
export type DrumId = (typeof DRUM_IDS)[number];

export interface DrumOpts {
  /** Pitch multiplier (toms, kick). */
  tune?: number;
  /** Length in seconds for drums that have one (riser). */
  dur?: number;
}

/** Longest tail of any one-shot drum, for voice accounting. */
const TAIL: Readonly<Record<DrumId, number>> = {
  kick: 0.32,
  snare: 0.2,
  hat: 0.06,
  ohat: 0.26,
  tom: 0.3,
  clap: 0.2,
  rim: 0.06,
  shaker: 0.09,
  crash: 1.3,
  cowbell: 0.25,
  riser: 2,
};

/**
 * Level of the cowbell's two tones on the bank's duty 50% wave (RMS 0.5). The
 * cowbell used to be the backend's own square at 0.22, which a browser plays at
 * 0.85 RMS and node at 1.0, so it was 1.4 dB louder in node. 0.37 on the bank
 * wave is the level a browser gave it.
 */
const COWBELL_LEVEL = 0.37;

/** Percussive gain curve: instant-ish attack, exponential fall to silence. */
function perc(g: AudioParam, t: number, peak: number, attack: number, decay: number): void {
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(peak, t + attack);
  g.exponentialRampToValueAtTime(0.0008, t + attack + decay);
  g.linearRampToValueAtTime(0, t + attack + decay + 0.004);
}

/**
 * Chip style drums built from oscillator sweeps and LFSR noise. They are
 * deliberately soft at the top: nothing above about 9 kHz carries real weight.
 * Returns false when the voice pool refused the hit.
 */
export function playDrum(rt: SynthRuntime, id: DrumId, t: number, vel: number, dest: AudioNode, opts?: DrumOpts): boolean {
  const ctx = rt.ctx;
  const tune = opts?.tune ?? 1;
  const dur = opts?.dur ?? TAIL[id];
  const stopAt = t + (id === 'riser' ? dur : TAIL[id]) + 0.03;
  // kick, snare and crash are the ones that must never be dropped
  const essential = id === 'kick' || id === 'snare';
  if (!rt.pool.tryAdd(ctx.currentTime, t, stopAt, essential)) return false;

  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(dest);
  nodes.push(out);

  const noiseSrc = (rate: number, start: number, stop: number): AudioBufferSourceNode => {
    const buf = rt.bank.noiseBuffer('noiseL');
    const bs = ctx.createBufferSource();
    bs.buffer = buf;
    bs.loop = true;
    bs.playbackRate.value = rate;
    bs.start(start, rt.rand() * buf.duration);
    bs.stop(stop);
    sources.push(bs);
    return bs;
  };
  const filt = (type: BiquadFilterType, f: number, q: number): BiquadFilterNode => {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    nodes.push(b);
    return b;
  };
  const gainNode = (): GainNode => {
    const g = ctx.createGain();
    g.gain.value = 0;
    nodes.push(g);
    return g;
  };
  const osc = (type: OscillatorType, f0: number, f1: number, over: number, stop: number): OscillatorNode => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + over);
    o.start(t);
    o.stop(stop);
    sources.push(o);
    return o;
  };

  switch (id) {
    case 'kick': {
      const o = osc('triangle', 175 * tune, 52 * tune, 0.1, t + 0.33);
      const g = gainNode();
      perc(g.gain, t, 0.62 * vel, 0.002, 0.27);
      o.connect(g).connect(out);
      // a short click so it reads on phone speakers
      const n = noiseSrc(0.6, t, t + 0.03);
      const bp = filt('bandpass', 2200, 0.8);
      const gc = gainNode();
      perc(gc.gain, t, 0.16 * vel, 0.0008, 0.012);
      n.connect(bp).connect(gc).connect(out);
      break;
    }
    case 'snare': {
      const o = osc('triangle', 205 * tune, 130 * tune, 0.07, t + 0.16);
      const g = gainNode();
      perc(g.gain, t, 0.3 * vel, 0.001, 0.12);
      o.connect(g).connect(out);
      const n = noiseSrc(0.55, t, t + 0.2);
      const hp = filt('highpass', 900, 0.7);
      const lp = filt('lowpass', 6500, 0.7);
      const gn = gainNode();
      perc(gn.gain, t, 0.4 * vel, 0.001, 0.16);
      n.connect(hp).connect(lp).connect(gn).connect(out);
      break;
    }
    case 'hat':
    case 'ohat': {
      const long = id === 'ohat';
      const n = noiseSrc(1, t, t + (long ? 0.28 : 0.06));
      const hp = filt('highpass', 6800, 0.6);
      const g = gainNode();
      perc(g.gain, t, (long ? 0.22 : 0.26) * vel, 0.001, long ? 0.2 : 0.03);
      n.connect(hp).connect(g).connect(out);
      break;
    }
    case 'tom': {
      const o = osc('triangle', 210 * tune, 108 * tune, 0.13, t + 0.34);
      const g = gainNode();
      perc(g.gain, t, 0.5 * vel, 0.002, 0.24);
      o.connect(g).connect(out);
      break;
    }
    case 'clap': {
      const n = noiseSrc(0.7, t, t + 0.22);
      const bp = filt('bandpass', 1350, 0.9);
      const g = gainNode();
      const p = g.gain;
      p.setValueAtTime(0, t);
      p.linearRampToValueAtTime(0.45 * vel, t + 0.001);
      p.exponentialRampToValueAtTime(0.08 * vel, t + 0.01);
      p.linearRampToValueAtTime(0.5 * vel, t + 0.011);
      p.exponentialRampToValueAtTime(0.08 * vel, t + 0.021);
      p.linearRampToValueAtTime(0.55 * vel, t + 0.022);
      p.exponentialRampToValueAtTime(0.0008, t + 0.17);
      p.linearRampToValueAtTime(0, t + 0.174);
      n.connect(bp).connect(g).connect(out);
      break;
    }
    case 'rim': {
      const o = osc('triangle', 1750 * tune, 1250 * tune, 0.012, t + 0.07);
      const g = gainNode();
      perc(g.gain, t, 0.32 * vel, 0.0008, 0.028);
      o.connect(g).connect(out);
      const n = noiseSrc(0.9, t, t + 0.03);
      const bp = filt('bandpass', 3800, 1.2);
      const gc = gainNode();
      perc(gc.gain, t, 0.14 * vel, 0.0005, 0.01);
      n.connect(bp).connect(gc).connect(out);
      break;
    }
    case 'shaker': {
      const n = noiseSrc(0.9, t, t + 0.1);
      const bp = filt('bandpass', 5200, 1.4);
      const g = gainNode();
      perc(g.gain, t, 0.5 * vel, 0.009, 0.05);
      n.connect(bp).connect(g).connect(out);
      break;
    }
    case 'crash': {
      const n = noiseSrc(0.95, t, t + 1.35);
      const hp = filt('highpass', 2600, 0.6);
      const lp = filt('lowpass', 8500, 0.7);
      const g = gainNode();
      perc(g.gain, t, 0.28 * vel, 0.002, 1.1);
      n.connect(hp).connect(lp).connect(g).connect(out);
      break;
    }
    case 'cowbell': {
      const bus = gainBell(ctx, nodes, t, vel, out);
      const square = rt.bank.osc('p50');
      for (const [f, lvl] of [
        [587 * tune, 1],
        [845 * tune, 0.8],
      ] as const) {
        const o = ctx.createOscillator();
        if (square.wave) o.setPeriodicWave(square.wave);
        o.frequency.value = f;
        o.start(t);
        o.stop(t + 0.28);
        sources.push(o);
        const gl = ctx.createGain();
        gl.gain.value = lvl * COWBELL_LEVEL * square.gain;
        nodes.push(gl);
        o.connect(gl).connect(bus);
      }
      break;
    }
    case 'riser': {
      const n = noiseSrc(0.8, t, t + dur + 0.02);
      const bp = filt('bandpass', 400, 2.2);
      bp.frequency.setValueAtTime(380, t);
      bp.frequency.exponentialRampToValueAtTime(5200, t + dur);
      const g = gainNode();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.3 * vel, t + dur);
      g.gain.linearRampToValueAtTime(0, t + dur + 0.01);
      n.connect(bp).connect(g).connect(out);
      break;
    }
  }

  rt.retire([...sources, ...nodes], stopAt + 0.05);
  return true;
}

/** Shared envelope bus for the two cowbell oscillators. */
function gainBell(ctx: BaseAudioContext, nodes: AudioNode[], t: number, vel: number, out: AudioNode): AudioNode {
  const g = ctx.createGain();
  g.gain.value = 0;
  perc(g.gain, t, vel, 0.001, 0.2);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1000;
  bp.Q.value = 1.2;
  g.connect(bp);
  bp.connect(out);
  nodes.push(g, bp);
  return g;
}
