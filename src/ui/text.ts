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

/** The five skills of a person, spelled out. */
export const SKILL_WORD = { prompt: 'PROMPT', taste: 'TASTE', debug: 'DEBUG', paranoia: 'PARANOIA', hustle: 'HUSTLE' } as const;
