import { describe, expect, it } from 'vitest';
import { tidyName } from './nameText';

describe('tidyName', () => {
  it('leaves plain names alone', () => {
    expect(tidyName('Prompt & Pray Inc.', 22)).toEqual({ name: 'Prompt & Pray Inc.', changed: false });
    expect(tidyName('  Dave  ', 14)).toEqual({ name: 'Dave', changed: false });
    expect(tidyName('Dave   the   Dev', 14)).toEqual({ name: 'Dave the Dev', changed: false });
  });

  it('takes the accent off and says so', () => {
    expect(tidyName('Café Rocket', 22)).toEqual({ name: 'Cafe Rocket', changed: true });
    expect(tidyName('Zoë Müller', 14)).toEqual({ name: 'Zoe Muller', changed: true });
    expect(tidyName('Åsa Ñandú', 14)).toEqual({ name: 'Asa Nandu', changed: true });
  });

  it('spells the letters that do not come apart', () => {
    expect(tidyName('Łukasz Strauß', 22)).toEqual({ name: 'Lukasz Strauss', changed: true });
    expect(tidyName('Søren Æther', 22)).toEqual({ name: 'Soren AEther', changed: true });
  });

  it('keeps an apostrophe a phone keyboard curled, without a word about it', () => {
    expect(tidyName('Dave\u2019s Dev Shop', 22)).toEqual({ name: "Dave's Dev Shop", changed: false });
    expect(tidyName('Vibes \u2014 Inc\u2026', 22)).toEqual({ name: 'Vibes - Inc...', changed: false });
  });

  it('drops emoji and says so', () => {
    expect(tidyName('Rocket 🚀 Labs', 22)).toEqual({ name: 'Rocket Labs', changed: true });
    expect(tidyName('👨‍💻 Dev', 14)).toEqual({ name: 'Dev', changed: true });
  });

  it('gives nothing back when no letter or number is left', () => {
    expect(tidyName('🚀🚀🚀', 22)).toEqual({ name: '', changed: true });
    expect(tidyName('Привет', 14)).toEqual({ name: '', changed: true });
    expect(tidyName('!!!', 14)).toEqual({ name: '', changed: true });
    expect(tidyName('   ', 14)).toEqual({ name: '', changed: true });
  });

  it('writes wide letters as plain ones', () => {
    expect(tidyName('ＶＩＢＥ', 14)).toEqual({ name: 'VIBE', changed: true });
  });

  it('never goes past the length the field allows, even when a spelling is longer than the letter', () => {
    expect(tidyName('SSßßßßßßß', 6).name).toHaveLength(6);
    expect(tidyName('SSßßßßßßß', 6).name.endsWith(' ')).toBe(false);
  });

  it('only gives back characters the font has', () => {
    const out = tidyName('Tëst ✓ ñame ™ \u0000 \u200b ok', 40).name;
    for (const ch of out) expect(ch.charCodeAt(0)).toBeGreaterThanOrEqual(32);
    expect(out).toMatch(/^[\x20-\x7e]+$/);
  });
});
