/**
 * Plays one bot game and prints it month by month, to see where the money goes.
 *   npx tsx tools/trace.ts [seed=1] [strategy=smart] [difficulty=normal]
 */
import { playBot, type Strategy } from '../src/sim/bot';
import { buildFromSource } from '../src/content/runtime';
import { DAYS_PER_MONTH } from '../src/sim/config';
import { money } from '../src/sim/format';

const seed = Number(process.argv[2] ?? 1);
const strategy = (process.argv[3] ?? 'smart') as Strategy;
const difficulty = (process.argv[4] ?? 'normal') as 'chill' | 'normal' | 'ramen';
const content = buildFromSource();

let lastMonth = -1;
let shipped = 0;
const r = playBot(content, seed, strategy, difficulty, (g) => {
  const s = g.s;
  if (s.shipped.length > shipped) {
    const a = s.shipped[s.shipped.length - 1]!;
    console.log(`    LAUNCH day ${a.launchDay}: ${a.name} [${a.kind}/${a.niche}/${a.scope}] score ${a.score} q${a.quality} hype ${a.hype} stats ${Object.values(a.stats).join('/')} ratings ${a.ratings.join(',')} via ${a.channel}  lifetime ${money(a.lifetime)} karma +${a.karma}`);
    shipped = s.shipped.length;
  }
  const month = Math.floor(s.day / DAYS_PER_MONTH);
  if (month !== lastMonth && !g.pending) {
    lastMonth = month;
    const burn = s.staff.reduce((n, m) => n + m.salary, 0);
    console.log(
      `m${String(month).padStart(2)} day ${String(s.day).padStart(4)} cash ${money(s.company.cash).padStart(10)} staff ${s.staff.length} payroll ${money(burn)} tokens ${Math.round(s.company.tokens)} karma ${Math.round(s.company.karma)} spag ${Math.round(s.company.spaghetti)} apps ${s.shipped.length} ${s.project ? `building ${Math.round(s.project.progress)}%` : 'no project'}`,
    );
  }
});
console.log(`END day ${r.endDay} rank ${r.rank} bankrupt ${r.bankrupt} score ${Math.round(r.score)} apps ${r.apps}`);
console.log('last ledger lines:');
for (const l of r.game.s.ledger.slice(-14)) console.log('  ', JSON.stringify(l));
