/**
 * Lists the art the game asks for and does not have yet.
 *
 *   npx tsx tools/art/missing.ts
 *
 * Icons: every icon name the code uses, plus one per kind, niche, tool and channel.
 * Decor: every shop item art id. Nothing here draws or plays anything.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFromSource } from '../../src/content/runtime';
import { hasIcon } from '../../src/art/sprites/icons';
import { decorPx } from '../../src/art/sprites/decor';
import { SHOP } from '../../src/sim/shop';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      if (p.includes(join('src', 'art'))) continue;
      walk(p, out);
    } else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

const used = new Map<string, Set<string>>();
const note = (name: string, where: string) => {
  if (!used.has(name)) used.set(name, new Set());
  used.get(name)!.add(where);
};

const patterns = [/icon:\s*'([A-Za-z0-9_]+)'/g, /iconImg\([^,]+,\s*'([A-Za-z0-9_]+)'/g, /bakeIcon\([^,]+,\s*'([A-Za-z0-9_]+)'/g, /iconButton\([^,]+,[^,]+,[^,]+,[^,]+,\s*'([A-Za-z0-9_]+)'/g, /meter\([^,]+,[^,]+,\s*'([A-Za-z0-9_]+)'/g];
for (const file of walk(join(root, 'src'))) {
  const text = readFileSync(file, 'utf8');
  const isCards = file.endsWith(join('sim', 'cards.ts'));
  for (const re of patterns) for (const m of text.matchAll(re)) note(isCards ? `card_${m[1]!}` : m[1]!, file.replace(`${root}/`, ''));
}

const c = buildFromSource();
for (const k of c.kinds) note(`kind_${k.id}`, `kind ${k.name}`);
for (const n of c.niches) note(`niche_${n.id}`, `niche ${n.plural}`);
for (const t of c.tools) note(`tool_${t.id}`, `tool ${t.name}`);
for (const ch of c.channels) note(`chan_${ch.id}`, `channel ${ch.name}`);

const missing = [...used.keys()].filter((n) => !hasIcon(n)).sort();
console.log(`ICONS MISSING (${missing.length}). 8x8 for the first group, 12x12 for kind_, niche_, tool_, chan_ and card icons.`);
for (const n of missing) console.log(`  ${n.padEnd(22)} ${[...used.get(n)!].slice(0, 2).join(', ')}`);

const decor = SHOP.filter((i) => !decorPx(i.art));
console.log(`\nDECOR MISSING (${decor.length} of ${SHOP.length}). id, spot, name`);
for (const i of decor) console.log(`  ${i.art.padEnd(12)} ${i.spot.padEnd(7)} ${i.name}`);
