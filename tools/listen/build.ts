/**
 * Builds docs/listening-pass.html, the checklist a person works through with headphones on.
 *
 *     npx tsx tools/listen/build.ts                   write docs/listening-pass.html
 *     npx tsx tools/listen/build.ts --out FILE        write somewhere else
 *     npx tsx tools/listen/build.ts --include-unused  also list clips the game never plays (audition takes)
 *     npx tsx tools/listen/build.ts --allow-missing   leave out clips whose MP3 is missing instead of failing
 *
 * It reads public/audio/vo/manifest.json, the MP3 bytes (a content hash tells the page when a clip was
 * rendered again), tools/tts/voices.json (what each voice is meant to sound like) and the game's own
 * content (src/content, the same walk `npm run vo:export` does). A clip is a game clip when the game
 * can say that line. It plays nothing. The output has no timestamp, so the same inputs give the same file.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import * as content from '../../src/content/index';
import type { DialogueStep } from '../../src/content/types';
import { countVoices, planTierA, planTierB, planTierC, type Manifest, type ManifestLine, type StoryBeat } from './tiers';
import type { Clip, PageData, VoiceInfo } from './types';

/** the six voices with the most clips make Tier A */
const TOP_VOICES = 6;
/** Tier C takes this share of the clips that are not in A or B */
const SAMPLE_RATE = 0.2;
/** the sign-off appears when this share of Tier C is marked */
const C_SHARE = 0.9;
const SEED = 'vcds-listening-pass-1';
const AUDIO_BASE = '../public/audio/vo/';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const voDir = join(root, 'public/audio/vo');

// ---- inputs ------------------------------------------------------------------------------------------------

function fail(message: string): never {
  console.error(`listen/build: ${message}`);
  process.exit(1);
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** manifest.json is the contract in docs/voice-contract.md. Check what this page relies on, name the first problems. */
function parseManifest(raw: unknown): Manifest {
  if (!isRecord(raw) || typeof raw.version !== 'number' || !isRecord(raw.voices) || !isRecord(raw.lines)) {
    return fail('manifest.json needs a numeric `version` and `voices` and `lines` objects.');
  }
  const voices: Record<string, { name: string }> = {};
  for (const [id, v] of Object.entries(raw.voices)) voices[id] = { name: isRecord(v) && typeof v.name === 'string' ? v.name : id };
  const lines: Record<string, ManifestLine> = {};
  const problems: string[] = [];
  for (const [id, l] of Object.entries(raw.lines)) {
    if (!isRecord(l) || typeof l.voice !== 'string' || typeof l.text !== 'string' || typeof l.file !== 'string' || typeof l.env !== 'string' || typeof l.dur !== 'number' || !Number.isFinite(l.dur)) {
      problems.push(id);
      continue;
    }
    const pairs = Array.isArray(l.words) ? l.words : [];
    const words = pairs.every((p) => Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number')
      ? pairs.map((p): readonly [number, number] => [Number(p[0]), Number(p[1])])
      : undefined;
    lines[id] = {
      voice: l.voice,
      text: l.text,
      file: l.file,
      dur: l.dur,
      env: l.env,
      ...(words !== undefined && words.length === l.text.split(/\s+/).filter((w) => w !== '').length ? { words } : {}),
      ...(typeof l.wer === 'number' ? { wer: l.wer } : {}),
    };
  }
  if (problems.length > 0) return fail(`${problems.length} manifest lines lack voice, text, file, dur or env. First: ${problems.slice(0, 3).join(', ')}`);
  return { version: raw.version, voices, lines };
}

interface VoiceMeta {
  readonly role: string;
  readonly description: string;
}

function readVoiceMeta(): Record<string, VoiceMeta> {
  const path = join(root, 'tools/tts/voices.json');
  if (!existsSync(path)) {
    console.warn('listen/build: tools/tts/voices.json not found, voices will have no description');
    return {};
  }
  const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const out: Record<string, VoiceMeta> = {};
  if (!isRecord(raw)) return out;
  for (const [id, v] of Object.entries(raw)) {
    if (isRecord(v)) out[id] = { role: typeof v.role === 'string' ? v.role : '', description: typeof v.description === 'string' ? v.description : '' };
  }
  return out;
}

// ---- the story, as beats -----------------------------------------------------------------------------------

const lineOf = (step: DialogueStep) => ({ id: step.line.id, voice: step.line.voice, text: step.line.text });
const narratorOnly = (steps: readonly DialogueStep[]) => steps.filter((s) => s.line.voice === 'narrator').map(lineOf);

/**
 * What a new player meets first, in the order story.ts declares it: the intro, every tutorial beat, the
 * deploy beats that play before the first thread, the Friday decision, and then every narrator line the
 * file has left (new month, investor meeting, awards finale). A clip appears once, under its first beat.
 */
function firstSessionBeats(): StoryBeat[] {
  const keyed = (label: string, record: Readonly<Record<string, readonly DialogueStep[]>>, only?: (steps: readonly DialogueStep[]) => ReturnType<typeof narratorOnly>) =>
    Object.entries(record).map(([key, steps]): StoryBeat => ({ label: `${label}: ${key}`, lines: only ? only(steps) : steps.map(lineOf) }));
  return [
    { label: 'Intro', lines: content.INTRO.map(lineOf) },
    ...keyed('Tutorial', content.TUTORIAL),
    { label: 'Deploy', lines: content.DEPLOY.map(lineOf) },
    ...keyed('Friday', content.FRIDAY),
    { label: 'Narrator: new month', lines: narratorOnly(content.MONTH_NARRATION) },
    ...keyed('Narrator: investor meeting', content.FUNDING, narratorOnly),
    ...Object.entries(content.YEAR_END).map(([year, steps]): StoryBeat => ({ label: `Narrator: Vibey Awards, year ${year}`, lines: narratorOnly(steps) })),
  ];
}

// ---- assembling --------------------------------------------------------------------------------------------

const sha1 = (data: Uint8Array | string): string => createHash('sha1').update(data).digest('hex');
const round2 = (n: number): number => Math.round(n * 100) / 100;

function toClip(id: string, line: ManifestLine, rev: string, unused: boolean): Clip {
  const words = line.words?.flatMap(([a, b]) => [round2(a), round2(b)]);
  return {
    id,
    v: line.voice,
    t: line.text,
    ...(line.file === `${id}.mp3` ? {} : { f: line.file }),
    d: line.dur,
    e: line.env,
    ...(words !== undefined ? { w: words } : {}),
    r: rev,
    ...(unused ? { u: true as const } : {}),
  };
}

function fontFace(weight: 400 | 700): string {
  const file = join(root, `node_modules/@fontsource/silkscreen/files/silkscreen-latin-${weight}-normal.woff2`);
  if (!existsSync(file)) {
    console.warn(`listen/build: ${relative(root, file)} not found, headings fall back to a system monospace face`);
    return '';
  }
  return `@font-face{font-family:'Silkscreen';font-style:normal;font-display:swap;font-weight:${weight};src:url(data:font/woff2;base64,${readFileSync(file).toString('base64')}) format('woff2');}\n`;
}

function bundlePage(): string {
  const result = buildSync({
    entryPoints: [join(here, 'page.ts')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    write: false,
    minify: false,
    legalComments: 'none',
    logLevel: 'silent',
  });
  const out = result.outputFiles[0];
  if (out === undefined) return fail('esbuild produced no output for page.ts');
  return out.text;
}

/** JSON inside a <script> tag: nothing in it may close the tag or end a JS line early */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

const minutes = (seconds: number): string => (seconds / 60).toFixed(2);

function main(): void {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf('--out');
  const outFile = outIndex >= 0 && args[outIndex + 1] !== undefined ? resolve(args[outIndex + 1] ?? '') : join(root, 'docs/listening-pass.html');
  const allowMissing = args.includes('--allow-missing');
  const includeUnused = args.includes('--include-unused');

  const manifestPath = join(voDir, 'manifest.json');
  if (!existsSync(manifestPath)) return fail(`${relative(root, manifestPath)} not found`);
  const parsed = parseManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));

  // The manifest also holds clips nothing plays: audition takes from casting, and lines that were reworded since.
  // The pass is about what a player can hear, so those stay off the page unless asked for.
  const gameIds = new Set(content.collectVoiceLines(content).map((l) => l.id));
  const inManifest = Object.keys(parsed.lines);
  const unusedIds = inManifest.filter((id) => !gameIds.has(id));
  const gameWithoutClip = [...gameIds].filter((id) => parsed.lines[id] === undefined);
  const wanted = inManifest.filter((id) => includeUnused || gameIds.has(id));

  // every clip on the page needs its MP3 on disk; the bytes give the revision hash
  const revs = new Map<string, string>();
  const missing: string[] = [];
  for (const id of wanted) {
    const file = join(voDir, parsed.lines[id]?.file ?? '');
    if (existsSync(file)) revs.set(id, sha1(readFileSync(file)).slice(0, 8));
    else missing.push(id);
  }
  if (missing.length > 0 && !allowMissing) {
    return fail(`${missing.length} of ${wanted.length} clips have no MP3 on disk (first: ${missing.slice(0, 3).join(', ')}). Fix that, or pass --allow-missing.`);
  }
  const manifest: Manifest = { ...parsed, lines: Object.fromEntries(wanted.filter((id) => revs.has(id)).map((id) => [id, parsed.lines[id] as ManifestLine])) };
  const leftOut = includeUnused ? 0 : unusedIds.length;

  const meta = readVoiceMeta();
  const counts = countVoices(manifest);
  const voices: VoiceInfo[] = counts.map((c) => ({
    id: c.voice,
    name: manifest.voices[c.voice]?.name ?? c.voice,
    role: meta[c.voice]?.role ?? '',
    description: meta[c.voice]?.description ?? '',
    clips: c.clips,
    seconds: round2(c.seconds),
  }));

  const a = planTierA(manifest, TOP_VOICES);
  const b = planTierB(manifest, firstSessionBeats());
  const c = planTierC(manifest, new Set([...a.ids, ...b.ids]), SAMPLE_RATE, SEED);

  const names = a.voices.map((v) => manifest.voices[v]?.name ?? v);
  const withoutTemplate: Omit<PageData, 'build'> = {
    format: 1,
    manifestVersion: manifest.version,
    audioBase: AUDIO_BASE,
    voices,
    clips: Object.keys(manifest.lines)
      .sort()
      .map((id) => toClip(id, manifest.lines[id] as ManifestLine, revs.get(id) ?? '', !gameIds.has(id))),
    leftOut,
    tiers: {
      A: { id: 'A', title: 'Most-heard voices', blurb: `Every clip of the ${a.voices.length} voices with the most clips: ${names.join(', ')}.`, ids: a.ids, groups: [] },
      B: { id: 'B', title: 'First session', blurb: 'What a new player hears first, in the order the game plays it. Intro, tutorial, first launch, the Friday decision, the narrator.', ids: b.ids, groups: b.groups },
      C: { id: 'C', title: 'Random 20% of the rest', blurb: `${c.ids.length} clips picked at random from the ${c.rest} not in Tier A or B. The same ${Math.round(SAMPLE_RATE * 100)}% from every voice, and the same pick on every build.`, ids: c.ids, groups: [] },
    },
    cShare: C_SHARE,
    seed: SEED,
    sampleRate: SAMPLE_RATE,
  };
  const data: PageData = { ...withoutTemplate, build: sha1(JSON.stringify(withoutTemplate)).slice(0, 8) };

  const css = `${fontFace(400)}${fontFace(700)}${readFileSync(join(here, 'page.css'), 'utf8')}`;
  const js = bundlePage();
  if (/<\/style/i.test(css)) return fail('page.css contains a closing style tag');
  const html = readFileSync(join(here, 'template.html'), 'utf8')
    .replace('{{CSS}}', () => css)
    .replace('{{DATA}}', () => jsonForScript(data))
    .replace('{{JS}}', () => js.replace(/<\/script/gi, '<\\/script'));
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, html);

  // ---- report ----
  const seconds = (ids: readonly string[]): number => ids.reduce((s, id) => s + (manifest.lines[id]?.dur ?? 0), 0);
  const inA = new Set(a.ids);
  const bAlsoA = b.ids.filter((id) => inA.has(id)).length;
  const union = new Set([...a.ids, ...b.ids, ...c.ids]);
  const all = Object.keys(manifest.lines);
  const perVoice = a.voices.map((v) => `${v} ${counts.find((x) => x.voice === v)?.clips ?? 0}`).join(', ');
  const pct = Math.round(SAMPLE_RATE * 100);
  console.log('Listening pass');
  console.log(`  manifest   ${inManifest.length} clips, manifest version ${manifest.version}; ${gameIds.size} game lines, ${gameWithoutClip.length} of them without a clip yet`);
  console.log(`  not played ${unusedIds.length} clips the game never plays (audition takes, reworded lines): ${includeUnused ? 'kept on the page, tagged (--include-unused)' : 'left off the page, pass --include-unused to add them'}`);
  console.log(`  on page    ${all.length} clips, ${voices.length} voices, ${minutes(seconds(all))} min; ${revs.size} of ${wanted.length} MP3 files present on disk${missing.length > 0 ? ` (${missing.length} left out)` : ''}`);
  console.log(`  Tier A     ${a.ids.length} clips, ${minutes(seconds(a.ids))} min   ${perVoice}`);
  console.log(`  Tier B     ${b.read} story lines read, ${b.matched} matched to clips, ${b.skipped} skipped (no exact match)`);
  console.log(`             ${b.ids.length} clips, ${minutes(seconds(b.ids))} min, ${bAlsoA} also in Tier A, ${b.ids.length - bAlsoA} only in B, ${b.groups.length} beats`);
  console.log(`  Tier C     ${c.ids.length} clips of ${c.rest} not in A or B (${pct}%), ${minutes(seconds(c.ids))} min, seed "${SEED}"`);
  console.log(`  to hear    ${union.size} distinct clips, ${minutes(seconds([...union]))} min`);
  console.log(`  wrote      ${relative(root, outFile)} (${Math.round(Buffer.byteLength(html) / 1024)} KB, build ${data.build})`);
}

main();
