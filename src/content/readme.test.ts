import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as content from './index';

describe('the readme', () => {
  it('counts the spoken lines the game really has', () => {
    const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
    const said = Number(/\*\*(\d+) spoken lines\*\*/.exec(readme)?.[1]);
    expect(said).toBe(content.collectVoiceLines(content).length);
  });
});
