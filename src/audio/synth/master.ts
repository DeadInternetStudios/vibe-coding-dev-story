import type { AudioCtx } from './runtime';

/**
 * Where the soft limiter tops out, linear: -3.5 dBFS. The promise to the game is
 * "never above -3 dBFS". The half decibel of room is for the 2x oversampled
 * WaveShaper, whose downsampling filter overshoots a hard clip by up to 0.2 dB.
 */
export const CEILING = 0.668;
/** The promised peak limit, linear: -3 dBFS. Tests and the analyzer check against this. */
export const PEAK_LIMIT = 0.7079;
/** Below this input level the limiter does nothing at all. */
export const KNEE = 0.5;
/** Gentle master low pass. The chip waves have a lot of top end we never want. */
export const LOWPASS_HZ = 8800;
/** Removes DC and sub rumble before the limiter. */
export const HIGHPASS_HZ = 26;

/** Solve k / tanh(k) = ratio for k >= 1 by bisection. */
function solveKappa(ratio: number): number {
  let lo = 1;
  let hi = 40;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (mid / Math.tanh(mid) < ratio) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Soft limiter transfer curve over input -1..1. Linear (unity) up to `knee`,
 * then a tanh shoulder that reaches exactly `ceiling` at full scale, with a
 * continuous slope at the knee so there is no audible corner. Input beyond
 * full scale is clamped by the WaveShaper, so the output can never exceed the
 * ceiling.
 */
export function softClipCurve(size = 2049, knee = KNEE, ceiling = CEILING): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(size);
  const kappa = solveKappa((1 - knee) / (ceiling - knee));
  const tk = Math.tanh(kappa);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    const ax = Math.abs(x);
    const y = ax <= knee ? ax : knee + ((ceiling - knee) * Math.tanh((kappa * (ax - knee)) / (1 - knee))) / tk;
    curve[i] = x < 0 ? -y : y;
  }
  return curve;
}

/** Volume sliders feel right when squared. 1 stays 1. */
export function volumeToGain(v: number): number {
  const c = Math.min(Math.max(Number.isFinite(v) ? v : 0, 0), 1);
  return c * c;
}

export interface MasterChain {
  /** Music players plug into this (it is the duck stage). */
  musicDuck: GainNode;
  musicVol: GainNode;
  sfxVol: GainNode;
  master: GainNode;
  mute: GainNode;
  lowpass: BiquadFilterNode;
  highpass: BiquadFilterNode;
  limiter: WaveShaperNode;
  dispose(): void;
}

/**
 *   musicDuck -> musicVol \
 *                           master -> mute -> highpass -> lowpass -> limiter -> out
 *   sfxVol ---------------/
 */
export function createMasterChain(ctx: AudioCtx, out: AudioNode): MasterChain {
  const musicDuck = ctx.createGain();
  const musicVol = ctx.createGain();
  const sfxVol = ctx.createGain();
  const master = ctx.createGain();
  const mute = ctx.createGain();
  const highpass = ctx.createBiquadFilter();
  const lowpass = ctx.createBiquadFilter();
  const limiter = ctx.createWaveShaper();

  highpass.type = 'highpass';
  highpass.frequency.value = HIGHPASS_HZ;
  highpass.Q.value = 0.7;
  lowpass.type = 'lowpass';
  lowpass.frequency.value = LOWPASS_HZ;
  lowpass.Q.value = 0.6;
  limiter.curve = softClipCurve();
  limiter.oversample = '2x';

  musicDuck.connect(musicVol);
  musicVol.connect(master);
  sfxVol.connect(master);
  master.connect(mute);
  mute.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(limiter);
  limiter.connect(out);

  return {
    musicDuck,
    musicVol,
    sfxVol,
    master,
    mute,
    lowpass,
    highpass,
    limiter,
    dispose() {
      for (const n of [musicDuck, musicVol, sfxVol, master, mute, highpass, lowpass, limiter]) {
        try {
          n.disconnect();
        } catch {
          /* gone */
        }
      }
    },
  };
}
