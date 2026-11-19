/** One bar of rests, 16 steps. */
export const R16 = '. . . . . . . . . . . . . . . .';

/** A token held for `steps` steps: hold('C4', 4) is "C4 - - -". */
export function hold(token: string, steps: number): string {
  return [token, ...Array.from({ length: steps - 1 }, () => '-')].join(' ');
}

/**
 * A bar of rests with tokens at the given steps (0 based), so sparse patterns
 * cannot be miscounted: place({ 4: 'x', 12: 'x' }) is a backbeat.
 */
export function place(at: Readonly<Record<number, string>>, steps = 16): string {
  const bar = Array.from({ length: steps }, () => '.');
  for (const [k, token] of Object.entries(at)) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0 || i >= steps) throw new Error(`audio: place() step ${k} is outside 0..${steps - 1}`);
    bar[i] = token;
  }
  return bar.join(' ');
}

/**
 * A melodic bar written as onsets only. Every note is held until the next onset
 * (the last one to the end of the bar); a "." token cuts the note before it and
 * rests until the next onset. Steps before the first onset are rests.
 *
 *   phrase({ 0: 'G5', 3: 'Bb5', 6: 'D6', 8: 'Eb6', 12: '.' })
 *   -> "G5 - - Bb5 - - D6 - Eb6 - - - . . . ."
 */
export function phrase(onsets: Readonly<Record<number, string>>, steps = 16): string {
  const starts = Object.keys(onsets)
    .map(Number)
    .sort((a, b) => a - b);
  const bar = Array.from({ length: steps }, () => '.');
  starts.forEach((start, i) => {
    if (!Number.isInteger(start) || start < 0 || start >= steps) throw new Error(`audio: phrase() step ${start} is outside 0..${steps - 1}`);
    const token = onsets[start]!;
    bar[start] = token;
    if (token === '.') return;
    const end = i + 1 < starts.length ? starts[i + 1]! : steps;
    for (let s = start + 1; s < end; s++) bar[s] = '-';
  });
  return bar.join(' ');
}

/** `n` copies of a bar. */
export function rep(bar: string, n: number): string[] {
  return Array.from({ length: n }, () => bar);
}

/** Join bars and lists of bars into one flat list. */
export function cat(...parts: ReadonlyArray<string | readonly string[]>): string[] {
  return parts.flatMap((p) => (typeof p === 'string' ? [p] : [...p]));
}

/** `n` bars of rests. */
export function rests(n: number): string[] {
  return rep(R16, n);
}

/** Every block of 8 bars is seven bars of `normal` and one closing bar of `fill`. */
export function every8(normal: string, fill: string, blocks: number): string[] {
  return Array.from({ length: blocks }, () => [...rep(normal, 7), fill]).flat();
}

/** Every block of 4 bars is three bars of `normal` and one closing bar of `fill`. */
export function every4(normal: string, fill: string, blocks: number): string[] {
  return Array.from({ length: blocks }, () => [...rep(normal, 3), fill]).flat();
}
