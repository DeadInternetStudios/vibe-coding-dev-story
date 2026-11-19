/**
 * Does the -3 dBFS promise hold when the game goes wrong? Plays the loudest song at full
 * intensity and drops 600 random sound effects into two seconds of it, on both backends,
 * and reports the sample peak. Exits 1 if anything leaves the engine above -3 dBFS.
 *
 *   npx tsx tools/audio/stress.ts [--sfx 600] [--song crunch]
 *
 * QUIET MACHINE: OfflineAudioContext only, and Chromium runs muted.
 */
import { OfflineAudioContext as NodeOfflineAudioContext } from 'node-web-audio-api';
import { SFX_IDS, type MusicId } from '../../src/audio/ids';
import { PEAK_LIMIT } from '../../src/audio/synth/master';
import { mulberry32 } from '../../src/audio/synth/notes';
import { renderInChromium } from './chromium';
import { renderJob, type OfflineCtor, type RenderJob, type RenderResult, type TimelineEvent } from './job';

function flag(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? (process.argv[at + 1] ?? fallback) : fallback;
}

function summarize(r: RenderResult): { peakDb: number; over: number; samples: number } {
  let peak = 0;
  let over = 0;
  for (const ch of [r.left, r.right]) {
    for (const v of ch) {
      const a = Math.abs(v);
      if (a > peak) peak = a;
      if (a > PEAK_LIMIT) over++;
    }
  }
  return { peakDb: 20 * Math.log10(Math.max(peak, 1e-9)), over, samples: r.left.length * 2 };
}

async function main(): Promise<void> {
  const count = Number(flag('sfx', '600'));
  const song = flag('song', 'crunch') as MusicId;
  const rand = mulberry32(7);
  const events: TimelineEvent[] = [{ at: 0, do: 'music', id: song, intensity: 1 }];
  for (let i = 0; i < count; i++) {
    events.push({ at: 1 + rand() * 2, do: 'sfx', id: SFX_IDS[Math.floor(rand() * SFX_IDS.length)]! });
  }
  events.sort((a, b) => a.at - b.at);
  const job: RenderJob = { kind: 'timeline', seconds: 8, events };

  const node = await renderJob(NodeOfflineAudioContext as unknown as OfflineCtor, job, 48000, 1);
  const [chrome] = await renderInChromium([job], 48000, 1);
  let bad = 0;
  for (const [name, r] of [
    ['node', node],
    ['chromium', chrome!],
  ] as const) {
    const s = summarize(r);
    const ok = s.over === 0;
    if (!ok) bad++;
    console.log(`${name.padEnd(9)} ${count} sfx over ${song}@100: peak ${s.peakDb.toFixed(2)} dBFS (limit ${(20 * Math.log10(PEAK_LIMIT)).toFixed(2)}), ${s.over} of ${s.samples} samples over  ${ok ? 'ok' : 'FAIL'}`);
  }
  if (bad) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
