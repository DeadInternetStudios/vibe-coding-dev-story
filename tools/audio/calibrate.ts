/**
 * Loudness calibration. Reads the analyzer's measurements and rewrites
 * src/audio/levels.ts so every sound lands on its target:
 *
 *   sound effects  -14 LUFS (event loudness) plus the sound's own `level` offset
 *   music          -18 LUFS (one settled loop, or the whole song if it does not loop)
 *
 *   npx tsx tools/audio/render.ts all
 *   tools/audio/.venv/bin/python tools/audio/analyze.py
 *   npx tsx tools/audio/calibrate.ts          (dry run, prints the changes)
 *   npx tsx tools/audio/calibrate.ts --write  (writes src/audio/levels.ts)
 *   add --music or --sfx to touch only that half and keep the other as it is
 *   add --analysis <path> to calibrate against another analysis.json, e.g. the one made
 *   from the Chromium renders (tools/audio/out/chromium/analysis.json): the game runs in a
 *   browser, so that is the reference the final levels are set on
 *
 * new trim = trim in force when it was measured + (target - measured)
 * Boosts are limited so a sound effect's peak stays under -3.8 dBFS (just inside the limiter
 * ceiling of -3.5), and a song's 95th percentile frame peak stays under the start of the
 * limiter's soft knee (-6 dBFS), so the limiter only ever catches the odd peak.
 * Changes smaller than 0.25 dB are ignored so a second run is stable.
 * Two passes settle it. A trim beyond +/-9 dB is a hint to fix the sound itself.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MUSIC_IDS, SFX_IDS } from '../../src/audio/ids';
import { MUSIC_TRIM_DB, SFX_TRIM_DB } from '../../src/audio/levels';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
/** Measured peaks are after the master limiter (ceiling -3.5 dBFS), so this leaves a hair of room. */
const PEAK_CAP_DB = -3.8;
/** Where the master limiter's soft knee begins. */
const KNEE_START_DB = -6;
const DEADBAND_DB = 0.25;
const SUSPICIOUS_DB = 9;

interface Row {
  name: string;
  group: string;
  trim_db: number;
  loops?: boolean;
  peak_db: number;
  peak_p95_db?: number | null;
  lufs_event?: number;
  lufs_target: number;
  lufs_loop?: number | null;
  lufs_i?: number | null;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

function newTrim(row: Row, measured: number, current: number, headroom: number): { trim: number; capped: boolean } {
  const delta = row.lufs_target - measured;
  if (Math.abs(delta) < DEADBAND_DB) return { trim: current, capped: false };
  let trim = current + delta;
  let capped = false;
  if (delta > headroom) {
    trim = current + Math.max(headroom, 0);
    capped = true;
  }
  return { trim: round1(trim), capped };
}

function render(name: string, doc: string, type: string, entries: Array<[string, number]>): string {
  const body = entries
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `  ${k}: ${v},`)
    .join('\n');
  return `/** ${doc} */\nexport const ${name}: Readonly<Partial<Record<${type}, number>>> = {\n${body}${body ? '\n' : ''}};\n`;
}

function main(): void {
  const write = process.argv.includes('--write');
  const onlyMusic = process.argv.includes('--music');
  const onlySfx = process.argv.includes('--sfx');
  const doSfx = !onlyMusic;
  const doMusic = !onlySfx;
  const at = process.argv.indexOf('--analysis');
  const analysis = at >= 0 ? resolve(process.argv[at + 1] ?? '') : resolve(HERE, 'out/analysis.json');
  const rows = JSON.parse(readFileSync(analysis, 'utf8')) as Row[];
  console.log(`calibrating against ${analysis}`);

  const sfx = new Map<string, number>(Object.entries(SFX_TRIM_DB) as Array<[string, number]>);
  const music = new Map<string, number>(Object.entries(MUSIC_TRIM_DB) as Array<[string, number]>);
  const notes: string[] = [];

  for (const r of rows) {
    if (r.name.includes('@') || r.name.includes('#')) continue; // variants and solo layers are for looking at, not calibrating
    if (doSfx && r.group === 'sfx' && r.lufs_event !== undefined) {
      const { trim, capped } = newTrim(r, r.lufs_event, r.trim_db, PEAK_CAP_DB - r.peak_db);
      sfx.set(r.name, trim);
      if (capped) notes.push(`${r.name}: wants more level but its peak is ${r.peak_db.toFixed(1)} dBFS, so it is held at ${trim} dB. Reduce its crest in the design.`);
    } else if (doMusic && r.group === 'music') {
      const measured = r.loops ? r.lufs_loop : r.lufs_i;
      if (measured === null || measured === undefined) continue;
      const p95 = r.peak_p95_db;
      const headroom = r.loops && p95 !== null && p95 !== undefined ? KNEE_START_DB - p95 : PEAK_CAP_DB - r.peak_db;
      const { trim, capped } = newTrim(r, measured, r.trim_db, headroom);
      music.set(r.name, trim);
      if (capped) notes.push(`${r.name}: held at ${trim} dB, any louder and the limiter would work too hard (95% of frames peak at ${(p95 ?? r.peak_db).toFixed(1)} dBFS).`);
    }
  }

  const sfxEntries = SFX_IDS.map((id): [string, number] => [id, sfx.get(id) ?? 0]);
  const musicEntries = MUSIC_IDS.map((id): [string, number] => [id, music.get(id) ?? 0]);

  const file = `import type { MusicId, SfxId } from './ids';

/**
 * Loudness trims in dB, one per sound. Written by tools/audio/calibrate.ts from
 * offline renders so music lands near -18 LUFS and sound effects near -14 LUFS
 * (plus each sound's own \`level\`). Run the tool, do not edit by hand.
 */
${render('SFX_TRIM_DB', 'dB per sound effect, 0 when absent.', 'SfxId', sfxEntries)}
${render('MUSIC_TRIM_DB', 'dB per song, 0 when absent.', 'MusicId', musicEntries)}`;

  const loud = [...sfxEntries, ...musicEntries].filter(([, v]) => Math.abs(v) > SUSPICIOUS_DB);
  for (const [k, v] of loud) notes.push(`${k}: trim ${v} dB is large. The sound itself is mis-gained, fix it at the source.`);

  console.log(`sfx trims: ${[...sfx.values()].filter((v) => v !== 0).length} non zero of ${sfx.size}, music trims: ${[...music.values()].filter((v) => v !== 0).length} of ${music.size}`);
  for (const n of notes) console.log(`  note: ${n}`);

  if (write) {
    writeFileSync(resolve(ROOT, 'src/audio/levels.ts'), file);
    console.log('wrote src/audio/levels.ts');
  } else {
    console.log('dry run, pass --write to save');
    const spread = [...sfx.values()];
    console.log(`sfx trim range ${Math.min(...spread).toFixed(1)} .. ${Math.max(...spread).toFixed(1)} dB`);
  }
}

main();
