import { describe, expect, it } from 'vitest';
import {
  MAX_LAG,
  Sequencer,
  barDuration,
  layerWanted,
  loopSeconds,
  stepDuration,
  swingOffset,
  type NoteEvent,
  type Song,
} from './sequencer';
import { compileSong } from './songs/dsl';

const BAR = (first: string) => `${first} . . . . . . . . . . . . . . .`;

/** 4 bars at 120 bpm: 'base' plays every beat, 'lead' once per bar and only above intensity 0.5. */
function fakeSong(over: { swing?: number; loop?: boolean; bars?: number } = {}): Song {
  const bars = over.bars ?? 4;
  const beat = 'C4 . . . C4 . . . C4 . . . C4 . . .';
  return compileSong({
    id: 'test',
    title: 'test',
    key: 'C major',
    bpm: 120,
    bars,
    swing: over.swing,
    loop: over.loop,
    harmony: Array.from({ length: bars }, () => 'C'),
    tracks: [
      { id: 'base', inst: 'arp', at: 0, bars: Array.from({ length: bars }, () => beat) },
      { id: 'lead', inst: 'lead', at: 0.5, bars: Array.from({ length: bars }, () => BAR('G4')) },
    ],
  });
}

interface Rec {
  track: number;
  note: NoteEvent;
  time: number;
  dur: number;
}

function runSong(song: Song, init?: { intensity?: number; tempoScale?: number }) {
  const notes: Rec[] = [];
  const layers: Array<{ track: number; on: boolean; time: number; immediate: boolean }> = [];
  const bars: Array<{ bar: number; time: number; loops: number }> = [];
  let ended: number | null = null;
  const seq = new Sequencer(
    song,
    {
      note: (track, note, time, dur) => notes.push({ track, note, time, dur }),
      layer: (track, on, time, immediate) => layers.push({ track, on, time, immediate }),
      bar: (bar, time, loops) => bars.push({ bar, time, loops }),
      end: (t) => {
        ended = t;
      },
    },
    init,
  );
  return { seq, notes, layers, bars, ended: () => ended };
}

const times = (recs: readonly Rec[], track: number) => recs.filter((n) => n.track === track).map((n) => n.time);

describe('timing math', () => {
  it('step, bar and loop lengths', () => {
    expect(stepDuration(120, 4)).toBeCloseTo(0.125, 10);
    expect(stepDuration(120, 4, 2)).toBeCloseTo(0.0625, 10);
    const song = fakeSong();
    expect(barDuration(song)).toBeCloseTo(2, 10);
    expect(loopSeconds(song)).toBeCloseTo(8, 10);
    expect(loopSeconds(song, 0.5)).toBeCloseTo(16, 10);
  });

  it('swing only moves the off beat eighth', () => {
    const step = stepDuration(120, 4);
    const offsets = Array.from({ length: 16 }, (_, i) => swingOffset(i, 4, 0.66, step));
    const moved = offsets.map((o, i) => (o > 0 ? i : -1)).filter((i) => i >= 0);
    expect(moved).toEqual([2, 6, 10, 14]);
    expect(offsets[2]).toBeCloseTo(0.66 * step, 10);
    expect(swingOffset(2, 4, 0, step)).toBe(0);
  });

  it('layers switch on at their threshold and keep a little hysteresis on the way off', () => {
    const t = { at: 0.5, to: 1 };
    expect(layerWanted(t, 0.49, false)).toBe(false);
    expect(layerWanted(t, 0.5, false)).toBe(true);
    expect(layerWanted(t, 0.47, true)).toBe(true); // already on: stays on inside the 0.04 band
    expect(layerWanted(t, 0.45, true)).toBe(false);
  });
});

describe('Sequencer', () => {
  it('schedules every step once, on the grid', () => {
    const { seq, notes } = runSong(fakeSong(), { intensity: 0 });
    seq.start(1);
    seq.tick(1, 2.1); // 1.0 .. 3.1: one bar plus the first step of the next
    expect(times(notes, 0)).toEqual([1, 1.5, 2, 2.5, 3].map((t) => expect.closeTo(t, 10)));
    const count = notes.length;
    seq.tick(1, 2.1); // same window again adds nothing
    expect(notes.length).toBe(count);
  });

  it('loops seamlessly: pass two starts exactly one loop later and the bar grid never stutters', () => {
    const song = fakeSong();
    const { seq, notes, bars } = runSong(song, { intensity: 0 });
    seq.start(0.5);
    seq.tick(0.5, 20);
    const firstSteps = notes.filter((n) => n.track === 0 && n.note.step === 0);
    expect(firstSteps[0]!.time).toBeCloseTo(0.5, 10);
    expect(firstSteps[1]!.time).toBeCloseTo(0.5 + loopSeconds(song), 10);
    expect(bars.slice(0, 6).map((b) => b.bar)).toEqual([0, 1, 2, 3, 0, 1]);
    expect(bars.slice(0, 6).map((b) => b.loops)).toEqual([0, 0, 0, 0, 1, 1]);
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i]!.time - bars[i - 1]!.time).toBeCloseTo(barDuration(song), 9);
    }
  });

  it('turns layers on at the next bar line, never mid bar', () => {
    const song = fakeSong();
    const { seq, notes, layers } = runSong(song, { intensity: 0.1 });
    seq.start(0);
    seq.tick(0, 1); // half way through bar 0
    expect(layers.filter((l) => l.on).map((l) => l.track)).toEqual([0]);
    seq.setIntensity(0.9);
    seq.tick(1, 3); // crosses into bar 1 at t = 2
    const leadOn = layers.find((l) => l.track === 1 && l.on)!;
    expect(leadOn.time).toBeCloseTo(barDuration(song), 10);
    expect(leadOn.immediate).toBe(false);
    const lead = times(notes, 1);
    expect(lead.length).toBeGreaterThan(0);
    expect(Math.min(...lead)).toBeGreaterThanOrEqual(barDuration(song) - 1e-9);
  });

  it('turns layers off at the next bar line and stops scheduling their notes', () => {
    const song = fakeSong();
    const { seq, notes, layers } = runSong(song, { intensity: 1 });
    seq.start(0);
    seq.tick(0, 2.5); // bar 0 and the start of bar 1 are already scheduled
    expect(times(notes, 1)).toEqual([0, 2].map((t) => expect.closeTo(t, 10)));
    seq.setIntensity(0);
    seq.tick(2.5, 6);
    const off = layers.find((l) => l.track === 1 && !l.on && !l.immediate)!;
    expect(off.time).toBeCloseTo(4, 10); // first bar line after the drop
    expect(times(notes, 1).length).toBe(2);
  });

  it('applies the first bar immediately, without a fade', () => {
    const { seq, layers } = runSong(fakeSong(), { intensity: 1 });
    seq.start(0);
    seq.tick(0, 0.2);
    expect(layers.length).toBe(2);
    expect(layers.every((l) => l.immediate)).toBe(true);
  });

  it('a tempo change takes effect on the next step with no gap and no overlap', () => {
    const { seq, notes } = runSong(fakeSong(), { intensity: 0 });
    seq.start(0);
    seq.tick(0, 0.5); // steps at 0, .125, .25, .375
    seq.setTempoScale(2);
    seq.tick(0.5, 1.5);
    const t = times(notes, 0);
    expect(t.slice(0, 4)).toEqual([0, 0.5, 0.75, 1].map((x) => expect.closeTo(x, 9)));
    expect(seq.getTempoScale()).toBe(2);
  });

  it('clamps tempo scale and intensity, and shrugs off NaN', () => {
    const { seq } = runSong(fakeSong());
    seq.setTempoScale(99);
    expect(seq.getTempoScale()).toBe(2);
    seq.setTempoScale(-5);
    expect(seq.getTempoScale()).toBe(0.5);
    seq.setTempoScale(Number.NaN);
    expect(seq.getTempoScale()).toBe(1);
    seq.setIntensity(5);
    expect(seq.getIntensity()).toBe(1);
    seq.setIntensity(-1);
    expect(seq.getIntensity()).toBe(0);
    seq.setIntensity(Number.NaN);
    expect(seq.getIntensity()).toBe(0);
  });

  it('swing delays the off beat eighth and leaves the on beats alone', () => {
    const song = compileSong({
      id: 'swing',
      title: 'swing',
      key: 'C major',
      bpm: 120,
      bars: 1,
      swing: 0.5,
      loop: false,
      harmony: ['C'],
      tracks: [{ id: 'eighths', inst: 'arp', bars: 'C4 . C4 . C4 . C4 . C4 . C4 . C4 . C4 .' }],
    });
    const { seq, notes } = runSong(song);
    seq.start(0);
    seq.tick(0, 5);
    const step = 0.125;
    const expected = [0, 2, 4, 6, 8, 10, 12, 14].map((s) => s * step + (s % 4 === 2 ? 0.5 * step : 0));
    expect(times(notes, 0)).toEqual(expected.map((x) => expect.closeTo(x, 9)));
  });

  it('a non looping song ends once and then goes quiet', () => {
    const { seq, notes, ended } = runSong(fakeSong({ loop: false, bars: 2 }), { intensity: 1 });
    seq.start(0);
    seq.tick(0, 100);
    expect(ended()).toBeCloseTo(4, 9);
    expect(seq.finished).toBe(true);
    const count = notes.length;
    seq.tick(100, 100);
    expect(notes.length).toBe(count);
  });

  it('skips ahead instead of firing a burst when the clock jumped far past the schedule', () => {
    const { seq, notes } = runSong(fakeSong(), { intensity: 1 });
    seq.start(0);
    seq.tick(0, 0.2);
    const before = notes.length;
    seq.tick(30, 1); // the tab slept for 30 s
    const late = notes.slice(before);
    expect(late.length).toBeGreaterThan(0);
    expect(late.length).toBeLessThan(12);
    expect(Math.min(...late.map((n) => n.time))).toBeGreaterThan(30 - MAX_LAG);
  });

  it('does nothing before start() and after stop()', () => {
    const { seq, notes } = runSong(fakeSong(), { intensity: 1 });
    seq.tick(0, 5);
    expect(notes.length).toBe(0);
    seq.start(0);
    seq.stop();
    seq.tick(0, 5);
    expect(notes.length).toBe(0);
    expect(seq.isRunning).toBe(false);
  });

  it('every note carries its written length in seconds', () => {
    const song = compileSong({
      id: 'lens',
      title: 'lens',
      key: 'C major',
      bpm: 120,
      bars: 1,
      loop: false,
      harmony: ['C'],
      tracks: [{ id: 'x', inst: 'lead', bars: 'C4 - - - E4 - . . G4 . . . . . . .' }],
    });
    const { seq, notes } = runSong(song);
    seq.start(0);
    seq.tick(0, 5);
    expect(notes.map((n) => n.dur)).toEqual([0.5, 0.25, 0.125].map((x) => expect.closeTo(x, 9)));
  });
});
