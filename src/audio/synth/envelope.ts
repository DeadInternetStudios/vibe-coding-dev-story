/**
 * ADSR as a list of automation breakpoints, computed up front.
 *
 * Every note in this engine has a known length when it is scheduled, so the
 * whole gain curve is a pure function of (adsr, start, gate length, peak).
 * That keeps short notes click free (the release starts from the value the
 * envelope really reached) and makes the curve testable without Web Audio.
 */

export interface Adsr {
  /** Attack seconds. Floored at MIN_ATTACK so nothing clicks. */
  a: number;
  /** Decay seconds to the sustain level (exponential shape). */
  d: number;
  /** Sustain level as a fraction of the peak, 0 to 1. */
  s: number;
  /** Release seconds, exponential, about 60 dB of fall. */
  r: number;
}

export type EnvKind = 'set' | 'lin' | 'exp';

export interface EnvPoint {
  /** Absolute time in seconds. */
  t: number;
  v: number;
  kind: EnvKind;
}

export const MIN_ATTACK = 0.0015;
/** Floor for exponential ramps, which cannot target zero. */
export const ENV_FLOOR = 1e-4;
/** The last step to true silence, so the oscillator can stop without a pop. */
export const FINAL_RAMP = 0.004;
/** Release falls this far (linear gain) over `r` before the last step to zero. */
export const RELEASE_FALL = 1e-3;

export interface BuiltEnvelope {
  points: EnvPoint[];
  /** Time the gain reaches zero. Stop the sources a hair after this. */
  end: number;
  /** Gain at the moment of note off (useful for tests). */
  atGate: number;
}

/**
 * @param env   the ADSR
 * @param t0    note start, seconds
 * @param dur   gate length (seconds from start to note off)
 * @param peak  gain at the top of the attack
 */
export function buildEnvelope(env: Adsr, t0: number, dur: number, peak: number): BuiltEnvelope {
  const a = Math.max(env.a, MIN_ATTACK);
  const d = Math.max(env.d, 0);
  const r = Math.max(env.r, 0.004);
  const gate = Math.max(dur, 0.002);
  const sustain = Math.max(env.s * peak, peak * ENV_FLOOR);
  const points: EnvPoint[] = [{ t: t0, v: 0, kind: 'set' }];
  let atGate: number;

  if (gate <= a) {
    atGate = (peak * gate) / a;
    points.push({ t: t0 + gate, v: atGate, kind: 'lin' });
  } else {
    points.push({ t: t0 + a, v: peak, kind: 'lin' });
    const hasDecay = d > 0 && sustain < peak;
    if (hasDecay && gate <= a + d) {
      // note off lands inside the decay: stop the decay where it actually is
      atGate = peak * Math.pow(sustain / peak, (gate - a) / d);
      points.push({ t: t0 + gate, v: atGate, kind: 'exp' });
    } else {
      if (hasDecay) points.push({ t: t0 + a + d, v: sustain, kind: 'exp' });
      atGate = hasDecay ? sustain : peak;
      // anchor the value at note off so the release has a clean start
      points.push({ t: t0 + gate, v: atGate, kind: 'set' });
    }
  }

  const tOff = t0 + gate;
  const releaseTo = Math.max(atGate * RELEASE_FALL, 1e-6);
  points.push({ t: tOff + r, v: releaseTo, kind: 'exp' });
  points.push({ t: tOff + r + FINAL_RAMP, v: 0, kind: 'lin' });
  return { points, end: tOff + r + FINAL_RAMP, atGate };
}

/** The slice of AudioParam we use, so tests can pass a fake. */
export interface ParamLike {
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
  exponentialRampToValueAtTime(v: number, t: number): unknown;
}

export function applyEnvelope(param: ParamLike, points: readonly EnvPoint[]): void {
  for (const p of points) {
    if (p.kind === 'set') param.setValueAtTime(p.v, p.t);
    else if (p.kind === 'lin') param.linearRampToValueAtTime(p.v, p.t);
    else param.exponentialRampToValueAtTime(Math.max(p.v, 1e-7), p.t);
  }
}

/**
 * Evaluate the envelope at time t (linear gain). Used by tests to check the
 * curve shape without rendering audio.
 */
export function envelopeAt(points: readonly EnvPoint[], t: number): number {
  if (points.length === 0) return 0;
  if (t <= points[0]!.t) return points[0]!.v;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1]!;
    const p1 = points[i]!;
    if (t <= p1.t) {
      const k = p1.t === p0.t ? 1 : (t - p0.t) / (p1.t - p0.t);
      if (p1.kind === 'exp') return p0.v * Math.pow(Math.max(p1.v, 1e-7) / Math.max(p0.v, 1e-7), k);
      if (p1.kind === 'set') return p0.v;
      return p0.v + (p1.v - p0.v) * k;
    }
  }
  return points[points.length - 1]!.v;
}
