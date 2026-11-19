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
