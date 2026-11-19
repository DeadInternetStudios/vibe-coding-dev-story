/** Quick timing probe: how long does it take to render N seconds of a song offline? */
import { OfflineAudioContext } from 'node-web-audio-api';
import { renderJob, type OfflineCtor } from './job';

const seconds = Number(process.argv[3] ?? 10);
const id = (process.argv[2] ?? 'office') as 'office';
const t0 = Date.now();
const r = await renderJob(OfflineAudioContext as unknown as OfflineCtor, { kind: 'music', id, seconds }, 48000, 1);
let peak = 0;
for (const v of r.left) peak = Math.max(peak, Math.abs(v));
console.log(`${id} ${seconds}s of audio rendered in ${((Date.now() - t0) / 1000).toFixed(2)}s (peak ${peak.toFixed(3)})`);
