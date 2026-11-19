/**
 * The three minute version of the listening pass: one clip per voice. Pure functions, no file access:
 * spot.ts reads the files and passes them in, the tests pass in small made-up manifests.
 */
import type { Manifest } from './tiers';

export interface SpotPick {
  readonly voice: string;
  readonly name: string;
  readonly id: string;
  readonly file: string;
  readonly text: string;
  readonly dur: number;
}

/** A clip this long is long enough to hear a voice and short enough to hear sixteen of them in a few minutes. */
export const SPOT_WINDOW = { min: 3, max: 9, ideal: 5.5 } as const;

/**
 * The lines tools/tts/cast.seed.md gives each voice, in the file's order. A voice starts at `## id`, a line is `- text`
 * with an optional `[delivery note]` at the end that is not part of what the voice says.
 */
export function parseSeedLines(md: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  let voice: string | undefined;
  for (const raw of md.split('\n')) {
    const head = /^##\s+([a-z0-9_-]+)\s*$/.exec(raw);
    if (head?.[1] !== undefined) {
      voice = head[1];
      out[voice] = [];
      continue;
    }
    const item = /^-\s+(.*?)\s*$/.exec(raw);
    if (voice !== undefined && item?.[1] !== undefined) {
      const text = item[1].replace(/\s*\[[^\]]*\]\s*$/, '').trim();
      if (text !== '') out[voice]?.push(text);
    }
  }
  return out;
}

/**
 * One clip for each voice in the manifest, in the manifest's voice order. A line from the cast seed file wins (they are
 * the lines each voice was written around), then the clip closest to a short ideal length. Nothing random.
 */
export function pickSpotClips(manifest: Manifest, seed: Readonly<Record<string, readonly string[]>>): SpotPick[] {
  const picks: SpotPick[] = [];
  for (const [voice, info] of Object.entries(manifest.voices)) {
    const own = Object.entries(manifest.lines).filter(([, line]) => line.voice === voice);
    if (own.length === 0) continue;
    const seeds = seed[voice] ?? [];
    const rank = ([id, line]: (typeof own)[number]): [number, number, number, string] => {
      const seeded = seeds.indexOf(line.text);
      const inWindow = line.dur >= SPOT_WINDOW.min && line.dur <= SPOT_WINDOW.max;
      return [inWindow ? 0 : 1, seeded >= 0 ? seeded : seeds.length + 1, Math.abs(line.dur - SPOT_WINDOW.ideal), id];
    };
    const best = own.slice().sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2] || (ra[3] < rb[3] ? -1 : ra[3] > rb[3] ? 1 : 0);
    })[0];
    if (best === undefined) continue;
    picks.push({ voice, name: info.name, id: best[0], file: best[1].file, text: best[1].text, dur: best[1].dur });
  }
  return picks;
}

export interface SpotMarks {
  readonly ok: number;
  readonly flagged: number;
  readonly open: number;
}

/** The one line a listener pastes into README.md or sends back. Names who heard it, when, how much, and what is still flagged. */
export function spotLine(name: string, date: string, picks: number, marks: SpotMarks, flaggedVoices: readonly string[]): string {
  const who = name.trim() === '' ? '<your name>' : name.trim();
  const flags = marks.flagged === 0 ? 'none flagged' : `${marks.flagged} flagged (${flaggedVoices.join(', ')})`;
  return `Voices spot-checked by ${who} on ${date}: ${picks} clips, one per voice, ${flags}.`;
}
