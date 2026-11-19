import type { Adsr } from './envelope';
import type { FilterSpec, LayerSpec, VibratoSpec, VoiceSpec } from './voice';

/**
 * Instrument presets. A voice is one or more oscillator layers through an ADSR
 * (plus optional vibrato and filter). Songs and sound effects refer to these by
 * name, so one tweak here retunes the whole game.
 *
 * `vol` is the peak gain of a full velocity note. Track and bus gains sit on top.
 */
export interface InstrumentDef {
  layers: readonly LayerSpec[];
  env: Adsr;
  vol: number;
  /** Fraction of the written note length that the gate stays open. Default 0.92. */
  gate?: number;
  vib?: VibratoSpec;
  filter?: FilterSpec;
  /** Steps per second for arpeggio tokens. Default 30. */
  arpRate?: number;
}

const vibLead: VibratoSpec = { rate: 5.6, depth: 11, delay: 0.16 };
const vibSoft: VibratoSpec = { rate: 5.0, depth: 8, delay: 0.22 };

export const INSTRUMENTS = {
  // ---- leads
  lead: { layers: [{ wave: 'p25' }], env: { a: 0.004, d: 0.09, s: 0.7, r: 0.08 }, vol: 0.34, gate: 0.94, vib: vibLead },
  leadSq: { layers: [{ wave: 'p50' }], env: { a: 0.004, d: 0.07, s: 0.62, r: 0.06 }, vol: 0.3, gate: 0.92, vib: vibSoft },
  leadThin: { layers: [{ wave: 'p12' }], env: { a: 0.003, d: 0.07, s: 0.5, r: 0.06 }, vol: 0.28, gate: 0.9, vib: vibLead },
  leadSoft: {
    layers: [{ wave: 'p50' }],
    env: { a: 0.012, d: 0.1, s: 0.75, r: 0.12 },
    vol: 0.32,
    gate: 0.95,
    vib: vibSoft,
    filter: { type: 'lowpass', f0: 3200, q: 0.7 },
  },
  leadChorus: {
    layers: [{ wave: 'p25' }, { wave: 'p50', detune: 9, vol: 0.55 }],
    env: { a: 0.006, d: 0.1, s: 0.68, r: 0.1 },
    vol: 0.27,
    gate: 0.95,
    vib: vibLead,
  },
  // ---- plucks and sparkles
  pluck: { layers: [{ wave: 'p25' }], env: { a: 0.002, d: 0.13, s: 0, r: 0.04 }, vol: 0.36, gate: 1 },
  pluckSq: { layers: [{ wave: 'p50' }], env: { a: 0.002, d: 0.11, s: 0, r: 0.04 }, vol: 0.3, gate: 1 },
  blip: { layers: [{ wave: 'p12' }], env: { a: 0.001, d: 0.06, s: 0, r: 0.03 }, vol: 0.3, gate: 1 },
  // ---- arps and chords
  arp: { layers: [{ wave: 'p25' }], env: { a: 0.002, d: 0.09, s: 0.3, r: 0.05 }, vol: 0.24, gate: 0.8 },
  arpThin: { layers: [{ wave: 'p12' }], env: { a: 0.002, d: 0.08, s: 0.25, r: 0.05 }, vol: 0.22, gate: 0.8 },
  arpSoft: {
    layers: [{ wave: 'p50' }],
    env: { a: 0.003, d: 0.1, s: 0.22, r: 0.06 },
    vol: 0.2,
    gate: 0.85,
    filter: { type: 'lowpass', f0: 3000, q: 0.7 },
  },
  chord: {
    layers: [{ wave: 'p25' }, { wave: 'p50', detune: -7, vol: 0.7 }],
    env: { a: 0.004, d: 0.16, s: 0.5, r: 0.1 },
    vol: 0.17,
    gate: 0.9,
  },
  stab: { layers: [{ wave: 'p25' }, { wave: 'p12', vol: 0.5 }], env: { a: 0.002, d: 0.1, s: 0, r: 0.05 }, vol: 0.22, gate: 1 },
  pad: {
    layers: [{ wave: 'p50' }, { wave: 'p50', detune: 9, vol: 0.8 }],
    env: { a: 0.1, d: 0.3, s: 0.8, r: 0.5 },
    vol: 0.14,
    gate: 1,
    filter: { type: 'lowpass', f0: 2200, q: 0.5 },
  },
  // ---- bass
  bass: { layers: [{ wave: 'tri' }], env: { a: 0.003, d: 0.06, s: 0.85, r: 0.06 }, vol: 0.5, gate: 0.88 },
  bassTight: { layers: [{ wave: 'tri' }], env: { a: 0.002, d: 0.1, s: 0.35, r: 0.04 }, vol: 0.55, gate: 0.8 },
  bassWarm: { layers: [{ wave: 'warm' }], env: { a: 0.004, d: 0.08, s: 0.75, r: 0.07 }, vol: 0.46, gate: 0.88 },
  bassPulse: {
    layers: [{ wave: 'p25', vol: 0.5 }, { wave: 'tri', ratio: 0.5, vol: 0.9 }],
    env: { a: 0.002, d: 0.1, s: 0.5, r: 0.05 },
    vol: 0.4,
    gate: 0.85,
  },
  bassStep: { layers: [{ wave: 'tri4' }], env: { a: 0.003, d: 0.07, s: 0.8, r: 0.06 }, vol: 0.5, gate: 0.88 },
  // ---- mallets and bells
  bell: {
    layers: [{ wave: 'sine' }, { wave: 'sine', ratio: 2.76, vol: 0.3 }, { wave: 'sine', ratio: 5.4, vol: 0.12 }],
    env: { a: 0.001, d: 0.5, s: 0, r: 0.25 },
    vol: 0.26,
    gate: 1,
  },
  glock: {
    layers: [{ wave: 'sine' }, { wave: 'sine', ratio: 4, vol: 0.35 }, { wave: 'sine', ratio: 6, vol: 0.15 }],
    env: { a: 0.001, d: 0.26, s: 0, r: 0.1 },
    vol: 0.22,
    gate: 1,
  },
  marimba: {
    layers: [{ wave: 'sine' }, { wave: 'sine', ratio: 4, vol: 0.25 }],
    env: { a: 0.001, d: 0.2, s: 0, r: 0.06 },
    vol: 0.34,
    gate: 1,
  },
  // ---- winds and brass
  organ: { layers: [{ wave: 'organ' }], env: { a: 0.01, d: 0.06, s: 0.85, r: 0.08 }, vol: 0.3, gate: 0.94 },
  brass: {
    layers: [{ wave: 'saw' }, { wave: 'saw', detune: 9, vol: 0.8 }],
    env: { a: 0.025, d: 0.15, s: 0.75, r: 0.12 },
    vol: 0.17,
    gate: 0.95,
    filter: { type: 'lowpass', f0: 600, f1: 2600, time: 0.1, q: 0.9 },
  },
  flute: {
    layers: [{ wave: 'sine' }, { wave: 'sine', ratio: 2, vol: 0.1 }],
    env: { a: 0.04, d: 0.1, s: 0.85, r: 0.12 },
    vol: 0.32,
    gate: 0.96,
    vib: { rate: 5.2, depth: 12, delay: 0.2 },
  },
} as const satisfies Record<string, InstrumentDef>;

export type InstrumentId = keyof typeof INSTRUMENTS;

export const INSTRUMENT_IDS = Object.keys(INSTRUMENTS) as InstrumentId[];

export function getInstrument(id: InstrumentId): InstrumentDef {
  return INSTRUMENTS[id];
}

/** Turn an instrument and a note into a voice. */
export function noteVoice(
  inst: InstrumentDef,
  freq: number,
  t: number,
  dur: number,
  vel: number,
  arp?: readonly number[],
): VoiceSpec {
  return {
    layers: inst.layers,
    t,
    dur: dur * (inst.gate ?? 0.92),
    freq,
    vol: inst.vol * vel,
    env: inst.env,
    vib: inst.vib,
    filter: inst.filter,
    arp: arp && arp.length > 1 ? { semis: arp, rate: inst.arpRate ?? 30 } : undefined,
  };
}
