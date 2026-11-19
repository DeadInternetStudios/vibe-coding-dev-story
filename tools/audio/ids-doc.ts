/**
 * Writes the id tables (every sound effect by family, every song with its layers) into the
 * `ids` block of docs/audio-notes.md, from the engine's own static lists, so the document cannot
 * drift from the code.
 *
 *   npx tsx tools/audio/ids-doc.ts            rewrite the block
 *   npx tsx tools/audio/ids-doc.ts --check    exit 1 if the block is out of date
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SoundEngine } from '../../src/audio/engine';
import { SONGS } from '../../src/audio/songs';

const NOTES = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/audio-notes.md');
const BEGIN = '<!-- AUTO:BEGIN ids -->';
const END = '<!-- AUTO:END ids -->';

function idsBlock(): string {
  const families = new Map<string, string[]>();
  for (const s of SoundEngine.SFX) families.set(s.family, [...(families.get(s.family) ?? []), s.id]);
  const lines = [`**Sound effects (${SoundEngine.SFX.length})**`, '', '| Family | Count | Ids |', '|---|---|---|'];
  for (const [family, ids] of families) lines.push(`| ${family} | ${ids.length} | ${ids.map((i) => `\`${i}\``).join(', ')} |`);
  lines.push(
    '',
    `**Music (${SoundEngine.MUSIC.length})**`,
    '',
    'A layer plays while the intensity is inside its window; `a-b` means from `a` to `b`, no window means the whole range.',
    '',
    '| Id | Label | Song | Layers |',
    '|---|---|---|---|',
  );
  for (const m of SoundEngine.MUSIC) {
    const song = SONGS[m.id];
    const window = (t: { id: string; at: number; to: number }): string => (t.at <= 0 && t.to >= 1 ? `\`${t.id}\`` : `\`${t.id}\` ${t.at}-${t.to}`);
    const layers = (song?.tracks ?? []).map(window).join(', ');
    const facts = song ? `${song.bpm} BPM, ${song.key}, ${song.bars} bars${song.loop ? ', loops' : ', plays once'}` : '';
    lines.push(`| \`${m.id}\` | ${m.label} | ${facts} | ${layers} |`);
  }
  return lines.join('\n') + '\n';
}

function main(): void {
  const text = existsSync(NOTES) ? readFileSync(NOTES, 'utf8') : '# Audio notes\n';
  const block = `${BEGIN}\n${idsBlock()}${END}`;
  const from = text.indexOf(BEGIN);
  const to = text.indexOf(END);
  const next = from >= 0 && to > from ? text.slice(0, from) + block + text.slice(to + END.length) : `${text.trimEnd()}\n\n${block}\n`;
  if (process.argv.includes('--check')) {
    if (next !== text) {
      console.error('docs/audio-notes.md: the ids block is out of date, run npx tsx tools/audio/ids-doc.ts');
      process.exit(1);
    }
    console.log('ids block is current');
    return;
  }
  writeFileSync(NOTES, next);
  console.log(`wrote ids block into ${NOTES}`);
}

main();
