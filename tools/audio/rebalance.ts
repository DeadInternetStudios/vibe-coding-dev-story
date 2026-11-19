/**
 * Move a song's layers to where their roles want them next to the lead.
 *
 *   tools/audio/song.sh balance <song>              render every layer alone, write out/balance.json
 *   npx tsx tools/audio/rebalance.ts <song>          dry run, print each volume edit
 *   npx tsx tools/audio/rebalance.ts <song> --write  edit src/audio/songs/<song>.ts
 *
 * The targets live in analyze.py (LAYER_TARGET_REL). This only applies the factors it
 * measured, so it must run straight after `song.sh balance` for the same song.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rewriteVols, type LayerChange } from './rebalance-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SONGS = resolve(HERE, '../../src/audio/songs');

interface BalanceRow {
  song: string;
  layer: string;
  rel: number;
  want: number | null;
  change: number | null;
}

function main(): void {
  const song = process.argv[2];
  if (!song || song.startsWith('--')) {
    console.error('usage: rebalance.ts <song> [--write]');
    process.exit(1);
  }
  const write = process.argv.includes('--write');
  const store = resolve(HERE, 'out/balance.json');
  if (!existsSync(store)) {
    console.error(`no ${store}: run tools/audio/song.sh balance ${song} first`);
    process.exit(1);
  }
  const rows = (JSON.parse(readFileSync(store, 'utf8')) as BalanceRow[]).filter((r) => r.song === song);
  if (rows.length === 0) {
    console.error(`no balance rows for ${song}: run tools/audio/song.sh balance ${song} first`);
    process.exit(1);
  }
  const changes: LayerChange[] = rows.filter((r) => r.change !== null).map((r) => ({ layer: r.layer, change: r.change! }));
  const file = resolve(SONGS, `${song}.ts`);
  const { source, edits } = rewriteVols(readFileSync(file, 'utf8'), changes);

  for (const r of rows) {
    const e = edits.find((x) => x.layer === r.layer);
    const was = `${r.rel >= 0 ? '+' : ''}${r.rel.toFixed(1)} dB vs lead (wants ${r.want === null ? 'n/a' : r.want.toFixed(1)})`;
    console.log(`${song}.${r.layer.padEnd(8)} ${was.padEnd(40)} ${e ? `vol ${e.from} -> ${e.to}` : 'ok'}`);
  }
  if (edits.length === 0) console.log('balanced: nothing to change');
  else if (write) {
    writeFileSync(file, source);
    console.log(`wrote ${file}`);
  } else console.log('dry run, pass --write to save');
}

main();
