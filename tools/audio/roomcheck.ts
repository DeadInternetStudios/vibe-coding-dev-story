/**
 * Does the audition page come up whole? Loads tools/audio/room.html in a muted headless
 * Chromium and checks: no page error, one button per sound effect and per song, and not a
 * single AudioContext created before anyone presses Start.
 *
 *   npx tsx tools/audio/roomcheck.ts
 *
 * QUIET MACHINE: an init script swaps AudioContext for a trap that throws, so even a bug in
 * the page cannot open an audio device. Nothing on the page is ever clicked.
 */
import { SoundEngine } from '../../src/audio/engine';
import { withChromiumPage } from './chromium';

interface Found {
  sfxButtons: number;
  musicButtons: number;
  sfxIds: string[];
  musicIds: string[];
  contextsTried: number;
  stateText: string;
  startLabel: string;
}

async function main(): Promise<void> {
  const found = await withChromiumPage(
    (page) =>
      page.evaluate(
        () => {
          const ids = (attr: string): string[] => [...document.querySelectorAll<HTMLElement>(`button[data-${attr}]`)].map((b) => b.dataset[attr]!);
          const sfxIds = ids('sfx');
          const musicIds = ids('music');
          return {
            sfxButtons: sfxIds.length,
            musicButtons: musicIds.length,
            sfxIds,
            musicIds,
            contextsTried: (window as unknown as { __audioContextsTried: number }).__audioContextsTried,
            stateText: document.getElementById('state')?.textContent ?? '',
            startLabel: document.getElementById('start')?.textContent ?? '',
          };
        },
        undefined,
      ) as Promise<Found>,
    {
      path: 'tools/audio/room.html',
      initScript: () => {
        const w = window as unknown as Record<string, unknown>;
        w.__audioContextsTried = 0;
        const trap = function (): never {
          w.__audioContextsTried = (w.__audioContextsTried as number) + 1;
          throw new Error('QUIET MACHINE: an AudioContext was created');
        };
        w.AudioContext = trap;
        w.webkitAudioContext = trap;
      },
      ready: () => document.querySelectorAll('button[data-sfx]').length > 0 && document.querySelectorAll('button[data-music]').length > 0,
    },
  );

  const wantSfx = SoundEngine.SFX.map((s) => s.id);
  const wantMusic = SoundEngine.MUSIC.map((m) => m.id);
  const problems: string[] = [];
  const diff = (a: string[], b: string[]): string[] => a.filter((x) => !b.includes(x));
  if (found.contextsTried !== 0) problems.push(`${found.contextsTried} AudioContext(s) were created on load`);
  if (diff(wantSfx, found.sfxIds).length || diff(found.sfxIds, wantSfx).length) problems.push(`sfx buttons differ: missing ${diff(wantSfx, found.sfxIds)}, extra ${diff(found.sfxIds, wantSfx)}`);
  if (diff(wantMusic, found.musicIds).length || diff(found.musicIds, wantMusic).length) problems.push(`song buttons differ: missing ${diff(wantMusic, found.musicIds)}, extra ${diff(found.musicIds, wantMusic)}`);
  if (new Set(found.sfxIds).size !== found.sfxIds.length) problems.push('duplicate sfx buttons');

  console.log(`room.html: ${found.sfxButtons} sound effect buttons, ${found.musicButtons} song buttons, ${found.contextsTried} audio contexts created, start button reads "${found.startLabel}", state "${found.stateText}"`);
  if (problems.length) {
    for (const p of problems) console.error(`PROBLEM: ${p}`);
    process.exit(1);
  }
  console.log('ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
