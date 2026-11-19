/**
 * Writes tools/tts/lines.json, every voiced line the game can speak.
 * The voice pipeline renders whatever is in there and not yet in the manifest.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as content from '../src/content/index';

const here = dirname(fileURLToPath(import.meta.url));
const lines = content.collectVoiceLines(content).map((l) => ({
  id: l.id,
  voice: l.voice,
  text: l.text,
  ...(l.delivery ? { delivery: l.delivery } : {}),
}));
const out = resolve(here, 'tts/lines.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ version: 1, lines }, null, 2) + '\n');
const byVoice = new Map<string, number>();
for (const l of lines) byVoice.set(l.voice, (byVoice.get(l.voice) ?? 0) + 1);
console.log(`wrote ${lines.length} lines to ${out}`);
console.log([...byVoice.entries()].map(([k, v]) => `${k}:${v}`).join('  '));
