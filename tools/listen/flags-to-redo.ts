/**
 * Turns flagged-lines.json (the page's "Export flags") into the commands that re-render those clips.
 *
 *     npx tsx tools/listen/flags-to-redo.ts flagged-lines.json          what to run, and what it can and cannot do
 *     npx tsx tools/listen/flags-to-redo.ts flagged-lines.json --cmd    only the re-render command, for a script
 *
 * It reads the manifest and tools/tts/lines*.json. It writes nothing and runs nothing.
 *
 * Why the report has a warning in it: tools/tts/generate.py can re-render a clip by id (`--redo-id`), but it
 * replays the seeds that clip was first rendered with. Same voice, same model, same seeds: the same take is the
 * expected result. A different take needs a different id (reword the line or change its delivery note) or a
 * change to the voice. The report says so instead of promising a fix.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REASONS } from './model';

export interface Flag {
  readonly clip: string;
  readonly voice: string;
  readonly text: string;
  readonly reasons: readonly string[];
  readonly note: string;
}

/** The part of the manifest this needs. */
export type ManifestLines = Readonly<Record<string, { readonly voice: string; readonly text: string }>>;

/** Lines files in the order generate.py merges them, with the ids each one lists. */
export type ListedIds = Readonly<Record<string, ReadonlySet<string>>>;

export interface RedoPlan {
  readonly flags: readonly Flag[];
  /** not in the manifest: the page was built from another manifest */
  readonly unknown: readonly Flag[];
  /** in the manifest with other text: the clip was re-rendered under a new line since the page was built */
  readonly changedText: readonly Flag[];
  /** can be named with --redo-id: some lines file lists the id */
  readonly redoable: readonly Flag[];
  /** in the manifest but in no lines file, so generate.py never looks at them */
  readonly notListed: readonly Flag[];
  /** the lines files to pass: the fewest that between them list every redoable id */
  readonly files: readonly string[];
  readonly byVoice: readonly (readonly [string, number])[];
  readonly byReason: readonly (readonly [string, number])[];
}

const LINES_FILES = ['lines.json', 'lines.seed.json', 'lines.extra.json'] as const;

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === 'string');
}

/** flagged-lines.json is `[{clip, voice, text, reasons, note}]`. Entries that do not fit are named, not guessed at. */
export function parseFlags(text: string): { flags: Flag[]; problems: string[] } {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return { flags: [], problems: ['The file is not valid JSON.'] };
  }
  if (!Array.isArray(doc)) return { flags: [], problems: ['The file should be a list: [{"clip": ..., "voice": ..., "text": ..., "reasons": [...], "note": ...}].'] };
  const flags: Flag[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  doc.forEach((entry: unknown, i) => {
    const o = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {};
    if (typeof o.clip !== 'string' || o.clip === '') {
      problems.push(`Entry ${i + 1} has no "clip".`);
      return;
    }
    if (seen.has(o.clip)) return;
    seen.add(o.clip);
    flags.push({
      clip: o.clip,
      voice: typeof o.voice === 'string' ? o.voice : o.clip.split('-')[0] ?? '',
      text: typeof o.text === 'string' ? o.text : '',
      reasons: isStringArray(o.reasons) ? o.reasons : [],
      note: typeof o.note === 'string' ? o.note : '',
    });
  });
  return { flags, problems };
}

function tally(items: readonly string[]): (readonly [string, number])[] {
  const counts = new Map<string, number>();
  for (const x of items) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
}

export function planRedo(flags: readonly Flag[], manifest: ManifestLines, listed: ListedIds): RedoPlan {
  const unknown: Flag[] = [];
  const changedText: Flag[] = [];
  const redoable: Flag[] = [];
  const notListed: Flag[] = [];
  for (const f of flags) {
    const line = manifest[f.clip];
    if (line === undefined) {
      unknown.push(f);
      continue;
    }
    if (f.text !== '' && f.text !== line.text) changedText.push(f);
    if (Object.values(listed).some((ids) => ids.has(f.clip))) redoable.push(f);
    else notListed.push(f);
  }
  // the fewest lines files that between them list every redoable id, in the order generate.py merges them
  const files: string[] = [];
  const covered = new Set<string>();
  for (const name of LINES_FILES) {
    const fresh = redoable.filter((f) => !covered.has(f.clip) && listed[name]?.has(f.clip));
    if (fresh.length === 0) continue;
    files.push(name);
    for (const f of fresh) covered.add(f.clip);
  }
  return {
    flags,
    unknown,
    changedText,
    redoable,
    notListed,
    files,
    byVoice: tally(flags.map((f) => f.voice)),
    byReason: tally(flags.flatMap((f) => (f.reasons.length > 0 ? f.reasons : ['no reason given']))),
  };
}

/** The generate.py command, to run inside tools/tts. `--dry-run` lists what would be rendered and loads no model. */
export function renderCommand(plan: RedoPlan, dryRun: boolean): string {
  const ids = plan.redoable.map((f) => `--redo-id ${f.clip}`).join(' ');
  return `.venv/bin/python generate.py --lines ${plan.files.join(' ')} ${ids}${dryRun ? ' --dry-run' : ''}`;
}

/** What each kind of flag usually needs. The ids are REASONS ids from model.ts. */
const ROUTES: Readonly<Record<string, string>> = {
  sung: 'reword the line, or give it a delivery note such as "flat, spoken, no melody"',
  stress: 'give the line a delivery note that names the stress, or reword it',
  glitch: 'reword the line or change its delivery note; the same seeds will glitch the same way',
  voice: 'the voice is off, not one clip: change its description in tools/tts/voices.json',
  level: 'change that voice\'s "trim" in tools/tts/voices.json; generate.py remasters from the stored raw takes when it has them',
  cutoff: 'reword the line or change its delivery note, then render the new id',
  other: 'read the note, then pick one of the routes above',
};

function reasonId(label: string): string {
  const found = REASONS.find((r) => r.label.toLowerCase() === label.toLowerCase() || r.id === label);
  return found?.id ?? 'other';
}

const list = (pairs: readonly (readonly [string, number])[]): string => pairs.map(([k, n]) => `${k} ${n}`).join(', ');
const some = (ids: readonly string[], n = 5): string => `${ids.slice(0, n).join(', ')}${ids.length > n ? `, and ${ids.length - n} more` : ''}`;

export function report(plan: RedoPlan, opts: { readonly venvExists: boolean }): string[] {
  const out: string[] = [];
  if (plan.flags.length === 0) return ['Nothing is flagged in that file. There is nothing to re-render.'];
  out.push(`${plan.flags.length} flagged clip${plan.flags.length === 1 ? '' : 's'}: ${list(plan.byVoice)}.`);
  out.push(`Reasons: ${list(plan.byReason)}.`);
  if (plan.unknown.length > 0) {
    out.push('', `Not in the manifest (${plan.unknown.length}): ${some(plan.unknown.map((f) => f.clip))}. The page was built from a different manifest, so these are skipped.`);
  }
  if (plan.changedText.length > 0) {
    out.push('', `The text in the manifest is not what was flagged for ${plan.changedText.length}: ${some(plan.changedText.map((f) => f.clip))}. Check that you flagged the clip you meant.`);
  }
  if (plan.notListed.length > 0) {
    out.push(
      '',
      `Cannot be re-rendered by id (${plan.notListed.length}): ${some(plan.notListed.map((f) => f.clip))}.`,
      'generate.py only looks at lines in a lines file. Run `npm run vo:export` in the repo root first. If an id is still missing, the game no longer says that line (an audition take, or the line was reworded), so there is nothing to re-render.',
    );
  }
  if (plan.redoable.length > 0) {
    out.push('', `Re-render by id (${plan.redoable.length}). Run these in tools/tts, after stopping watch.sh if it is running:`, '', '  cd tools/tts');
    if (!opts.venvExists) out.push('  ./setup.sh        # builds tools/tts/.venv, which this checkout does not have yet; the model weights (about 5 GB) download on first use');
    out.push(`  ${renderCommand(plan, true)}`, `  ${renderCommand(plan, false)}`);
  }
  out.push(
    '',
    'Read this before you run it',
    '  --redo-id replays the seeds each clip was first rendered with (generate.py, seed_for). With the same voice',
    '  description, model and ident.json, the expected result is the same take. generate.py has no switch that',
    '  re-renders one id with new seeds and keeps the result whatever the automatic score says.',
    '  What changes a take: a new id (reword the line, or change its delivery note, in src/content, then',
    '  `npm run vo:export` and generate.py; the old clip stays in the manifest, unused), or a change to the voice.',
  );
  const reasons = [...new Set(plan.flags.flatMap((f) => f.reasons.map(reasonId)))];
  if (reasons.length > 0) {
    out.push('', 'Where each kind of flag usually goes');
    for (const id of REASONS.map((r) => r.id).filter((r) => reasons.includes(r))) {
      const label = REASONS.find((r) => r.id === id)?.label ?? id;
      out.push(`  ${label}: ${ROUTES[id] ?? ''}`);
    }
  }
  return out;
}

function main(): void {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (file === undefined || args.includes('--help')) {
    console.log('Usage: npx tsx tools/listen/flags-to-redo.ts flagged-lines.json [--cmd]');
    process.exit(file === undefined && !args.includes('--help') ? 1 : 0);
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const path = resolve(file);
  if (!existsSync(path)) {
    console.error(`flags-to-redo: ${file} not found`);
    process.exit(1);
  }
  const { flags, problems } = parseFlags(readFileSync(path, 'utf8'));
  if (problems.length > 0 && flags.length === 0) {
    console.error(`flags-to-redo: ${file}: ${problems.join(' ')}`);
    process.exit(1);
  }
  for (const p of problems) console.error(`flags-to-redo: ${p}`);

  const manifestPath = join(root, 'public/audio/vo/manifest.json');
  const manifest: { lines?: ManifestLines } = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const listed: Record<string, ReadonlySet<string>> = {};
  for (const name of LINES_FILES) {
    const p = join(root, 'tools/tts', name);
    if (!existsSync(p)) continue;
    const doc: { lines?: { id?: unknown }[] } = JSON.parse(readFileSync(p, 'utf8'));
    listed[name] = new Set((doc.lines ?? []).map((l) => String(l.id)));
  }
  const plan = planRedo(flags, manifest.lines ?? {}, listed);
  if (args.includes('--cmd')) {
    if (plan.redoable.length === 0) process.exit(1);
    console.log(renderCommand(plan, false));
    return;
  }
  const venvExists = existsSync(join(root, 'tools/tts/.venv/bin/python'));
  console.log(`Read ${file}\n`);
  for (const line of report(plan, { venvExists })) console.log(line);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
