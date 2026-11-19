/**
 * Plays many whole games with bots and prints how they went.
 *   npx tsx tools/balance.ts [seeds=60] [difficulty=normal] [strategies=smart,casual,yolo,random,idle]
 */
import { playBot, type Strategy } from '../src/sim/bot';
import { buildFromSource } from '../src/content/runtime';
import { TOTAL_DAYS } from '../src/sim/config';

const seeds = Number(process.argv[2] ?? 60);
const difficulty = (process.argv[3] ?? 'normal') as 'chill' | 'normal' | 'ramen';
const content = buildFromSource();

const strategies = (process.argv[4] ?? 'smart,casual,yolo,random,idle').split(',') as Strategy[];

function pct(n: number, d: number): string {
  return `${Math.round((n / d) * 100)}%`.padStart(4);
}
function median(xs: number[]): number {
  const a = xs.slice().sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)] ?? 0;
}
function q(xs: number[], p: number): number {
  const a = xs.slice().sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(a.length * p))] ?? 0;
}

console.log(`difficulty ${difficulty}, ${seeds} seeds, ${TOTAL_DAYS} days per game`);
for (const strategy of strategies) {
  const rows = [];
  for (let seed = 1; seed <= seeds; seed++) rows.push(playBot(content, seed * 7919, strategy, difficulty));
  const ranks: Record<string, number> = {};
  for (const r of rows) ranks[r.rank] = (ranks[r.rank] ?? 0) + 1;
  const bankrupt = rows.filter((r) => r.bankrupt).length;
  const survived = rows.filter((r) => !r.bankrupt);
  const endDays = rows.filter((r) => r.bankrupt).map((r) => r.endDay);
  const apps = rows.map((r) => r.apps);
  const scores = rows.map((r) => r.score);
  const avg = rows.map((r) => r.avgScore);
  const cash = rows.map((r) => r.game.s.company.cash);
  const hires = rows.map((r) => r.game.s.counters.hires ?? 0);
  console.log(`\n== ${strategy} ==`);
  console.log(`  bankrupt ${pct(bankrupt, rows.length)}  (median end day ${median(endDays) || '-'})   survived ${survived.length}`);
  console.log(`  apps shipped  p10 ${q(apps, 0.1)}  median ${median(apps)}  p90 ${q(apps, 0.9)}`);
  console.log(`  avg app score p10 ${q(avg, 0.1).toFixed(1)}  median ${median(avg).toFixed(1)}  p90 ${q(avg, 0.9).toFixed(1)}`);
  console.log(`  final score   p10 ${Math.round(q(scores, 0.1))}  median ${Math.round(median(scores))}  p90 ${Math.round(q(scores, 0.9))}`);
  console.log(`  final cash    p10 ${Math.round(q(cash, 0.1))}  median ${Math.round(median(cash))}  p90 ${Math.round(q(cash, 0.9))}`);
  console.log(`  hires median ${median(hires)}`);
  console.log(`  ranks ${Object.entries(ranks).sort().map(([k, v]) => `${k}:${v}`).join(' ')}`);
}
