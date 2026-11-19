/** One bar of rests, 16 steps. */
export const R16 = '. . . . . . . . . . . . . . . .';

/** A token held for `steps` steps: hold('C4', 4) is "C4 - - -". */
export function hold(token: string, steps: number): string {
  return [token, ...Array.from({ length: steps - 1 }, () => '-')].join(' ');
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
