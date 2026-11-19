/**
 * Dumps every song as plain JSON (tracks, notes, harmony) into tools/audio/out/songs,
 * for the piano roll plots in analyze.py and for anything else that wants the notes.
 *
 *   npx tsx tools/audio/dump.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SONGS } from '../../src/audio/songs';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), 'out/songs');
mkdirSync(dir, { recursive: true });
let n = 0;
for (const song of Object.values(SONGS)) {
  if (!song) continue;
  const tracks = song.tracks.map((t) => ({ id: t.id, inst: t.inst, at: t.at, to: t.to, pan: t.pan, vol: t.vol, notes: t.notes }));
  writeFileSync(
    resolve(dir, `${song.id}.json`),
    JSON.stringify({ id: song.id, title: song.title, key: song.key, bpm: song.bpm, bars: song.bars, stepsPerBar: song.stepsPerBar, stepsPerBeat: song.stepsPerBeat, swing: song.swing, loop: song.loop, harmony: song.harmony, tracks }),
  );
  n++;
}
console.log(`dumped ${n} song(s) into ${dir}`);
