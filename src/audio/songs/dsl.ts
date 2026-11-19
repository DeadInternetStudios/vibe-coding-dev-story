import type { NoteEvent, Song, Track } from '../sequencer';
import type { DrumId } from '../synth/drums';
import type { InstrumentId } from '../synth/instruments';
import { noteToMidi, pitchClass } from '../synth/notes';

/**
 * Song notation. One token per step (a 16th note by default), one string per
 * bar, bars separated by "|" or given as an array.
 *
 *   C4 E4 F#3 Bb2     absolute note (C4 is middle C)
 *   1 3 5 7           chord tones of the chord active at that step (root, third, fifth, seventh)
 *   8                 root an octave up
 *   1' 5,             append ' for an octave up, , for an octave down
 *   @                 the whole chord as a fast tracker style arpeggio
 *   5+1'              two notes at once (a dyad or stab)
 *   -                 hold the previous note one more step
 *   .                 rest
 *   !  ~              suffix: accent / soft (no suffix is a normal hit)
 *
 * Drum lanes use x (hit), X (accent), o (ghost), . (rest) and - (hold, for risers).
 */

export interface TrackSpec {
  id: string;
  inst: InstrumentId;
  /** Octave the chord root sits in for chord tokens (C..B of this octave). Default 4. */
  octave?: number;
  at?: number;
  to?: number;
  pan?: number;
  vol?: number;
  bars: string | readonly string[];
}

export interface DrumTrackSpec {
  id: string;
  at?: number;
  to?: number;
  pan?: number;
  vol?: number;
  /** lane name -> bars. Lanes: k s h oh t tl tm th c r sh cr cb ri */
  lanes: Readonly<Record<string, string | readonly string[]>>;
}

export interface SongSpec {
  id: string;
  title: string;
  key: string;
  bpm: number;
  bars: number;
  beatsPerBar?: number;
  stepsPerBeat?: number;
  swing?: number;
  loop?: boolean;
  defaultIntensity?: number;
  /** Pitch classes allowed outside the key, for the diatonic check. */
  chromatic?: readonly string[];
  /** One entry per bar: "F", or "F,C" for two chords (each takes half the bar). */
  harmony: readonly string[];
  tracks: readonly (TrackSpec | DrumTrackSpec)[];
}

export const CHORD_QUALITIES: Readonly<Record<string, readonly number[]>> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '5': [0, 7, 12],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  '7sus4': [0, 5, 7, 10],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  add9: [0, 4, 7, 14],
  '9': [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  aug: [0, 4, 8],
};

export interface Chord {
  symbol: string;
  rootPc: number;
  intervals: readonly number[];
}

export function parseChord(symbol: string): Chord {
  const m = /^([A-G][#b]?)(.*)$/.exec(symbol.trim());
  if (!m) throw new Error(`audio: bad chord "${symbol}"`);
  const intervals = CHORD_QUALITIES[m[2]!];
  if (!intervals) throw new Error(`audio: unknown chord quality "${m[2]}" in "${symbol}"`);
  return { symbol, rootPc: pitchClass(m[1]!), intervals };
}

/** Pitch classes of a key. "F major", "A minor". Minor includes the raised 7th (harmonic). */
export function scaleOf(key: string): ReadonlySet<number> {
  const m = /^([A-G][#b]?)\s+(major|minor)$/.exec(key);
  if (!m) throw new Error(`audio: bad key "${key}"`);
  const root = pitchClass(m[1]!);
  const steps = m[2] === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10, 11];
  return new Set(steps.map((s) => (root + s) % 12));
}

/** Split a bar field into a flat list of single bar strings. */
export function normalizeBars(src: string | readonly string[]): string[] {
  const list = typeof src === 'string' ? [src] : src;
  const out: string[] = [];
  for (const s of list) for (const bar of s.split('|')) out.push(bar.trim());
  return out;
}

const DRUM_LANES: Readonly<Record<string, { drum: DrumId; tune?: number }>> = {
  k: { drum: 'kick' },
  s: { drum: 'snare' },
  h: { drum: 'hat' },
  oh: { drum: 'ohat' },
  t: { drum: 'tom' },
  tl: { drum: 'tom', tune: 0.74 },
  tm: { drum: 'tom', tune: 0.9 },
  th: { drum: 'tom', tune: 1.3 },
  c: { drum: 'clap' },
  r: { drum: 'rim' },
  sh: { drum: 'shaker' },
  cr: { drum: 'crash' },
  cb: { drum: 'cowbell' },
  ri: { drum: 'riser' },
};

const VEL_NORMAL = 0.8;
const VEL_ACCENT = 1;
const VEL_SOFT = 0.5;

interface Mutable {
  step: number;
  dur: number;
  pitch: number;
  vel: number;
  drum?: DrumId;
  arp?: readonly number[];
  tune?: number;
}

const ABS_NOTE = /^[A-G][#b]?\d$/;
const REL_NOTE = /^([1357@8])(['`,]*)$/;

function octaveShift(marks: string): number {
  let s = 0;
  for (const c of marks) s += c === ',' ? -12 : 12;
  return s;
}

function chordRootMidi(chord: Chord, octave: number): number {
  return 12 * (octave + 1) + chord.rootPc;
}

/** Midi pitches (and the arp offsets for '@') one token part resolves to. */
function resolvePart(part: string, chord: Chord, octave: number, where: string): { pitch: number; arp?: number[] } {
  if (ABS_NOTE.test(part)) return { pitch: noteToMidi(part) };
  const m = REL_NOTE.exec(part);
  if (!m) throw new Error(`audio: ${where}: cannot read token "${part}"`);
  const root = chordRootMidi(chord, octave);
  const shift = octaveShift(m[2]!);
  const iv = chord.intervals;
  switch (m[1]) {
    case '1':
      return { pitch: root + shift };
    case '3':
      return { pitch: root + iv[1]! + shift };
    case '5':
      return { pitch: root + iv[2]! + shift };
    case '7':
      return { pitch: root + (iv.length > 3 ? iv[3]! : 12) + shift };
    case '8':
      return { pitch: root + 12 + shift };
    default: {
      // '@': play the chord as a fast arpeggio around its root
      const tones = iv.filter((x) => x < 12);
      return { pitch: root + shift, arp: [...tones, 12] };
    }
  }
}

function velOf(tok: string): { core: string; vel: number } {
  const last = tok[tok.length - 1];
  if (last === '!') return { core: tok.slice(0, -1), vel: VEL_ACCENT };
  if (last === '~') return { core: tok.slice(0, -1), vel: VEL_SOFT };
  return { core: tok, vel: VEL_NORMAL };
}

function chordsForBar(chords: readonly Chord[][], bar: number, local: number, stepsPerBar: number): Chord {
  const list = chords[bar]!;
  const idx = Math.min(list.length - 1, Math.floor((local / stepsPerBar) * list.length));
  return list[idx]!;
}

function parsePitched(spec: TrackSpec, song: SongSpec, stepsPerBar: number, chords: readonly Chord[][]): NoteEvent[] {
  const bars = normalizeBars(spec.bars);
  if (bars.length !== song.bars) {
    throw new Error(`audio: ${song.id}/${spec.id}: expected ${song.bars} bars, got ${bars.length}`);
  }
  const octave = spec.octave ?? 4;
  const events: Mutable[] = [];
  let open: Mutable[] = [];

  bars.forEach((barStr, b) => {
    const tokens = barStr.split(/\s+/).filter(Boolean);
    if (tokens.length !== stepsPerBar) {
      throw new Error(`audio: ${song.id}/${spec.id} bar ${b + 1}: expected ${stepsPerBar} steps, got ${tokens.length}: "${barStr}"`);
    }
    tokens.forEach((tok, local) => {
      const step = b * stepsPerBar + local;
      const where = `${song.id}/${spec.id} bar ${b + 1} step ${local + 1}`;
      if (tok === '-') {
        if (open.length === 0) throw new Error(`audio: ${where}: "-" has nothing to hold`);
        for (const n of open) n.dur++;
        return;
      }
      open = [];
      if (tok === '.') return;
      const { core, vel } = velOf(tok);
      const chord = chordsForBar(chords, b, local, stepsPerBar);
      for (const part of core.split('+')) {
        const r = resolvePart(part, chord, octave, where);
        const n: Mutable = { step, dur: 1, pitch: r.pitch, vel, arp: r.arp };
        events.push(n);
        open.push(n);
      }
    });
  });
  return events;
}

function parseDrums(spec: DrumTrackSpec, song: SongSpec, stepsPerBar: number): NoteEvent[] {
  const events: Mutable[] = [];
  for (const [lane, src] of Object.entries(spec.lanes)) {
    const def = DRUM_LANES[lane];
    if (!def) throw new Error(`audio: ${song.id}/${spec.id}: unknown drum lane "${lane}"`);
    const bars = normalizeBars(src);
    if (bars.length !== song.bars) {
      throw new Error(`audio: ${song.id}/${spec.id}/${lane}: expected ${song.bars} bars, got ${bars.length}`);
    }
    let open: Mutable | null = null;
    bars.forEach((barStr, b) => {
      const tokens = barStr.split(/\s+/).filter(Boolean);
      if (tokens.length !== stepsPerBar) {
        throw new Error(`audio: ${song.id}/${spec.id}/${lane} bar ${b + 1}: expected ${stepsPerBar} steps, got ${tokens.length}: "${barStr}"`);
      }
      tokens.forEach((tok, local) => {
        const step = b * stepsPerBar + local;
        if (tok === '-') {
          if (open) open.dur++;
          return;
        }
        open = null;
        if (tok === '.') return;
        let vel: number;
        if (tok === 'x') vel = VEL_NORMAL;
        else if (tok === 'X') vel = VEL_ACCENT;
        else if (tok === 'o') vel = 0.45;
        else throw new Error(`audio: ${song.id}/${spec.id}/${lane} bar ${b + 1} step ${local + 1}: bad drum token "${tok}"`);
        const n: Mutable = { step, dur: 1, pitch: 0, vel, drum: def.drum, tune: def.tune };
        events.push(n);
        open = n;
      });
    });
  }
  return events;
}

function buildGrid(events: readonly NoteEvent[], totalSteps: number): Array<readonly NoteEvent[] | undefined> {
  const grid: Array<NoteEvent[] | undefined> = new Array<NoteEvent[] | undefined>(totalSteps).fill(undefined);
  for (const e of events) {
    (grid[e.step] ??= []).push(e);
  }
  return grid;
}

function isDrumSpec(t: TrackSpec | DrumTrackSpec): t is DrumTrackSpec {
  return 'lanes' in t;
}

/** Compile a song spec into plain sequencer data. Throws with a precise message on any slip. */
export function compileSong(spec: SongSpec): Song {
  const beatsPerBar = spec.beatsPerBar ?? 4;
  const stepsPerBeat = spec.stepsPerBeat ?? 4;
  const stepsPerBar = beatsPerBar * stepsPerBeat;
  const totalSteps = stepsPerBar * spec.bars;

  if (spec.harmony.length !== spec.bars) {
    throw new Error(`audio: ${spec.id}: harmony has ${spec.harmony.length} bars, song has ${spec.bars}`);
  }
  const chords = spec.harmony.map((h) => h.split(',').map((c) => parseChord(c)));

  const ids = new Set<string>();
  const tracks: Track[] = spec.tracks.map((t) => {
    if (ids.has(t.id)) throw new Error(`audio: ${spec.id}: duplicate track id "${t.id}"`);
    ids.add(t.id);
    const events = (isDrumSpec(t) ? parseDrums(t, spec, stepsPerBar) : parsePitched(t, spec, stepsPerBar, chords))
      .slice()
      .sort((a, b) => a.step - b.step);
    return {
      id: t.id,
      inst: isDrumSpec(t) ? 'drums' : t.inst,
      at: t.at ?? 0,
      to: t.to ?? 1,
      pan: t.pan ?? 0,
      vol: t.vol ?? 1,
      notes: events,
      grid: buildGrid(events, totalSteps),
    };
  });

  return {
    id: spec.id,
    title: spec.title,
    key: spec.key,
    bpm: spec.bpm,
    stepsPerBeat,
    beatsPerBar,
    stepsPerBar,
    bars: spec.bars,
    totalSteps,
    swing: spec.swing ?? 0,
    loop: spec.loop ?? true,
    defaultIntensity: spec.defaultIntensity ?? 1,
    chromatic: (spec.chromatic ?? []).map((n) => pitchClass(n)),
    harmony: spec.harmony,
    tracks,
  };
}
