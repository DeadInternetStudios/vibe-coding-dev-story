/**
 * Do node-web-audio-api and the browser play the synth's waves at the same level?
 * Renders each wave at a few pitches, alone, on both backends and prints peak and
 * RMS side by side. Exits 1 if a synth wave differs by more than TOLERANCE_DB in RMS
 * (the native rows are information only: they are the backends' own built ins).
 *
 *   npx tsx tools/audio/waveprobe.ts
 *
 * QUIET MACHINE: OfflineAudioContext only, and Chromium runs muted.
 */
import { OfflineAudioContext as NodeOfflineAudioContext } from 'node-web-audio-api';
import { withChromiumPage } from './chromium';
import type { OfflineCtor } from './job';
import { probeWaves, type WaveRow } from './probe-core';

/** Band limiting a browser applies at high pitch costs a pulse about 0.3 dB. Anything beyond is a real difference. */
const TOLERANCE_DB = 0.6;

const db = (x: number): number => 20 * Math.log10(Math.max(x, 1e-9));

async function main(): Promise<void> {
  const node = await probeWaves(NodeOfflineAudioContext as unknown as OfflineCtor);
  const chrome = await withChromiumPage((page) =>
    page.evaluate(() => (window as unknown as { __probeWaves: () => Promise<WaveRow[]> }).__probeWaves(), undefined),
  );
  let bad = 0;
  console.log('wave            Hz | node peak    rms | chrome peak    rms | chrome - node (dB): peak    rms');
  for (const a of node) {
    const b = chrome.find((r) => r.wave === a.wave && r.hz === a.hz)!;
    const dRms = db(b.rms) - db(a.rms);
    const synth = !a.wave.startsWith('native:');
    const flag = synth && Math.abs(dRms) > TOLERANCE_DB ? '  <-- DIFFERS' : '';
    if (flag) bad++;
    console.log(
      `${a.wave.padEnd(16)}${String(a.hz).padStart(4)} | ${a.peak.toFixed(3).padStart(9)} ${a.rms.toFixed(3).padStart(6)} | ${b.peak.toFixed(3).padStart(10)} ${b.rms.toFixed(3).padStart(6)} | ${(db(b.peak) - db(a.peak)).toFixed(2).padStart(23)} ${dRms.toFixed(2).padStart(6)}${flag}`,
    );
  }
  if (bad) {
    console.error(`\n${bad} synth wave(s) differ by more than ${TOLERANCE_DB} dB between node and the browser`);
    process.exit(1);
  }
  console.log(`\nall synth waves agree within ${TOLERANCE_DB} dB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
