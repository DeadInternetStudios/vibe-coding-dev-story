/**
 * Lints every sprite family against the art brief and prints what is wrong.
 *
 *   npx tsx tools/art/check.ts [icons|decor|portraits|fx|logo|rooms|backdrop] [--quiet]
 *
 * Exits 1 when there is any error. Warnings are for your eyes: look again.
 */
import { checkAll, checkBackdrop, checkDecor, checkFx, checkIcons, checkLogo, checkPortraits, checkRooms } from './checks';
import type { Finding } from './lint';

const args = process.argv.slice(2);
const which = args.find((a) => !a.startsWith('--'));
const quiet = args.includes('--quiet');

const runners: Record<string, () => Finding[]> = { icons: checkIcons, decor: checkDecor, portraits: checkPortraits, fx: checkFx, logo: checkLogo, rooms: checkRooms, backdrop: checkBackdrop };
const findings = which ? (runners[which] ?? (() => { throw new Error(`no family "${which}": ${Object.keys(runners).join(', ')}`); }))() : checkAll();

const errors = findings.filter((f) => f.level === 'error');
const warns = findings.filter((f) => f.level === 'warn');
for (const f of [...errors, ...(quiet ? [] : warns)]) console.log(`${f.level.toUpperCase().padEnd(5)} ${f.sprite.padEnd(24)} ${f.msg}`);
console.log(`\n${errors.length} error(s), ${warns.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
