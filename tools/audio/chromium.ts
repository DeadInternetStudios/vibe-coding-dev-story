/**
 * Render jobs in headless Chromium, on the browser's own OfflineAudioContext.
 *
 * Why: the game runs in a browser, so Chrome's audio stack is the ground truth for
 * loudness and tone. The node backend (node-web-audio-api) is what the analysis runs
 * on day to day because it needs nothing installed; this backend is how we check that
 * the two agree (see tools/audio/crosscheck.py).
 *
 * QUIET MACHINE: Chromium is launched muted (--mute-audio) and the page only ever
 * constructs OfflineAudioContext. Nothing here can reach a speaker.
 *
 * Playwright is not a dependency of the repo. It is read from the 100x install
 * (~/.100x, override with PLAYWRIGHT_HOME), which also holds the browsers.
 */
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import type { RenderJob, RenderResult } from './job';
import type { WireResult } from './offline-page';

/** The slice of Playwright this file uses, so no types package is needed. */
interface PwPage {
  goto(url: string): Promise<unknown>;
  waitForFunction(fn: () => unknown, arg?: unknown, opts?: { timeout?: number }): Promise<unknown>;
  evaluate<R, A>(fn: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
  on(event: 'console', cb: (msg: { type(): string; text(): string }) => void): void;
  on(event: 'pageerror', cb: (err: Error) => void): void;
}
interface PwBrowser {
  newPage(): Promise<PwPage>;
  close(): Promise<void>;
}
interface Playwright {
  chromium: { launch(opts: { headless: boolean; args: string[] }): Promise<PwBrowser> };
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function loadPlaywright(): Playwright {
  const home = process.env.PLAYWRIGHT_HOME ?? resolve(homedir(), '.100x');
  try {
    return createRequire(resolve(home, 'package.json'))('playwright') as Playwright;
  } catch (e) {
    throw new Error(`playwright not found under ${home} (set PLAYWRIGHT_HOME). ${e instanceof Error ? e.message : e}`);
  }
}

function decode(b64: string): Float32Array {
  const bytes = Buffer.from(b64, 'base64');
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

/**
 * Open tools/audio/offline.html in a muted headless Chromium served by a throwaway
 * Vite server, hand the page to `fn`, and clean up whatever happens.
 */
export async function withChromiumPage<T>(fn: (page: PwPage) => Promise<T>): Promise<T> {
  const pw = loadPlaywright();
  // The page has no dependencies, so skip Vite's scan (it would pre-bundle Phaser for the game's index.html).
  const server = await createServer({
    root: ROOT,
    configFile: false,
    logLevel: 'error',
    appType: 'mpa',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { host: '127.0.0.1', port: 5199, strictPort: false },
  });
  await server.listen();
  const base = server.resolvedUrls?.local[0];
  if (!base) throw new Error('the Vite server did not report a url');

  const browser = await pw.chromium.launch({ headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => {
      throw new Error(`page error: ${e.message}`);
    });
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') console.warn(`[chromium ${m.type()}] ${m.text()}`);
    });
    await page.goto(new URL('tools/audio/offline.html', base).href);
    await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 120_000 });
    return await fn(page);
  } finally {
    await browser.close();
    await server.close();
  }
}

export async function renderInChromium(jobs: RenderJob[], sampleRate: number, seed: number): Promise<RenderResult[]> {
  return withChromiumPage(async (page) => {
    const results: RenderResult[] = [];
    for (const job of jobs) {
      const wire = await page.evaluate(
        (a) => (window as unknown as { __renderJob: (j: RenderJob, sr: number, s: number) => Promise<WireResult> }).__renderJob(a.job, a.sampleRate, a.seed),
        { job, sampleRate, seed },
      );
      results.push({ ...wire, left: decode(wire.left), right: decode(wire.right) });
    }
    return results;
  });
}
