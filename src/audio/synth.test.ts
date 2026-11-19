import { describe, expect, it } from 'vitest';
import {
  ENV_FLOOR,
  FINAL_RAMP,
  applyEnvelope,
  buildEnvelope,
  envelopeAt,
  type Adsr,
  type EnvPoint,
} from './synth/envelope';
import { INSTRUMENTS, noteVoice } from './synth/instruments';
import { CEILING, GUARD_KNEE, GUARD_MAX, KNEE, PEAK_LIMIT, guardCurve, softClipCurve, volumeToGain } from './synth/master';
import {
  centsToRatio,
  clamp,
  dbToGain,
  gainToDb,
  midiToFreq,
  mulberry32,
  noteToMidi,
  pitchClass,
  semitoneRatio,
  toHz,
} from './synth/notes';
import { VoicePool } from './synth/runtime';
import {
  PULSE_DUTY,
  WAVE_RMS,
  lfsrCycle,
  normalizeRms,
  organTable,
  pulseTable,
  sawTable,
  steppedTriangleSamples,
  tablePeak,
  tableToFourier,
  unitPeak,
  warmTable,
  type FourierTable,
} from './synth/waves';

describe('note math', () => {
  it('maps names to midi and hertz', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C#4')).toBe(61);
    expect(noteToMidi('Bb3')).toBe(58);
    expect(noteToMidi('F#3')).toBe(54);
    expect(noteToMidi('C-1')).toBe(0);
    expect(midiToFreq(69)).toBeCloseTo(440, 9);
    expect(midiToFreq(57)).toBeCloseTo(220, 9);
    expect(midiToFreq(60)).toBeCloseTo(261.6256, 3);
    expect(toHz('A5')).toBeCloseTo(880, 9);
    expect(toHz(123.4)).toBe(123.4);
  });

  it('pitch classes wrap and accept flats and sharps', () => {
    expect(pitchClass('C')).toBe(0);
    expect(pitchClass('Bb')).toBe(10);
    expect(pitchClass('B#')).toBe(0);
    expect(pitchClass('Cb')).toBe(11);
    expect(pitchClass('F#')).toBe(6);
  });

  it('rejects junk loudly, since this runs when songs are compiled', () => {
    expect(() => noteToMidi('H4')).toThrow(/bad note/);
    expect(() => pitchClass('x')).toThrow(/bad pitch/);
  });

  it('ratios and decibels', () => {
    expect(semitoneRatio(12)).toBeCloseTo(2, 12);
    expect(centsToRatio(1200)).toBeCloseTo(2, 12);
    expect(dbToGain(-6.0206)).toBeCloseTo(0.5, 4);
    expect(gainToDb(1)).toBeCloseTo(0, 12);
    expect(gainToDb(0)).toBeLessThan(-100);
    expect(clamp(5, 0, 1)).toBe(1);
  });

  it('the seeded random source repeats and stays in [0,1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

function fakeParam() {
  const calls: Array<[string, number, number]> = [];
  return {
    calls,
    setValueAtTime: (v: number, t: number) => calls.push(['set', v, t]),
    linearRampToValueAtTime: (v: number, t: number) => calls.push(['lin', v, t]),
    exponentialRampToValueAtTime: (v: number, t: number) => calls.push(['exp', v, t]),
  };
}

describe('envelope', () => {
  const env: Adsr = { a: 0.002, d: 0.1, s: 0.5, r: 0.1 };

  it('a normal note: attack, decay to sustain, hold, release, silence', () => {
    const e = buildEnvelope(env, 1, 0.5, 0.8);
    expect(e.atGate).toBeCloseTo(0.4, 12);
    expect(e.end).toBeCloseTo(1 + 0.5 + 0.1 + FINAL_RAMP, 12);
    expect(envelopeAt(e.points, 1)).toBe(0);
    expect(envelopeAt(e.points, 1.002)).toBeCloseTo(0.8, 9);
    expect(envelopeAt(e.points, 1.3)).toBeCloseTo(0.4, 9);
    expect(envelopeAt(e.points, 1.5)).toBeCloseTo(0.4, 9);
    expect(envelopeAt(e.points, 1.6)).toBeLessThan(0.001);
    expect(envelopeAt(e.points, e.end)).toBe(0);
  });

  it('a note shorter than its attack stops where the attack got to (no click, no overshoot)', () => {
    const slow: Adsr = { a: 0.05, d: 0.1, s: 0.5, r: 0.05 };
    const e = buildEnvelope(slow, 0, 0.01, 1);
    expect(e.atGate).toBeCloseTo(0.2, 9);
    expect(Math.max(...e.points.map((p) => p.v))).toBeLessThanOrEqual(0.2 + 1e-12);
  });

  it('a note off inside the decay releases from the value the decay reached', () => {
    const e = buildEnvelope(env, 0, 0.05, 1);
    const expected = Math.pow(0.5, (0.05 - 0.002) / 0.1);
    expect(e.atGate).toBeCloseTo(expected, 9);
    expect(envelopeAt(e.points, 0.05)).toBeCloseTo(expected, 6);
  });

  it('no decay and full sustain stays flat until note off', () => {
    const flat: Adsr = { a: 0.002, d: 0, s: 1, r: 0.05 };
    const e = buildEnvelope(flat, 0, 0.3, 0.7);
    expect(envelopeAt(e.points, 0.15)).toBeCloseTo(0.7, 9);
  });

  it('is well formed for any parameters: ordered in time, finite, never above peak, ends at zero', () => {
    const rand = mulberry32(99);
    for (let i = 0; i < 2000; i++) {
      const adsr: Adsr = { a: rand() * 0.1, d: rand() * 0.5, s: rand(), r: rand() * 0.8 };
      const dur = rand() * 1.2;
      const peak = 0.05 + rand();
      const e = buildEnvelope(adsr, 3, dur, peak);
      let last = -Infinity;
      for (const p of e.points) {
        expect(Number.isFinite(p.v)).toBe(true);
        expect(p.v).toBeGreaterThanOrEqual(0);
        expect(p.v).toBeLessThanOrEqual(peak + 1e-12);
        expect(p.t).toBeGreaterThanOrEqual(last - 1e-12);
        last = p.t;
      }
      expect(e.points[e.points.length - 1]!.v).toBe(0);
      expect(e.end).toBeCloseTo(last, 12);
    }
  });

  it('exponential targets are never zero (the Web Audio API would throw)', () => {
    const e = buildEnvelope({ a: 0.001, d: 0.2, s: 0, r: 0.2 }, 0, 0.5, 1);
    const param = fakeParam();
    applyEnvelope(param, e.points);
    for (const [kind, v] of param.calls) if (kind === 'exp') expect(v).toBeGreaterThan(0);
    expect(ENV_FLOOR).toBeGreaterThan(0);
  });

  it('applyEnvelope replays the points in order', () => {
    const points: EnvPoint[] = [
      { t: 0, v: 0, kind: 'set' },
      { t: 1, v: 1, kind: 'lin' },
      { t: 2, v: 0.5, kind: 'exp' },
    ];
    const param = fakeParam();
    applyEnvelope(param, points);
    expect(param.calls.map((c) => c[0])).toEqual(['set', 'lin', 'exp']);
  });
});

function evalTable(t: FourierTable, phase: number): number {
  let y = 0;
  for (let n = 1; n < t.real.length; n++) y += t.real[n]! * Math.cos(n * phase) + t.imag[n]! * Math.sin(n * phase);
  return y;
}

function rmsOf(t: FourierTable, n = 4096): { rms: number; mean: number; peak: number } {
  let sum = 0;
  let sq = 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const y = evalTable(t, (2 * Math.PI * i) / n);
    sum += y;
    sq += y * y;
    peak = Math.max(peak, Math.abs(y));
  }
  return { rms: Math.sqrt(sq / n), mean: sum / n, peak };
}

describe('wave tables', () => {
  it.each(Object.entries(PULSE_DUTY))('%s has the requested RMS, no DC, and the right shape', (_id, duty) => {
    const t = pulseTable(duty);
    const { rms, mean } = rmsOf(t);
    expect(rms).toBeGreaterThan(WAVE_RMS * 0.97);
    expect(rms).toBeLessThan(WAVE_RMS * 1.03);
    expect(Math.abs(mean)).toBeLessThan(1e-3);
    // a pulse is high for `duty` of the cycle and low for the rest: sample the middle of each part
    const high = evalTable(t, 2 * Math.PI * duty * 0.5);
    const low = evalTable(t, 2 * Math.PI * (duty + (1 - duty) * 0.5));
    expect(high).toBeGreaterThan(0);
    expect(low).toBeLessThan(0);
  });

  it('a 50 percent pulse has only odd harmonics', () => {
    const t = pulseTable(0.5);
    for (let n = 2; n < t.imag.length; n += 2) {
      expect(Math.abs(t.imag[n]!)).toBeLessThan(1e-3);
      expect(Math.abs(t.real[n]!)).toBeLessThan(1e-3);
    }
    expect(Math.abs(t.imag[1]!)).toBeGreaterThan(0.1);
  });

  it('warm and organ tables are normalised', () => {
    for (const t of [warmTable(), organTable()]) {
      const { rms, mean } = rmsOf(t, 1024);
      expect(rms).toBeCloseTo(WAVE_RMS, 2);
      expect(Math.abs(mean)).toBeLessThan(1e-3);
    }
  });

  it('the stepped triangle has 32 steps and 16 levels', () => {
    const s = steppedTriangleSamples();
    expect(s.length).toBe(32);
    expect(new Set(s).size).toBe(16);
    expect(Math.max(...s)).toBeCloseTo(1, 12);
    expect(Math.min(...s)).toBeCloseTo(-1, 12);
  });

  it('the sawtooth rises through each half of the cycle, at the common level, with no DC', () => {
    const t = sawTable();
    const { rms, mean } = rmsOf(t);
    expect(rms).toBeCloseTo(WAVE_RMS, 2);
    expect(Math.abs(mean)).toBeLessThan(1e-3);
    expect(evalTable(t, 0.25 * Math.PI)).toBeLessThan(evalTable(t, 0.75 * Math.PI));
    expect(evalTable(t, 1.25 * Math.PI)).toBeLessThan(evalTable(t, 1.75 * Math.PI));
    expect(evalTable(t, 0.5 * Math.PI)).toBeGreaterThan(0);
    expect(evalTable(t, 1.5 * Math.PI)).toBeLessThan(0);
  });
});

describe('unit peak tables', () => {
  const tables: Record<string, FourierTable> = {
    p12: pulseTable(0.125),
    p25: pulseTable(0.25),
    p50: pulseTable(0.5),
    p75: pulseTable(0.75),
    saw: sawTable(),
    tri4: normalizeRms(tableToFourier(steppedTriangleSamples(), 16)),
    warm: warmTable(),
    organ: organTable(),
  };

  it('tablePeak finds the top of a sine and of a square (Gibbs overshoot included)', () => {
    const sine: FourierTable = { real: new Float32Array(2), imag: Float32Array.of(0, 0.8) };
    expect(tablePeak(sine)).toBeCloseTo(0.8, 3);
    const sq = pulseTable(0.5);
    const plateau = Math.abs(evalTable(sq, Math.PI / 2));
    expect(tablePeak(sq)).toBeGreaterThan(plateau * 1.05); // the ripple at the edge is the peak
    expect(tablePeak(sq)).toBeLessThan(plateau * 1.25);
  });

  it.each(Object.entries(tables))('%s: scaled to peak 1, and the reported peak restores its level', (_name, t) => {
    const before = rmsOf(t).rms;
    const { table, peak } = unitPeak(t);
    expect(tablePeak(table)).toBeCloseTo(1, 3);
    expect(rmsOf(table).rms * peak).toBeCloseTo(before, 3);
    expect(peak).toBeGreaterThan(0);
  });

  it('a short duty pulse needs a boost and a square needs a cut to sit at the same level', () => {
    expect(unitPeak(pulseTable(0.125)).peak).toBeGreaterThan(1.3);
    expect(unitPeak(pulseTable(0.5)).peak).toBeLessThan(0.7);
  });
});

describe('LFSR noise', () => {
  it('long mode has the NES period of 32767', () => {
    expect(lfsrCycle(false).length).toBe(32767);
  });

  it('short mode is the tonal 93 step loop', () => {
    expect(lfsrCycle(true).length).toBe(93);
  });

  it('is balanced (no DC) and bounded', () => {
    for (const short of [false, true]) {
      const c = lfsrCycle(short);
      let sum = 0;
      for (const v of c) {
        sum += v;
        expect(Math.abs(v)).toBeLessThanOrEqual(0.7 * 2);
      }
      expect(Math.abs(sum / c.length)).toBeLessThan(1e-4);
    }
  });
});

describe('master limiter curve', () => {
  const c = softClipCurve(2049);
  const at = (x: number) => c[Math.round(((x + 1) / 2) * (c.length - 1))]!;

  it('is unity below the knee', () => {
    for (const x of [0, 0.1, 0.25, KNEE - 0.01, -0.3, -KNEE + 0.01]) expect(at(x)).toBeCloseTo(x, 3);
  });

  it('reaches exactly the ceiling at full scale and never beyond', () => {
    expect(at(1)).toBeCloseTo(CEILING, 4);
    expect(at(-1)).toBeCloseTo(-CEILING, 4);
    expect(Math.max(...c)).toBeLessThanOrEqual(CEILING + 1e-6);
    expect(Math.min(...c)).toBeGreaterThanOrEqual(-CEILING - 1e-6);
  });

  it('is odd, monotonic and has no corner at the knee', () => {
    for (let i = 0; i < c.length; i++) expect(c[i]).toBeCloseTo(-c[c.length - 1 - i]!, 6);
    for (let i = 1; i < c.length; i++) expect(c[i]!).toBeGreaterThanOrEqual(c[i - 1]! - 1e-9);
    const step = 2 / (c.length - 1);
    const slope = (x: number) => (at(x + step) - at(x)) / step;
    const below = slope(KNEE - 0.05);
    const above = slope(KNEE + 0.02);
    expect(below).toBeCloseTo(1, 1);
    expect(above).toBeGreaterThan(0.85);
    expect(above).toBeLessThanOrEqual(1.01);
  });

  it('the ceiling leaves half a decibel under the promised minus three', () => {
    expect(gainToDb(CEILING)).toBeCloseTo(-3.5, 1);
    expect(gainToDb(PEAK_LIMIT)).toBeCloseTo(-3, 1);
    expect(CEILING).toBeLessThan(PEAK_LIMIT);
  });

  describe('the guard stage after it', () => {
    const g = guardCurve(8193);
    const gat = (x: number) => g[Math.round(((x + 1) / 2) * (g.length - 1))]!;

    it('is exactly transparent up to just above the limiter ceiling', () => {
      expect(GUARD_KNEE).toBeGreaterThan(CEILING);
      for (const x of [0, 0.2, 0.5, CEILING, GUARD_KNEE - 0.001, -CEILING, -0.3]) expect(gat(x)).toBeCloseTo(x, 3);
    });

    it('never outputs more than the promised peak, even for input far past full scale', () => {
      expect(GUARD_MAX).toBeLessThan(PEAK_LIMIT);
      expect(Math.max(...g)).toBeLessThanOrEqual(GUARD_MAX);
      expect(Math.min(...g)).toBeGreaterThanOrEqual(-GUARD_MAX);
      expect(gat(1)).toBeGreaterThan(GUARD_MAX - 0.001);
    });

    it('is odd, monotonic, and soaks up the limiter overshoot smoothly', () => {
      for (let i = 0; i < g.length; i++) expect(g[i]).toBeCloseTo(-g[g.length - 1 - i]!, 6);
      for (let i = 1; i < g.length; i++) expect(g[i]!).toBeGreaterThanOrEqual(g[i - 1]! - 1e-9);
      // a +0.4 dB overshoot above the ceiling lands under the promise, a +1.6 dB one too
      expect(gat(CEILING * 1.047)).toBeLessThan(GUARD_MAX);
      expect(gat(CEILING * 1.2)).toBeLessThan(GUARD_MAX);
    });
  });

  it('slider volumes are squared, clamped and NaN safe', () => {
    expect(volumeToGain(1)).toBe(1);
    expect(volumeToGain(0.5)).toBe(0.25);
    expect(volumeToGain(2)).toBe(1);
    expect(volumeToGain(-1)).toBe(0);
    expect(volumeToGain(Number.NaN)).toBe(0);
  });
});

describe('VoicePool', () => {
  it('refuses ordinary voices when full but always admits essential ones', () => {
    const pool = new VoicePool(3);
    for (let i = 0; i < 3; i++) expect(pool.tryAdd(0, 0, 10, false)).toBe(true);
    expect(pool.tryAdd(0, 0, 10, false)).toBe(false);
    expect(pool.tryAdd(0, 0, 10, true)).toBe(true);
    expect(pool.size).toBe(4);
  });

  it('counts overlap at the voice start time, so a long jingle does not block itself', () => {
    const pool = new VoicePool(2);
    // four notes in a row, each 1 s long, scheduled up front
    for (let i = 0; i < 4; i++) expect(pool.tryAdd(0, i, i + 1, false)).toBe(true);
    expect(pool.polyphony(1.5)).toBe(1);
  });

  it('forgets voices that are over', () => {
    const pool = new VoicePool(2);
    pool.tryAdd(0, 0, 1, false);
    pool.tryAdd(0, 0, 1, false);
    expect(pool.tryAdd(0.5, 0.5, 2, false)).toBe(false);
    expect(pool.tryAdd(1.5, 1.5, 2, false)).toBe(true);
    expect(pool.size).toBe(1);
  });
});

describe('noteVoice', () => {
  it('a steady note has no slide', () => {
    const v = noteVoice(INSTRUMENTS.lead, 440, 1, 0.5, 0.8);
    expect(v.slideTo).toBeUndefined();
    expect(v.slideTime).toBeUndefined();
  });

  it('a bend glides over the whole gated note, by that many semitones', () => {
    const fall = noteVoice(INSTRUMENTS.trombone, 440, 1, 1, 0.8, undefined, -12);
    expect(fall.slideTo).toBeCloseTo(220, 6);
    expect(fall.slideTime).toBeCloseTo(fall.dur, 9);
    const scoop = noteVoice(INSTRUMENTS.lead, 440, 1, 1, 0.8, undefined, 7);
    expect(scoop.slideTo).toBeCloseTo(440 * 2 ** (7 / 12), 6);
  });
});
