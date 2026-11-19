import type { Niche, ProductKind } from '../content/types';
import type { Content } from './content';
import type { Rng } from './rng';

export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

export function nicheVars(n: Niche): Record<string, string> {
  return {
    Niche: n.plural,
    niche: n.plural.toLowerCase(),
    brand: n.brand,
    pun: n.pun,
    Adj: n.adj,
    adj: n.adj.toLowerCase(),
    Singular: n.singular,
    singular: n.singular.toLowerCase(),
  };
}

/** A product name from a kind's templates, for example "DoggoDo". */
export function productName(rng: Rng, kind: ProductKind, niche: Niche, taken: readonly string[] = []): string {
  const vars = nicheVars(niche);
  for (let i = 0; i < 8; i++) {
    const name = fill(rng.pick(kind.nameTemplates), vars).replace(/\s+/g, ' ').trim();
    if (!taken.includes(name)) return name;
  }
  return fill(rng.pick(kind.nameTemplates), vars) + ' 2';
}

export function personName(rng: Rng, content: Content, pool: readonly string[] = []): string {
  const first = pool.length ? rng.pick(pool) : rng.pick(content.firstNames);
  return `${first} ${rng.pick(content.lastNames)}`;
}

export function companyName(rng: Rng, content: Content): string {
  return rng.pick(content.companyNames);
}
