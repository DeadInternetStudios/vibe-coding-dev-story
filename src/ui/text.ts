/** The longest start of the text that fits `max` characters, ending in three dots. Used for names in tight rows. */
export function fit(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, Math.max(1, max - 3)).replace(/[\s,;:.\-]+$/, '');
  return `${head}...`;
}
