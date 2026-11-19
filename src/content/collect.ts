import { isVoiceLine, type VoiceLine } from './vo';

/** Walk any content value and pull out every voiced line, once per id. */
export function collectVoiceLines(root: unknown): VoiceLine[] {
  const found = new Map<string, VoiceLine>();
  const seen = new Set<object>();
  const visit = (v: unknown) => {
    if (typeof v !== 'object' || v === null) return;
    if (seen.has(v)) return;
    seen.add(v);
    if (isVoiceLine(v)) {
      found.set(v.id, v);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) visit(x);
      return;
    }
    for (const x of Object.values(v)) visit(x);
  };
  visit(root);
  return [...found.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}
