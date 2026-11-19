import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VERSION, VOICES_HEARD_BY } from './version';

describe('version', () => {
  it('is the version in package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(VERSION).toBe(pkg.version);
  });

  it('says the same about who heard the voices as the README does', () => {
    const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
    const line = /Voices heard end to end by: (.+?)\.\s*$/m.exec(readme);
    expect(line, 'README.md has no "Voices heard end to end by:" line').not.toBeNull();
    expect(line![1]).toBe(VOICES_HEARD_BY ?? 'nobody yet');
  });
});
