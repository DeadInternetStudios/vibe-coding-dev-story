/**
 * How much CPU does the sound engine need? Renders each song's full mix (intensity 1, every
 * layer on) offline, as fast as the machine allows, on node-web-audio-api and on a headless
 * Chromium, and reports the cost of one more second of music as a share of one core.
 *
 *   npx tsx tools/audio/cpu.ts [song ...]
 *
 * The time includes the engine's own scheduling (JavaScript) and the browser's graph rendering,
 * which are the two things a live game pays for. Other jobs on the machine inflate it, so read
 * the numbers as an upper bound. Looping songs are rendered at two lengths so the fixed cost of
 * building a context drops out of the slope; a song that plays once is timed at its own length.
 *
 * QUIET MACHINE: OfflineAudioContext only, and Chromium runs muted.
 */
import { cpus, loadavg } from 'node:os';
import { OfflineAudioContext as NodeOfflineAudioContext } from 'node-web-audio-api';
import { MUSIC_IDS, type MusicId } from '../../src/audio/ids';
import { SONGS } from '../../src/audio/songs';
import { loopSeconds } from '../../src/audio/sequencer';
import { withChromiumPage } from './chromium';
import { renderJob, type OfflineCtor, type RenderJob } from './job';

const SHORT = 10;
const LONG = 40;
const REPEATS = 2;

type Timer = (job: RenderJob) => Promise<number>;

const job = (id: MusicId, seconds?: number): RenderJob => ({ kind: 'music', id, intensity: 1, ...(seconds ? { seconds } : { loops: 1, tail: 0 }) });

async function best(time: Timer, j: RenderJob): Promise<number> {
  let min = Infinity;
  for (let i = 0; i < REPEATS; i++) min = Math.min(min, await time(j));
  return min;
}

/** Milliseconds of work per second of audio for one song. */
async function costPerSecond(time: Timer, id: MusicId): Promise<{ msPerSec: number; seconds: number }> {
  const song = SONGS[id]!;
  if (!song.loop) {
    const seconds = loopSeconds(song);
    return { msPerSec: (await best(time, job(id))) / seconds, seconds };
  }
  const short = await best(time, job(id, SHORT));
  const long = await best(time, job(id, LONG));
  return { msPerSec: (long - short) / (LONG - SHORT), seconds: LONG };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const ids = (args.length ? args : [...MUSIC_IDS]) as MusicId[];

  const node: Timer = async (j) => {
    const t0 = performance.now();
    await renderJob(NodeOfflineAudioContext as unknown as OfflineCtor, j, 48000, 1);
    return performance.now() - t0;
  };

  console.log(`${'song'.padEnd(10)}${'node ms/s'.padStart(11)}${'% core'.padStart(8)}${'chromium ms/s'.padStart(16)}${'% core'.padStart(8)}   (1 s of music costs this many ms; at real time that is the share of one core)`);
  await withChromiumPage(async (page) => {
    const chromium: Timer = (j) =>
      page.evaluate((a) => (window as unknown as { __timeJob: (j: RenderJob, sr: number, seed: number) => Promise<number> }).__timeJob(a, 48000, 1), j);
    let worst = 0;
    for (const id of ids) {
      const n = await costPerSecond(node, id);
      const c = await costPerSecond(chromium, id);
      worst = Math.max(worst, c.msPerSec / 10);
      console.log(`${id.padEnd(10)}${n.msPerSec.toFixed(1).padStart(11)}${(n.msPerSec / 10).toFixed(1).padStart(8)}${c.msPerSec.toFixed(1).padStart(16)}${(c.msPerSec / 10).toFixed(1).padStart(8)}`);
    }
    console.log(`\nworst song on Chromium: ${worst.toFixed(1)}% of one core. Machine load average ${loadavg()[0]!.toFixed(0)} on ${cpus().length} cores, so these are upper bounds.`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
