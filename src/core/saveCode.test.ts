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
    expect(decodeSave(code)).toEqual(state);
  });

  it('survives being pasted with spaces and line breaks around it', () => {
    const code = encodeSave(state);
    expect(decodeSave(`  ${code.slice(0, 40)}\n${code.slice(40)}  `)).toEqual(state);
  });

  it('turns away anything that is not a save of this version', () => {
    expect(decodeSave('hello')).toBeNull();
    expect(decodeSave('VCDS1:not base64 at all')).toBeNull();
    expect(decodeSave(`VCDS1:${btoa('{"v":999}')}`)).toBeNull();
    expect(decodeSave(`VCDS1:${btoa('null')}`)).toBeNull();
    expect(decodeSave(encodeSave({ ...state, staff: 'no' as never }))).toBeNull();
  });
});
