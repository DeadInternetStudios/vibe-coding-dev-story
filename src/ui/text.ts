/** The longest start of the text that fits `max` characters, ending in three dots. Used for names in tight rows. */
export function fit(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, Math.max(1, max - 3)).replace(/[\s,;:.\-]+$/, '');
  return `${head}...`;
}

/** The five stats in words. Short enough for a bar row, long enough to say what they are. */
export const STAT_WORD = { vibes: 'VIBES', features: 'FEATURES', polish: 'POLISH', stability: 'STABILITY', security: 'SECURITY' } as const;
/** The same, trimmed to seven letters for narrow rows. */
export const STAT_WORD_7 = { vibes: 'VIBES', features: 'FEATURE', polish: 'POLISH', stability: 'STABLE', security: 'SECURE' } as const;

/** What a kind of app pays, as a word. Its money number runs from 2 to 10, and a row of dollar signs never said how far apart the steps are. */
export function payWord(money: number): string {
  if (money <= 2) return 'PEANUTS';
  if (money <= 4) return 'A BIT';
  if (money <= 6) return 'OK';
  if (money <= 8) return 'WELL';
  return 'HUGE';
}

/** The five skills of a person, spelled out. */
export const SKILL_WORD = { prompt: 'PROMPT', taste: 'TASTE', debug: 'DEBUG', paranoia: 'PARANOIA', hustle: 'HUSTLE' } as const;
