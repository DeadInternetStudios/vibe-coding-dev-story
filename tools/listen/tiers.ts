/**
 * Which clips a human has to hear. Pure functions, no file access: build.ts reads the files and
 * passes them in, the tests pass in small made-up manifests.
 *
 *   Tier A  every clip of the voices with the most clips
 *   Tier B  the story beats a new player meets first, matched to manifest clips
 *   Tier C  a seeded 20% sample of everything else, the same share from every voice
 */
import type { BeatGroup } from './types';

export interface ManifestLine {
  readonly voice: string;
  readonly text: string;
  readonly file: string;
  readonly dur: number;
  readonly env: string;
  readonly words?: readonly (readonly [number, number])[];
  readonly wer?: number;
}

export interface Manifest {
  readonly version: number;
  readonly voices: Readonly<Record<string, { readonly name: string }>>;
  readonly lines: Readonly<Record<string, ManifestLine>>;
}

/** One spoken line of the story, as the game's content module defines it. */
export interface StoryLine {
  readonly id: string;
  readonly voice: string;
  readonly text: string;
}

export interface StoryBeat {
  readonly label: string;
  readonly lines: readonly StoryLine[];
}

/** FNV-1a over UTF-8, 32 bit. The same hash the game uses for line ids. */
export function fnv1a32(input: string): number {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(input)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const byText = (manifest: Manifest) => (a: string, b: string): number => {
  const ta = manifest.lines[a]?.text.toLowerCase() ?? '';
  const tb = manifest.lines[b]?.text.toLowerCase() ?? '';
  return ta < tb ? -1 : ta > tb ? 1 : a < b ? -1 : a > b ? 1 : 0;
};

export interface VoiceCount {
  readonly voice: string;
  readonly clips: number;
  readonly seconds: number;
}

/** Every voice in the manifest, most clips first, ties by voice id. */
export function countVoices(manifest: Manifest): VoiceCount[] {
  const acc = new Map<string, { clips: number; seconds: number }>();
  for (const line of Object.values(manifest.lines)) {
    const row = acc.get(line.voice) ?? { clips: 0, seconds: 0 };
    row.clips += 1;
    row.seconds += line.dur;
    acc.set(line.voice, row);
  }
  return [...acc.entries()]
    .map(([voice, v]) => ({ voice, clips: v.clips, seconds: v.seconds }))
    .sort((a, b) => b.clips - a.clips || (a.voice < b.voice ? -1 : 1));
}

export interface TierAPlan {
  /** the chosen voices, most clips first */
  readonly voices: readonly string[];
  /** every clip of those voices, grouped by voice in that order, then by text */
  readonly ids: readonly string[];
}

export function planTierA(manifest: Manifest, topVoices: number): TierAPlan {
  const voices = countVoices(manifest).slice(0, topVoices).map((v) => v.voice);
  const compare = byText(manifest);
  const ids = voices.flatMap((voice) =>
    Object.keys(manifest.lines)
      .filter((id) => manifest.lines[id]?.voice === voice)
      .sort(compare),
  );
  return { voices, ids };
}

export interface TierBPlan {
  readonly groups: readonly BeatGroup[];
  /** story lines read */
  readonly read: number;
  /** story lines that became a clip (a clip that two beats share counts once per beat) */
  readonly matched: number;
  /** story lines with no clip in the manifest, skipped */
  readonly skipped: number;
  /** distinct clips in the tier */
  readonly ids: readonly string[];
}

/**
 * Match story lines to manifest clips. The id is the exact match (voice + text + delivery). When the id is
 * not in the manifest, a clip of the same voice and exact text is used if there is exactly one.
 * A clip appears once in the tier, under the first beat that has it.
 */
export function planTierB(manifest: Manifest, beats: readonly StoryBeat[]): TierBPlan {
  const byVoiceText = new Map<string, string[]>();
  for (const [id, line] of Object.entries(manifest.lines)) {
    const key = `${line.voice}\u0000${line.text}`;
    byVoiceText.set(key, [...(byVoiceText.get(key) ?? []), id]);
  }
  const seen = new Set<string>();
  const groups: BeatGroup[] = [];
  let read = 0;
  let matched = 0;
  let skipped = 0;
  for (const beat of beats) {
    const ids: string[] = [];
    for (const line of beat.lines) {
      read += 1;
      let id: string | undefined = manifest.lines[line.id] ? line.id : undefined;
      if (id === undefined) {
        const same = byVoiceText.get(`${line.voice}\u0000${line.text}`);
        if (same?.length === 1) id = same[0];
      }
      if (id === undefined) {
        skipped += 1;
        continue;
      }
      matched += 1;
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    if (ids.length > 0) groups.push({ label: beat.label, ids });
  }
  return { groups, read, matched, skipped, ids: groups.flatMap((g) => g.ids) };
}

/**
 * Split `total` seats over pools in proportion to pool size (largest remainder, ties by key), so the
 * seats add up to `total` exactly. A pool never gets more seats than it has clips.
 */
export function allocate(pools: Readonly<Record<string, number>>, total: number): Record<string, number> {
  const keys = Object.keys(pools).sort();
  const size = keys.reduce((n, k) => n + (pools[k] ?? 0), 0);
  const out: Record<string, number> = {};
  if (size === 0) return out;
  const shares = keys.map((k) => ({ k, exact: ((pools[k] ?? 0) * total) / size }));
  for (const s of shares) out[s.k] = Math.min(Math.floor(s.exact), pools[s.k] ?? 0);
  let left = total - Object.values(out).reduce((a, b) => a + b, 0);
  const order = [...shares].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)) || (a.k < b.k ? -1 : 1));
  for (let i = 0; left > 0 && i < order.length * 2; i += 1) {
    const s = order[i % order.length];
    if (s === undefined) break;
    const have = out[s.k] ?? 0;
    if (have < (pools[s.k] ?? 0)) {
      out[s.k] = have + 1;
      left -= 1;
    }
  }
  return out;
}

export interface TierCPlan {
  readonly ids: readonly string[];
  /** clips left after A and B */
  readonly rest: number;
  /** per voice: clips left, clips picked */
  readonly perVoice: Readonly<Record<string, { readonly pool: number; readonly picked: number }>>;
}

/**
 * A seeded sample of `rate` of the clips that are not in `excluded`, the same share from every voice.
 * Clips are ranked by hash(seed, id), so the sample does not change when unrelated clips are added.
 */
export function planTierC(manifest: Manifest, excluded: ReadonlySet<string>, rate: number, seed: string): TierCPlan {
  const pools = new Map<string, string[]>();
  for (const id of Object.keys(manifest.lines).sort()) {
    const line = manifest.lines[id];
    if (line === undefined || excluded.has(id)) continue;
    pools.set(line.voice, [...(pools.get(line.voice) ?? []), id]);
  }
  const sizes = Object.fromEntries([...pools.entries()].map(([voice, ids]) => [voice, ids.length]));
  const rest = Object.values(sizes).reduce((a, b) => a + b, 0);
  const seats = allocate(sizes, Math.ceil(rate * rest));
  const picked: string[] = [];
  const perVoice: Record<string, { pool: number; picked: number }> = {};
  for (const [voice, ids] of pools) {
    let n = seats[voice] ?? 0;
    if (n === 0 && ids.length > 0) n = 1;
    const ranked = ids
      .map((id) => ({ id, rank: fnv1a32(`${seed}|${id}`) }))
      .sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : 1))
      .slice(0, n)
      .map((x) => x.id);
    picked.push(...ranked);
    perVoice[voice] = { pool: ids.length, picked: ranked.length };
  }
  const order = new Map(countVoices(manifest).map((v, i) => [v.voice, i]));
  const compare = byText(manifest);
  picked.sort((a, b) => {
    const va = order.get(manifest.lines[a]?.voice ?? '') ?? 0;
    const vb = order.get(manifest.lines[b]?.voice ?? '') ?? 0;
    return va - vb || compare(a, b);
  });
  return { ids: picked, rest, perVoice };
}
