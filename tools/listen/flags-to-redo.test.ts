import { describe, expect, it } from 'vitest';
import { parseFlags, planRedo, renderCommand, report, type Flag } from './flags-to-redo';

const flag = (clip: string, over: Partial<Flag> = {}): Flag => ({ clip, voice: clip.split('-')[0] ?? '', text: `text of ${clip}`, reasons: ['wrong stress'], note: '', ...over });
const manifest = Object.fromEntries(['dave-1', 'dave-2', 'clod-1', 'bro-1'].map((id) => [id, { voice: id.split('-')[0] ?? '', text: `text of ${id}` }]));
const listed = { 'lines.json': new Set(['dave-1', 'dave-2', 'clod-1']), 'lines.seed.json': new Set(['dave-1']), 'lines.extra.json': new Set(['bro-1']) };

describe('parseFlags', () => {
  it('reads what the page exports', () => {
    const text = JSON.stringify([{ clip: 'dave-1', voice: 'dave', text: 'Hi', reasons: ['cut off'], note: 'ends early' }]);
    expect(parseFlags(text)).toEqual({ flags: [{ clip: 'dave-1', voice: 'dave', text: 'Hi', reasons: ['cut off'], note: 'ends early' }], problems: [] });
  });

  it('lists a clip once and names entries it cannot use', () => {
    const { flags, problems } = parseFlags(JSON.stringify([{ clip: 'dave-1' }, { clip: 'dave-1', note: 'again' }, { voice: 'dave' }]));
    expect(flags.map((f) => f.clip)).toEqual(['dave-1']);
    expect(problems).toEqual(['Entry 3 has no "clip".']);
  });

  it('says so when the file is not a list or not JSON', () => {
    expect(parseFlags('{"a":1}').problems[0]).toMatch(/should be a list/);
    expect(parseFlags('][').problems).toEqual(['The file is not valid JSON.']);
  });
});

describe('planRedo', () => {
  const plan = planRedo([flag('dave-1'), flag('clod-1'), flag('bro-1'), flag('ghost-1'), flag('dave-2', { text: 'old words' })], { ...manifest, 'bro-1': { voice: 'bro', text: 'text of bro-1' } }, { ...listed, 'lines.extra.json': new Set<string>() });

  it('sorts flags into what generate.py can redo and what it cannot', () => {
    expect(plan.redoable.map((f) => f.clip)).toEqual(['dave-1', 'clod-1', 'dave-2']);
    expect(plan.notListed.map((f) => f.clip)).toEqual(['bro-1']);
    expect(plan.unknown.map((f) => f.clip)).toEqual(['ghost-1']);
    expect(plan.changedText.map((f) => f.clip)).toEqual(['dave-2']);
  });

  it('passes the fewest lines files that list every id', () => {
    expect(plan.files).toEqual(['lines.json']);
    const extra = planRedo([flag('dave-1'), flag('bro-1')], manifest, listed);
    expect(extra.files).toEqual(['lines.json', 'lines.extra.json']);
  });

  it('counts by voice and by reason', () => {
    const p = planRedo([flag('dave-1', { reasons: ['cut off', 'wrong stress'] }), flag('dave-2'), flag('clod-1', { reasons: [] })], manifest, listed);
    expect(p.byVoice).toEqual([['dave', 2], ['clod', 1]]);
    expect(p.byReason).toEqual([['wrong stress', 2], ['cut off', 1], ['no reason given', 1]]);
  });
});

describe('renderCommand', () => {
  const plan = planRedo([flag('dave-1'), flag('clod-1')], manifest, listed);

  it('names every id with --redo-id and the lines files', () => {
    expect(renderCommand(plan, false)).toBe('.venv/bin/python generate.py --lines lines.json --redo-id dave-1 --redo-id clod-1');
  });

  it('adds --dry-run, which loads no model', () => {
    expect(renderCommand(plan, true)).toMatch(/ --dry-run$/);
  });
});

describe('report', () => {
  const plan = planRedo([flag('dave-1'), flag('bro-1')], manifest, { ...listed, 'lines.extra.json': new Set<string>() });
  const text = report(plan, { venvExists: true }).join('\n');

  it('shows the commands to run in tools/tts', () => {
    expect(text).toContain('cd tools/tts');
    expect(text).toContain('--redo-id dave-1');
    expect(text).not.toContain('setup.sh');
  });

  it('says that --redo-id replays the same seeds, so the same take is expected', () => {
    expect(text).toMatch(/replays the seeds/);
    expect(text).toMatch(/same take/);
  });

  it('names the clips it cannot redo, and the routes that do change a take', () => {
    expect(text).toContain('Cannot be re-rendered by id (1): bro-1');
    expect(text).toContain('Wrong stress: ');
  });

  it('points to setup.sh when there is no venv, and has nothing to say about an empty file', () => {
    expect(report(plan, { venvExists: false }).join('\n')).toContain('./setup.sh');
    expect(report(planRedo([], manifest, listed), { venvExists: true })).toEqual(['Nothing is flagged in that file. There is nothing to re-render.']);
  });
});
