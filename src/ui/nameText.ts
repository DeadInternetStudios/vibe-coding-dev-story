/**
 * The pixel fonts draw plain ASCII and nothing else, so a name with an accent or an emoji in it would lose those
 * letters without a word. This turns what a player typed into what the font can show.
 */

/** Curly quotes and long dashes that phone keyboards put in by themselves. Swapped for their plain twin, and not worth a word. */
const TYPOGRAPHY: Record<string, string> = {
  '\u2018': "'",
  '\u2019': "'",
  '\u201B': "'",
  '\u2032': "'",
  '\u201C': '"',
  '\u201D': '"',
  '\u201E': '"',
  '\u2033': '"',
  '\u2010': '-',
  '\u2011': '-',
  '\u2013': '-',
  '\u2014': '-',
  '\u2212': '-',
  '\u2026': '...',
};

/** Letters that do not come apart into a plain letter and a mark, with the plain letters they are written as. */
const WHOLE_LETTERS: Record<string, string> = {
  ß: 'ss',
  Æ: 'AE',
  æ: 'ae',
  Œ: 'OE',
  œ: 'oe',
  Ø: 'O',
  ø: 'o',
  Ł: 'L',
  ł: 'l',
  Đ: 'D',
  đ: 'd',
  Ð: 'D',
  ð: 'd',
  Þ: 'Th',
  þ: 'th',
  ı: 'i',
};

export interface TidyName {
  /** what the font can draw, empty when nothing usable is left */
  name: string;
  /** true when the player will see something other than what they typed */
  changed: boolean;
}

/** Accents come off (é is e), the few letters with their own shape get plain spellings, anything else the font cannot draw goes. */
export function tidyName(typed: string, maxLen: number): TidyName {
  const asTyped = [...typed]
    .map((ch) => TYPOGRAPHY[ch] ?? ch)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  let plain = '';
  for (const ch of asTyped.normalize('NFKD')) {
    if (/\p{M}/u.test(ch)) continue;
    const code = ch.codePointAt(0)!;
    plain += code >= 32 && code <= 126 ? ch : (WHOLE_LETTERS[ch] ?? '');
  }
  const name = plain.replace(/\s+/g, ' ').trim().slice(0, maxLen).trim();
  const usable = /[A-Za-z0-9]/.test(name);
  return { name: usable ? name : '', changed: !usable || name !== asTyped };
}
