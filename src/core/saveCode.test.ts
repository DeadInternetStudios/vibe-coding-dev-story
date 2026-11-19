import { describe, expect, it } from 'vitest';
import { FIXTURE } from '../sim/fixtures';
import { playBot } from '../sim/bot';
import { decodeSave, encodeSave } from './saveCode';

describe('save codes', () => {
  const state = playBot(FIXTURE, 5, 'smart').game.snapshot();

  it('round trips a whole run, accents and all', () => {
    const code = encodeSave(state);
    expect(code.startsWith('VCDS1:')).toBe(true);
    expect(code).not.toMatch(/\s/);
    expect(decodeSave(code, FIXTURE)).toEqual(state);
  });

  it('survives being pasted with spaces and line breaks around it', () => {
    const code = encodeSave(state);
    expect(decodeSave(`  ${code.slice(0, 40)}\n${code.slice(40)}  `, FIXTURE)).toEqual(state);
  });

  it('turns away anything that is not a save of this version', () => {
    expect(decodeSave('hello', FIXTURE)).toBeNull();
    expect(decodeSave('VCDS1:not base64 at all', FIXTURE)).toBeNull();
    expect(decodeSave(`VCDS1:${btoa('{"v":999}')}`, FIXTURE)).toBeNull();
    expect(decodeSave(`VCDS1:${btoa('null')}`, FIXTURE)).toBeNull();
    expect(decodeSave(encodeSave({ ...state, staff: 'no' as never }), FIXTURE)).toBeNull();
  });

  it('turns away the codes that broke the game in review: a team with a hole in it, and a save with nothing in it', () => {
    const code = (s: unknown) => `VCDS1:${btoa(JSON.stringify(s))}`;
    expect(decodeSave(code({ v: 1, day: 5, company: 'x', staff: [null], shipped: [] }), FIXTURE)).toBeNull();
    expect(decodeSave(code({ v: 1 }), FIXTURE)).toBeNull();
  });

  it('turns away a code with a string company, a missing company or a team member that is not a person', () => {
    expect(decodeSave(encodeSave({ ...state, company: 'x' as never }), FIXTURE)).toBeNull();
    const { company: _company, ...noCompany } = state;
    expect(decodeSave(encodeSave(noCompany as never), FIXTURE)).toBeNull();
    expect(decodeSave(encodeSave({ ...state, staff: [null as never, ...state.staff] }), FIXTURE)).toBeNull();
  });

  it('turns away a code that is far longer than any save', () => {
    expect(decodeSave(`VCDS1:${'A'.repeat(4_100_000)}`, FIXTURE)).toBeNull();
  });
});
