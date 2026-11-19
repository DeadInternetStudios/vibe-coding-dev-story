import { describe, expect, it } from 'vitest';
import { CATALOG } from '../../src/art/catalog';
import { checkBackdrop, checkDecor, checkFx, checkIcons, checkLogo, checkPortraits, checkRooms } from './checks';
import type { Finding } from './lint';

const errors = (findings: Finding[]) => findings.filter((f) => f.level === 'error').map((f) => `${f.sprite}: ${f.msg}`);

describe('art rules from docs/art-brief.md', () => {
  it('icons are 8x8 or 12x12, closed, and not twins', () => expect(errors(checkIcons())).toEqual([]));
  it('every shop item has decor that fits its spot', () => expect(errors(checkDecor())).toEqual([]));
  it('portraits are 16x17 and each is its own person', () => expect(errors(checkPortraits())).toEqual([]));
  it('fx are 8x8 or smaller and cover the brief', () => expect(errors(checkFx())).toEqual([]));
  it('the logo is about 190x48', () => expect(errors(checkLogo())).toEqual([]));
  it('rooms match their spec and every wall item can hang', () => expect(errors(checkRooms())).toEqual([]));
  it('the night city fills any screen', () => expect(errors(checkBackdrop())).toEqual([]));

  it('every sprite in the catalog bakes to visible pixels', () => {
    const broken: string[] = [];
    for (const [group, items] of Object.entries(CATALOG)) {
      for (const item of items) {
        const p = item.make();
        const rgba = p.rgba(item.roles);
        let seen = false;
        for (let i = 3; i < rgba.length && !seen; i += 4) seen = rgba[i] !== 0;
        if (rgba.length !== p.w * p.h * 4 || !seen) broken.push(`${group}/${item.name}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
