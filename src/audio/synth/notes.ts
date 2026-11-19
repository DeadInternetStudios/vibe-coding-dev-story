/**
 * Pure note math. C4 is MIDI 60 (middle C), A4 is MIDI 69 and 440 Hz.
 * Nothing here touches Web Audio, so it runs in node tests and in tools.
 */

const PITCH_CLASS: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const NOTE_RE = /^([A-G])([#b]?)(-?\d)$/;
const PC_RE = /^([A-G])([#b]?)$/;

/** 'F#' -> 6, 'Bb' -> 10. Throws on junk, because this runs at data compile time. */
export function pitchClass(name: string): number {
  const m = PC_RE.exec(name);
  if (!m) throw new Error(`audio: bad pitch class "${name}"`);
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (PITCH_CLASS[m[1]!]! + accidental + 12) % 12;
}

/** 'C4' -> 60, 'F#3' -> 54, 'Bb2' -> 46. */
export function noteToMidi(name: string): number {
  const m = NOTE_RE.exec(name);
  if (!m) throw new Error(`audio: bad note name "${name}"`);
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const octave = Number(m[3]);
  return 12 * (octave + 1) + PITCH_CLASS[m[1]!]! + accidental;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** A note name ('C5') or a plain frequency in Hz. */
export type PitchSpec = string | number;

export function toHz(p: PitchSpec): number {
  return typeof p === 'number' ? p : midiToFreq(noteToMidi(p));
}

/** Semitones to a frequency ratio. */
export function semitoneRatio(semis: number): number {
  return Math.pow(2, semis / 12);
}

export function centsToRatio(cents: number): number {
  return Math.pow(2, cents / 1200);
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function clamp01(x: number): number {
  return clamp(x, 0, 1);
}

/** dB to linear gain. */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export function gainToDb(g: number): number {
  return 20 * Math.log10(Math.max(g, 1e-9));
}

/** Small deterministic PRNG so renders and tests are repeatable. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
