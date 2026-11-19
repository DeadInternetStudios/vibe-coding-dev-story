/**
 * Does a note begin exactly when it was told to, on node-web-audio-api and in a browser?
 * Starts each wave at many fractional sample positions, in each way a voice can be driven, and
 * prints the worst error in samples, relative to the first start (a wave's own phase offset is
 * not an error).
 *
 *   npx tsx tools/audio/startprobe.ts [wave ...] [--rows]      default: native:sine p25 saw
 *
 * QUIET MACHINE: OfflineAudioContext only, and Chromium runs muted.
 */
import { OfflineAudioContext as NodeOfflineAudioContext } from 'node-web-audio-api';
import { withChromiumPage } from './chromium';
import type { OfflineCtor } from './job';
import { probeStarts, type StartMode, type StartRow } from './start-core';

const MODES: readonly StartMode[] = ['value', 'event', 'lfo', 'value+lfo'];

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const waves = args.length ? args : ['native:sine', 'p25', 'saw'];
  const rows = process.argv.includes('--rows');
  const worst = (r: StartRow[]): number => Math.max(...r.map((x) => Math.abs(x.error)));
  console.log('worst start error in samples (1 = 20.8 us at 48 kHz); the quantum is 128 samples');
  console.log(`${'wave'.padEnd(12)}${'frequency set by'.padEnd(18)}${'node'.padStart(8)}${'chromium'.padStart(10)}`);
  for (const wave of waves) {
    for (const mode of MODES) {
      const node = await probeStarts(NodeOfflineAudioContext as unknown as OfflineCtor, wave, 24, mode);
      const chrome = await withChromiumPage((page) =>
        page.evaluate(
          (a) => (window as unknown as { __probeStarts: (w: string, m: StartMode) => Promise<StartRow[]> }).__probeStarts(a.wave, a.mode),
          { wave, mode },
        ),
      );
      const label = { value: 'frequency.value', event: 'setValueAtTime', lfo: 'setValueAtTime + lfo', 'value+lfo': 'frequency.value + lfo' }[mode];
      console.log(`${wave.padEnd(12)}${label.padEnd(18)}${worst(node).toFixed(2).padStart(8)}${worst(chrome).toFixed(2).padStart(10)}`);
      if (rows) {
        for (let i = 0; i < node.length; i++) {
          console.log(`   start ${node[i]!.start.toFixed(2).padStart(8)} in-quantum ${node[i]!.quantumOffset.toFixed(1).padStart(6)}   node ${node[i]!.error.toFixed(2).padStart(7)}   chromium ${chrome[i]!.error.toFixed(2).padStart(7)}`);
        }
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
