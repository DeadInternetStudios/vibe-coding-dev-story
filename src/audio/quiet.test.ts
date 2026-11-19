import { OfflineAudioContext as NodeOfflineAudioContext } from 'node-web-audio-api';
import { describe, expect, it } from 'vitest';
import { quietRun, silentSink } from './quiet';

/** The loudest sample that comes out of the speakers when a 440 Hz tone is wired to `output`. */
async function loudest(output: (ctx: BaseAudioContext) => AudioNode): Promise<number> {
  const ctx = new NodeOfflineAudioContext(1, 4800, 48000) as unknown as OfflineAudioContext;
  const tone = ctx.createOscillator();
  tone.frequency.value = 440;
  tone.connect(output(ctx));
  tone.start();
  const heard = (await ctx.startRendering()).getChannelData(0);
  return heard.reduce((peak, v) => Math.max(peak, Math.abs(v)), 0);
}

describe('test runs are silent', () => {
  it('a tone wired straight to the speakers is loud, so the silent output below is a real test', async () => {
    expect(await loudest((ctx) => ctx.destination)).toBeGreaterThan(0.5);
  });

  it('the silent output lets nothing reach the speakers', async () => {
    expect(await loudest((ctx) => silentSink(ctx))).toBe(0);
  });

  it.each([
    ['a person playing', '', false, false],
    ['a person with a setting in the link', '?off=keys', false, false],
    ['a debug link', '?debug=1', false, true],
    ['a bare debug link', '?debug', false, true],
    ['a demo link', '?demo=thread&seed=7&notut=1', false, true],
    ['a scene link', '?scene=Ending', false, true],
    ['a person who asks to hear a test link', '?demo=thread&debug=1&sound=1', false, false],
    ['a sound switch set to anything but 1', '?debug=1&sound=0', false, true],
    ['automation on a plain link', '', true, true],
    ['automation that asks for sound', '?debug=1&sound=1', true, true],
  ])('%s', (_who, search, automated, quiet) => {
    expect(quietRun(search, automated)).toBe(quiet);
  });
});
