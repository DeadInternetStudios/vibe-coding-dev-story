/**
 * Wave tables for the chip synth.
 *
 * Pulse waves are exact Fourier series handed to a PeriodicWave, so the browser
 * band limits them per pitch (no aliasing, no harsh fizz). Noise comes from a
 * real NES style 15 bit LFSR so it is deterministic and has a short, tonal mode.
 */

export type PulseId = 'p12' | 'p25' | 'p50' | 'p75';
export type NoiseId = 'noiseL' | 'noiseS';
/** Everything an oscillator layer can be. */
export type WaveId = PulseId | NoiseId | 'tri' | 'tri4' | 'saw' | 'sine' | 'organ' | 'warm';

export const PULSE_DUTY: Readonly<Record<PulseId, number>> = {
  p12: 0.125,
  p25: 0.25,
  p50: 0.5,
  p75: 0.75,
};

export function isNoise(w: WaveId): w is NoiseId {
  return w === 'noiseL' || w === 'noiseS';
}

export function isPulse(w: WaveId): w is PulseId {
  return w === 'p12' || w === 'p25' || w === 'p50' || w === 'p75';
}

export interface FourierTable {
  real: Float32Array;
  imag: Float32Array;
}

/** Target RMS for custom periodic waves, so duty cycles sit at similar loudness. */
export const WAVE_RMS = 0.5;
/** Harmonics kept for pulses. The browser band limits further per pitch. */
export const PULSE_HARMONICS = 80;

/**
 * Pulse wave of the given duty (0..1) as Fourier coefficients.
 * x(t) = 1 while phase < duty, else 0, minus its mean. The coefficients are
 * scaled so the wave's RMS is WAVE_RMS whatever the duty is.
 */
export function pulseTable(duty: number, harmonics = PULSE_HARMONICS, rms = WAVE_RMS): FourierTable {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  const scale = rms / Math.sqrt(duty * (1 - duty));
  for (let n = 1; n <= harmonics; n++) {
    real[n] = (scale * Math.sin(2 * Math.PI * n * duty)) / (n * Math.PI);
    imag[n] = (scale * (1 - Math.cos(2 * Math.PI * n * duty))) / (n * Math.PI);
  }
  return { real, imag };
}

/** Fourier coefficients of one cycle given as samples (a naive DFT, fine for 32 to 256 points). */
export function tableToFourier(samples: ArrayLike<number>, maxHarmonics: number): FourierTable {
  const n = samples.length;
  const h = Math.min(maxHarmonics, Math.floor(n / 2));
  const real = new Float32Array(h + 1);
  const imag = new Float32Array(h + 1);
  for (let k = 1; k <= h; k++) {
    let a = 0;
    let b = 0;
    for (let i = 0; i < n; i++) {
      const ph = (2 * Math.PI * k * i) / n;
      a += samples[i]! * Math.cos(ph);
      b += samples[i]! * Math.sin(ph);
    }
    real[k] = (2 * a) / n;
    imag[k] = (2 * b) / n;
  }
  return { real, imag };
}

/** Scale a Fourier table so the waveform it describes has the given RMS. */
export function normalizeRms(t: FourierTable, rms = WAVE_RMS): FourierTable {
  let power = 0;
  for (let k = 1; k < t.real.length; k++) power += (t.real[k]! ** 2 + t.imag[k]! ** 2) / 2;
  const cur = Math.sqrt(power);
  const g = cur > 0 ? rms / cur : 1;
  const real = new Float32Array(t.real.length);
  const imag = new Float32Array(t.imag.length);
  for (let k = 0; k < real.length; k++) {
    real[k] = t.real[k]! * g;
    imag[k] = t.imag[k]! * g;
  }
  return { real, imag };
}

/** NES style 4 bit stepped triangle: 32 steps, 16 levels. Gritty and warm. */
export function steppedTriangleSamples(): number[] {
  const out: number[] = [];
  for (let i = 0; i < 32; i++) {
    const level = i < 16 ? i : 31 - i; // 0..15..0
    out.push((level - 7.5) / 7.5);
  }
  return out;
}

/** Warm bass shape: a triangle with a pinch of 2nd and 3rd harmonic so it survives phone speakers. */
export function warmTable(): FourierTable {
  const real = new Float32Array(9);
  const imag = new Float32Array(9);
  // triangle odd harmonics fall as 1/n^2 with alternating sign (sine series)
  const tri = (n: number) => (n % 2 === 1 ? (8 / (Math.PI * Math.PI)) * (1 / (n * n)) * (((n - 1) / 2) % 2 === 0 ? 1 : -1) : 0);
  for (let n = 1; n <= 8; n++) imag[n] = tri(n);
  imag[2] += 0.1;
  imag[3] += 0.07;
  imag[4] += 0.03;
  return normalizeRms({ real, imag });
}

/** Drawbar style organ: fundamental, octave, twelfth, double octave. */
export function organTable(): FourierTable {
  const real = new Float32Array(9);
  const imag = new Float32Array(9);
  imag[1] = 1;
  imag[2] = 0.55;
  imag[3] = 0.32;
  imag[4] = 0.2;
  imag[6] = 0.08;
  imag[8] = 0.05;
  return normalizeRms({ real, imag });
}

/**
 * One full period of an NES style LFSR as +/-1 samples with the mean removed.
 * Long mode taps bit 1 (period 32767), short mode taps bit 6 (period 93 from
 * the power on state), which is the metallic, tonal noise.
 */
export function lfsrCycle(short: boolean): Float32Array {
  let reg = 1;
  const seen = new Map<number, number>();
  const bits: number[] = [];
  while (!seen.has(reg)) {
    seen.set(reg, bits.length);
    bits.push(reg & 1);
    const fb = (reg & 1) ^ ((reg >> (short ? 6 : 1)) & 1);
    reg = (reg >> 1) | (fb << 14);
  }
  const start = seen.get(reg)!;
  const cycle = bits.slice(start);
  let mean = 0;
  for (const b of cycle) mean += b ? 1 : -1;
  mean /= cycle.length;
  const out = new Float32Array(cycle.length);
  for (let i = 0; i < cycle.length; i++) out[i] = ((cycle[i] ? 1 : -1) - mean) * 0.7;
  return out;
}

/** What an oscillator needs: a built in type or a PeriodicWave. */
export interface OscSource {
  type?: OscillatorType;
  wave?: PeriodicWave;
}

/**
 * Per context cache of periodic waves and noise buffers. Created once, reused
 * by every voice, so a note costs a couple of nodes and nothing else.
 */
export class WaveBank {
  private readonly waves = new Map<WaveId, OscSource>();
  private readonly noise = new Map<NoiseId, AudioBuffer>();

  constructor(private readonly ctx: BaseAudioContext) {}

  osc(id: WaveId): OscSource {
    let src = this.waves.get(id);
    if (!src) {
      src = this.make(id);
      this.waves.set(id, src);
    }
    return src;
  }

  noiseBuffer(id: NoiseId): AudioBuffer {
    let buf = this.noise.get(id);
    if (!buf) {
      const cycle = lfsrCycle(id === 'noiseS');
      buf = this.ctx.createBuffer(1, cycle.length, this.ctx.sampleRate);
      buf.getChannelData(0).set(cycle);
      this.noise.set(id, buf);
    }
    return buf;
  }

  /** Length of one noise cycle in samples (93 or 32767). */
  noiseCycleLength(id: NoiseId): number {
    return this.noiseBuffer(id).length;
  }

  private periodic(t: FourierTable): OscSource {
    return { wave: this.ctx.createPeriodicWave(t.real, t.imag, { disableNormalization: true }) };
  }

  private make(id: WaveId): OscSource {
    if (isPulse(id)) return this.periodic(pulseTable(PULSE_DUTY[id]));
    switch (id) {
      case 'tri':
        return { type: 'triangle' };
      case 'saw':
        return { type: 'sawtooth' };
      case 'sine':
        return { type: 'sine' };
      case 'tri4':
        return this.periodic(normalizeRms(tableToFourier(steppedTriangleSamples(), 16)));
      case 'warm':
        return this.periodic(warmTable());
      case 'organ':
        return this.periodic(organTable());
      default:
        throw new Error(`audio: ${id} is not an oscillator wave`);
    }
  }
}
