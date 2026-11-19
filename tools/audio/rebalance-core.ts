/**
 * The pure part of tools/audio/rebalance.ts: multiply the `vol` of named tracks in a
 * song's source text. No file or process access, so the tests can feed it strings.
 */

export interface LayerChange {
  layer: string;
  /** Factor to multiply the track's vol by. */
  change: number;
}

export interface VolEdit {
  layer: string;
  /** vol before; 1 when the track had none (the compiler's default) */
  from: number;
  to: number;
}

/** Factors closer to 1 than this are left alone, so running the tool twice changes nothing the second time. */
export const MIN_CHANGE = 0.03;
/** One pass never moves a layer further than this, a bigger ask means the layer itself is wrong. */
export const CHANGE_LIMITS = [0.2, 5] as const;

const round2 = (x: number): number => Math.round(x * 100) / 100;

/**
 * Every `{ ... }` in the source as [open, close] indexes, skipping braces inside
 * strings and comments. Song files hold plain object literals, so this is enough.
 */
export function objectRanges(src: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const stack: number[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? src.length : end + 2;
    } else if (c === "'" || c === '"' || c === '`') {
      i++;
      while (i < src.length && src[i] !== c) i += src[i] === '\\' ? 2 : 1;
      i++;
    } else {
      if (c === '{') stack.push(i);
      else if (c === '}') {
        const open = stack.pop();
        if (open !== undefined) out.push([open, i]);
      }
      i++;
    }
  }
  return out;
}

/** The smallest object literal that contains `index`. */
function enclosing(ranges: Array<[number, number]>, index: number): [number, number] | undefined {
  let best: [number, number] | undefined;
  for (const r of ranges) {
    if (r[0] < index && index < r[1] && (!best || r[1] - r[0] < best[1] - best[0])) best = r;
  }
  return best;
}

function applyOne(source: string, layer: string, factor: number): { source: string; edit: VolEdit } {
  const idRe = new RegExp(`\\bid:\\s*'${layer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}',?`, 'g');
  const hits = [...source.matchAll(idRe)];
  if (hits.length !== 1) throw new Error(`rebalance: expected exactly one track with id '${layer}', found ${hits.length}`);
  const hit = hits[0]!;
  const at = hit.index!;
  const range = enclosing(objectRanges(source), at);
  if (!range) throw new Error(`rebalance: track '${layer}' is not inside an object literal`);

  const body = source.slice(range[0], range[1] + 1);
  const volRe = /\bvol:\s*(-?\d*\.?\d+)/;
  const vol = volRe.exec(body);
  if (vol) {
    const from = Number(vol[1]);
    const to = round2(from * factor);
    const start = range[0] + vol.index + vol[0].length - vol[1]!.length;
    return { source: source.slice(0, start) + String(to) + source.slice(start + vol[1]!.length), edit: { layer, from, to } };
  }

  const to = round2(factor);
  const afterId = at + hit[0].length;
  const withComma = hit[0].endsWith(',') ? '' : ',';
  const lineStart = source.lastIndexOf('\n', at) + 1;
  const indent = /^\s*/.exec(source.slice(lineStart, at))![0];
  const multiLine = source[afterId] === '\n';
  const insert = multiLine ? `${withComma}\n${indent}vol: ${to},` : `${withComma} vol: ${to},`;
  return { source: source.slice(0, afterId) + insert + source.slice(afterId), edit: { layer, from: 1, to } };
}

/** Multiply each named track's vol (adding one where missing). Throws if a layer is not exactly one track. */
export function rewriteVols(source: string, changes: readonly LayerChange[]): { source: string; edits: VolEdit[] } {
  let text = source;
  const edits: VolEdit[] = [];
  for (const { layer, change } of changes) {
    if (!Number.isFinite(change) || change <= 0) throw new Error(`rebalance: bad factor ${change} for '${layer}'`);
    const factor = Math.min(CHANGE_LIMITS[1], Math.max(CHANGE_LIMITS[0], change));
    if (Math.abs(factor - 1) < MIN_CHANGE) continue;
    const r = applyOne(text, layer, factor);
    text = r.source;
    edits.push(r.edit);
  }
  return { source: text, edits };
}
