import { describe, expect, it } from 'vitest';
import { channelRows, channelTextY, MAX_ROW_H, TWO_LINE_ROW_H } from './channelRows';

/** Card heights and list tops the ready card really uses: a phone upright, a phone on its side, a laptop. */
const CARDS = [
  { what: 'phone upright', h: 408, top: 166 },
  { what: 'short phone upright', h: 392, top: 166 },
  { what: 'phone on its side', h: 220, top: 32 },
  { what: 'laptop', h: 258, top: 32 },
  { what: 'tablet on its side', h: 258, top: 32 },
];

describe('the channel list on the ready card', () => {
  it.each(CARDS)('$what: the last row ends above the LAUNCH button (which starts 25 from the bottom)', ({ h, top }) => {
    const { rowH } = channelRows(h, top, 8);
    expect(top + rowH * 8).toBeLessThanOrEqual(h - 25);
    expect(rowH).toBeLessThanOrEqual(MAX_ROW_H);
  });

  it.each(CARDS)('$what: a stacked note never reaches the bevel of its row', ({ h, top }) => {
    const { rowH, inline } = channelRows(h, top, 8);
    const textY = channelTextY(rowH, inline);
    const buttonInnerBottom = rowH - 1 - 2;
    if (inline) {
      // one line of 8 pixels, centred, with air above and below
      expect(textY).toBeGreaterThanOrEqual(2);
      expect(textY + 8).toBeLessThanOrEqual(buttonInnerBottom);
    } else {
      // name, a pixel, note: 17 pixels of text
      expect(textY + 9 + 8).toBeLessThanOrEqual(buttonInnerBottom);
    }
  });

  it('a phone on its side has no room for two lines, so the note goes beside the name', () => {
    expect(channelRows(220, 32, 8).inline).toBe(true);
  });

  it('the laptop and the phone upright keep the note under the name', () => {
    expect(channelRows(258, 32, 8).inline).toBe(false);
    expect(channelRows(408, 166, 8).inline).toBe(false);
  });

  it('the cut between the two looks is the row height the note needs', () => {
    expect(channelRows(220, 32, 8).rowH).toBeLessThan(TWO_LINE_ROW_H);
    expect(channelRows(258, 32, 8).rowH).toBeGreaterThanOrEqual(TWO_LINE_ROW_H);
  });
});
