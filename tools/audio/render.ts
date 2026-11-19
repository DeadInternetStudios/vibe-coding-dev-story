/**
 * Offline renderer. Renders any sound effect or song to a WAV file through the
 * exact same engine code the game runs, using OfflineAudioContext only.
 *
 *   npx tsx tools/audio/render.ts sfx coin payday
 *   npx tsx tools/audio/render.ts sfx all
 *   npx tsx tools/audio/render.ts music office --loops 3 --intensity 0.5 --name office@50
 *   npx tsx tools/audio/render.ts music all --variants
 *   npx tsx tools/audio/render.ts music office --solo bass,kit   (those layers alone, name office#bass+kit)
 *   npx tsx tools/audio/render.ts all
 *   npx tsx tools/audio/render.ts timeline --seconds 40 --name demo \
 *       --events "0:music=office,12:intensity=0.2,20:duck=0.6/200,24:unduck=300,30:sfx=coin"
 *
 * Options: --out DIR (default tools/audio/out)  --sr 48000  --seed 1
 *          --backend node|chromium  (chromium runs the same job in headless
 *          Chromium with --mute-audio, still OfflineAudioContext only)
 *
 * QUIET MACHINE: nothing here can make sound. There is no AudioContext in this file.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OfflineAudioContext } from 'node-web-audio-api';
import { MUSIC_IDS, MUSIC_LABELS, SFX_CATALOG, type MusicId, type SfxId } from '../../src/audio/ids';
import { SONGS } from '../../src/audio/songs';
import { renderJob, type OfflineCtor, type RenderJob, type RenderResult, type TimelineEvent } from './job';
import { encodeWav } from './wav';

const HERE = dirname(fileURLToPath(import.meta.url));

interface Args {
  positional: string[];
  flags: Map<string, string | true>;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags.set(key, next);
        i++;
      } else flags.set(key, true);
    } else positional.push(a);
  }
  return { positional, flags };
}

export function parseEvents(src: string): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  for (const raw of src.split(',')) {
    const s = raw.trim();
    if (!s) continue;
    const m = /^([\d.]+):(\w+)(?:=(.*))?$/.exec(s);
    if (!m) throw new Error(`bad event "${s}"`);
    const at = Number(m[1]);
    const val = m[3] ?? '';
    switch (m[2]) {
      case 'sfx':
        out.push({ at, do: 'sfx', id: val as SfxId });
        break;
      case 'music': {
        const [id, inten] = val.split('@');
        out.push({ at, do: 'music', id: id as MusicId, intensity: inten !== undefined ? Number(inten) : undefined });
        break;
      }
      case 'stop':
        out.push({ at, do: 'stopMusic', fadeMs: val ? Number(val) : undefined });
        break;
      case 'intensity':
        out.push({ at, do: 'intensity', value: Number(val) });
        break;
      case 'tempo':
        out.push({ at, do: 'tempo', value: Number(val) });
        break;
      case 'duck': {
        const [amount, ms] = val.split('/');
        out.push({ at, do: 'duck', amount: Number(amount), ms: Number(ms ?? 200) });
        break;
      }
      case 'unduck':
        out.push({ at, do: 'unduck', ms: Number(val || 300) });
        break;
      case 'mute':
        out.push({ at, do: 'mute', value: val !== '0' && val !== 'false' });
        break;
      default:
        throw new Error(`unknown event action "${m[2]}"`);
    }
  }
  return out;
}

interface Planned {
  name: string;
  group: string;
  job: RenderJob;
  label: string;
  family: string;
}

function sfxJobs(ids: readonly SfxId[]): Planned[] {
  return ids.map((id) => {
    const entry = SFX_CATALOG.find((e) => e[0] === id);
    if (!entry) throw new Error(`unknown sfx id "${id}"`);
    return { name: id, group: 'sfx', job: { kind: 'sfx', id }, label: entry[1], family: entry[2] };
  });
}

function musicJobs(ids: readonly MusicId[], opts: { loops?: number; seconds?: number; intensity?: number; name?: string; variants?: boolean; solo?: string[] }): Planned[] {
  const out: Planned[] = [];
  for (const id of ids) {
    const song = SONGS[id];
    if (!song) {
      console.warn(`skip ${id}: no song yet`);
      continue;
    }
    const base = { kind: 'music', id, loops: opts.loops, seconds: opts.seconds } as const;
    if (opts.solo) {
      out.push({ name: opts.name ?? `${id}#${opts.solo.join('+')}`, group: 'music', job: { ...base, intensity: 1, solo: opts.solo }, label: `${MUSIC_LABELS[id]} (${opts.solo.join(' + ')} alone)`, family: 'music' });
      continue;
    }
    out.push({
      name: opts.name ?? (opts.intensity !== undefined ? `${id}@${Math.round(opts.intensity * 100)}` : id),
      group: 'music',
      job: { ...base, intensity: opts.intensity },
      label: MUSIC_LABELS[id],
      family: 'music',
    });
    const layered = song.tracks.some((t) => t.at > 0);
    if (opts.variants && layered) {
      for (const v of [0, 0.5, 1]) {
        if (Math.abs(v - song.defaultIntensity) < 0.01) continue; // the main render is already this one
        out.push({
          name: `${id}@${Math.round(v * 100)}`,
          group: 'music',
          job: { ...base, intensity: v },
          label: `${MUSIC_LABELS[id]} (intensity ${v})`,
          family: 'music',
        });
      }
    }
  }
  return out;
}

async function main(): Promise<void> {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [cmd, ...rest] = positional;
  const outDir = resolve(String(flags.get('out') ?? resolve(HERE, 'out')));
  const sampleRate = Number(flags.get('sr') ?? 48000);
  const seed = Number(flags.get('seed') ?? 1);
  const backend = String(flags.get('backend') ?? 'node');
  const loops = flags.has('loops') ? Number(flags.get('loops')) : undefined;
  const seconds = flags.has('seconds') ? Number(flags.get('seconds')) : undefined;
  const intensity = flags.has('intensity') ? Number(flags.get('intensity')) : undefined;
  const name = flags.has('name') ? String(flags.get('name')) : undefined;
  const variants = flags.has('variants');
  const solo = flags.has('solo') ? String(flags.get('solo')).split(',') : undefined;

  let planned: Planned[] = [];
  const allSfx = SFX_CATALOG.map((e) => e[0]);
  switch (cmd) {
    case 'sfx':
      planned = sfxJobs(rest.length === 0 || rest[0] === 'all' ? allSfx : (rest as SfxId[]));
      break;
    case 'music':
      planned = musicJobs(rest.length === 0 || rest[0] === 'all' ? MUSIC_IDS : (rest as MusicId[]), { loops, seconds, intensity, name, variants, solo });
      break;
    case 'all':
      planned = [...sfxJobs(allSfx), ...musicJobs(MUSIC_IDS, { loops, seconds, variants: true })];
      break;
    case 'timeline': {
      const evSrc = String(flags.get('events') ?? '');
      planned = [
        {
          name: name ?? 'timeline',
          group: 'timeline',
          job: { kind: 'timeline', seconds: seconds ?? 30, events: parseEvents(evSrc) },
          label: name ?? 'timeline',
          family: 'timeline',
        },
      ];
      break;
    }
    default:
      console.error('usage: render.ts <sfx|music|all|timeline> [ids...] [--out DIR] [--loops N] [--seconds S] [--intensity X] [--variants] [--backend node|chromium]');
      process.exit(2);
  }

  let results: RenderResult[];
  const t0 = Date.now();
  if (backend === 'chromium') {
    const { renderInChromium } = await import('./chromium');
    results = await renderInChromium(planned.map((p) => p.job), sampleRate, seed);
  } else {
    results = [];
    for (const p of planned) results.push(await renderJob(OfflineAudioContext as unknown as OfflineCtor, p.job, sampleRate, seed));
  }

  for (let i = 0; i < planned.length; i++) {
    const p = planned[i]!;
    const r = results[i]!;
    const dir = resolve(outDir, 'wav', p.group);
    mkdirSync(dir, { recursive: true });
    const file = resolve(dir, `${p.name}.wav`);
    writeFileSync(file, encodeWav(r.sampleRate, [r.left, r.right]));
    writeFileSync(
      resolve(dir, `${p.name}.json`),
      JSON.stringify({ name: p.name, group: p.group, label: p.label, family: p.family, backend, sampleRate: r.sampleRate, seconds: r.seconds, loopSeconds: r.loopSeconds, attempts: r.attempts, ...r.meta }, null, 2),
    );
  }
  console.log(`rendered ${planned.length} file(s) with ${backend} in ${((Date.now() - t0) / 1000).toFixed(1)}s into ${outDir}/wav`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
