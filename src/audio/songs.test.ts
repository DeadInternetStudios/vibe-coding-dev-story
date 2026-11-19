import { describe, expect, it } from 'vitest';
import { SoundEngine } from './engine';
import { MUSIC_IDS, type MusicId } from './ids';
import { layerWanted, type Song, type Track } from './sequencer';
import { SONGS } from './songs';
import { parseChord, scaleOf } from './songs/dsl';
import { INSTRUMENTS } from './synth/instruments';

/** What the brief asks of each song. A song that exists must stay inside its row. */
const BRIEF: Readonly<Record<MusicId, { mode: 'major' | 'minor'; bpm: readonly [number, number]; bars: readonly [number, number]; loop: boolean }>> = {
  title: { mode: 'major', bpm: [112, 128], bars: [16, 32], loop: true },
  office: { mode: 'major', bpm: [100, 108], bars: [16, 32], loop: true },
  crunch: { mode: 'minor', bpm: [144, 152], bars: [16, 32], loop: true },
  thread: { mode: 'major', bpm: [92, 100], bars: [16, 32], loop: true },
  launch: { mode: 'major', bpm: [120, 150], bars: [16, 32], loop: true },
  awards: { mode: 'major', bpm: [96, 126], bars: [16, 32], loop: true },
  shop: { mode: 'major', bpm: [100, 135], bars: [16, 32], loop: true },
  win: { mode: 'major', bpm: [100, 160], bars: [2, 12], loop: false },
  lose: { mode: 'minor', bpm: [56, 100], bars: [1, 8], loop: false },
  menu: { mode: 'major', bpm: [70, 100], bars: [16, 32], loop: true },
};

const songs = (Object.entries(SONGS) as Array<[MusicId, Song | undefined]>).filter((e): e is [MusicId, Song] => e[1] !== undefined);

const melodic = (song: Song): Track[] => song.tracks.filter((t) => t.inst !== 'drums');
const pc = (midi: number): number => ((midi % 12) + 12) % 12;

/** Pitch classes of the chord sounding at a step of the loop. */
function chordTones(song: Song, step: number): Set<number> {
  const names = song.harmony[Math.floor(step / song.stepsPerBar)]!.split(',');
  const local = step % song.stepsPerBar;
  const which = Math.min(Math.floor(local / (song.stepsPerBar / names.length)), names.length - 1);
  const chord = parseChord(names[which]!);
  return new Set(chord.intervals.map((i) => (chord.rootPc + i) % 12));
}

const sweep = Array.from({ length: 21 }, (_, i) => i / 20);
const playing = (song: Song, intensity: number): Track[] => song.tracks.filter((t) => layerWanted(t, intensity, false));

describe('song data', () => {
  it('has a song to test', () => {
    expect(songs.length).toBeGreaterThan(0);
  });

  it('lists every song layer in the public MUSIC table', () => {
    for (const entry of SoundEngine.MUSIC) {
      const song = SONGS[entry.id];
      expect(entry.layers, entry.id).toEqual((song?.tracks ?? []).map((t) => t.id));
    }
    expect(SoundEngine.MUSIC.map((m) => m.id)).toEqual([...MUSIC_IDS]);
  });

  describe.each(songs)('%s', (id, song) => {
    const brief = BRIEF[id];

    it('is filed under its own id', () => {
      expect(song.id).toBe(id);
    });

    it('stays inside the brief: mode, tempo, length, looping', () => {
      expect(song.key.endsWith(brief.mode), `${song.key} should be ${brief.mode}`).toBe(true);
      expect(song.bpm).toBeGreaterThanOrEqual(brief.bpm[0]);
      expect(song.bpm).toBeLessThanOrEqual(brief.bpm[1]);
      expect(song.bars).toBeGreaterThanOrEqual(brief.bars[0]);
      expect(song.bars).toBeLessThanOrEqual(brief.bars[1]);
      expect(song.loop).toBe(brief.loop);
    });

    it('has consistent step maths and one chord entry per bar', () => {
      expect(song.stepsPerBar).toBe(song.beatsPerBar * song.stepsPerBeat);
      expect(song.totalSteps).toBe(song.bars * song.stepsPerBar);
      expect(song.harmony).toHaveLength(song.bars);
      for (const symbol of song.harmony.flatMap((h) => h.split(','))) expect(() => parseChord(symbol)).not.toThrow();
    });

    it('has real notes in every track, inside the loop, on a known instrument', () => {
      for (const t of song.tracks) {
        expect(t.notes.length, `${t.id} is empty`).toBeGreaterThan(0);
        if (t.inst !== 'drums') expect(INSTRUMENTS[t.inst], `${t.id} uses an unknown instrument`).toBeDefined();
        for (const n of t.notes) {
          expect(n.step).toBeGreaterThanOrEqual(0);
          expect(n.dur).toBeGreaterThan(0);
          expect(n.step + n.dur, `${t.id} note at step ${n.step} runs past the loop end`).toBeLessThanOrEqual(song.totalSteps);
          expect(n.vel).toBeGreaterThan(0);
          expect(n.vel).toBeLessThanOrEqual(1.25);
          if (t.inst === 'drums') expect(n.drum, `${t.id} drum note without a drum`).toBeDefined();
          expect(t.grid[n.step]).toContain(n);
        }
      }
    });

    it('keeps bass low and leads high', () => {
      for (const t of melodic(song)) {
        const pitches = t.notes.map((n) => n.pitch);
        const lo = Math.min(...pitches);
        const hi = Math.max(...pitches);
        if (t.inst.startsWith('bass')) {
          // bassPulse stacks a pulse at the written pitch on a triangle an octave below, so it is written an octave up
          const writtenUp = t.inst === 'bassPulse';
          expect(lo, `${t.id} lowest note`).toBeGreaterThanOrEqual(writtenUp ? 40 : 28);
          expect(hi, `${t.id} highest note`).toBeLessThanOrEqual(writtenUp ? 72 : 60);
        } else if (t.inst.startsWith('lead')) {
          expect(lo, `${t.id} lowest note`).toBeGreaterThanOrEqual(55);
          expect(hi, `${t.id} highest note`).toBeLessThanOrEqual(100);
        } else {
          expect(lo, `${t.id} lowest note`).toBeGreaterThanOrEqual(24);
          expect(hi, `${t.id} highest note`).toBeLessThanOrEqual(108);
        }
      }
    });

    it('plays in key: notes are in the scale, in the chord, or declared chromatic', () => {
      const scale = scaleOf(song.key);
      for (const t of melodic(song)) {
        const bad = t.notes.filter((n) => !scale.has(pc(n.pitch)) && !song.chromatic.includes(pc(n.pitch)) && !chordTones(song, n.step).has(pc(n.pitch)));
        const share = bad.length / t.notes.length;
        expect(share, `${t.id}: ${bad.length} of ${t.notes.length} notes are out of key, first at steps ${bad.slice(0, 4).map((n) => n.step).join(', ')}`).toBeLessThanOrEqual(0.02);
      }
    });

    it('lands the lead on chord tones when the beat falls', () => {
      for (const t of melodic(song).filter((x) => x.inst.startsWith('lead'))) {
        const onBeat = t.notes.filter((n) => n.step % song.stepsPerBeat === 0);
        if (onBeat.length < 8) continue;
        const good = onBeat.filter((n) => chordTones(song, n.step).has(pc(n.pitch))).length;
        expect(good / onBeat.length, `${t.id} on-beat chord tones`).toBeGreaterThanOrEqual(0.7);
      }
    });

    it('is never silent, at any intensity', () => {
      for (const i of sweep) {
        expect(playing(song, i).filter((t) => t.inst !== 'drums').length, `intensity ${i} has no melodic layer`).toBeGreaterThan(0);
      }
    });

    it('adds layers as intensity rises and never drops below its quiet floor', () => {
      expect(playing(song, 1).length).toBeGreaterThanOrEqual(playing(song, 0).length - 1);
      expect(playing(song, 1).length).toBeGreaterThanOrEqual(Math.min(song.tracks.length, 4));
      expect(playing(song, 0).length).toBeGreaterThanOrEqual(2);
    });

    it('starts the loop on a downbeat at its default intensity', () => {
      const first = playing(song, song.defaultIntensity).filter((t) => (t.grid[0]?.length ?? 0) > 0);
      expect(first.length, 'nothing sounds on step 0').toBeGreaterThan(0);
    });

    it('does not repeat one identical bar for the whole song', () => {
      for (const t of melodic(song).filter((x) => x.notes.length > 8)) {
        const bars = new Set<string>();
        for (let b = 0; b < song.bars; b++) {
          const sig = t.notes
            .filter((n) => n.step >= b * song.stepsPerBar && n.step < (b + 1) * song.stepsPerBar)
            .map((n) => `${n.step - b * song.stepsPerBar}:${n.pitch}:${n.dur}`)
            .join(' ');
          bars.add(sig);
        }
        if (song.bars >= 16) expect(bars.size, `${t.id} plays the same bar throughout`).toBeGreaterThan(1);
      }
    });
  });
});
