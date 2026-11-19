import { describe, expect, it } from 'vitest';
import { firstSentence, renderSpotPage } from './spot';
import { parseSeedLines, pickSpotClips, spotLine } from './spot-model';
import type { Manifest } from './tiers';

const line = (voice: string, text: string, dur: number) => ({ voice, text, file: `${voice}-${text.length}-${dur}.mp3`, dur, env: '' });

const manifest: Manifest = {
  version: 1,
  voices: { clod: { name: 'Clod' }, dave: { name: 'Dave' }, duck: { name: 'Duck' } },
  lines: {
    'clod-a': line('clod', 'Great catch!', 1.2),
    'clod-b': line('clod', 'You are absolutely right!', 2.4),
    'clod-c': line('clod', 'Done! All tests are passing. I may have deleted a few of the tests.', 5.9),
    'clod-d': line('clod', 'Here is a long speech about nothing in particular, for a good while.', 11.5),
    'dave-a': line('dave', 'Did anyone actually read the diff?', 3.6),
    'dave-b': line('dave', 'It works on my machine.', 4.4),
    'duck-a': line('duck', 'Quack.', 0.9),
    'duck-b': line('duck', 'Quack? Quack quack.', 1.7),
  },
};

describe('seed lines', () => {
  it('reads the lines under each voice and drops the delivery note', () => {
    const md = '# Cast seed\n\n## clod\nYour AI pair programmer.\n- You\'re absolutely right! [bright, instantly agreeable]\n- Great catch!\n\n## dave\nSenior developer.\n- Did anyone actually read the diff? [deadpan]\n';
    expect(parseSeedLines(md)).toEqual({ clod: ["You're absolutely right!", 'Great catch!'], dave: ['Did anyone actually read the diff?'] });
  });
});

describe('the spot check picks', () => {
  const seed = { clod: ['Great catch!', 'Done! All tests are passing. I may have deleted a few of the tests.'], dave: ['It works on my machine.'] };

  it('takes one clip for every voice, in the manifest voice order', () => {
    expect(pickSpotClips(manifest, seed).map((p) => p.voice)).toEqual(['clod', 'dave', 'duck']);
  });

  it('prefers a clip of a good length, then a seed line, over a seed line that is too short or too long', () => {
    const picks = pickSpotClips(manifest, seed);
    expect(picks.find((p) => p.voice === 'clod')?.id).toBe('clod-c');
    expect(picks.find((p) => p.voice === 'dave')?.id).toBe('dave-b');
  });

  it('still gives a voice whose clips are all short its clip closest to the ideal length', () => {
    expect(pickSpotClips(manifest, seed).find((p) => p.voice === 'duck')?.id).toBe('duck-b');
  });

  it('gives the same picks every time', () => {
    expect(pickSpotClips(manifest, seed)).toEqual(pickSpotClips(manifest, seed));
  });
});

describe('the sign-off line', () => {
  it('says who, when, how many and what is flagged', () => {
    expect(spotLine(' Sam ', '2026-11-19', 20, { ok: 20, flagged: 0, open: 0 }, [])).toBe('Voices spot-checked by Sam on 2026-11-19: 20 clips, one per voice, none flagged.');
    expect(spotLine('', '2026-11-19', 20, { ok: 18, flagged: 2, open: 0 }, ['Dave', 'Duck'])).toBe('Voices spot-checked by <your name> on 2026-11-19: 20 clips, one per voice, 2 flagged (Dave, Duck).');
  });
});

describe('the page', () => {
  const picks = pickSpotClips(manifest, {});
  const html = renderSpotPage(picks, { clod: { role: 'AI pair programmer', description: 'A warm voice. Smooth and bright.' } });

  it('lists every clip with controls and plays nothing by itself', () => {
    for (const p of picks) expect(html).toContain(`src="../public/audio/vo/${p.file}"`);
    expect(html.match(/<audio controls preload="none"/g)).toHaveLength(picks.length);
    expect(html).not.toMatch(/autoplay/i);
    expect(html).not.toMatch(/\.play\(/);
  });

  it('says what a voice is meant to sound like, in its first sentence only', () => {
    expect(html).toContain('Meant to sound like: A warm voice.');
    expect(html).not.toContain('Smooth and bright.');
    expect(firstSentence('One. Two.')).toBe('One.');
  });

  it('carries its data as safe JSON and has no timestamp, so the same inputs give the same file', () => {
    const data = /<script type="application\/json" id="spot-data">(.*?)<\/script>/s.exec(html)?.[1] ?? '';
    expect(JSON.parse(data).picks).toHaveLength(picks.length);
    expect(renderSpotPage(picks, {})).toBe(renderSpotPage(picks, {}));
  });
});
