import { DAYS_PER_YEAR } from '../sim/config';
import { shortMoney, shortNumber } from '../sim/format';
import type { GameState } from '../sim/types';

const RANK_NAME: Record<string, string> = { S: 'UNICORN', A: 'SUCCESS', B: 'SURVIVED', C: 'MEH', D: 'ZOMBIE', F: 'RAN OUT' };

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** How long the run lasted, in plain words. */
function span(day: number): string {
  const years = Math.floor(day / DAYS_PER_YEAR);
  const months = Math.floor((day % DAYS_PER_YEAR) / 28);
  const parts = [years > 0 ? plural(years, 'year') : '', months > 0 || years === 0 ? plural(months, 'month') : ''].filter(Boolean);
  return parts.join(' ');
}

/** The post a player pastes into Reddit. Short, a little smug, and true. */
export function shareText(s: GameState, endingTitle: string | undefined, url: string): string {
  const end = s.ending;
  if (!end) return url;
  const best = s.shipped.slice().sort((a, b) => b.score - a.score)[0];
  const founder = s.staff.find((m) => m.isFounder)?.name ?? 'The founder';
  const quirks: string[] = [];
  const outages = s.counters.friday_incidents ?? 0;
  const gambles = s.counters.friday_deploys ?? 0;
  const scares = s.counters.bankrupt_scares ?? 0;
  if (gambles > 0) quirks.push(`${plural(gambles, 'Friday deploy', 'Friday deploys')}, ${plural(outages, 'outage')}`);
  if (scares > 0) quirks.push(`${plural(scares, 'bankruptcy scare')}`);
  if (s.counters.perfect_scores) quirks.push(`${plural(s.counters.perfect_scores, 'perfect 10', 'perfect 10s')} from Reddit`);
  const lines = [
    end.bankrupt
      ? `I vibe coded ${s.company.name} for ${span(end.day)} and the money ran out. Rank ${end.rank} (${RANK_NAME[end.rank] ?? ''}).`
      : `I vibe coded ${s.company.name} for ${span(end.day)} in Vibe Coding Dev Story. Rank ${end.rank} (${RANK_NAME[end.rank] ?? ''}).`,
    endingTitle ? `Ending: "${endingTitle}"` : '',
    '',
    `${plural(s.shipped.length, 'app')} shipped${best ? `, best was ${best.name} at ${best.score}/40 on Reddit` : ''}`,
    `Revenue ${shortMoney(s.company.totalRevenue)}, valuation ${shortMoney(end.valuation)}, karma ${shortNumber(s.company.karma)}, team of ${s.staff.length}`,
    ...quirks,
    `Final score ${end.score.toLocaleString('en-US')}. ${founder} says it was always part of the plan.`,
    '',
    url,
  ];
  return lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n');
}

/** Copy to the clipboard. Falls back to a hidden textarea where the clipboard API is blocked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea
  }
  try {
    const box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand('copy');
    box.remove();
    return ok;
  } catch {
    return false;
  }
}
