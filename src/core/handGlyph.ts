/**
 * A letter drawn by hand, for the ones a web font cannot draw at a small size: rows of # and . joined with "/".
 * It keeps the height of the letter it replaces and may have its own width, so an m can have room for three strokes.
 * Null when the rows do not make a letter of that height, and the font's own drawing stays.
 */
export function handGlyph(rows: string | undefined, height: number): { w: number; bits: Uint8Array } | null {
  if (!rows) return null;
  const lines = rows.split('/');
  const w = lines[0]!.length;
  if (w === 0 || lines.length !== height || lines.some((row) => row.length !== w || /[^#.]/.test(row))) return null;
  const bits = new Uint8Array(w * height);
  lines.forEach((row, y) => [...row].forEach((cell, x) => (bits[y * w + x] = cell === '#' ? 1 : 0)));
  return { w, bits };
}
